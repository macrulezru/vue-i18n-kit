<script setup lang="ts">
import { ref, computed } from 'vue'
import { useT, useFormat } from 'vue-i18n-kit'

const { t, tm } = useT()
const { formatNumber, formatDate, formatCurrency } = useFormat()

const userCount    = ref(1247)
const orderCount   = ref(38)
const messageCount = ref(5)
const revenue      = 8_450.75
const reportDate   = new Date('2026-06-09')

const growth = computed(() =>
  formatNumber(0.125, { style: 'percent', maximumFractionDigits: 1 }),
)
</script>

<template>
  <div class="stats">

    <!-- Header ──────────────────────────────────────────────────────────────── -->
    <div class="page-header">
      <h2 class="page-title">{{ t('stats.title') }}</h2>
      <p class="page-subtitle">{{ t('stats.subtitle') }}</p>
    </div>

    <!-- Stat cards ──────────────────────────────────────────────────────────── -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon stat-icon--blue">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div class="stat-value">{{ formatNumber(userCount) }}</div>
        <div class="stat-label">{{ tm('stats.users', { count: userCount }) }}</div>
      </div>

      <div class="stat-card">
        <div class="stat-icon stat-icon--purple">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="3" width="15" height="13" rx="2"/>
            <path d="M16 8h2a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <line x1="8" y1="21" x2="8" y2="16"/>
            <line x1="5" y1="21" x2="11" y2="21"/>
          </svg>
        </div>
        <div class="stat-value">{{ formatNumber(orderCount) }}</div>
        <div class="stat-label">{{ tm('stats.orders', { count: orderCount }) }}</div>
      </div>

      <div class="stat-card stat-card--accent">
        <div class="stat-icon stat-icon--green">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="1" x2="12" y2="23"/>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
        </div>
        <div class="stat-value">{{ formatCurrency(revenue, 'USD') }}</div>
        <div class="stat-label">{{ t('stats.revenue') }}</div>
      </div>
    </div>

    <!-- ICU plural slider ───────────────────────────────────────────────────── -->
    <div class="plural-demo">
      <div class="plural-header">
        <span class="plural-title">ICU plural</span>
        <span class="plural-result">{{ tm('stats.messages', { count: messageCount }) }}</span>
      </div>
      <div class="slider-row">
        <span class="slider-min">0</span>
        <input
          v-model.number="messageCount"
          type="range"
          min="0"
          max="100"
          class="slider"
        />
        <span class="slider-max">100</span>
        <span class="slider-value">{{ messageCount }}</span>
      </div>
      <p class="plural-hint">
        Move the slider — the plural form updates according to the active locale's CLDR rules.
      </p>
    </div>

    <!-- Date & growth ──────────────────────────────────────────────────────── -->
    <div class="info-grid">
      <div class="info-card">
        <span class="info-label">{{ t('stats.report_date') }}</span>
        <span class="info-value">
          {{ formatDate(reportDate, { dateStyle: 'long' }) }}
        </span>
      </div>
      <div class="info-card">
        <span class="info-label">{{ t('stats.growth') }}</span>
        <span class="info-value info-value--green">+{{ growth }}</span>
      </div>
    </div>

    <!-- Slider for user count ───────────────────────────────────────────────── -->
    <div class="count-sliders">
      <div class="count-row">
        <span class="count-label">{{ tm('stats.users', { count: userCount }) }}</span>
        <input v-model.number="userCount"  type="range" min="0" max="9999" class="slider" />
        <span class="count-num">{{ userCount }}</span>
      </div>
      <div class="count-row">
        <span class="count-label">{{ tm('stats.orders', { count: orderCount }) }}</span>
        <input v-model.number="orderCount" type="range" min="0" max="500"  class="slider" />
        <span class="count-num">{{ orderCount }}</span>
      </div>
    </div>

  </div>
</template>

<style scoped>
.stats {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.page-header { display: flex; flex-direction: column; gap: 6px; }
.page-title  { font-size: 1.6rem; font-weight: 700; letter-spacing: -0.02em; color: #f4f4f5; }
.page-subtitle { font-size: 14px; color: #52525b; }

/* ── Stat cards ──────────────────────────────────────────────────────────── */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.stat-card {
  padding: 24px;
  border-radius: 12px;
  border: 1px solid #1c1c1f;
  background: #111113;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stat-card--accent {
  border-color: rgba(74, 222, 128, 0.15);
  background: rgba(74, 222, 128, 0.04);
}

.stat-icon {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon--blue  { background: rgba(59, 130, 246, 0.1); color: #60a5fa; }
.stat-icon--purple{ background: rgba(168, 85, 247, 0.1); color: #c084fc; }
.stat-icon--green { background: rgba(74, 222, 128, 0.1); color: #4ade80; }

.stat-value {
  font-size: 1.8rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: #f4f4f5;
  line-height: 1;
}

.stat-label { font-size: 13px; color: #71717a; }

/* ── ICU plural demo ──────────────────────────────────────────────────────── */
.plural-demo {
  padding: 20px 24px;
  border-radius: 12px;
  border: 1px solid #1c1c1f;
  background: #111113;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.plural-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.plural-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #52525b;
}

.plural-result {
  font-size: 1.1rem;
  font-weight: 600;
  color: #818cf8;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.slider-min,
.slider-max { font-size: 11px; color: #3f3f46; width: 16px; text-align: center; }

.slider {
  flex: 1;
  accent-color: #818cf8;
  cursor: pointer;
  height: 4px;
}

.slider-value,
.count-num {
  font-size: 13px;
  font-family: ui-monospace, monospace;
  color: #a1a1aa;
  min-width: 36px;
  text-align: right;
}

.plural-hint {
  font-size: 12px;
  color: #3f3f46;
}

/* ── Info cards ──────────────────────────────────────────────────────────── */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.info-card {
  padding: 16px 20px;
  border-radius: 10px;
  border: 1px solid #1c1c1f;
  background: #111113;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-label { font-size: 12px; color: #52525b; }
.info-value { font-size: 15px; font-weight: 600; color: #e4e4e7; }
.info-value--green { color: #4ade80; }

/* ── Count sliders ───────────────────────────────────────────────────────── */
.count-sliders {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px 24px;
  border-radius: 12px;
  border: 1px solid #1c1c1f;
  background: #111113;
}

.count-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.count-label {
  font-size: 13px;
  color: #71717a;
  min-width: 160px;
}
</style>
