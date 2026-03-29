import { runInit } from './commands/init.js'
import { runAdd } from './commands/add.js'
import { runCheck } from './commands/check.js'
import { runAutoConfig } from './commands/auto-config.js'
import { startUiServer } from '../ui-server/server.js'

const VERSION = '0.1.0'

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
    const flags = parseFlags(rest)
    runInit({
      dir: str(flags['dir'], 'src/locales'),
      locales: typeof flags['locales'] === 'string' ? flags['locales'].split(',') : ['en'],
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
  auto-config                   Auto-discover locale files, generate i18n-tools/
                                  data, and configure vueI18nMapPlugin in vite.config

  init [options]                Create locale JSON files with example structure
    --dir <path>                Locales directory       (default: src/locales)
    --locales <en,ru,de>        Comma-separated codes   (default: en)

  add <locale> [options]        Add a new locale file based on an existing one
    --dir <path>                Locales directory       (default: src/locales)
    --from <locale>             Source locale to copy   (default: first in dir)
    --empty                     Write empty strings instead of source values

  check [options]               Check all locales have the same translation keys
    --dir <path>                Locales directory       (default: src/locales)
    --default <locale>          Reference locale        (default: first alphabetically)
    --fail                      Exit with code 1 if any keys are missing

  ui [options]                  Start the locale editor UI
    --port <number>             Port to listen on       (default: 4173)

Examples:
  npx vue-i18n-kit auto-config
  npx vue-i18n-kit init --locales en,ru,de
  npx vue-i18n-kit add fr --from en --empty
  npx vue-i18n-kit check --default en --fail
  npx vue-i18n-kit ui
`)
}
