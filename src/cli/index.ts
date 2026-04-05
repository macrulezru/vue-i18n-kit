import { runAdd } from './commands/add.js'
import { runCheck } from './commands/check.js'
import { runAutoConfig } from './commands/auto-config.js'
import { runInitWizard } from './commands/init-wizard.js'
import { runMerge } from './commands/merge.js'
import { runPrune } from './commands/prune.js'
import { startUiServer } from '../ui-server/server.js'

const VERSION = '0.2.1'

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
    })
    break
  }

  case 'prune': {
    const flags = parseFlags(rest)
    runPrune({
      dir: str(flags['dir'], 'src/locales'),
      cwd: process.cwd(),
      dry: flags['dry'] === true,
      yes: flags['yes'] === true,
      entriesFile: typeof flags['entries'] === 'string' ? flags['entries'] : undefined,
    })
    break
  }

  case 'auto-config': {
    runAutoConfig(process.cwd())
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

  prune [options]               Remove keys not referenced in source code
    --dir <path>                Locales directory       (default: src/locales)
    --entries <file>            Path to pre-built entries JSON (skips scanning)
    --dry                       Preview keys to remove without writing files
    --yes                       Skip confirmation prompt

Examples:
  npx vue-i18n-kit init                           # first-time setup or update config
  npx vue-i18n-kit ui                             # open locale editor
  npx vue-i18n-kit add fr --from en --empty
  npx vue-i18n-kit check --default en --fail
  npx vue-i18n-kit merge shared/base.json --dry   # preview base dictionary merge
  npx vue-i18n-kit prune --dry                    # preview unused key removal
`)
}
