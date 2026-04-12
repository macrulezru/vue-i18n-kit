/**
 * v-i18n-inspect — dev-only Vue directive for dynamic translation keys.
 *
 * Attaches hover-triggered pencil-button behaviour directly to an existing
 * element without wrapping it in an extra DOM node.  Useful for runtime keys
 * that cannot be statically analysed by `wrapTranslationCalls`:
 *
 * ```html
 * <span v-i18n-inspect="myKey">{{ t(myKey) }}</span>
 * <li v-for="item in items" v-i18n-inspect="'items.' + item.id">
 *   {{ t('items.' + item.id) }}
 * </li>
 * ```
 *
 * The directive is a complete no-op in production: it is only registered by
 * `vueI18nDevPlugin` in dev mode, so the attribute is silently ignored by Vue
 * in production builds.
 */
import type { ObjectDirective } from 'vue'
import { emitEdit } from './eventBus'

// ── Internal state ────────────────────────────────────────────────────────────

interface DirectiveState {
  /** Current translation key (updated reactively via `updated` hook). */
  key: string
  /** The pencil button appended to `el` while hovered; `null` when not shown. */
  btn: HTMLButtonElement | null
  /** Whether WE set `position: relative` on `el` — restored on unmount. */
  setPosition: boolean
  onEnter: () => void
  onLeave: () => void
}

const _state = new WeakMap<HTMLElement, DirectiveState>()

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Creates a pencil button whose click handler always uses the CURRENT key
 * via the `getKey` closure — so re-creating the button on key updates is
 * unnecessary.
 */
function createBtn(getKey: () => string): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = '__ik-btn'
  // Feather "edit-2" pencil icon — same as I18nInspect.vue
  btn.innerHTML =
    `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" ` +
    `stroke="currentColor" stroke-width="2.5" stroke-linecap="round" ` +
    `stroke-linejoin="round" aria-hidden="true">` +
    `<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>` +
    `</svg>`
  btn.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation()
    emitEdit({ key: getKey() })
  })
  return btn
}

// ── Directive ─────────────────────────────────────────────────────────────────

export const vI18nInspect: ObjectDirective<HTMLElement, string> = {
  mounted(el, binding) {
    // Make `el` an offset parent so the absolute-positioned button lands
    // correctly.  Only touch inline style when the computed position is static
    // (the default); leave any existing positioned value untouched.
    const setPosition = window.getComputedStyle(el).position === 'static'
    if (setPosition) el.style.position = 'relative'

    const state: DirectiveState = {
      key: binding.value,
      btn: null,
      setPosition,
      onEnter() {
        el.classList.add('__ik-w--on')
        if (!state.btn) {
          state.btn = createBtn(() => state.key)
          state.btn.title = `vue-i18n-kit › ${state.key}`
          el.appendChild(state.btn)
        }
      },
      onLeave() {
        el.classList.remove('__ik-w--on')
        if (state.btn) {
          state.btn.remove()
          state.btn = null
        }
      },
    }

    el.addEventListener('mouseenter', state.onEnter)
    el.addEventListener('mouseleave', state.onLeave)
    _state.set(el, state)
  },

  updated(el, binding) {
    if (binding.value === binding.oldValue) return
    const state = _state.get(el)
    if (!state) return
    state.key = binding.value
    // If the button is currently visible, update its tooltip immediately.
    if (state.btn) state.btn.title = `vue-i18n-kit › ${binding.value}`
  },

  unmounted(el) {
    const state = _state.get(el)
    if (!state) return
    el.removeEventListener('mouseenter', state.onEnter)
    el.removeEventListener('mouseleave', state.onLeave)
    state.btn?.remove()
    if (state.setPosition) el.style.position = ''
    _state.delete(el)
  },
}
