<script setup lang="ts">
import { ref } from 'vue'
import NavBar from './components/NavBar.vue'
import HomePage from './components/HomePage.vue'
import StatsPage from './components/StatsPage.vue'
import { useT, useLocale } from 'vue-i18n-kit'

const { t } = useT()
const { isLoading } = useLocale()
const page = ref<'home' | 'stats'>('home')
</script>

<template>
  <div class="app">
    <NavBar :page="page" @navigate="page = $event" />

    <Transition name="loading">
      <div v-if="isLoading" class="loading-bar" />
    </Transition>

    <main class="main">
      <Transition name="page" mode="out-in">
        <HomePage v-if="page === 'home'" key="home" />
        <StatsPage v-else key="stats" />
      </Transition>
    </main>

    <footer class="footer">
      <span>{{ t('footer.tagline') }}</span>
      <span class="footer-hint">{{ t('locale.hint') }}</span>
      <span class="footer-version">{{ t('footer.version', { version: '0.4.5' }) }}</span>
    </footer>
  </div>
</template>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: #09090b;
  color: #e4e4e7;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-size: 15px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #27272a; border-radius: 3px; }
</style>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.loading-bar {
  position: fixed;
  top: 52px;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #818cf8, #a78bfa, #818cf8);
  background-size: 200% 100%;
  animation: shimmer 1s linear infinite;
  z-index: 200;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.loading-enter-active,
.loading-leave-active { transition: opacity 0.2s; }
.loading-enter-from,
.loading-leave-to    { opacity: 0; }

.main {
  flex: 1;
  max-width: 960px;
  margin: 0 auto;
  width: 100%;
  padding: 48px 24px 64px;
}

.page-enter-active,
.page-leave-active { transition: opacity 0.15s, transform 0.15s; }
.page-enter-from   { opacity: 0; transform: translateY(6px); }
.page-leave-to     { opacity: 0; transform: translateY(-6px); }

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 32px;
  border-top: 1px solid #18181b;
  font-size: 12px;
  color: #3f3f46;
}

.footer-hint {
  color: #27272a;
  text-align: center;
  flex: 1;
}
</style>
