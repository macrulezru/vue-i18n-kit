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

export interface I18nKitRules {
  /** Interpolation patterns considered as placeholders, e.g. ["{var}", "{{var}}"] */
  interpolationPatterns?: string[]
  /** Length warning threshold: warn if value.length > ref.length * factor; 0 = disabled */
  lengthWarningFactor?: number
  /** Warn when values contain HTML tags */
  warnOnHtmlTags?: boolean
  /** Warn on malformed ICU syntax (unclosed braces, missing other{}) */
  warnOnIcuErrors?: boolean
  /** Warn when a key has identical values across all locales */
  warnOnDuplicateValues?: boolean
  /** Warn if value length is below this minimum; 0 = disabled */
  minValueLength?: number
}

export interface I18nKitIgnore {
  /** Keys that prune will never remove — supports glob: "status.*" */
  prune?: string[]
  /** Keys excluded from duplicate-value warnings */
  duplicates?: string[]
  /** Keys excluded from unused-key warnings in the editor */
  unused?: string[]
  /** File/directory glob patterns excluded from the source scanner */
  scanExclude?: string[]
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
  /** Validation rules for the editor and Vite plugin */
  rules?: I18nKitRules
  /** Whitelist/exclusion rules for prune, duplicate detector, unused detector, and scanner */
  ignore?: I18nKitIgnore
  /**
   * Keys that cannot be overridden by child projects (base config only).
   * Supports glob patterns: "legal.*", "brand.name"
   */
  locked?: string[]
  integrations: {
    /** Path to vite.config.ts if present */
    viteConfigPath?: string
    /** Path to nuxt.config.ts if present */
    nuxtConfigPath?: string
    /** Whether vueI18nMapPlugin was automatically added */
    pluginAdded: boolean
    lastUpdated: string
  }
  /**
   * Track when reference locale values change so other locales can be flagged
   * as "needs review". Hashes are stored in i18n-kit.notes.json.
   * @default false
   */
  staleTracking?: boolean
  /**
   * Machine translation settings. API keys should be stored in the UI
   * (localStorage) rather than in this file for security reasons.
   */
  translation?: {
    /**
     * Translation engine to use.
     * @default "libretranslate"
     */
    engine?: 'libretranslate' | 'deepl'
    deepl?: {
      /**
       * Formality level for target text. Only supported by some languages
       * (DE, FR, IT, ES, NL, PL, PT, JA, RU).
       * @default "default"
       */
      formality?: 'default' | 'more' | 'less' | 'prefer_more' | 'prefer_less'
    }
    libretranslate?: {
      /** LibreTranslate instance URL */
      apiUrl?: string
    }
  }
  /**
   * Enable namespace mode: treat top-level JSON keys as namespaces.
   * - CLI: `vue-i18n-kit split` / `vue-i18n-kit merge-ns`
   * - Editor: shows a namespace filter bar above the key table.
   * @default false
   */
  namespaces?: boolean
  /**
   * Translation memory settings.
   * Stores past translations in i18n-kit.memory.json and suggests them
   * when editing cells in the UI.
   */
  memory?: {
    /**
     * Set to false to disable translation memory entirely.
     * @default true
     */
    enabled?: boolean
  }
  scanner?: {
    /** Glob patterns for scanning t()/tm()/$t() key usage */
    include: string[]
    exclude: string[]
    lastScan?: string
  }
}
