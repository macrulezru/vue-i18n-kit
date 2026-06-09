<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLocale, useAvailableLocales, useT } from 'vue-i18n-kit'

interface LocaleMeta { display: string; flag: string }

const { locale, setLocale, isLoading } = useLocale<LocaleMeta>()
const { availableLocales } = useAvailableLocales<LocaleMeta>()
const { t } = useT()

const open = ref(false)
const current = computed(() => availableLocales.value.find(l => l.code === locale.value))

function select(code: string) {
  void setLocale(code)
  open.value = false
}

function onBlur() {
  // Delay so item clicks register before the menu closes
  setTimeout(() => { open.value = false }, 120)
}
</script>

<template>
  <div class="switcher">
    <span class="switcher-label">{{ t('locale.label') }}</span>
    <div class="dropdown">
      <button
        class="trigger"
        :disabled="isLoading"
        @click="open = !open"
        @blur="onBlur"
      >
        <span class="flag">{{ current?.meta?.flag }}</span>
        <span class="code">{{ locale.toUpperCase() }}</span>
        <svg
          class="chevron"
          :class="{ open }"
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <Transition name="menu">
        <div v-if="open" class="menu">
          <button
            v-for="loc in availableLocales"
            :key="loc.code"
            :class="['item', { active: loc.code === locale }]"
            @mousedown.prevent="select(loc.code)"
          >
            <span class="flag">{{ loc.meta?.flag }}</span>
            <span class="display">{{ loc.meta?.display ?? loc.code }}</span>
            <span class="code-badge">{{ loc.code }}</span>
          </button>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.switcher {
  display: flex;
  align-items: center;
  gap: 10px;
}

.switcher-label {
  font-size: 12px;
  color: #52525b;
}

.dropdown {
  position: relative;
}

.trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 7px;
  border: 1px solid #27272a;
  background: #18181b;
  color: #a1a1aa;
  font-size: 13px;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.1s, color 0.1s, background 0.1s;
}

.trigger:hover:not(:disabled) {
  border-color: #3f3f46;
  color: #e4e4e7;
  background: #1f1f23;
}

.trigger:disabled { opacity: 0.5; cursor: default; }

.flag { font-size: 16px; line-height: 1; }

.code { font-size: 12px; letter-spacing: 0.08em; }

.chevron {
  color: #52525b;
  transition: transform 0.15s;
}
.chevron.open { transform: rotate(180deg); }

.menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 160px;
  background: #1c1c1f;
  border: 1px solid #27272a;
  border-radius: 9px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
  padding: 4px;
  z-index: 300;
}

.item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #a1a1aa;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s, color 0.1s;
}

.item:hover { background: rgba(255,255,255,0.05); color: #e4e4e7; }
.item.active { color: #818cf8; background: rgba(129, 140, 248, 0.08); }

.display { flex: 1; }

.code-badge {
  font-size: 10px;
  color: #3f3f46;
  font-family: ui-monospace, monospace;
  letter-spacing: 0.06em;
}

.menu-enter-active,
.menu-leave-active { transition: opacity 0.1s, transform 0.1s; }
.menu-enter-from,
.menu-leave-to     { opacity: 0; transform: translateY(-4px); }
</style>
