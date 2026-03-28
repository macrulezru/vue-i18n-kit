import { ref } from 'vue'
import type { App, Plugin } from 'vue'
import { createI18nInstance } from './createI18n'
import { getState, setState } from './state'
import { loadLocale } from './utils/loadLocale'
import { loadPersistedLocale, saveLocale } from './utils/persistLocale'
import { extractMessages, isLocaleDefinition } from './utils/localeEntry'
import type { I18nPluginOptions, LocaleMessages } from './types'

const DEFAULT_STORAGE_KEY = 'vue3-i18n-locale'

/**
 * Loads messages for a locale and registers them on the i18n instance.
 * Throws if the locale is not registered in the plugin options.
 */
export async function setLocale(lang: string): Promise<void> {
  const state = getState()
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
export function createVueI18nPlugin(options: I18nPluginOptions): Plugin {
  return {
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

      setState({ i18n, options, isLoading, loadedLocales, storageKey })

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
