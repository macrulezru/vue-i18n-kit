import { ref, computed } from 'vue'
import type { App, Ref, ComputedRef } from 'vue'
import { createI18nInstance } from './createI18n'
import { I18N_KIT_KEY } from './state'
import type { I18nKitState } from './state'
import { loadLocale } from './utils/loadLocale'
import { loadPersistedLocale, saveLocale } from './utils/persistLocale'
import { extractMessages, extractMeta, extractNamespaces, extractEagerNamespaces } from './utils/localeEntry'
import type { I18nPluginOptions, LocaleMessages, I18nPlugin, I18nService, LocaleInfo } from './types'

const DEFAULT_STORAGE_KEY = 'vue3-i18n-locale'

// ── Namespace helpers ─────────────────────────────────────────────────────────

/**
 * Loads a single namespace for a locale and merges its messages into the
 * i18n instance. Idempotent — no-op if already loaded.
 * @internal — used by useNamespace composable
 */
export async function loadOneNamespace(
  state: I18nKitState,
  lang: string,
  ns: string,
): Promise<void> {
  const nsMap = state.loadedNamespaces.get(lang) ?? new Set<string>()
  if (nsMap.has(ns)) return

  const entry = state.options.locales[lang]
  if (!entry) return
  const namespaces = extractNamespaces(entry)
  const loader = namespaces?.[ns]
  if (!loader) return

  const nsMessages = await loadLocale(loader)

  // Merge namespace keys under the locale's existing messages
  const existing = (state.i18n.global.getLocaleMessage(lang) as Record<string, unknown>) ?? {}
  state.i18n.global.setLocaleMessage(lang, { ...existing, ...nsMessages })

  nsMap.add(ns)
  state.loadedNamespaces.set(lang, nsMap)
}

/**
 * Loads messages for a locale and registers them on the i18n instance.
 * When the locale uses namespaces, loads eager namespaces (all by default).
 * Accepts the per-app state explicitly so this function is SSR-safe.
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
    const entry = options.locales[lang]
    const messageSource = extractMessages(entry)
    const namespaces = extractNamespaces(entry)

    // Load monolithic messages if present and not yet loaded
    if (messageSource && !loadedLocales.has(lang)) {
      const messages = await loadLocale(messageSource)
      i18n.global.setLocaleMessage(lang, messages)
      loadedLocales.add(lang)
    }

    // Load namespace messages
    if (namespaces) {
      const eager = extractEagerNamespaces(entry)
      // undefined → load all; [] → load none; string[] → load listed
      const toLoad = eager === undefined ? Object.keys(namespaces) : eager
      await Promise.all(toLoad.map(ns => loadOneNamespace(state, lang, ns)))

      // Mark locale as "base-loaded" even if it only has namespaces (no messages)
      if (!loadedLocales.has(lang)) loadedLocales.add(lang)
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
 * LocaleDefinition objects (messages + optional metadata + optional namespaces).
 *
 * @example
 * // Monolithic locale file (unchanged API)
 * app.use(createVueI18nPlugin({
 *   defaultLocale: 'en',
 *   locales: {
 *     en: { messages: () => import('./locales/en.json'), meta: { display: 'English' } },
 *   },
 * }))
 *
 * @example
 * // Namespace-split locale files
 * app.use(createVueI18nPlugin({
 *   defaultLocale: 'en',
 *   locales: {
 *     en: {
 *       namespaces: {
 *         auth:      () => import('./locales/split/en/auth.json'),
 *         dashboard: () => import('./locales/split/en/dashboard.json'),
 *       },
 *       eagerNamespaces: ['auth'],  // only auth loads on setLocale; dashboard is lazy
 *       meta: { display: 'English', flag: '🇬🇧' },
 *     },
 *   },
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
    loadNamespace(ns: string, locale?: string): Promise<void> {
      if (!installedState) throw new Error(NOT_INSTALLED)
      const lang = locale ?? (installedState.i18n.global.locale.value as string)
      return loadOneNamespace(installedState, lang, ns)
    },
    isNamespaceLoaded(ns: string, locale?: string): boolean {
      if (!installedState) return false
      const lang = locale ?? (installedState.i18n.global.locale.value as string)
      return installedState.loadedNamespaces.get(lang)?.has(ns) ?? false
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
      const loadedNamespaces = new Map<string, Set<string>>()
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
      const state: I18nKitState = {
        i18n, options, isLoading, loadedLocales, loadedNamespaces, storageKey, localeChangeCallbacks,
      }
      installedState = state
      availableLocalesComputed = computed<LocaleInfo<TMeta>[]>(() =>
        Object.entries(options.locales).map(([code, entry]) => ({
          code,
          meta: extractMeta(entry) as TMeta | undefined,
        })),
      )
      app.provide(I18N_KIT_KEY, state)
      app.use(i18n)

      // Async bootstrap: load the initial locale if it's a lazy function or has namespaces
      const hasNamespaces = !!extractNamespaces(initialEntry ?? {})
      if (typeof initialMessages_ === 'function' || (!initialMessages_ && hasNamespaces)) {
        isLoading.value = true
        setLocale(state, requestedLocale)
          .catch(() => { /* loading failed — isLoading cleared in finally */ })
          .finally(() => { isLoading.value = false })
      }
    },
  }
}
