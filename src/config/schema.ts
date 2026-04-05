export interface LocaleMeta {
  /** Human-readable locale name, shown in the UI switcher */
  display: string
  /** Emoji flag, e.g. '🇬🇧' */
  flag?: string
  /** Text direction (default: ltr) */
  direction?: 'ltr' | 'rtl'
  /** Translator credit */
  author?: string
  /** Dictionary version string */
  version?: string
  /** Any additional project-specific fields */
  [key: string]: unknown
}

export interface LocaleConfig {
  /** BCP 47 locale code: 'en', 'ru', 'zh-CN', etc. */
  code: string
  /** Path to the locale JSON file, relative to project root */
  path: string
  meta: LocaleMeta
  createdAt: string
  updatedAt: string
}

export interface I18nKitConfig {
  /** Config schema version — current: 1 */
  version: number
  /**
   * Path to a base/shared locale directory or i18n-kit.config.json to extend.
   * Base keys are merged underneath project keys (project always wins).
   * Useful for org-wide shared dictionaries.
   * @example "../../shared-i18n"
   * @example "node_modules/@myorg/i18n"
   */
  extends?: string
  /** Directory containing locale JSON files, relative to project root */
  localesDir: string
  /** Directory for generated toolkit files (config, entries map), relative to project root */
  toolkitDir: string
  locales: LocaleConfig[]
  integrations: {
    /** Path to vite.config.ts if present */
    viteConfigPath?: string
    /** Path to nuxt.config.ts if present */
    nuxtConfigPath?: string
    /** Whether vueI18nMapPlugin was automatically added */
    pluginAdded: boolean
    lastUpdated: string
  }
  scanner?: {
    /** Glob patterns for scanning t()/tm()/$t() key usage */
    include: string[]
    exclude: string[]
    lastScan?: string
  }
}
