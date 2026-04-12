import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { compareLocales } from '../utils/localeKeys'
import { buildEntriesMap } from '../utils/scanner'
import type { LocaleMismatch } from '../utils/localeKeys'

// ResolvedConfig used only internally — Plugin is NOT imported to avoid
// structural type conflicts between different vite versions in consuming projects.
import type { ResolvedConfig } from 'vite'

/**
 * Minimal structural plugin interface compatible with any Vite version.
 * Vite's `plugins` array accepts any object that satisfies this shape.
 */
export interface VitePlugin {
  name: string
  enforce?: 'pre' | 'post'
  configResolved?(config: unknown): void
  buildStart?(this: { warn(msg: string | { message: string }): void; error(msg: string | { message: string }): void }): void
  handleHotUpdate?(ctx: unknown): void
  resolveId?(id: string, importer?: string): string | null | undefined
  load?(id: string): string | null | undefined
  transform?(code: string, id: string): string | null | undefined
  /**
   * Plain function form runs as post-hook (after Vite's own HTML transform),
   * so bare-specifier imports in injected scripts are NOT rewritten.
   * Use the object form with `order: 'pre'` to run before Vite's transform.
   */
  transformIndexHtml?:
    | ((html: string, ctx?: unknown) => HtmlTagDescriptor[] | void)
    | { order?: 'pre' | 'post'; handler: (html: string, ctx?: unknown) => HtmlTagDescriptor[] | void }
}

/** Minimal Vite HtmlTagDescriptor — enough to inject script/link tags. */
export interface HtmlTagDescriptor {
  tag: string
  attrs?: Record<string, string | boolean | undefined>
  children?: string | HtmlTagDescriptor[]
  injectTo?: 'head' | 'body' | 'head-prepend' | 'body-prepend'
}

export interface I18nKitRules {
  interpolationPatterns?: string[]
  lengthWarningFactor?: number
  warnOnHtmlTags?: boolean
  warnOnIcuErrors?: boolean
  warnOnDuplicateValues?: boolean
  minValueLength?: number
}

export interface I18nCheckPluginOptions {
  /**
   * Path to the directory containing locale JSON files,
   * relative to the Vite project root.
   * @default 'src/locales'
   */
  localesDir?: string

  /**
   * Locale code used as the reference when comparing keys.
   * Defaults to the first file found alphabetically.
   */
  defaultLocale?: string

  /**
   * When true, missing keys cause the build to fail with an error.
   * When false (default), missing keys produce warnings only.
   * @default false
   */
  failOnMissing?: boolean

  /**
   * Validation rules — overrides defaults for length, placeholders, etc.
   * These are the same rules configurable in `i18n-kit.config.json`.
   */
  rules?: I18nKitRules
}

function loadLocaleFiles(dir: string): Record<string, Record<string, unknown>> {
  if (!existsSync(dir)) return {}

  const result: Record<string, Record<string, unknown>> = {}
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()

  for (const file of files) {
    const locale = file.slice(0, -5)
    try {
      const content = readFileSync(join(dir, file), 'utf-8')
      result[locale] = JSON.parse(content) as Record<string, unknown>
    } catch {
      // Malformed files are skipped; they'll show up as empty locales in comparisons
    }
  }

  return result
}

function buildReport(mismatches: LocaleMismatch[], refLocale: string): string {
  const lines: string[] = [
    `[vue-i18n-kit] Incomplete translations detected (reference: "${refLocale}"):`,
  ]

  for (const m of mismatches) {
    lines.push(`  Locale "${m.locale}":`)
    if (m.missing.length) {
      lines.push(`    Missing keys (${m.missing.length}):`)
      m.missing.forEach((k) => lines.push(`      - ${k}`))
    }
    if (m.extra.length) {
      lines.push(`    Extra keys (${m.extra.length}):`)
      m.extra.forEach((k) => lines.push(`      + ${k}`))
    }
  }

  return lines.join('\n')
}

/**
 * Vite plugin that checks locale JSON files for missing or extra translation keys.
 *
 * During development it runs on every locale file save (HMR).
 * During builds it runs at `buildStart` — set `failOnMissing: true` to
 * abort the build when keys are incomplete.
 *
 * @example
 * // vite.config.ts
 * import { vueI18nCheckPlugin } from 'vue-i18n-kit/vite'
 *
 * export default defineConfig({
 *   plugins: [
 *     vueI18nCheckPlugin({
 *       localesDir: 'src/locales',
 *       defaultLocale: 'en',
 *       failOnMissing: true,   // fail the build on missing keys
 *     }),
 *   ],
 * })
 */
export function vueI18nCheckPlugin(options: I18nCheckPluginOptions = {}): VitePlugin {
  const { localesDir = 'src/locales', defaultLocale, failOnMissing = false } = options

  let resolvedLocalesDir = ''

  function runCheck(
    emit: (type: 'warn' | 'error', message: string) => void,
  ): void {
    const locales = loadLocaleFiles(resolvedLocalesDir)
    const localeNames = Object.keys(locales)
    if (localeNames.length < 2) return

    const refLocale = defaultLocale ?? localeNames[0]
    const reference = locales[refLocale]

    if (!reference) {
      emit('warn', `[vue-i18n-kit] Default locale "${refLocale}" not found in ${resolvedLocalesDir}`)
      return
    }

    const others: Record<string, Record<string, unknown>> = {}
    for (const [name, messages] of Object.entries(locales)) {
      if (name !== refLocale) others[name] = messages
    }

    const mismatches = compareLocales(reference, others)
    if (mismatches.length === 0) return

    const report = buildReport(mismatches, refLocale)
    emit(failOnMissing ? 'error' : 'warn', report)
  }

  return {
    name: 'vue-i18n-kit:check',
    enforce: 'pre',

    configResolved(config: unknown) {
      const cfg = config as ResolvedConfig
      resolvedLocalesDir = resolve(cfg.root, localesDir)
    },

    buildStart() {
      runCheck((type, message) => {
        if (type === 'error') {
          this.error(message)
        } else {
          this.warn(message)
        }
      })
    },

    handleHotUpdate(ctx: unknown) {
      const { file, server } = ctx as { file: string; server: { config: ResolvedConfig } };
      if (file.startsWith(resolvedLocalesDir) && file.endsWith('.json')) {
        runCheck((type, message) => {
          const log = (server.config as unknown as { logger: { warn: (m: string) => void; error: (m: string) => void } }).logger
          if (type === 'error') {
            log.error(message)
          } else {
            log.warn(message)
          }
        })
      }
    },
  }
}

// ── Map plugin ────────────────────────────────────────────────────────────────

export interface I18nMapLocaleConfig {
  /** Path to the locale JSON file, relative to project root */
  path: string
  /** Arbitrary metadata (same shape as LocaleDefinition.meta) */
  meta?: Record<string, unknown>
}

export interface LocaleMapEntry {
  /** Locale identifier, e.g. "ru", "en" */
  code: string
  /** Resolved absolute path to the locale JSON file */
  path: string
  /** Arbitrary metadata attached to this locale */
  meta?: Record<string, unknown>
}

export interface LocaleMap {
  /** Absolute path to the project root */
  root: string
  /** ISO timestamp of when the map was generated */
  generatedAt: string
  locales: LocaleMapEntry[]
}

export interface I18nMapPluginOptions {
  /**
   * Map of locale codes to their file paths and optional metadata.
   * Accepts either a plain path string or a `{ path, meta }` object.
   *
   * @example
   * locales: {
   *   en: { path: 'src/locales/en.json', meta: { display: 'English' } },
   *   ru: { path: 'src/locales/ru.json', meta: { display: 'Русский' } },
   * }
   */
  locales: Record<string, string | I18nMapLocaleConfig>
  /**
   * Output path for the generated map file, relative to project root.
   * @default 'i18n-tools/locales.config.json'
   */
  output?: string
}

/**
 * Vite plugin that dumps a locale map to `i18n-tools/locales.config.json`
 * when Vite is started in `--mode i18n-dump` mode, then exits immediately.
 *
 * Add this script to your project's package.json:
 * ```json
 * "i18n:ui": "vite --mode i18n-dump && vue-i18n-kit ui"
 * ```
 *
 * The map is regenerated every time before the editor starts.
 * The generated file can be added to `.gitignore`.
 *
 * @example
 * // vite.config.ts
 * import { vueI18nMapPlugin } from 'vue-i18n-kit/vite'
 *
 * export default defineConfig({
 *   plugins: [
 *     vueI18nMapPlugin({
 *       locales: {
 *         en: { path: 'src/locales/en.json', meta: { display: 'English', flag: '🇬🇧' } },
 *         ru: { path: 'src/locales/ru.json', meta: { display: 'Русский', flag: '🇷🇺' } },
 *       },
 *     }),
 *   ],
 * })
 */
// ── Plugin ────────────────────────────────────────────────────────────────────

export function vueI18nMapPlugin(options: I18nMapPluginOptions): VitePlugin {
  const { locales, output = 'i18n-tools/locales.config.json' } = options

  return {
    name: 'vue-i18n-kit:map',
    enforce: 'pre',

    configResolved(config: unknown) {
      const cfg = config as ResolvedConfig
      if (cfg.mode !== 'i18n-dump') return

      const root = cfg.root
      const outDir = dirname(resolve(root, output))

      // ── locales.config.json ──────────────────────────────────────────────
      const localeEntries: LocaleMapEntry[] = Object.entries(locales).map(([code, entry]) => {
        const localeConfig: I18nMapLocaleConfig =
          typeof entry === 'string' ? { path: entry } : entry

        const result: LocaleMapEntry = {
          code,
          path: resolve(root, localeConfig.path),
        }
        if (localeConfig.meta !== undefined) result.meta = localeConfig.meta
        return result
      })

      const localesMap: LocaleMap = {
        root,
        generatedAt: new Date().toISOString(),
        locales: localeEntries,
      }

      mkdirSync(outDir, { recursive: true })
      writeFileSync(resolve(root, output), JSON.stringify(localesMap, null, 2) + '\n', 'utf-8')
      cfg.logger.info(`[vue-i18n-kit] Locale map written to ${output}`)

      // ── locales.entries.json ─────────────────────────────────────────────
      const entriesMap = buildEntriesMap(root)
      const entriesOutput = output.replace(/[^/\\]+$/, 'locales.entries.json')
      writeFileSync(
        resolve(root, entriesOutput),
        JSON.stringify(entriesMap, null, 2) + '\n',
        'utf-8',
      )
      cfg.logger.info(`[vue-i18n-kit] Locale entries written to ${entriesOutput}`)

      process.nextTick(() => process.exit(0))
    },
  }
}

// ── Inline plugin ─────────────────────────────────────────────────────────────

const VIRTUAL_MODULE_ID = 'virtual:vue-i18n-kit/locales'
const RESOLVED_ID = '\0' + VIRTUAL_MODULE_ID

export interface I18nInlinePluginOptions {
  /**
   * Map of locale codes to their JSON file paths (relative to project root).
   * Accepts a plain path string or a `{ path, meta }` object.
   *
   * @example
   * locales: {
   *   en: 'src/locales/en.json',
   *   ru: { path: 'src/locales/ru.json', meta: { display: 'Русский' } },
   * }
   */
  locales: Record<string, string | { path: string; meta?: Record<string, unknown> }>
}

/**
 * Vite plugin that provides a virtual module `virtual:vue-i18n-kit/locales`
 * exporting all locale JSON files as a static object baked into the bundle.
 *
 * This eliminates runtime HTTP requests for locale files — useful for
 * SSR, offline apps, or small projects that want zero loading latency.
 *
 * @example
 * // vite.config.ts
 * import { vueI18nInlinePlugin } from 'vue-i18n-kit/vite'
 *
 * export default defineConfig({
 *   plugins: [
 *     vueI18nInlinePlugin({
 *       locales: {
 *         en: 'src/locales/en.json',
 *         ru: 'src/locales/ru.json',
 *       },
 *     }),
 *   ],
 * })
 *
 * // your app setup
 * import inlineLocales from 'virtual:vue-i18n-kit/locales'
 * import { createI18n } from 'vue-i18n-kit'
 *
 * const i18n = createI18n({
 *   locales: {
 *     en: inlineLocales.en,   // plain object — no lazy loading
 *     ru: inlineLocales.ru,
 *   },
 *   defaultLocale: 'en',
 * })
 */
export function vueI18nInlinePlugin(options: I18nInlinePluginOptions): VitePlugin {
  const { locales } = options
  let root = ''

  return {
    name: 'vue-i18n-kit:inline',
    enforce: 'pre',

    configResolved(config: unknown) {
      root = (config as ResolvedConfig).root
    },

    resolveId(id: string) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_ID
    },

    load(id: string) {
      if (id !== RESOLVED_ID) return

      const result: Record<string, unknown> = {}

      for (const [code, entry] of Object.entries(locales)) {
        const locPath = typeof entry === 'string' ? entry : entry.path
        const absPath = resolve(root, locPath)

        if (!existsSync(absPath)) {
          console.warn(`[vue-i18n-kit:inline] Locale file not found: ${absPath}`)
          result[code] = {}
          continue
        }

        try {
          result[code] = JSON.parse(readFileSync(absPath, 'utf-8')) as Record<string, unknown>
        } catch {
          console.warn(`[vue-i18n-kit:inline] Failed to parse: ${absPath}`)
          result[code] = {}
        }
      }

      return `export default ${JSON.stringify(result, null, 2)}`
    },
  }
}

// ── Namespace plugin ──────────────────────────────────────────────────────────

const NS_VIRTUAL_ID   = 'virtual:vue-i18n-namespaces'
const NS_RESOLVED_ID  = '\0' + NS_VIRTUAL_ID

export interface I18nNamespaceLocaleConfig {
  /** Arbitrary metadata forwarded to LocaleDefinition.meta */
  meta?: Record<string, unknown>
  /**
   * Namespaces to load immediately when this locale is activated.
   * Omit to load all namespaces eagerly.
   * Pass `[]` for fully lazy loading (use `useNamespace()` to load on demand).
   */
  eagerNamespaces?: string[]
}

export interface I18nNamespacePluginOptions {
  /**
   * Directory containing locale subdirectories with namespace JSON files.
   * Each subdirectory name is a locale code; each JSON file inside is a namespace.
   *
   * @example 'src/locales/split'  →  split/en/auth.json, split/en/dashboard.json
   * @default 'src/locales/split'
   */
  dir?: string
  /**
   * Optional per-locale config (metadata, eagerNamespaces).
   * Locales found in the directory but not listed here are included automatically.
   */
  locales?: Record<string, I18nNamespaceLocaleConfig>
}

/**
 * Vite plugin that scans a namespace directory and generates the virtual module
 * `virtual:vue-i18n-namespaces` with per-locale namespace loaders.
 *
 * **Setup (vite.config.ts):**
 * ```ts
 * import { vueI18nNamespacePlugin } from 'vue-i18n-kit/vite'
 *
 * export default defineConfig({
 *   plugins: [
 *     vueI18nNamespacePlugin({
 *       dir: 'src/locales/split',
 *       locales: {
 *         en: { meta: { display: 'English', flag: '🇬🇧' }, eagerNamespaces: ['common'] },
 *         ru: { meta: { display: 'Русский',  flag: '🇷🇺' } },
 *       },
 *     }),
 *   ],
 * })
 * ```
 *
 * **main.ts:**
 * ```ts
 * import { locales } from 'virtual:vue-i18n-namespaces'
 *
 * app.use(createVueI18nPlugin({ defaultLocale: 'en', locales }))
 * ```
 *
 * **Lazy load a namespace in a component:**
 * ```ts
 * import { useNamespace } from 'vue-i18n-kit'
 * const { isLoading } = useNamespace('dashboard')
 * ```
 *
 * TypeScript: add to `env.d.ts` or `vite-env.d.ts`:
 * ```ts
 * declare module 'virtual:vue-i18n-namespaces' {
 *   import type { LocaleEntry } from 'vue-i18n-kit'
 *   export const locales: Record<string, LocaleEntry>
 * }
 * ```
 */
export function vueI18nNamespacePlugin(options: I18nNamespacePluginOptions = {}): VitePlugin {
  const { dir = 'src/locales/split', locales: localeCfg = {} } = options
  let root = ''

  return {
    name: 'vue-i18n-kit:namespaces',
    enforce: 'pre',

    configResolved(config: unknown) {
      root = (config as ResolvedConfig).root
    },

    resolveId(id: string) {
      if (id === NS_VIRTUAL_ID) return NS_RESOLVED_ID
    },

    load(id: string) {
      if (id !== NS_RESOLVED_ID) return

      const absDir = resolve(root, dir)
      if (!existsSync(absDir)) {
        console.warn(`[vue-i18n-kit:namespaces] Directory not found: ${absDir}`)
        return `export const locales = {}`
      }

      // Collect locale subdirectories
      const localeDirs = readdirSync(absDir).filter(entry => {
        try { return statSync(join(absDir, entry)).isDirectory() } catch { return false }
      })

      const localeEntries: string[] = []

      for (const code of localeDirs.sort()) {
        const localeDir = join(absDir, code)
        const nsFiles = readdirSync(localeDir).filter(f => f.endsWith('.json')).sort()
        if (nsFiles.length === 0) continue

        const cfg = localeCfg[code] ?? {}
        const nsEntries: string[] = []

        for (const nsFile of nsFiles) {
          const ns = nsFile.replace(/\.json$/, '')
          const absPath = join(localeDir, nsFile).replace(/\\/g, '/')
          // Use dynamic import so Vite code-splits each namespace file
          nsEntries.push(`        ${JSON.stringify(ns)}: () => import(${JSON.stringify(absPath)})`)
        }

        const metaStr = cfg.meta ? `,\n      meta: ${JSON.stringify(cfg.meta)}` : ''
        const eagerStr = cfg.eagerNamespaces !== undefined
          ? `,\n      eagerNamespaces: ${JSON.stringify(cfg.eagerNamespaces)}`
          : ''

        localeEntries.push(
          `  ${JSON.stringify(code)}: {\n    namespaces: {\n${nsEntries.join(',\n')}\n      }${metaStr}${eagerStr}\n  }`
        )
      }

      return [
        `export const locales = {`,
        localeEntries.join(',\n'),
        `}`,
      ].join('\n')
    },

    // HMR: reload module when any namespace file changes
    handleHotUpdate(ctx: unknown) {
      const { file, server } = ctx as { file: string; modules: unknown[]; server: { moduleGraph: { getModuleById(id: string): unknown }; reloadModule(mod: unknown): void } }
      const absDir = resolve(root, dir)
      if (file.startsWith(absDir) && file.endsWith('.json')) {
        const mod = server.moduleGraph.getModuleById(NS_RESOLVED_ID)
        if (mod) server.reloadModule(mod)
      }
    },
  }
}

// ── Dev overlay plugin ────────────────────────────────────────────────────────

const DEV_VIRTUAL_ID   = 'virtual:vue-i18n-kit/dev-overlay'
const DEV_RESOLVED_ID  = '\0' + DEV_VIRTUAL_ID

export interface I18nDevPluginOptions {
  /**
   * URL of the running `vue-i18n-kit ui` server.
   *
   * When the app is started via `vue-i18n-kit dev`, this is set automatically
   * through the `I18N_KIT_UI_URL` environment variable — you can omit this
   * option entirely in that case.
   *
   * @default process.env.I18N_KIT_UI_URL ?? 'http://localhost:4173'
   */
  uiUrl?: string

  /**
   * Automatically wrap `t()` / `tm()` / `$t()` calls found in Vue template
   * interpolations (`{{ }}`) with `<I18nInspect i18n-key="…">` in dev mode.
   *
   * Only literal string keys are wrapped; dynamic keys are skipped.
   * Set to `false` to opt out and use `<I18nInspect>` explicitly.
   * @default true
   */
  autoWrap?: boolean

  /**
   * List of function names to look for in template interpolations.
   * @default ['t', 'tm', '$t']
   */
  wrapFunctions?: string[]

  /**
   * Width of the iframe editor panel opened via «Open in editor panel».
   * Accepts any valid CSS width value.
   * @default '480px'
   */
  iframeWidth?: string
}

/**
 * Vite plugin that enables in-context translation editing.
 *
 * **Active only in `vite serve` (development) mode** — complete no-op during
 * production builds. Nothing from this plugin ends up in the final bundle.
 *
 * When active the plugin:
 * 1. Injects a virtual module into the page that mounts the `DevOverlay`
 *    as a standalone Vue app on `document.body`.
 * 2. Exposes `window.__I18N_KIT_INSPECT_COMPONENT__` so the `I18nInspect`
 *    component can be registered in the user app (done automatically by the
 *    transform sub-plugin added in a later iteration).
 * 3. Sets `window.__I18N_KIT_UI_URL__` for the overlay to communicate with
 *    the `vue-i18n-kit ui` server.
 *
 * @example
 * // vite.config.ts
 * import { vueI18nDevPlugin } from 'vue-i18n-kit/vite'
 *
 * export default defineConfig({
 *   plugins: [
 *     vue(),
 *     vueI18nDevPlugin({ uiUrl: 'http://localhost:4173' }),
 *   ],
 * })
 */
export function vueI18nDevPlugin(options: I18nDevPluginOptions = {}): VitePlugin {
  const {
    uiUrl = process.env['I18N_KIT_UI_URL'] ?? 'http://localhost:4173',
    autoWrap = true,
    wrapFunctions = ['t', 'tm', '$t'],
    iframeWidth = '100vw',
  } = options
  let isServe = false

  // __dirname is available here via tsup's `shims: true` option, which injects
  // a fileURLToPath-based shim in the ESM output so it works identically in
  // both dist/vite-plugin/index.js (CJS) and dist/vite-plugin/index.mjs (ESM).
  // At runtime __dirname === dist/vite-plugin/, so joining 'dev-overlay/index.js'
  // points to the pre-compiled overlay bundle.
  const overlayIndexPath = join(__dirname, 'dev-overlay', 'index.js')

  return {
    name: 'vue-i18n-kit:dev',
    enforce: 'pre',

    configResolved(config: unknown) {
      const cfg = config as ResolvedConfig
      isServe = (cfg as unknown as { command: string }).command === 'serve'
    },

    resolveId(id: string) {
      if (!isServe) return
      if (id === DEV_VIRTUAL_ID) return DEV_RESOLVED_ID
    },

    load(id: string) {
      if (!isServe) return
      if (id !== DEV_RESOLVED_ID) return
      return buildDevOverlayCode(uiUrl, overlayIndexPath, iframeWidth)
    },

    transform(code: string, id: string) {
      if (!isServe || !autoWrap) return
      // Only raw .vue files (no query params — those are compiled sub-blocks)
      if (!id.endsWith('.vue') || id.includes('?')) return
      return wrapTranslationCalls(code, wrapFunctions)
    },

    // Use `src` pointing at the canonical Vite virtual-module URL so the
    // browser can fetch it directly without any specifier rewriting.
    // Virtual modules resolved to `\0<id>` are served by Vite at
    // `/@id/__x00__<id>` — this is stable across Vite v4/v5/v6/v7.
    transformIndexHtml(_html: string) {
      if (!isServe) return []
      return [
        {
          tag: 'script',
          attrs: { type: 'module', src: `/@id/__x00__${DEV_VIRTUAL_ID}` },
          injectTo: 'head',
        },
      ]
    },
  }
}

/**
 * Rewrites a Vue SFC's `<template>` block in dev mode: wraps every
 * `{{ t('key') }}` / `{{ tm('key') }}` / `{{ $t('key') }}` interpolation
 * with `<I18nInspect i18n-key="key">{{ … }}</I18nInspect>`.
 *
 * Rules:
 * - Only interpolations (`{{ }}`), never element attributes.
 * - Only literal string keys — dynamic expressions are skipped.
 * - Already-wrapped calls (immediately followed by `</I18nInspect>`) are not
 *   double-wrapped, so files with explicit `<I18nInspect>` markup are safe.
 * - Template literals containing `${}` are skipped (dynamic key).
 *
 * Returns `undefined` (no change) when the template is unchanged.
 *
 * @internal exported for unit-testing
 */
export function wrapTranslationCalls(source: string, fnAliases: string[]): string | undefined {
  // Locate the <template> block (Vue SFC has exactly one)
  const templateStart = source.indexOf('<template')
  if (templateStart === -1) return

  const tagEnd = source.indexOf('>', templateStart)
  if (tagEnd === -1) return

  const templateClose = source.lastIndexOf('</template>')
  if (templateClose === -1 || templateClose <= tagEnd) return

  const before  = source.slice(0, tagEnd + 1)
  const content = source.slice(tagEnd + 1, templateClose)
  const after   = source.slice(templateClose)

  // Sort longest name first so e.g. 'tm' is matched before 't'
  const sorted = [...fnAliases].sort((a, b) => b.length - a.length)
  const escapedNames = sorted.map(n => n.replace(/[$]/g, '\\$')).join('|')

  // Match the opening of a translation interpolation: {{ fnName('key'
  // Group 1 = quote char, Group 2 = literal key content
  const startRe = new RegExp(
    `\\{\\{\\s*(?:${escapedNames})\\(\\s*(['"\`])([^'"\`\\n]+)\\1`,
    'g',
  )

  let result = ''
  let cursor = 0

  let m: RegExpExecArray | null
  while ((m = startRe.exec(content)) !== null) {
    const interpStart = m.index
    const key = m[2]

    // Skip template literals with dynamic expressions
    if (key.includes('${')) continue

    // Find matching }} by counting {{ / }} pairs
    let depth = 0
    let i = interpStart
    let interpEnd = -1

    while (i < content.length - 1) {
      if (content[i] === '{' && content[i + 1] === '{') {
        depth++
        i += 2
      } else if (content[i] === '}' && content[i + 1] === '}') {
        depth--
        if (depth === 0) {
          interpEnd = i + 2
          break
        }
        i += 2
      } else {
        i++
      }
    }

    if (interpEnd === -1) continue

    // Skip if already wrapped — text right after the interpolation starts with </I18nInspect>
    if (/^\s*<\/I18nInspect>/.test(content.slice(interpEnd))) {
      result += content.slice(cursor, interpEnd)
      cursor = interpEnd
      startRe.lastIndex = interpEnd
      continue
    }

    const safeKey    = key.replace(/"/g, '&quot;')
    const fullInterp = content.slice(interpStart, interpEnd)

    result += content.slice(cursor, interpStart)
    result += `<I18nInspect i18n-key="${safeKey}">${fullInterp}</I18nInspect>`
    cursor = interpEnd
    startRe.lastIndex = interpEnd
  }

  result += content.slice(cursor)

  if (result === content) return
  return before + result + after
}

/**
 * Generates the browser-side dev overlay entry module.
 *
 * The pre-compiled overlay bundle (`dist/vite-plugin/dev-overlay/index.js`)
 * is read from disk and inlined directly into the virtual module body.
 * This avoids any `server.fs.allow` / `/@fs/` restrictions — Vite always
 * serves virtual module content, regardless of where the plugin lives on disk.
 *
 * The bundle's `export { ... }` block is replaced with local `const` aliases
 * so that `I18nInspect` and `DevOverlay` are available in scope for the
 * bootstrap code appended below.
 *
 * @internal
 */
function buildDevOverlayCode(uiUrl: string, overlayIndexPath: string, iframeWidth: string): string {
  let overlayContent: string
  try {
    overlayContent = readFileSync(overlayIndexPath, 'utf-8')
  } catch {
    return `console.error('[vue-i18n-kit] dev overlay bundle not found: ${overlayIndexPath.replace(/\\/g, '/')}')`
  }

  // Replace `export { origName as alias, ... }` at the end of the bundle with
  // `const alias = origName` local declarations so the names stay in scope.
  const strippedContent = overlayContent.replace(
    /export\s*\{([\s\S]*?)\}\s*;?\s*$/,
    (_match, body: string) =>
      body
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const m = s.match(/^(\S+)\s+as\s+(\S+)$/)
          return m ? `const ${m[2]} = ${m[1]}` : `/* ${s} — already in scope */`
        })
        .join('\n'),
  )

  const uiUrlJson = JSON.stringify(uiUrl)

  return `
import { createApp } from 'vue'

// ── Inlined overlay bundle ────────────────────────────────────────────────────
// Sourced from dist/vite-plugin/dev-overlay/index.js at plugin load time.
// Inlined to avoid server.fs.allow restrictions on paths outside project root.
${strippedContent}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
window.__I18N_KIT_INSPECT_COMPONENT__ = I18nInspect
window.__I18N_KIT_INSPECT_DIRECTIVE__ = vI18nInspect
window.__I18N_KIT_UI_URL__ = ${uiUrlJson}

function __ik_mountOverlay() {
  if (document.getElementById('__i18n-kit-overlay__')) return
  const el = document.createElement('div')
  el.id = '__i18n-kit-overlay__'
  document.body.appendChild(el)
  createApp(DevOverlay, { uiUrl: ${uiUrlJson}, iframeWidth: ${JSON.stringify(iframeWidth)} }).mount(el)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', __ik_mountOverlay)
} else {
  __ik_mountOverlay()
}
`
}
