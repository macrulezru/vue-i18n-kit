/**
 * Tiny window-event-based bus used by I18nInspect and DevOverlay to communicate
 * without a shared module reference (they may run in different Vue app instances).
 *
 * Both components are injected into the user's page as a virtual module, so they
 * share `window` as a reliable communication channel.
 */

export interface I18nEditPayload {
  /** Translation key, e.g. "nav.home" */
  key: string
  /** Optional locale override — defaults to the currently active locale. */
  locale?: string
}

const I18N_EDIT_EVENT = 'vue-i18n-kit:edit'

/** Dispatch an edit request — called by I18nInspect on pencil click. */
export function emitEdit(payload: I18nEditPayload): void {
  window.dispatchEvent(
    new CustomEvent<I18nEditPayload>(I18N_EDIT_EVENT, { detail: payload }),
  )
}

/**
 * Subscribe to edit requests — called by DevOverlay on mount.
 * Returns an unsubscribe function.
 */
export function onEdit(cb: (payload: I18nEditPayload) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<I18nEditPayload>).detail)
  window.addEventListener(I18N_EDIT_EVENT, handler)
  return () => window.removeEventListener(I18N_EDIT_EVENT, handler)
}
