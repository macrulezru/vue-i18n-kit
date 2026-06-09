<script setup lang="ts">
import { ref } from 'vue'
import { useT } from 'vue-i18n-kit'

const { t } = useT()
const name = ref('World')
</script>

<template>
  <div class="home">

    <!-- Hero ──────────────────────────────────────────────────────────────────── -->
    <section class="hero">
      <div class="hero-badge">Demo app</div>
      <h1 class="hero-title">{{ t('home.title') }}</h1>
      <p class="hero-subtitle">{{ t('home.subtitle') }}</p>

      <div class="greeting-row">
        <span class="greeting">{{ t('home.greeting', { name }) }}</span>
        <input
          v-model="name"
          class="name-input"
          :placeholder="t('home.name_placeholder')"
          maxlength="32"
        />
      </div>
    </section>

    <!-- Feature cards ──────────────────────────────────────────────────────────── -->
    <section class="features">
      <div class="card">
        <div class="card-icon card-icon--blue">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
        </div>
        <h3 class="card-title">{{ t('home.features.lazy') }}</h3>
        <p class="card-desc">{{ t('home.features.lazy_desc') }}</p>
      </div>

      <div class="card">
        <div class="card-icon card-icon--purple">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/>
            <line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>
          </svg>
        </div>
        <h3 class="card-title">{{ t('home.features.icu') }}</h3>
        <p class="card-desc">{{ t('home.features.icu_desc') }}</p>
      </div>

      <div class="card card--accent">
        <div class="card-icon card-icon--indigo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </div>
        <h3 class="card-title">{{ t('home.features.editor') }}</h3>
        <p class="card-desc">{{ t('home.features.editor_desc') }}</p>
      </div>
    </section>

    <!-- Editor tip ──────────────────────────────────────────────────────────────── -->
    <div class="tip">
      <div class="tip-dot" />
      <span>{{ t('common.try_editor') }}</span>
    </div>

  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 48px;
}

/* ── Hero ──────────────────────────────────────────────────────────────────── */
.hero {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 20px;
  border: 1px solid #27272a;
  background: #18181b;
  font-size: 11px;
  font-weight: 600;
  color: #818cf8;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  width: fit-content;
}

.hero-title {
  font-size: clamp(1.8rem, 5vw, 2.6rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  color: #f4f4f5;
  line-height: 1.15;
}

.hero-subtitle {
  font-size: 15px;
  color: #71717a;
  max-width: 520px;
}

.greeting-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.greeting {
  font-size: 1.25rem;
  font-weight: 600;
  color: #e4e4e7;
}

.name-input {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid #27272a;
  background: #18181b;
  color: #e4e4e7;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  width: 200px;
}

.name-input:focus {
  border-color: #818cf8;
  box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.12);
}

.name-input::placeholder { color: #3f3f46; }

/* ── Feature cards ──────────────────────────────────────────────────────────── */
.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.card {
  padding: 24px;
  border-radius: 12px;
  border: 1px solid #1c1c1f;
  background: #111113;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: border-color 0.15s;
}

.card:hover { border-color: #27272a; }

.card--accent {
  border-color: rgba(129, 140, 248, 0.2);
  background: rgba(129, 140, 248, 0.04);
}

.card--accent:hover { border-color: rgba(129, 140, 248, 0.35); }

.card-icon {
  width: 38px;
  height: 38px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-icon--blue   { background: rgba(59, 130, 246, 0.12); color: #60a5fa; }
.card-icon--purple { background: rgba(168, 85, 247, 0.12); color: #c084fc; }
.card-icon--indigo { background: rgba(129, 140, 248, 0.12); color: #818cf8; }

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #e4e4e7;
}

.card-desc {
  font-size: 13px;
  color: #71717a;
  line-height: 1.6;
}

/* ── Tip ──────────────────────────────────────────────────────────────────── */
.tip {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #52525b;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px dashed #1c1c1f;
}

.tip-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #818cf8;
  animation: pulse 2s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.4; transform: scale(0.7); }
}
</style>
