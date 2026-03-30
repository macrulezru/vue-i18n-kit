import type { Ref, ComputedRef, Plugin } from 'vue'

export type LocaleMessages = Record<string, unknown>
export type LocaleLoader = () => Promise<LocaleMessages | { default: LocaleMessages }>

/**
 * Extended locale entry that bundles messages together with arbitrary metadata.
 *
 * The metadata shape is up to the consuming project — common fields include
 * `display` (human-readable name), `flag`, `author`, etc.
 *
 * @example
 * locales: {
 *   en: {
 *     messages: () => import('./locales/en.json'),
 *     meta: { display: 'English', flag: '🇬🇧' },
 *   },
 *   ru: {
 *     messages: () => import('./locales/ru.json'),
 *     meta: { display: 'Русский', flag: '🇷🇺', author: 'Danil Lisin' },
 *   },
 * }
 */
export interface LocaleDefinition<TMeta extends Record<string, unknown> = Record<string, unknown>> {
  /** Pre-loaded message object or async loader function */
  messages: LocaleMessages | LocaleLoader
  /** Arbitrary metadata attached to this locale */
  meta?: TMeta
}

/**
 * A locale value accepted by `createVueI18nPlugin`.
 *
 * Three forms are supported and can be mixed freely:
 * - `LocaleMessages` — plain pre-loaded object
 * - `LocaleLoader` — async loader function `() => import('./...')`
 * - `LocaleDefinition` — object with `messages` + optional `meta`
 */
export type LocaleEntry = LocaleMessages | LocaleLoader | LocaleDefinition

/**
 * Info about a single locale, returned by `useAvailableLocales`.
 * `TMeta` lets callers type the `meta` field for better autocompletion.
 */
export interface LocaleInfo<TMeta extends Record<string, unknown> = Record<string, unknown>> {
  /** Locale code (e.g. 'en', 'ru') */
  code: string
  /** Metadata attached via LocaleDefinition, or undefined if not provided */
  meta: TMeta | undefined
}

/**
 * Service object returned by `createVueI18nPlugin`.
 * Can be used outside of Vue component setup (router guards, Pinia stores, etc.).
 *
 * All properties throw if accessed before `app.use(plugin)`.
 */
export interface I18nService<TMeta extends Record<string, unknown> = Record<string, unknown>> {
  /** Currently active locale ref — same instance as `useLocale().locale` */
  readonly locale: Ref<string>
  /** True while a locale file is being loaded */
  readonly isLoading: Ref<boolean>
  /** Switch the active locale (lazy-loads messages if needed) */
  setLocale(lang: string): Promise<void>
  /** All registered locales with their metadata */
  readonly availableLocales: ComputedRef<LocaleInfo<TMeta>[]>
}

/**
 * Return type of `createVueI18nPlugin`.
 * Satisfies Vue's `Plugin` contract and exposes a `.service` property.
 *
 * @example
 * const i18nPlugin = createVueI18nPlugin({ ... })
 * app.use(i18nPlugin)                     // unchanged
 * i18nPlugin.service.setLocale('en')      // usable anywhere
 */
export type I18nPlugin<TMeta extends Record<string, unknown> = Record<string, unknown>> = Plugin & {
  readonly service: I18nService<TMeta>
}

export interface I18nPluginOptions {
  /** Default locale to use on startup */
  defaultLocale: string

  /** Fallback locale when a key is missing in the active locale */
  fallbackLocale?: string

  /**
   * Map of locale codes to messages, lazy loaders, or full LocaleDefinition objects.
   *
   * @example
   * // Simple lazy loader
   * locales: { en: () => import('./locales/en.json') }
   *
   * // With metadata
   * locales: {
   *   en: { messages: () => import('./locales/en.json'), meta: { display: 'English' } },
   *   ru: { messages: () => import('./locales/ru.json'), meta: { display: 'Русский' } },
   * }
   */
  locales: Record<string, LocaleEntry>

  /** Persist the selected locale in localStorage between sessions */
  persistLocale?: boolean

  /** localStorage key to store the locale (default: 'vue3-i18n-locale') */
  storageKey?: string

  /** Extra options passed directly to vue-i18n's createI18n */
  vueI18nOptions?: Record<string, unknown>
}
