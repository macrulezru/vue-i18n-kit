import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { discoverLocales } from '../src/cli/commands/auto-config'

// ── Temp fixture helpers ───────────────────────────────────────────────────────

const TMP = join(import.meta.dirname, '__auto-config-tmp__')

function setup(files: Record<string, string>): string {
  mkdirSync(TMP, { recursive: true })
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(TMP, rel)
    mkdirSync(abs.slice(0, Math.max(abs.lastIndexOf('/'), abs.lastIndexOf('\\'))), { recursive: true })
    writeFileSync(abs, content, 'utf-8')
  }
  return TMP
}

beforeEach(() => mkdirSync(TMP, { recursive: true }))
afterEach(() => { if (existsSync(TMP)) rmSync(TMP, { recursive: true }) })

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('discoverLocales — plain string keys', () => {
  it('finds locales with plain string keys', () => {
    const cwd = setup({
      'src/i18n.ts': `
        import { createVueI18nPlugin } from 'vue-i18n-kit'
        export default createVueI18nPlugin({
          defaultLocale: 'en',
          locales: {
            en: { messages: () => import('./locales/en.json'), meta: { display: 'English' } },
            ru: { messages: () => import('./locales/ru.json'), meta: { display: 'Русский' } },
          },
        })
      `,
      'src/locales/en.json': '{}',
      'src/locales/ru.json': '{}',
    })
    const locales = discoverLocales(cwd)
    expect(locales.map(l => l.code)).toEqual(['en', 'ru'])
  })

  it('extracts meta from LocaleDefinition', () => {
    const cwd = setup({
      'src/i18n.ts': `
        export default createVueI18nPlugin({
          locales: {
            en: { messages: () => import('./locales/en.json'), meta: { display: 'English', flag: 'uk' } },
          },
        })
      `,
      'src/locales/en.json': '{}',
    })
    const locales = discoverLocales(cwd)
    expect(locales[0].meta).toEqual({ display: 'English', flag: 'uk' })
  })
})

describe("discoverLocales — ['quoted'] computed keys", () => {
  it("handles ['en']: quoted string in brackets", () => {
    const cwd = setup({
      'src/i18n.ts': `
        export default createVueI18nPlugin({
          locales: {
            ['en']: { messages: () => import('./locales/en.json'), meta: { display: 'English' } },
            ['ru']: { messages: () => import('./locales/ru.json'), meta: { display: 'Русский' } },
          },
        })
      `,
      'src/locales/en.json': '{}',
      'src/locales/ru.json': '{}',
    })
    const locales = discoverLocales(cwd)
    expect(locales.map(l => l.code)).toEqual(['en', 'ru'])
  })
})

describe('discoverLocales — computed property keys', () => {
  it('finds locales with [Enum.VALUE] computed keys', () => {
    const cwd = setup({
      'src/plugins/i18n.ts': `
        import { createVueI18nPlugin } from 'vue-i18n-kit'
        import { LocalesEnum } from '@/enums/locales.enum'

        const i18nPlugin = createVueI18nPlugin({
          defaultLocale: LocalesEnum.RU,
          locales: {
            [LocalesEnum.EN]: {
              messages: () => import('@/locales/en.json'),
              meta: { display: 'English' },
            },
            [LocalesEnum.RU]: {
              messages: () => import('@/locales/ru.json'),
              meta: { display: 'Русский' },
            },
          },
        })

        export default i18nPlugin
      `,
      'locales/en.json': '{}',
      'locales/ru.json': '{}',
    })
    const locales = discoverLocales(cwd)
    expect(locales.map(l => l.code)).toEqual(['en', 'ru'])
  })

  it('derives locale code from filename when key is computed', () => {
    const cwd = setup({
      'src/i18n.ts': `
        export default createVueI18nPlugin({
          locales: {
            [Locales.DE]: () => import('@/locales/de.json'),
          },
        })
      `,
      'locales/de.json': '{}',
    })
    const locales = discoverLocales(cwd)
    expect(locales[0].code).toBe('de')
  })

  it('extracts meta with computed keys', () => {
    const cwd = setup({
      'src/i18n.ts': `
        export default createVueI18nPlugin({
          locales: {
            [LocalesEnum.EN]: {
              messages: () => import('@/locales/en.json'),
              meta: { display: 'English' },
            },
          },
        })
      `,
      'locales/en.json': '{}',
    })
    const locales = discoverLocales(cwd)
    expect(locales[0].meta).toEqual({ display: 'English' })
  })

  it('handles mixed plain and computed keys in the same locales object', () => {
    const cwd = setup({
      'src/i18n.ts': `
        export default createVueI18nPlugin({
          locales: {
            en: { messages: () => import('./locales/en.json') },
            [Locales.RU]: { messages: () => import('./locales/ru.json') },
          },
        })
      `,
      'src/locales/en.json': '{}',
      'src/locales/ru.json': '{}',
    })
    const locales = discoverLocales(cwd)
    expect(locales.map(l => l.code)).toEqual(['en', 'ru'])
  })
})

describe('discoverLocales — external locales variable', () => {
  it('finds locales when locales object is declared as a separate const', () => {
    const cwd = setup({
      'src/plugins/i18n.ts': `
        import { createVueI18nPlugin } from 'vue-i18n-kit'

        const appLocales = {
          en: { messages: () => import('@/locales/en.json'), meta: { display: 'English' } },
          ru: { messages: () => import('@/locales/ru.json'), meta: { display: 'Русский' } },
        }

        export default createVueI18nPlugin({
          defaultLocale: 'en',
          locales: appLocales,
        })
      `,
      'locales/en.json': '{}',
      'locales/ru.json': '{}',
    })
    const locales = discoverLocales(cwd)
    expect(locales.map(l => l.code)).toEqual(['en', 'ru'])
  })

  it('handles typed external variable (const locales: Record<...> = { ... })', () => {
    const cwd = setup({
      'src/i18n.ts': `
        import type { I18nPluginOptions } from 'vue-i18n-kit'

        const localeMap: Record<string, unknown> = {
          en: { messages: () => import('./locales/en.json') },
          de: { messages: () => import('./locales/de.json') },
        }

        export default createVueI18nPlugin({
          defaultLocale: 'en',
          locales: localeMap,
        })
      `,
      'src/locales/en.json': '{}',
      'src/locales/de.json': '{}',
    })
    const locales = discoverLocales(cwd)
    expect(locales.map(l => l.code)).toEqual(['en', 'de'])
  })

  it('handles export const locales = { ... }', () => {
    const cwd = setup({
      'src/i18n.ts': `
        export const locales = {
          en: { messages: () => import('./locales/en.json') },
          fr: { messages: () => import('./locales/fr.json') },
        }

        export default createVueI18nPlugin({ defaultLocale: 'en', locales })
      `,
      'src/locales/en.json': '{}',
      'src/locales/fr.json': '{}',
    })
    const locales = discoverLocales(cwd)
    expect(locales.map(l => l.code)).toEqual(['en', 'fr'])
  })

  it('handles shorthand property { locales } in plugin options', () => {
    const cwd = setup({
      'src/i18n.ts': `
        const locales = {
          en: () => import('./locales/en.json'),
          ru: () => import('./locales/ru.json'),
        }

        export default createVueI18nPlugin({
          defaultLocale: 'en',
          fallbackLocale: 'en',
          locales,
        })
      `,
      'src/locales/en.json': '{}',
      'src/locales/ru.json': '{}',
    })
    const locales = discoverLocales(cwd)
    expect(locales.map(l => l.code)).toEqual(['en', 'ru'])
  })

  it('preserves meta from external variable', () => {
    const cwd = setup({
      'src/i18n.ts': `
        const locales = {
          en: { messages: () => import('./locales/en.json'), meta: { display: 'English', flag: 'uk' } },
        }
        export default createVueI18nPlugin({ locales })
      `,
      'src/locales/en.json': '{}',
    })
    const locales = discoverLocales(cwd)
    expect(locales[0].meta).toEqual({ display: 'English', flag: 'uk' })
  })

  it('handles external variable with computed enum keys', () => {
    const cwd = setup({
      'src/i18n.ts': `
        const locales = {
          [LocalesEnum.EN]: { messages: () => import('@/locales/en.json') },
          [LocalesEnum.RU]: { messages: () => import('@/locales/ru.json') },
        }
        export default createVueI18nPlugin({ defaultLocale: LocalesEnum.EN, locales })
      `,
      'locales/en.json': '{}',
      'locales/ru.json': '{}',
    })
    const locales = discoverLocales(cwd)
    expect(locales.map(l => l.code)).toEqual(['en', 'ru'])
  })
})

describe('discoverLocales — @/ alias resolution', () => {
  it('resolves @/ to src/ when file exists there (standard Vite convention)', () => {
    const cwd = setup({
      'src/plugins/i18n.ts': `
        export default createVueI18nPlugin({
          locales: {
            en: { messages: () => import('@/locales/en.json') },
            ru: { messages: () => import('@/locales/ru.json') },
          },
        })
      `,
      'src/locales/en.json': '{}',
      'src/locales/ru.json': '{}',
    })
    const locales = discoverLocales(cwd)
    expect(locales.map(l => l.code)).toEqual(['en', 'ru'])
    expect(locales[0].relativePath).toBe('src/locales/en.json')
  })

  it('falls back to cwd/ when @/ file is not under src/ (Nuxt-style)', () => {
    const cwd = setup({
      'src/i18n.ts': `
        export default createVueI18nPlugin({
          locales: {
            en: { messages: () => import('@/locales/en.json') },
          },
        })
      `,
      'locales/en.json': '{}',
    })
    const locales = discoverLocales(cwd)
    expect(locales[0].relativePath).toBe('locales/en.json')
  })
})

describe('discoverLocales — plugin in separate file', () => {
  it('finds createVueI18nPlugin even when it is not in main.ts', () => {
    const cwd = setup({
      'src/main.ts': `
        import i18nPlugin from '@/plugins/i18n'
        import { createApp } from 'vue'
        const app = createApp(App)
        app.use(i18nPlugin)
        app.mount('#app')
      `,
      'src/plugins/i18n.ts': `
        import { createVueI18nPlugin } from 'vue-i18n-kit'
        export default createVueI18nPlugin({
          defaultLocale: 'en',
          locales: {
            en: { messages: () => import('@/locales/en.json') },
            ru: { messages: () => import('@/locales/ru.json') },
          },
        })
      `,
      'locales/en.json': '{}',
      'locales/ru.json': '{}',
    })
    const locales = discoverLocales(cwd)
    expect(locales.map(l => l.code)).toEqual(['en', 'ru'])
  })
})
