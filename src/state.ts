import type { Ref } from 'vue'
import type { I18nPluginOptions } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type I18nInstance = any

export interface I18nKitState {
  i18n: I18nInstance
  options: I18nPluginOptions
  isLoading: Ref<boolean>
  loadedLocales: Set<string>
  storageKey: string
}

let _state: I18nKitState | null = null

export function setState(state: I18nKitState): void {
  _state = state
}

export function getState(): I18nKitState {
  if (!_state) {
    throw new Error(
      '[vue-i18n-kit] Plugin not installed. Call app.use(createVueI18nPlugin(...)) before using composables.',
    )
  }
  return _state
}

/** For use in tests only — resets the module-level singleton. */
export function _resetState(): void {
  _state = null
}
