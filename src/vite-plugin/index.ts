import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join, dirname, relative } from 'node:path'
import { compareLocales } from '../utils/localeKeys'
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
// ── Entries scanner ───────────────────────────────────────────────────────────

const SCAN_EXTENSIONS = new Set(['.vue', '.ts', '.tsx', '.js', '.jsx'])
const EXCLUDE_DIRS = new Set([
  'node_modules', 'dist', '.git', 'i18n-tools',
  '.vite', 'coverage', '.nuxt', '.output', '.cache',
])

// Matches: t('key'), $t('key'), tm('key', ...) — not preceded by a letter
// to avoid false positives like fmt('...'), useT('...'), etc.
const KEY_RE = /(?<![a-zA-Z])(?:\$t|tm?)\s*\(\s*['"`]([^'"`\n]+)['"`]/g

function scanFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry.name)) {
        results.push(...scanFiles(join(dir, entry.name)))
      }
    } else if (entry.isFile()) {
      const dotIdx = entry.name.lastIndexOf('.')
      if (dotIdx !== -1 && SCAN_EXTENSIONS.has(entry.name.slice(dotIdx))) {
        results.push(join(dir, entry.name))
      }
    }
  }
  return results
}

function buildEntriesMap(root: string): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  const files = scanFiles(root)

  for (const file of files) {
    const content = readFileSync(file, 'utf-8')
    const relPath = relative(root, file).replace(/\\/g, '/')

    KEY_RE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = KEY_RE.exec(content)) !== null) {
      const key = match[1]
      if (!map[key]) map[key] = []
      if (!map[key].includes(relPath)) map[key].push(relPath)
    }
  }

  // Sort keys alphabetically for stable output
  return Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)))
}

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
