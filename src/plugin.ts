import { ref, computed } from 'vue'
import type { App, Ref, ComputedRef } from 'vue'
import { createI18nInstance } from './createI18n'
import { I18N_KIT_KEY } from './state'
import type { I18nKitState } from './state'
import { loadLocale } from './utils/loadLocale'
import { loadPersistedLocale, saveLocale } from './utils/persistLocale'
import { extractMessages, extractMeta } from './utils/localeEntry'
import type { I18nPluginOptions, LocaleMessages, I18nPlugin, I18nService, LocaleInfo } from './types'

const DEFAULT_STORAGE_KEY = 'vue3-i18n-locale'

/**
 * Loads messages for a locale and registers them on the i18n instance.
 * Accepts the per-app state explicitly so this function is SSR-safe and can
 * be called from both composables (via `useLocale`) and server entry points.
 *
 * Throws if the locale is not registered in the plugin options.
 */
export async function setLocale(state: I18nKitState, lang: string): Promise<void> {
  const { options, i18n, isLoading, loadedLocales, storageKey } = state

  if (!options.locales[lang]) {
    throw new Error(
      `[vue-i18n-kit] Locale "${lang}" is not registered. Available locales: ${Object.keys(options.locales).join(', ')}`,
    )
  }

  isLoading.value = true

  try {
    if (!loadedLocales.has(lang)) {
      const messages = await loadLocale(extractMessages(options.locales[lang]))
      i18n.global.setLocaleMessage(lang, messages)
      loadedLocales.add(lang)
    }

    i18n.global.locale.value = lang

    if (options.persistLocale) {
      saveLocale(storageKey, lang)
    }

    for (const cb of state.localeChangeCallbacks) {
      cb(lang)
    }
  } finally {
    isLoading.value = false
  }
}

/**
 * Creates the Vue plugin that sets up vue-i18n with lazy-loading support.
 *
 * Locales can be plain message objects, async loader functions, or
 * LocaleDefinition objects (messages + optional metadata).
 *
 * @example
 * app.use(createVueI18nPlugin({
 *   defaultLocale: 'ru',
 *   fallbackLocale: 'en',
 *   locales: {
 *     ru: { messages: () => import('./locales/ru.json'), meta: { display: 'Русский' } },
 *     en: { messages: () => import('./locales/en.json'), meta: { display: 'English' } },
 *   },
 *   persistLocale: true,
 * }))
 */
export function createVueI18nPlugin<
  TMeta extends Record<string, unknown> = Record<string, unknown>,
>(options: I18nPluginOptions): I18nPlugin<TMeta> {
  const NOT_INSTALLED =
    '[vue-i18n-kit] Plugin is not installed yet. Call app.use(plugin) before using service.'

  let installedState: I18nKitState | null = null
  let availableLocalesComputed: ComputedRef<LocaleInfo<TMeta>[]> | null = null

  const service: I18nService<TMeta> = {
    get locale() {
      if (!installedState) throw new Error(NOT_INSTALLED)
      return installedState.i18n.global.locale as Ref<string>
    },
    get isLoading() {
      if (!installedState) throw new Error(NOT_INSTALLED)
      return installedState.isLoading
    },
    setLocale(lang: string): Promise<void> {
      if (!installedState) throw new Error(NOT_INSTALLED)
      return setLocale(installedState, lang)
    },
    get availableLocales() {
      if (!installedState || !availableLocalesComputed) throw new Error(NOT_INSTALLED)
      return availableLocalesComputed
    },
    onLocaleChange(callback: (lang: string) => void): () => void {
      if (!installedState) throw new Error(NOT_INSTALLED)
      installedState.localeChangeCallbacks.add(callback)
      return () => installedState?.localeChangeCallbacks.delete(callback)
    },
  }

  return {
    service,
    install(app: App): void {
      const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY

      // Determine the locale to restore — from localStorage or default
      const persistedLocale = options.persistLocale ? loadPersistedLocale(storageKey) : null
      const requestedLocale =
        persistedLocale && options.locales[persistedLocale] ? persistedLocale : options.defaultLocale

      const isLoading = ref(false)
      const loadedLocales = new Set<string>()
      const initialMessages: Record<string, LocaleMessages> = {}

      // Pre-load initial locale synchronously if messages are already an object
      const initialEntry = options.locales[requestedLocale]
      const initialMessages_ = initialEntry ? extractMessages(initialEntry) : undefined
      if (initialMessages_ && typeof initialMessages_ !== 'function') {
        initialMessages[requestedLocale] = initialMessages_ as LocaleMessages
        loadedLocales.add(requestedLocale)
      }

      // Pre-load fallback locale synchronously so vue-i18n can use it immediately
      const { fallbackLocale } = options
      if (fallbackLocale && fallbackLocale !== requestedLocale) {
        const fallbackEntry = options.locales[fallbackLocale]
        const fallbackMessages_ = fallbackEntry ? extractMessages(fallbackEntry) : undefined
        if (fallbackMessages_ && typeof fallbackMessages_ !== 'function') {
          initialMessages[fallbackLocale] = fallbackMessages_ as LocaleMessages
          loadedLocales.add(fallbackLocale)
        }
      }

      const i18n = createI18nInstance(options, initialMessages, requestedLocale)

      // Provide per-app state — SSR-safe, no module-level singleton
      const localeChangeCallbacks = new Set<(lang: string) => void>()
      const state: I18nKitState = { i18n, options, isLoading, loadedLocales, storageKey, localeChangeCallbacks }
      installedState = state
      availableLocalesComputed = computed<LocaleInfo<TMeta>[]>(() =>
        Object.entries(options.locales).map(([code, entry]) => ({
          code,
          meta: extractMeta(entry) as TMeta | undefined,
        })),
      )
      app.provide(I18N_KIT_KEY, state)

      app.use(i18n)

      // Async bootstrap: load the initial locale if it's a lazy function
      if (typeof initialMessages_ === 'function') {
        isLoading.value = true
        loadLocale(initialMessages_)
          .then((messages) => {
            i18n.global.setLocaleMessage(requestedLocale, messages)
            loadedLocales.add(requestedLocale)
          })
          .catch(() => {
            // Loading failed — isLoading will be cleared below
          })
          .finally(() => {
            isLoading.value = false
          })
      }
    },
  }
}
