<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import LocaleTable from './components/LocaleTable.vue'
import Dashboard from './components/Dashboard.vue'
import { fetchConfig, fetchLocale, fetchEntries } from './api'
import type { LocaleInfo, LocaleData, LocaleEntries } from './api'

type Section = 'dashboard' | 'editor'
const section = ref<Section>('dashboard')

const loading = ref(true)
const locales = ref<LocaleInfo[]>([])
const localeData = ref<LocaleData>({})
const rawLocaleData = ref<Record<string, Record<string, unknown>>>({})
const entries = ref<LocaleEntries>({})

const allKeys = computed(() => {
  const keys = new Set<string>()
  for (const data of Object.values(localeData.value)) {
    for (const key of Object.keys(data)) keys.add(key)
  }
  return [...keys].sort()
})

function setNestedValue(obj: Record<string, unknown>, path: string, value: string): void {
  const parts = path.split('.')
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof current[parts[i]] !== 'object' || current[parts[i]] === null) {
      current[parts[i]] = {}
    }
    current = current[parts[i]] as Record<string, unknown>
  }
  current[parts[parts.length - 1]] = value
}

async function saveTranslation(code: string, key: string, value: string) {
  localeData.value = {
    ...localeData.value,
    [code]: { ...localeData.value[code], [key]: value },
  }

  setNestedValue(rawLocaleData.value[code], key, value)

  await fetch(`/api/locale/${code}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rawLocaleData.value[code]),
  })
}

onMounted(async () => {
  const config = await fetchConfig()
  locales.value = config.locales

  await Promise.all(
    config.locales.map(async (locale) => {
      const raw = await fetch(`/api/locale/${locale.code}`).then(r => r.json())
      rawLocaleData.value = { ...rawLocaleData.value, [locale.code]: raw }
      const messages = await fetchLocale(locale.code)
      localeData.value = { ...localeData.value, [locale.code]: messages }
    })
  )

  entries.value = await fetchEntries()
  loading.value = false
})
</script>

<template>
  <header class="header">
    <span class="header-title">vue-i18n-kit</span>

    <nav class="nav">
      <button
        class="nav-btn"
        :class="{ active: section === 'dashboard' }"
        @click="section = 'dashboard'"
      >Dashboard</button>
      <button
        class="nav-btn"
        :class="{ active: section === 'editor' }"
        @click="section = 'editor'"
      >Editor</button>
    </nav>

    <span v-if="!loading" class="header-stats">
      {{ allKeys.length }} keys &nbsp;&bull;&nbsp; {{ locales.length }} locales
    </span>
  </header>

  <div v-if="loading" class="loading">Loading locales…</div>

  <template v-else>
    <Dashboard
      v-if="section === 'dashboard'"
      :locales="locales"
      :locale-data="localeData"
      :all-keys="allKeys"
      :entries="entries"
    />

    <LocaleTable
      v-else
      :keys="allKeys"
      :locales="locales"
      :locale-data="localeData"
      :entries="entries"
      @save="saveTranslation"
    />
  </template>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 20px;
  height: 52px;
  background: #18181b;
  border-bottom: 1px solid #27272a;
  flex-shrink: 0;
}

.header-title {
  font-size: 13px;
  font-weight: 600;
  color: #52525b;
  letter-spacing: 0.04em;
}

/* ── Nav tabs ── */
.nav {
  display: flex;
  gap: 2px;
  background: #0f0f11;
  border: 1px solid #27272a;
  border-radius: 8px;
  padding: 3px;
}

.nav-btn {
  padding: 4px 16px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #52525b;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  font-family: inherit;
  letter-spacing: 0.03em;
}
.nav-btn:hover { color: #a1a1aa; }
.nav-btn.active {
  background: #27272a;
  color: #e4e4e7;
}

.header-stats {
  margin-left: auto;
  font-size: 12px;
  color: #52525b;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #52525b;
  font-size: 13px;
}
</style>
