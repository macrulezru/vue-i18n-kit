<script setup lang="ts">
import { computed } from 'vue'
import type { LocaleInfo, LocaleData, LocaleEntries } from '../api'

const props = defineProps<{
  locales: LocaleInfo[]
  localeData: LocaleData
  allKeys: string[]
  entries: LocaleEntries
}>()

// ── Stat: missing per locale ──────────────────────────────────────────────────

interface LocaleMissing {
  locale: LocaleInfo
  missing: string[]
}

const missingByLocale = computed<LocaleMissing[]>(() =>
  props.locales.map(locale => ({
    locale,
    missing: props.allKeys.filter(k => !props.localeData[locale.code]?.[k]),
  }))
)

const totalMissing = computed(() =>
  missingByLocale.value.reduce((s, l) => s + l.missing.length, 0)
)

// ── Stat: unused keys ─────────────────────────────────────────────────────────

const unusedKeys = computed(() =>
  props.allKeys.filter(k => !props.entries[k]?.length)
)

// ── Helpers ───────────────────────────────────────────────────────────────────

function localeName(locale: LocaleInfo): string {
  return (locale.meta?.display as string | undefined) ?? locale.code
}

function localeFlag(locale: LocaleInfo): string | undefined {
  return locale.meta?.flag as string | undefined
}

function pct(missing: number): number {
  if (!props.allKeys.length) return 0
  return Math.round(((props.allKeys.length - missing) / props.allKeys.length) * 100)
}
</script>

<template>
  <div class="dashboard">

    <!-- ── Top stat cards ──────────────────────────────────────────────────── -->
    <div class="stat-grid">
      <div class="stat-card">
        <span class="stat-label">Languages</span>
        <span class="stat-value">{{ locales.length }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Phrases</span>
        <span class="stat-value">{{ allKeys.length }}</span>
      </div>
      <div class="stat-card" :class="{ 'stat-card--warn': totalMissing > 0 }">
        <span class="stat-label">Missing translations</span>
        <span class="stat-value">{{ totalMissing }}</span>
      </div>
      <div class="stat-card" :class="{ 'stat-card--warn': unusedKeys.length > 0 }">
        <span class="stat-label">Unused keys</span>
        <span class="stat-value">{{ unusedKeys.length }}</span>
      </div>
    </div>

    <div class="panels">

      <!-- ── Missing per locale ────────────────────────────────────────────── -->
      <section class="panel">
        <h2 class="panel-title">Translation coverage</h2>
        <div class="locale-list">
          <div
            v-for="item in missingByLocale"
            :key="item.locale.code"
            class="locale-row"
          >
            <div class="locale-row-head">
              <span class="locale-flag">{{ localeFlag(item.locale) ?? '🌐' }}</span>
              <span class="locale-name">{{ localeName(item.locale) }}</span>
              <span class="locale-code">{{ item.locale.code }}</span>
              <span class="locale-pct" :class="{ 'pct--full': item.missing.length === 0 }">
                {{ pct(item.missing.length) }}%
              </span>
              <span v-if="item.missing.length" class="missing-count">
                {{ item.missing.length }} missing
              </span>
              <span v-else class="all-ok">complete</span>
            </div>

            <div class="progress-bar">
              <div
                class="progress-fill"
                :class="{ 'progress-fill--full': item.missing.length === 0 }"
                :style="{ width: pct(item.missing.length) + '%' }"
              />
            </div>

            <div v-if="item.missing.length" class="missing-keys">
              <span
                v-for="k in item.missing"
                :key="k"
                class="key-chip key-chip--missing"
              >{{ k }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Unused keys ───────────────────────────────────────────────────── -->
      <section class="panel">
        <h2 class="panel-title">
          Unused keys
          <span class="panel-count">{{ unusedKeys.length }}</span>
        </h2>
        <div v-if="unusedKeys.length" class="unused-list">
          <span
            v-for="k in unusedKeys"
            :key="k"
            class="key-chip key-chip--unused"
          >{{ k }}</span>
        </div>
        <p v-else class="all-ok-msg">All keys are used in the project.</p>
      </section>

    </div>
  </div>
</template>

<style scoped>
.dashboard {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* ── Stat cards ── */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.stat-card {
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 10px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.stat-card--warn {
  border-color: #3f2a1a;
  background: #1c1510;
}

.stat-label {
  font-size: 11px;
  font-weight: 600;
  color: #52525b;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #e4e4e7;
  line-height: 1;
}
.stat-card--warn .stat-value {
  color: #fb923c;
}

/* ── Panels ── */
.panels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  align-items: start;
}

.panel {
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 10px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-title {
  font-size: 12px;
  font-weight: 700;
  color: #71717a;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-count {
  background: #27272a;
  color: #71717a;
  font-size: 10px;
  padding: 1px 7px;
  border-radius: 8px;
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
}

/* ── Coverage rows ── */
.locale-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.locale-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.locale-row-head {
  display: flex;
  align-items: center;
  gap: 7px;
}

.locale-flag { font-size: 16px; }
.locale-name { font-size: 13px; font-weight: 600; color: #d4d4d8; }
.locale-code { font-size: 11px; color: #52525b; }

.locale-pct {
  margin-left: auto;
  font-size: 12px;
  font-weight: 700;
  color: #fb923c;
}
.locale-pct.pct--full { color: #4ade80; }

.missing-count {
  font-size: 11px;
  color: #fb923c;
  background: rgba(251, 146, 60, 0.1);
  padding: 2px 7px;
  border-radius: 6px;
}

.all-ok {
  font-size: 11px;
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
  padding: 2px 7px;
  border-radius: 6px;
}

/* ── Progress bar ── */
.progress-bar {
  height: 4px;
  background: #27272a;
  border-radius: 2px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: #fb923c;
  border-radius: 2px;
  transition: width 0.4s ease;
}
.progress-fill--full { background: #4ade80; }

/* ── Key chips ── */
.missing-keys, .unused-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.key-chip {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
}

.key-chip--missing {
  background: rgba(251, 146, 60, 0.08);
  border: 1px solid rgba(251, 146, 60, 0.2);
  color: #fb923c;
}

.key-chip--unused {
  background: rgba(148, 163, 184, 0.06);
  border: 1px solid #27272a;
  color: #71717a;
}

.all-ok-msg {
  font-size: 12px;
  color: #3f3f46;
  font-style: italic;
}
</style>
