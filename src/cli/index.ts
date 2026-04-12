import { runAdd } from './commands/add.js'
import { runCheck } from './commands/check.js'
import { runAutoConfig } from './commands/auto-config.js'
import { runInitWizard } from './commands/init-wizard.js'
import { runMerge } from './commands/merge.js'
import { runPrune } from './commands/prune.js'
import { runTypes } from './commands/types.js'
import { runStale } from './commands/stale.js'
import { runExport } from './commands/export-translations.js'
import { runImport } from './commands/import-translations.js'
import { runStats } from './commands/stats.js'
import { runSplit } from './commands/split.js'
import { runMergeNs } from './commands/merge-ns.js'
import { runDev } from './commands/dev.js'
import { startUiServer } from '../ui-server/server.js'

const VERSION = '0.3.0'

const [, , command, ...rest] = process.argv

function parseFlags(args: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2)
      const next = args[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next
        i++
      } else {
        flags[key] = true
      }
    }
  }
  return flags
}

function str(v: string | boolean | undefined, fallback: string): string {
  return typeof v === 'string' ? v : fallback
}

switch (command) {
  case 'init': {
    runInitWizard(process.cwd()).catch((err: unknown) => {
      console.error('[vue-i18n-kit] Unexpected error:', err)
      process.exit(1)
    })
    break
  }

  case 'add': {
    const locale = rest.find((a) => !a.startsWith('--'))
    if (!locale) {
      console.error('Usage: vue-i18n-kit add <locale> [--dir <path>] [--from <locale>] [--empty]')
      process.exit(1)
    }
    const flags = parseFlags(rest)
    runAdd(locale, {
      dir: str(flags['dir'], 'src/locales'),
      from: typeof flags['from'] === 'string' ? flags['from'] : undefined,
      empty: flags['empty'] === true,
    })
    break
  }

  case 'check': {
    const flags = parseFlags(rest)
    runCheck({
      dir: str(flags['dir'], 'src/locales'),
      defaultLocale: typeof flags['default'] === 'string' ? flags['default'] : undefined,
      fail: flags['fail'] === true,
    })
    break
  }

  case 'merge': {
    const source = rest.find((a) => !a.startsWith('--'))
    if (!source) {
      console.error('Usage: vue-i18n-kit merge <source.json> [--dir <path>] [--locale <code>] [--overwrite] [--dry]')
      process.exit(1)
    }
    const flags = parseFlags(rest)
    runMerge({
      source,
      dir: str(flags['dir'], 'src/locales'),
      locale: typeof flags['locale'] === 'string' ? flags['locale'] : undefined,
      overwrite: flags['overwrite'] === true,
      dry: flags['dry'] === true,
      noSort: flags['no-sort'] === true,
    })
    break
  }

  case 'prune': {
    const flags = parseFlags(rest)
    const ignoreFlag = typeof flags['ignore'] === 'string' ? flags['ignore'].split(',').map(s => s.trim()) : undefined
    runPrune({
      dir: str(flags['dir'], 'src/locales'),
      cwd: process.cwd(),
      dry: flags['dry'] === true,
      yes: flags['yes'] === true,
      entriesFile: typeof flags['entries'] === 'string' ? flags['entries'] : undefined,
      ignore: ignoreFlag,
    })
    break
  }

  case 'types': {
    const flags = parseFlags(rest)
    runTypes({
      out:    typeof flags['out']    === 'string' ? flags['out']    : undefined,
      locale: typeof flags['locale'] === 'string' ? flags['locale'] : undefined,
      dir:    typeof flags['dir']    === 'string' ? flags['dir']    : undefined,
      watch:  flags['watch'] === true,
    })
    break
  }

  case 'export': {
    const flags = parseFlags(rest)
    if (!flags['locale']) {
      console.error('Usage: vue-i18n-kit export --locale <code> [--format xliff|po] [--out <path>] [--dir <path>]')
      process.exit(1)
    }
    runExport({
      locale:          str(flags['locale'] as string, ''),
      format:          flags['format'] === 'po' ? 'po' : 'xliff',
      out:             typeof flags['out'] === 'string' ? flags['out'] : undefined,
      dir:             typeof flags['dir'] === 'string' ? flags['dir'] : undefined,
      referenceLocale: typeof flags['ref']  === 'string' ? flags['ref']  : undefined,
    })
    break
  }

  case 'import': {
    const flags = parseFlags(rest)
    const file = rest.find(a => !a.startsWith('--'))
    if (!file && typeof flags['file'] !== 'string') {
      console.error('Usage: vue-i18n-kit import <file.xliff|file.po> [--dir <path>] [--dry]')
      process.exit(1)
    }
    runImport({
      file: file ?? str(flags['file'] as string, ''),
      dir:  typeof flags['dir'] === 'string' ? flags['dir'] : undefined,
      dry:  flags['dry'] === true,
    })
    break
  }

  case 'stats': {
    const flags = parseFlags(rest)
    const fmt = flags['format']
    runStats({
      format: fmt === 'json' ? 'json' : fmt === 'html' ? 'html' : 'console',
      out: typeof flags['out'] === 'string' ? flags['out'] : undefined,
      dir: typeof flags['dir'] === 'string' ? flags['dir'] : undefined,
    })
    break
  }

  case 'split': {
    const flags = parseFlags(rest)
    runSplit({
      dir:  typeof flags['dir'] === 'string' ? flags['dir'] : undefined,
      out:  typeof flags['out'] === 'string' ? flags['out'] : undefined,
      dry:  flags['dry'] === true,
      cwd:  process.cwd(),
    })
    break
  }

  case 'merge-ns': {
    const flags = parseFlags(rest)
    runMergeNs({
      dir:    typeof flags['dir']    === 'string' ? flags['dir']    : undefined,
      out:    typeof flags['out']    === 'string' ? flags['out']    : undefined,
      dry:    flags['dry'] === true,
      noSort: flags['no-sort'] === true,
      cwd:    process.cwd(),
    })
    break
  }

  case 'stale': {
    const flags = parseFlags(rest)
    runStale({
      dir:    typeof flags['dir']    === 'string' ? flags['dir']    : undefined,
      locale: typeof flags['locale'] === 'string' ? flags['locale'] : undefined,
    })
    break
  }

  case 'auto-config': {
    runAutoConfig(process.cwd())
    break
  }

  case 'dev': {
    const flags = parseFlags(rest)
    const uiPortRaw = flags['ui-port']
    runDev({
      uiPort:  typeof uiPortRaw === 'string' ? parseInt(uiPortRaw, 10) : 4173,
      appCmd:  typeof flags['app-cmd'] === 'string' ? flags['app-cmd'] : undefined,
      cwd:     process.cwd(),
    })
    break
  }

  case 'ui': {
    const flags = parseFlags(rest)
    const port = typeof flags['port'] === 'string' ? parseInt(flags['port'], 10) : 4173
    startUiServer({ cwd: process.cwd(), port })
    break
  }

  case '--version':
  case '-v':
    console.log(VERSION)
    break

  default:
    console.log(`
vue-i18n-kit v${VERSION} — Locale file management CLI

Commands:
  init                          Interactive setup wizard — creates i18n-kit.config.json,
                                  locale JSON files, and configures vite/nuxt automatically.
                                  Re-run at any time to update settings.

  dev [options]                 Start the app dev server AND the locale editor UI together
    --ui-port <number>          Port for the i18n UI server (default: 4173)
    --app-cmd <command>         Override auto-detected dev command (default: npm/pnpm/yarn run dev)

  ui [options]                  Start the locale editor UI
    --port <number>             Port to listen on       (default: 4173)

  auto-config                   Non-interactive: auto-discover locales from
                                  createVueI18nPlugin and update vite/nuxt config.
                                  Useful in CI or package.json scripts.

  add <locale> [options]        Add a new locale file based on an existing one
    --dir <path>                Locales directory       (default: src/locales)
    --from <locale>             Source locale to copy   (default: first in dir)
    --empty                     Write empty strings instead of source values

  check [options]               Check all locales have the same translation keys
    --dir <path>                Locales directory       (default: src/locales)
    --default <locale>          Reference locale        (default: first alphabetically)
    --fail                      Exit with code 1 if any keys are missing

  merge <source.json> [options] Deep-merge a base/shared JSON into locale file(s)
    --dir <path>                Locales directory       (default: src/locales)
    --locale <code>             Only merge into this locale (default: all)
    --overwrite                 Overwrite existing keys (default: add missing only)
    --dry                       Preview changes without writing files
    --no-sort                   Skip alphabetical key sort (default: sort is applied)

  prune [options]               Remove keys not referenced in source code
    --dir <path>                Locales directory       (default: src/locales)
    --entries <file>            Path to pre-built entries JSON (skips scanning)
    --dry                       Preview keys to remove without writing files
    --yes                       Skip confirmation prompt
    --ignore <patterns>         Comma-separated key patterns to never remove (e.g. "status.*,legacy.*")
                                 Also reads ignore.prune from i18n-kit.config.json

  types [options]               Generate TypeScript types (TranslationKey) from locale file
    --out <path>                Output file               (default: src/i18n.d.ts)
    --locale <code>             Locale to use as key source (default: first in config)
    --dir <path>                Locales directory       (default: src/locales)
    --watch                     Regenerate on file change

  stats [options]               Coverage report: fill rate per locale and namespace
    --format <console|json|html>  Output format         (default: console)
    --out <path>                Write to file instead of stdout (json/html)
    --dir <path>                Locales directory       (default: src/locales)

  split [options]               Split flat locale JSON files into per-namespace files
    --dir <path>                Source locales directory    (default: localesDir from config)
    --out <path>                Output directory            (default: <dir>/split)
    --dry                       Preview without writing files

  merge-ns [options]            Merge per-namespace files back into flat locale JSON files
    --dir <path>                Namespace directory         (default: <localesDir>/split)
    --out <path>                Output directory            (default: localesDir from config)
    --dry                       Preview without writing files
    --no-sort                   Skip alphabetical key sort

  stale [options]               Show keys whose reference value changed since last translation
    --dir <path>                Locales directory       (default: src/locales)
    --locale <code>             Reference locale        (default: first in config)

  export [options]              Export locales to XLIFF or PO format for translators
    --format <xliff|po>         Output format           (default: xliff)
    --locale <code>             Locale to export        (required)
    --out <path>                Output file path        (default: <locale>.<format>)
    --dir <path>                Locales directory       (default: src/locales)

  import [options]              Import translations from XLIFF or PO file
    --file <path>               Input XLIFF or PO file  (required)
    --dir <path>                Locales directory       (default: src/locales)

Examples:
  npx vue-i18n-kit init                           # first-time setup or update config
  npx vue-i18n-kit dev                            # start app + locale editor together
  npx vue-i18n-kit dev --ui-port 5173             # custom UI server port
  npx vue-i18n-kit dev --app-cmd "nuxt dev"       # Nuxt projects
  npx vue-i18n-kit ui                             # open locale editor standalone
  npx vue-i18n-kit add fr --from en --empty
  npx vue-i18n-kit check --default en --fail
  npx vue-i18n-kit merge shared/base.json --dry   # preview base dictionary merge
  npx vue-i18n-kit prune --dry                    # preview unused key removal
  npx vue-i18n-kit types --watch                  # generate types, watch for changes
  npx vue-i18n-kit stats                          # coverage report in console
  npx vue-i18n-kit stats --format json --out ci-report.json
  npx vue-i18n-kit stats --format html            # open i18n-stats.html
  npx vue-i18n-kit stale                          # show outdated translations
  npx vue-i18n-kit export --format po --locale ru # export Russian for translators
  npx vue-i18n-kit import --file ru.po            # import completed translations
`)
}
