<script setup lang="ts">
import { useToast } from '../composables/useToast'
import Icon from './Icon.vue'

const { items, dismiss } = useToast()

const iconMap = {
  success: 'check',
  error:   'alertTriangle',
  info:    'info',
  warning: 'warning',
} as const
</script>

<template>
  <Teleport to="body">
    <TransitionGroup name="toast" tag="div" class="toast-list">
      <div
        v-for="t in items"
        :key="t.id"
        class="toast"
        :class="`toast--${t.type}`"
        @click="dismiss(t.id)"
      >
        <Icon :name="iconMap[t.type]" :size="14" class="toast-icon" />
        <span class="toast-msg">{{ t.message }}</span>
        <button class="toast-close" @click.stop="dismiss(t.id)">
          <Icon name="close" :size="10" />
        </button>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<style scoped>
.toast-list {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 14px;
  border-radius: 9px;
  min-width: 240px;
  max-width: 380px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  pointer-events: all;
  border: 1px solid transparent;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04);
  backdrop-filter: blur(8px);
}

.toast--success { background: rgba(20,40,25,0.95); border-color: rgba(74,222,128,0.25); color: #86efac; }
.toast--success .toast-icon { color: #4ade80; }

.toast--error   { background: rgba(40,15,15,0.95); border-color: rgba(239,68,68,0.25); color: #fca5a5; }
.toast--error .toast-icon { color: #f87171; }

.toast--info    { background: rgba(15,20,40,0.95); border-color: rgba(129,140,248,0.25); color: #c7d2fe; }
.toast--info .toast-icon { color: #818cf8; }

.toast--warning { background: rgba(40,30,10,0.95); border-color: rgba(251,191,36,0.25); color: #fde68a; }
.toast--warning .toast-icon { color: #fbbf24; }

.toast-msg { flex: 1; line-height: 1.4; }

.toast-close {
  display: flex; align-items: center; justify-content: center;
  width: 18px; height: 18px;
  background: rgba(255,255,255,0.06); border: none; border-radius: 4px;
  color: currentColor; opacity: 0.6; cursor: pointer; flex-shrink: 0;
  transition: opacity 0.12s;
}
.toast-close:hover { opacity: 1; }

/* Transitions */
.toast-enter-active { transition: all 0.22s cubic-bezier(0.16,1,0.3,1); }
.toast-leave-active { transition: all 0.18s ease-in; }
.toast-enter-from  { opacity: 0; transform: translateX(60px) scale(0.95); }
.toast-leave-to    { opacity: 0; transform: translateX(40px) scale(0.95); }
</style>
