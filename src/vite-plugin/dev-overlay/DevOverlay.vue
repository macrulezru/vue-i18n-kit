<script setup lang="ts">
/**
 * DevOverlay — dev-only floating editor popup + iframe panel.
 *
 * Mounted as an independent Vue app on document.body by vueI18nDevPlugin.
 * Listens to edit events from I18nInspect / v-i18n-inspect via the window-event bus.
 *
 * On open:
 *  1. Fetches locale list from GET /api/config
 *  2. Fetches all locale messages in parallel via GET /api/locale/:code
 *  3. Extracts the specific key value from each locale (dot-notation)
 *
 * On save:
 *  - Merges the edited value back into the full messages object
 *  - Sends PUT /api/locale/:code for each changed locale
 *  - The server writes to disk → Vite's file watcher triggers HMR automatically
 *
 * Keyboard: Escape = cancel popup / close iframe  |  Ctrl+Enter / ⌘+Enter = save
 */
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { onEdit } from './eventBus'
import type { I18nEditPayload } from './eventBus'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  uiUrl: string
  /** Width of the iframe editor panel. @default '480px' */
  iframeWidth?: string
}>()

const iframeWidthValue = props.iframeWidth ?? '100vw'

// ── Interfaces ────────────────────────────────────────────────────────────────

interface LocaleInfo {
  code: string
  meta?: { display?: string; flag?: string }
}

// ── State ─────────────────────────────────────────────────────────────────────

const visible    = ref(false)
const isLoading  = ref(false)
const isSaving   = ref(false)
const saveOk     = ref(false)
const errorMsg   = ref<string | null>(null)

const editKey    = ref('')
const locales    = ref<LocaleInfo[]>([])

/** Current saved value per locale */
const savedValues = ref<Record<string, string>>({})
/** User-edited draft value per locale */
const draftValues = ref<Record<string, string>>({})
/** Full messages objects per locale — needed for PUT */
const fullMessages = ref<Record<string, Record<string, unknown>>>({})

const panelRef   = ref<HTMLElement | null>(null)
const firstInput = ref<HTMLTextAreaElement | null>(null)

// ── iframe state ──────────────────────────────────────────────────────────────

/** Whether the right-side iframe editor panel is open */
const iframeOpen = ref(false)
/** URL loaded in the iframe — set when the user opens the full editor */
const iframeUrl  = ref('')

// ── Derived state ─────────────────────────────────────────────────────────────

const isDirty = computed(() =>
  locales.value.some(l => draftValues.value[l.code] !== savedValues.value[l.code]),
)

const changedLocales = computed(() =>
  locales.value.filter(l => draftValues.value[l.code] !== savedValues.value[l.code]),
)

// ── Key helpers (dot-notation) ────────────────────────────────────────────────

function getNestedValue(obj: Record<string, unknown>, key: string): string {
  const parts = key.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (typeof cur !== 'object' || cur === null) return ''
    cur = (cur as Record<string, unknown>)[p]
  }
  return typeof cur === 'string' ? cur : ''
}

function setNestedValue(obj: Record<string, unknown>, key: string, value: string): Record<string, unknown> {
  const result = { ...obj }
  const parts = key.split('.')
  let cursor: Record<string, unknown> = result
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    cursor[p] = typeof cursor[p] === 'object' && cursor[p] !== null
      ? { ...(cursor[p] as Record<string, unknown>) }
      : {}
    cursor = cursor[p] as Record<string, unknown>
  }
  cursor[parts[parts.length - 1]] = value
  return result
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function fetchLocaleData(key: string): Promise<void> {
  isLoading.value = true
  errorMsg.value = null

  try {
    // 1. Fetch locale list
    const configRes = await fetch(`${props.uiUrl}/api/config`)
    if (!configRes.ok) throw new Error(`Server ${configRes.status}: ${configRes.statusText}`)
    const config = await configRes.json() as { locales: LocaleInfo[] }
    locales.value = config.locales

    // 2. Fetch all locale messages in parallel
    const results = await Promise.all(
      config.locales.map(async (l) => {
        const res = await fetch(`${props.uiUrl}/api/locale/${l.code}`)
        if (!res.ok) throw new Error(`Failed to load locale "${l.code}"`)
        return [l.code, await res.json() as Record<string, unknown>] as const
      }),
    )

    // 3. Extract values for this key
    const saved: Record<string, string> = {}
    const full: Record<string, Record<string, unknown>> = {}
    for (const [code, messages] of results) {
      full[code] = messages
      saved[code] = getNestedValue(messages, key)
    }

    fullMessages.value = full
    savedValues.value = saved
    draftValues.value = { ...saved }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Failed to load translations'
  } finally {
    isLoading.value = false
    // Focus first textarea after render
    await nextTick()
    firstInput.value?.focus()
  }
}

async function saveAll(): Promise<void> {
  if (!isDirty.value || isSaving.value) return
  isSaving.value = true
  errorMsg.value = null

  try {
    await Promise.all(
      changedLocales.value.map(async (l) => {
        const updated = setNestedValue(fullMessages.value[l.code] ?? {}, editKey.value, draftValues.value[l.code])
        const res = await fetch(`${props.uiUrl}/api/locale/${l.code}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        })
        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || `Failed to save "${l.code}"`)
        }
        // Update stored values after confirmed save
        fullMessages.value[l.code] = updated
        savedValues.value[l.code] = draftValues.value[l.code]
      }),
    )

    saveOk.value = true
    // Auto-close after brief success flash
    setTimeout(() => {
      saveOk.value = false
      close()
    }, 900)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Save failed'
  } finally {
    isSaving.value = false
  }
}

// ── Open / close popup ────────────────────────────────────────────────────────

function open(payload: I18nEditPayload): void {
  editKey.value = payload.key
  visible.value = true
  savedValues.value = {}
  draftValues.value = {}
  fullMessages.value = {}
  saveOk.value = false
  errorMsg.value = null
  locales.value = []
  void fetchLocaleData(payload.key)
}

function close(): void {
  if (isSaving.value) return
  visible.value = false
  saveOk.value = false
  errorMsg.value = null
}

// ── iframe panel ──────────────────────────────────────────────────────────────

/**
 * Opens the full editor in the right-side iframe panel.
 * If the iframe is already open (user clicked for a different key),
 * the iframe src is updated to navigate to the new key.
 * The mini popup closes so the user can see the application behind the panel.
 */
function openInEditor(): void {
  const firstLocale = locales.value[0]?.code
  const params = new URLSearchParams({ key: editKey.value })
  if (firstLocale) params.set('edit', firstLocale)
  iframeUrl.value = `${props.uiUrl}/?${params.toString()}`
  iframeOpen.value = true
  close()
}

/** Opens the iframe URL in a new browser tab, then closes the iframe panel. */
function openInNewTab(): void {
  window.open(iframeUrl.value, '_blank', 'noopener')
  iframeOpen.value = false
}

function closeIframe(): void {
  iframeOpen.value = false
}

// ── Keyboard handling ─────────────────────────────────────────────────────────

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.stopPropagation()
    if (visible.value) close()
    else if (iframeOpen.value) closeIframe()
    return
  }
  if (visible.value && (e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    void saveAll()
  }
}

// ── Click-outside ─────────────────────────────────────────────────────────────

function onBackdropMousedown(e: MouseEvent): void {
  // Close only when clicking the backdrop itself, not the panel
  if (e.target === e.currentTarget) close()
}

// ── Scroll lock ───────────────────────────────────────────────────────────────

// Block host-page scroll while the popup or iframe panel is open.
const isAnyOpen = computed(() => visible.value || iframeOpen.value)

watch(isAnyOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

// ── Lifecycle ─────────────────────────────────────────────────────────────────

let unsub: (() => void) | null = null

onMounted(() => {
  unsub = onEdit(open)
  document.addEventListener('keydown', onKeydown, true)
})

onUnmounted(() => {
  unsub?.()
  document.removeEventListener('keydown', onKeydown, true)
  // Restore scroll in case the overlay is removed while open
  document.body.style.overflow = ''
})
</script>

<template>
  <!-- ── Mini popup ─────────────────────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="__ik-overlay">
      <div
        v-if="visible"
        class="__ik-backdrop"
        role="dialog"
        aria-modal="true"
        :aria-label="`Edit translation: ${editKey}`"
        @mousedown.self="onBackdropMousedown"
      >
        <div ref="panelRef" class="__ik-panel">

          <!-- ── Header ──────────────────────────────────────────────────── -->
          <div class="__ik-header">
            <span class="__ik-logo">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
              vue-i18n-kit
            </span>
            <span class="__ik-kbd-hint">
              <kbd>Ctrl</kbd><kbd>↵</kbd> save &nbsp; <kbd>Esc</kbd> close
            </span>
            <button
              type="button"
              class="__ik-open-btn"
              :title="iframeOpen ? 'Update editor panel key' : 'Open in editor panel'"
              @click="openInEditor"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="18" rx="1"/>
                <path d="M14 3h7v7"/>
                <path d="M21 3l-7 7"/>
              </svg>
            </button>
            <button
              type="button"
              class="__ik-close"
              title="Close (Esc)"
              @click="close"
            >×</button>
          </div>

          <!-- ── Key badge ───────────────────────────────────────────────── -->
          <div class="__ik-key-row">
            <code class="__ik-key-badge">{{ editKey }}</code>
          </div>

          <!-- ── Loading state ───────────────────────────────────────────── -->
          <div v-if="isLoading" class="__ik-loading">
            <span class="__ik-spinner" aria-hidden="true" />
            Loading translations…
          </div>

          <!-- ── Error state ─────────────────────────────────────────────── -->
          <div v-else-if="errorMsg" class="__ik-error">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {{ errorMsg }}
          </div>

          <!-- ── Locale fields ───────────────────────────────────────────── -->
          <div v-else class="__ik-fields">
            <div
              v-for="(locale, idx) in locales"
              :key="locale.code"
              class="__ik-field"
            >
              <label class="__ik-label" :for="`__ik-input-${locale.code}`">
                <span v-if="locale.meta?.flag" class="__ik-flag">{{ locale.meta.flag }}</span>
                <span class="__ik-locale-code">{{ locale.code }}</span>
                <span v-if="locale.meta?.display" class="__ik-locale-name">{{ locale.meta.display }}</span>
                <span
                  v-if="draftValues[locale.code] !== savedValues[locale.code]"
                  class="__ik-changed"
                  title="Unsaved changes"
                >●</span>
              </label>
              <textarea
                :id="`__ik-input-${locale.code}`"
                :ref="idx === 0 ? (el) => { firstInput = el as HTMLTextAreaElement } : undefined"
                v-model="draftValues[locale.code]"
                class="__ik-textarea"
                rows="2"
                :placeholder="`Translation for ${locale.code}…`"
                :disabled="isSaving"
                @keydown.enter.ctrl.prevent="saveAll"
                @keydown.enter.meta.prevent="saveAll"
              />
            </div>
          </div>

          <!-- ── Footer ─────────────────────────────────────────────────── -->
          <div v-if="!isLoading" class="__ik-footer">
            <div class="__ik-footer-left">
              <Transition name="__ik-success">
                <span v-if="saveOk" class="__ik-success-msg">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Saved
                </span>
              </Transition>
            </div>

            <div class="__ik-footer-right">
              <button
                type="button"
                class="__ik-btn-cancel"
                :disabled="isSaving"
                @click="close"
              >Cancel</button>
              <button
                type="button"
                class="__ik-btn-save"
                :disabled="!isDirty || isSaving || !!errorMsg"
                @click="saveAll"
              >
                <span v-if="isSaving" class="__ik-spinner __ik-spinner--sm" aria-hidden="true" />
                <span>{{ isSaving ? 'Saving…' : 'Save' }}</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- ── iframe editor panel ────────────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="__ik-iframe">
      <div
        v-if="iframeOpen"
        class="__ik-iframe-panel"
        :style="{ width: iframeWidthValue }"
        role="complementary"
        aria-label="vue-i18n-kit full editor"
      >
        <!-- bar -->
        <div class="__ik-iframe-bar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          </svg>
          <span class="__ik-iframe-bar-title">vue-i18n-kit</span>
          <span class="__ik-iframe-bar-spacer" />
          <button
            type="button"
            class="__ik-iframe-bar-btn"
            title="Open in new tab"
            @click="openInNewTab"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </button>
          <button
            type="button"
            class="__ik-iframe-bar-btn __ik-iframe-bar-btn--close"
            title="Close editor panel (Esc)"
            @click="closeIframe"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- iframe -->
        <iframe
          class="__ik-iframe-el"
          :src="iframeUrl"
          title="vue-i18n-kit editor"
          allow="same-origin"
        />
      </div>
    </Transition>
  </Teleport>
</template>

<style>
/* All class names use the __ik- prefix to avoid conflicts with host-app styles. */

/* ── Backdrop ──────────────────────────────────────────────────────────────── */
.__ik-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
  padding: 24px;
  box-sizing: border-box;
}

/* ── Panel ─────────────────────────────────────────────────────────────────── */
.__ik-panel {
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 10px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 520px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 14px;
  color: #e4e4e7;
  line-height: 1.5;
}

/* ── Header ────────────────────────────────────────────────────────────────── */
.__ik-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #27272a;
  flex-shrink: 0;
}

.__ik-logo {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  color: #818cf8;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.__ik-kbd-hint {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: #71717a;
  margin-left: auto;
}

.__ik-kbd-hint kbd,
.__ik-save-kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px 4px;
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 3px;
  font-size: 10px;
  font-family: inherit;
  color: #71717a;
  line-height: 1.4;
}

.__ik-open-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  color: #71717a;
  padding: 2px;
  border-radius: 4px;
  transition: color 0.1s, background 0.1s;
  flex-shrink: 0;
}
.__ik-open-btn:hover { color: #818cf8; background: rgba(129, 140, 248, 0.1); }

.__ik-close {
  background: none;
  border: none;
  cursor: pointer;
  color: #71717a;
  font-size: 20px;
  line-height: 1;
  padding: 0 0 0 8px;
  transition: color 0.1s;
}
.__ik-close:hover { color: #a1a1aa; }

/* ── Key badge ─────────────────────────────────────────────────────────────── */
.__ik-key-row {
  padding: 10px 16px 0;
  flex-shrink: 0;
}

.__ik-key-badge {
  display: inline-block;
  background: #0f0f11;
  border: 1px solid #27272a;
  border-radius: 5px;
  padding: 3px 8px;
  font-size: 12px;
  font-family: ui-monospace, 'Cascadia Code', monospace;
  color: #a1a1aa;
  letter-spacing: 0.01em;
}

/* ── Loading ───────────────────────────────────────────────────────────────── */
.__ik-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 24px 16px;
  color: #71717a;
  font-size: 13px;
}

/* ── Error ─────────────────────────────────────────────────────────────────── */
.__ik-error {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 12px 16px;
  margin: 10px 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 6px;
  color: #f87171;
  font-size: 12px;
  line-height: 1.5;
}
.__ik-error svg { flex-shrink: 0; margin-top: 1px; }

/* ── Locale fields ─────────────────────────────────────────────────────────── */
.__ik-fields {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 10px 16px 12px;
  overflow-y: auto;
  flex: 1 1 auto;
}

.__ik-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 0;
  border-bottom: 1px solid #27272a;
}
.__ik-field:last-child { border-bottom: none; }

.__ik-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
  color: #a1a1aa;
  cursor: default;
  user-select: none;
}

.__ik-flag { font-size: 14px; line-height: 1; }

.__ik-locale-code {
  font-family: ui-monospace, 'Cascadia Code', monospace;
  font-size: 11px;
  background: #0f0f11;
  border: 1px solid #27272a;
  border-radius: 3px;
  padding: 1px 5px;
  color: #a1a1aa;
}

.__ik-locale-name { color: #71717a; }

.__ik-changed {
  color: #fbbf24;
  font-size: 10px;
  margin-left: 2px;
}

.__ik-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 7px 10px;
  border: 1px solid #27272a;
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;
  color: #e4e4e7;
  background: #0f0f11;
  resize: vertical;
  min-height: 36px;
  transition: border-color 0.1s, box-shadow 0.1s;
  line-height: 1.5;
  outline: none;
}
.__ik-textarea:focus {
  border-color: #818cf8;
  box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.12);
}
.__ik-textarea:disabled { background: #27272a; color: #52525b; }

/* ── Footer ────────────────────────────────────────────────────────────────── */
.__ik-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-top: 1px solid #27272a;
  flex-shrink: 0;
  gap: 8px;
}

.__ik-footer-left,
.__ik-footer-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.__ik-btn-cancel,
.__ik-btn-save {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.1s, opacity 0.1s;
  border: 1px solid transparent;
  line-height: 1;
}

.__ik-btn-cancel {
  background: #27272a;
  border-color: #3f3f46;
  color: #a1a1aa;
}
.__ik-btn-cancel:hover:not(:disabled) { background: #3f3f46; }

.__ik-btn-save {
  background: rgba(129, 140, 248, 0.15);
  border-color: rgba(129, 140, 248, 0.25);
  color: #818cf8;
}
.__ik-btn-save:hover:not(:disabled) { background: rgba(129, 140, 248, 0.25); }
.__ik-btn-save:disabled { opacity: 0.45; cursor: default; }

.__ik-success-msg {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #4ade80;
  font-weight: 500;
}

/* ── Spinner ───────────────────────────────────────────────────────────────── */
.__ik-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(129, 140, 248, 0.2);
  border-top-color: #818cf8;
  border-radius: 50%;
  animation: __ik-spin 0.6s linear infinite;
  flex-shrink: 0;
}
.__ik-spinner--sm {
  width: 11px;
  height: 11px;
  border-width: 1.5px;
  border-top-color: #818cf8;
  border-color: rgba(129, 140, 248, 0.2);
}

@keyframes __ik-spin {
  to { transform: rotate(360deg); }
}

/* ── Panel enter/leave transition ──────────────────────────────────────────── */
.__ik-overlay-enter-active,
.__ik-overlay-leave-active {
  transition: opacity 0.15s ease;
}
.__ik-overlay-enter-active .__ik-panel,
.__ik-overlay-leave-active .__ik-panel {
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.__ik-overlay-enter-from,
.__ik-overlay-leave-to {
  opacity: 0;
}
.__ik-overlay-enter-from .__ik-panel,
.__ik-overlay-leave-to .__ik-panel {
  transform: translateY(8px) scale(0.98);
  opacity: 0;
}

/* ── Success flash transition ──────────────────────────────────────────────── */
.__ik-success-enter-active,
.__ik-success-leave-active {
  transition: opacity 0.2s ease;
}
.__ik-success-enter-from,
.__ik-success-leave-to {
  opacity: 0;
}

/* ── iframe editor panel ───────────────────────────────────────────────────── */
.__ik-iframe-panel {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  z-index: 2147483646;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.18);
}

.__ik-iframe-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  height: 36px;
  background: #0f0f11;
  border-bottom: 1px solid #27272a;
  color: #e4e4e7;
  flex-shrink: 0;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 12px;
}

.__ik-iframe-bar-title {
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #818cf8;
}

.__ik-iframe-bar-spacer { flex: 1; }

.__ik-iframe-bar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  color: #71717a;
  padding: 5px;
  border-radius: 4px;
  transition: color 0.1s, background 0.1s;
  line-height: 1;
}
.__ik-iframe-bar-btn:hover {
  color: #e4e4e7;
  background: rgba(255, 255, 255, 0.06);
}
.__ik-iframe-bar-btn--close:hover {
  color: #f87171;
  background: rgba(239, 68, 68, 0.15);
}

.__ik-iframe-el {
  flex: 1;
  border: none;
  width: 100%;
  background: #18181b;
  display: block;
}

/* ── iframe panel slide-in transition ──────────────────────────────────────── */
.__ik-iframe-enter-active,
.__ik-iframe-leave-active {
  transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}
.__ik-iframe-enter-from,
.__ik-iframe-leave-to {
  transform: translateX(100%);
}
</style>
