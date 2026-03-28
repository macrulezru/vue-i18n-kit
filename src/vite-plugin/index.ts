import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { compareLocales } from '../utils/localeKeys'
import type { LocaleMismatch } from '../utils/localeKeys'

// Type-only import so vite is never bundled — it must be a peer dep.
import type { Plugin, ResolvedConfig } from 'vite'

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
export function vueI18nCheckPlugin(options: I18nCheckPluginOptions = {}): Plugin {
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

    configResolved(config: ResolvedConfig) {
      resolvedLocalesDir = resolve(config.root, localesDir)
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

    handleHotUpdate({ file, server }: { file: string; server: { config: ResolvedConfig } }) {
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
