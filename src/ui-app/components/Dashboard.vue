<script setup lang="ts">
import { computed } from 'vue'
import Icon from './Icon.vue'
import type { LocaleInfo, LocaleData, LocaleEntries } from '../api'

const props = defineProps<{
  locales: LocaleInfo[]
  localeData: LocaleData
  allKeys: string[]
  entries: LocaleEntries
  duplicateKeys?: string[]
}>()

const emit = defineEmits<{
  (e: 'filter-namespace', ns: string): void
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

// ── Coverage score ────────────────────────────────────────────────────────────

const overallCoverage = computed(() => {
  const total = props.allKeys.length * props.locales.length
  if (!total) return 100
  const filled = props.locales.reduce((acc, l) =>
    acc + props.allKeys.filter(k => props.localeData[l.code]?.[k]).length, 0)
  return Math.round((filled / total) * 100)
})

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

// ── Namespace stats ───────────────────────────────────────────────────────────

interface NsStat { name: string; keys: number; pct: number }

const namespaceStats = computed<NsStat[]>(() => {
  const groups = new Map<string, string[]>()
  for (const key of props.allKeys) {
    const dot = key.indexOf('.')
    if (dot === -1) continue
    const ns = key.slice(0, dot)
    if (!groups.has(ns)) groups.set(ns, [])
    groups.get(ns)!.push(key)
  }
  return [...groups.entries()].map(([name, keys]) => {
    const total = keys.length * props.locales.length
    const filled = total ? props.locales.reduce((acc, l) =>
      acc + keys.filter(k => props.localeData[l.code]?.[k]).length, 0) : 0
    return { name, keys: keys.length, pct: total ? Math.round((filled / total) * 100) : 0 }
  }).sort((a, b) => a.pct - b.pct)
})

const rootKeys = computed(() => props.allKeys.filter(k => !k.includes('.')))

const rootCoverage = computed(() => {
  const keys = rootKeys.value
  const total = keys.length * props.locales.length
  if (!total) return 100
  const filled = props.locales.reduce((acc, l) =>
    acc + keys.filter(k => props.localeData[l.code]?.[k]).length, 0)
  return Math.round((filled / total) * 100)
})
</script>

<template>
  <div class="dashboard">

    <!-- ── Top stat cards ──────────────────────────────────────────────────── -->
    <div class="stat-grid">
      <div class="stat-card stat-card--blue">
        <div class="stat-icon-wrap stat-icon-wrap--blue">
          <Icon name="globe" :size="16" />
        </div>
        <div class="stat-body">
          <span class="stat-label">Languages</span>
          <span class="stat-value">{{ locales.length }}</span>
        </div>
      </div>

      <div class="stat-card stat-card--indigo">
        <div class="stat-icon-wrap stat-icon-wrap--indigo">
          <Icon name="layers" :size="16" />
        </div>
        <div class="stat-body">
          <span class="stat-label">Phrases</span>
          <span class="stat-value">{{ allKeys.length }}</span>
        </div>
      </div>

      <div class="stat-card" :class="totalMissing > 0 ? 'stat-card--orange' : 'stat-card--green'">
        <div class="stat-icon-wrap" :class="totalMissing > 0 ? 'stat-icon-wrap--orange' : 'stat-icon-wrap--green'">
          <Icon :name="totalMissing > 0 ? 'warning' : 'check'" :size="16" />
        </div>
        <div class="stat-body">
          <span class="stat-label">Missing</span>
          <span class="stat-value">{{ totalMissing }}</span>
        </div>
      </div>

      <div class="stat-card" :class="unusedKeys.length > 0 ? 'stat-card--yellow' : 'stat-card--green'">
        <div class="stat-icon-wrap" :class="unusedKeys.length > 0 ? 'stat-icon-wrap--yellow' : 'stat-icon-wrap--green'">
          <Icon :name="unusedKeys.length > 0 ? 'zap' : 'check'" :size="16" />
        </div>
        <div class="stat-body">
          <span class="stat-label">Unused keys</span>
          <span class="stat-value">{{ unusedKeys.length }}</span>
        </div>
      </div>
    </div>

    <!-- ── Coverage score bar ─────────────────────────────────────────────── -->
    <div class="coverage-bar-wrap">
      <div class="coverage-bar-head">
        <span class="coverage-label">
          <Icon name="percent" :size="12" />
          Overall coverage
        </span>
        <span class="coverage-pct" :class="overallCoverage === 100 ? 'pct--full' : ''">{{ overallCoverage }}%</span>
      </div>
      <div class="coverage-bar">
        <div
          class="coverage-fill"
          :class="{ 'coverage-fill--full': overallCoverage === 100 }"
          :style="{ width: overallCoverage + '%' }"
        />
      </div>
    </div>

    <!-- ── Namespace progress ─────────────────────────────────────────────── -->
    <section class="panel panel--full">
      <h2 class="panel-title">
        <Icon name="layers" :size="13" class="panel-title-icon panel-title-icon--indigo" />
        Coverage by namespace
      </h2>
      <div class="ns-grid">
        <button
          v-for="ns in namespaceStats"
          :key="ns.name"
          class="ns-card ns-card--btn"
          :class="ns.pct === 100 ? 'ns-card--full' : ns.pct < 50 ? 'ns-card--low' : ''"
          :title="`Filter editor by namespace: ${ns.name}`"
          @click="emit('filter-namespace', ns.name)"
        >
          <div class="ns-head">
            <span class="ns-name">
              <Icon name="layers" :size="10" />
              {{ ns.name }}
            </span>
            <span class="ns-keys">{{ ns.keys }} keys</span>
            <span class="ns-pct" :class="ns.pct === 100 ? 'pct--full' : ''">{{ ns.pct }}%</span>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :class="{ 'progress-fill--full': ns.pct === 100 }"
              :style="{ width: ns.pct + '%' }"
            />
          </div>
        </button>
        <div v-if="rootKeys.length" class="ns-card">
          <div class="ns-head">
            <span class="ns-name"><Icon name="key" :size="10" />root</span>
            <span class="ns-keys">{{ rootKeys.length }} keys</span>
            <span class="ns-pct" :class="rootCoverage === 100 ? 'pct--full' : ''">{{ rootCoverage }}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :class="{ 'progress-fill--full': rootCoverage === 100 }" :style="{ width: rootCoverage + '%' }" />
          </div>
        </div>
      </div>
    </section>

    <div class="panels">

      <!-- ── Missing per locale ────────────────────────────────────────────── -->
      <section class="panel">
        <h2 class="panel-title">
          <Icon name="check" :size="13" class="panel-title-icon panel-title-icon--green" />
          Translation coverage
        </h2>
        <div class="locale-list">
          <div
            v-for="item in missingByLocale"
            :key="item.locale.code"
            class="locale-row"
          >
            <div class="locale-row-head">
              <span class="locale-flag">{{ localeFlag(item.locale) ?? '' }}</span>
              <span v-if="!localeFlag(item.locale)" class="locale-flag-fallback">
                <Icon name="globe" :size="14" />
              </span>
              <span class="locale-name">{{ localeName(item.locale) }}</span>
              <span class="locale-code">{{ item.locale.code }}</span>
              <span class="locale-pct" :class="{ 'pct--full': item.missing.length === 0 }">
                {{ pct(item.missing.length) }}%
              </span>
              <span v-if="item.missing.length" class="badge badge--missing">
                <Icon name="warning" :size="10" />
                {{ item.missing.length }} missing
              </span>
              <span v-else class="badge badge--ok">
                <Icon name="check" :size="10" />
                complete
              </span>
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
              >
                <Icon name="key" :size="9" />
                {{ k }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Unused keys ───────────────────────────────────────────────────── -->
      <section class="panel">
        <h2 class="panel-title">
          <Icon name="zap" :size="13" class="panel-title-icon" :class="unusedKeys.length ? 'panel-title-icon--yellow' : 'panel-title-icon--muted'" />
          Unused keys
          <span class="panel-count">{{ unusedKeys.length }}</span>
        </h2>
        <div v-if="unusedKeys.length" class="unused-list">
          <span
            v-for="k in unusedKeys"
            :key="k"
            class="key-chip key-chip--unused"
          >
            <Icon name="key" :size="9" />
            {{ k }}
          </span>
        </div>
        <p v-else class="empty-msg">
          <Icon name="check" :size="13" />
          All keys are used in the project.
        </p>
      </section>

      <!-- ── Duplicate values ─────────────────────────────────────────────── -->
      <section v-if="duplicateKeys && duplicateKeys.length" class="panel">
        <h2 class="panel-title">
          <Icon name="copy" :size="13" class="panel-title-icon panel-title-icon--purple" />
          Duplicate values
          <span class="panel-count">{{ duplicateKeys.length }}</span>
        </h2>
        <p class="panel-subtitle">Keys where all locales share the same non-empty value — may need translation.</p>
        <div class="unused-list">
          <span
            v-for="k in duplicateKeys"
            :key="k"
            class="key-chip key-chip--dup"
          >
            <Icon name="copy" :size="9" />
            {{ k }}
          </span>
        </div>
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
  gap: 20px;
}

/* ── Stat cards ── */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.stat-card {
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 10px;
  padding: 16px 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  transition: border-color 0.15s;
}
.stat-card--blue   { border-color: rgba(56,189,248,0.15);  background: linear-gradient(135deg, #18181b 0%, rgba(56,189,248,0.03) 100%); }
.stat-card--indigo { border-color: rgba(129,140,248,0.15); background: linear-gradient(135deg, #18181b 0%, rgba(129,140,248,0.03) 100%); }
.stat-card--green  { border-color: rgba(74,222,128,0.15);  background: linear-gradient(135deg, #18181b 0%, rgba(74,222,128,0.03) 100%); }
.stat-card--orange { border-color: rgba(251,146,60,0.15);  background: linear-gradient(135deg, #18181b 0%, rgba(251,146,60,0.03) 100%); }
.stat-card--yellow { border-color: rgba(251,191,36,0.15);  background: linear-gradient(135deg, #18181b 0%, rgba(251,191,36,0.03) 100%); }

.stat-icon-wrap {
  width: 36px; height: 36px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.stat-icon-wrap--blue   { background: rgba(56,189,248,0.1);  color: #38bdf8; border: 1px solid rgba(56,189,248,0.15); }
.stat-icon-wrap--indigo { background: rgba(129,140,248,0.1); color: #818cf8; border: 1px solid rgba(129,140,248,0.15); }
.stat-icon-wrap--green  { background: rgba(74,222,128,0.1);  color: #4ade80; border: 1px solid rgba(74,222,128,0.15); }
.stat-icon-wrap--orange { background: rgba(251,146,60,0.1);  color: #fb923c; border: 1px solid rgba(251,146,60,0.15); }
.stat-icon-wrap--yellow { background: rgba(251,191,36,0.1);  color: #fbbf24; border: 1px solid rgba(251,191,36,0.15); }

.stat-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.stat-label {
  font-size: 11px;
  font-weight: 600;
  color: #52525b;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #e4e4e7;
  line-height: 1;
}
.stat-card--orange .stat-value { color: #fb923c; }
.stat-card--yellow .stat-value { color: #fbbf24; }

/* ── Coverage bar ── */
.coverage-bar-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.coverage-bar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.coverage-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #52525b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.coverage-pct {
  font-size: 13px;
  font-weight: 700;
  color: #fb923c;
}
.coverage-pct.pct--full { color: #4ade80; }
.coverage-bar {
  height: 5px;
  background: #27272a;
  border-radius: 3px;
  overflow: hidden;
}
.coverage-fill {
  height: 100%;
  background: linear-gradient(90deg, #f97316, #fb923c);
  border-radius: 3px;
  transition: width 0.6s cubic-bezier(0.4,0,0.2,1);
}
.coverage-fill--full { background: linear-gradient(90deg, #22c55e, #4ade80); }

/* ── Namespace ── */
.ns-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.ns-card {
  background: #111113;
  border: 1px solid #27272a;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  transition: border-color 0.15s;
}
.ns-card--full { border-color: rgba(74,222,128,0.15); }
.ns-card--low  { border-color: rgba(251,146,60,0.15); }

.ns-card--btn {
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: border-color 0.15s, background 0.15s;
}
.ns-card--btn:hover {
  background: #1c1c1f;
  border-color: rgba(129,140,248,0.25);
}

.ns-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ns-name {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  font-weight: 600;
  color: #818cf8;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ns-keys {
  font-size: 10px;
  color: #3f3f46;
  white-space: nowrap;
  flex-shrink: 0;
}
.ns-pct {
  font-size: 12px;
  font-weight: 700;
  color: #fb923c;
  flex-shrink: 0;
}
.ns-pct.pct--full { color: #4ade80; }

/* ── Panels ── */
.panels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: start;
}
.panel--full { grid-column: 1 / -1; }

.panel {
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 10px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-title {
  font-size: 11px;
  font-weight: 700;
  color: #71717a;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  display: flex;
  align-items: center;
  gap: 7px;
}
.panel-title-icon--green  { color: #4ade80; }
.panel-title-icon--yellow { color: #fbbf24; }
.panel-title-icon--indigo { color: #818cf8; }
.panel-title-icon--purple { color: #c084fc; }
.panel-title-icon--muted  { color: #3f3f46; }

.panel-subtitle {
  font-size: 11px;
  color: #3f3f46;
  line-height: 1.5;
  margin: -8px 0 0;
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
  gap: 16px;
}

.locale-row {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.locale-row-head {
  display: flex;
  align-items: center;
  gap: 7px;
}

.locale-flag { font-size: 15px; line-height: 1; }
.locale-flag-fallback { color: #52525b; display: flex; }
.locale-name { font-size: 13px; font-weight: 600; color: #d4d4d8; }
.locale-code {
  font-size: 10px;
  color: #3f3f46;
  background: #1c1c1f;
  border: 1px solid #27272a;
  border-radius: 4px;
  padding: 1px 5px;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.locale-pct {
  margin-left: auto;
  font-size: 12px;
  font-weight: 700;
  color: #fb923c;
}
.locale-pct.pct--full { color: #4ade80; }

.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 5px;
}
.badge--missing {
  color: #fb923c;
  background: rgba(251, 146, 60, 0.1);
  border: 1px solid rgba(251, 146, 60, 0.2);
}
.badge--ok {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.2);
}

/* ── Progress bar ── */
.progress-bar {
  height: 3px;
  background: #27272a;
  border-radius: 2px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #f97316, #fb923c);
  border-radius: 2px;
  transition: width 0.5s ease;
}
.progress-fill--full { background: linear-gradient(90deg, #22c55e, #4ade80); }

/* ── Key chips ── */
.missing-keys, .unused-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.key-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
}

.key-chip--missing {
  background: rgba(251, 146, 60, 0.07);
  border: 1px solid rgba(251, 146, 60, 0.18);
  color: #fb923c;
}

.key-chip--unused {
  background: rgba(148, 163, 184, 0.04);
  border: 1px solid #27272a;
  color: #52525b;
}

.key-chip--dup {
  background: rgba(192, 132, 252, 0.06);
  border: 1px solid rgba(192, 132, 252, 0.2);
  color: #c084fc;
}

.empty-msg {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: #4ade80;
  opacity: 0.7;
}
</style>
