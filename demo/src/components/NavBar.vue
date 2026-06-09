<script setup lang="ts">
import LocaleSwitcher from './LocaleSwitcher.vue'
import { useT } from 'vue-i18n-kit'

const { t } = useT()

defineProps<{ page: 'home' | 'stats' }>()
const emit = defineEmits<{ navigate: [page: 'home' | 'stats'] }>()

const editorUrl = (import.meta.env.DEV && typeof window !== 'undefined')
  ? (window as Record<string, unknown>)['__I18N_KIT_UI_URL__'] as string | undefined ?? null
  : null
</script>

<template>
  <nav class="nav">
    <div class="nav-left">
      <span class="logo">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        vue-i18n-kit
      </span>

      <div class="nav-links">
        <button
          :class="['nav-link', { active: page === 'home' }]"
          @click="emit('navigate', 'home')"
        >
          {{ t('nav.home') }}
        </button>
        <button
          :class="['nav-link', { active: page === 'stats' }]"
          @click="emit('navigate', 'stats')"
        >
          {{ t('nav.stats') }}
        </button>
      </div>
    </div>

    <div class="nav-right">
      <a
        v-if="editorUrl"
        :href="editorUrl"
        target="_blank"
        rel="noopener"
        class="editor-link"
        title="Open Dictionary Editor (vue-i18n-kit ui)"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
        Editor UI
      </a>
      <LocaleSwitcher />
    </div>
  </nav>
</template>

<style scoped>
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 52px;
  background: #111113;
  border-bottom: 1px solid #1c1c1f;
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 700;
  color: #818cf8;
  letter-spacing: 0.03em;
  user-select: none;
}

.nav-links {
  display: flex;
  gap: 2px;
}

.nav-link {
  background: none;
  border: none;
  color: #52525b;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  padding: 5px 12px;
  border-radius: 6px;
  transition: color 0.1s, background 0.1s;
  font-weight: 500;
}

.nav-link:hover { color: #a1a1aa; }
.nav-link.active {
  color: #e4e4e7;
  background: rgba(255, 255, 255, 0.06);
}

.editor-link {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
  color: #818cf8;
  text-decoration: none;
  padding: 4px 10px;
  border-radius: 5px;
  border: 1px solid rgba(129, 140, 248, 0.3);
  background: rgba(129, 140, 248, 0.06);
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.editor-link:hover {
  background: rgba(129, 140, 248, 0.14);
  border-color: rgba(129, 140, 248, 0.55);
  color: #a5b4fc;
}
</style>
