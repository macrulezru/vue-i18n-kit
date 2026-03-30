import { inject } from 'vue'
import type { App, InjectionKey, Ref } from 'vue'
import type { I18nPluginOptions } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type I18nInstance = any

export interface I18nKitState {
  i18n: I18nInstance
  options: I18nPluginOptions
  isLoading: Ref<boolean>
  loadedLocales: Set<string>
  storageKey: string
  /** Subscribers notified after every successful locale switch */
  localeChangeCallbacks: Set<(lang: string) => void>
}

export const I18N_KIT_KEY: InjectionKey<I18nKitState> = Symbol('vue-i18n-kit')

/**
 * Use inside Vue `setup()` — retrieves per-app state via `inject`.
 * SSR-safe: each app instance has its own provided state.
 */
export function useI18nKitState(): I18nKitState {
  const state = inject(I18N_KIT_KEY)
  if (!state) {
    throw new Error(
      '[vue-i18n-kit] Plugin not installed. Call app.use(createVueI18nPlugin(...)) before using composables.',
    )
  }
  return state
}

/**
 * Use outside `setup()` (tests, server entry points) — retrieves state from
 * the app instance's provides map.
 */
export function getState(app: App): I18nKitState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const provides = (app as any)._context.provides as Record<symbol, unknown>
  const state = provides[I18N_KIT_KEY as symbol] as I18nKitState | undefined
  if (!state) {
    throw new Error(
      '[vue-i18n-kit] Plugin not installed. Call app.use(createVueI18nPlugin(...)) before using composables.',
    )
  }
  return state
}

/**
 * For use in tests only.
 * No-op in the provide/inject model — each app instance carries its own state,
 * so there is no global singleton to reset between tests.
 */
export function _resetState(): void {
  // intentional no-op
}
