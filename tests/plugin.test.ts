import { describe, it, expect, beforeEach } from 'vitest'
import { createApp, h } from 'vue'
import { createVueI18nPlugin } from '../src/plugin'
import { getState } from '../src/state'
import { defaultOptions, ruMessages } from './helpers'

beforeEach(() => {
  localStorage.clear()
})

describe('createVueI18nPlugin — installation', () => {
  it('installs without throwing', () => {
    const app = createApp({ render: () => h('div') })
    expect(() => app.use(createVueI18nPlugin(defaultOptions))).not.toThrow()
  })

  it('sets plugin state after install', () => {
    const app = createApp({ render: () => h('div') })
    app.use(createVueI18nPlugin(defaultOptions))
    const state = getState(app)
    expect(state).toBeDefined()
    expect(state.options).toBe(defaultOptions)
  })

  it('sets initial locale to defaultLocale', () => {
    const app = createApp({ render: () => h('div') })
    app.use(createVueI18nPlugin(defaultOptions))
    const state = getState(app)
    expect(state.i18n.global.locale.value).toBe('ru')
  })

  it('pre-loads synchronous locale messages', () => {
    const app = createApp({ render: () => h('div') })
    app.use(createVueI18nPlugin(defaultOptions))
    const state = getState(app)
    expect(state.loadedLocales.has('ru')).toBe(true)
  })

  it('does not pre-load lazy locales', () => {
    const lazyOptions = {
      ...defaultOptions,
      locales: {
        ru: () => Promise.resolve(ruMessages),
        en: defaultOptions.locales.en,
      },
    }
    const app = createApp({ render: () => h('div') })
    app.use(createVueI18nPlugin(lazyOptions))
    const state = getState(app)
    expect(state.loadedLocales.has('ru')).toBe(false)
    expect(state.isLoading.value).toBe(true)
  })

  it('throws if getState called on app without plugin installed', () => {
    const app = createApp({ render: () => h('div') })
    expect(() => getState(app)).toThrow('[vue-i18n-kit]')
  })

  it('two app instances carry independent state', () => {
    const app1 = createApp({ render: () => h('div') })
    const app2 = createApp({ render: () => h('div') })

    app1.use(createVueI18nPlugin(defaultOptions))
    app2.use(createVueI18nPlugin({ ...defaultOptions, defaultLocale: 'en' }))

    expect(getState(app1).i18n.global.locale.value).toBe('ru')
    expect(getState(app2).i18n.global.locale.value).toBe('en')
  })
})

describe('createVueI18nPlugin — service', () => {
  it('service.locale throws before install', () => {
    const plugin = createVueI18nPlugin(defaultOptions)
    expect(() => plugin.service.locale).toThrow('[vue-i18n-kit]')
  })

  it('service.isLoading throws before install', () => {
    const plugin = createVueI18nPlugin(defaultOptions)
    expect(() => plugin.service.isLoading).toThrow('[vue-i18n-kit]')
  })

  it('service.setLocale throws before install', () => {
    const plugin = createVueI18nPlugin(defaultOptions)
    expect(() => plugin.service.setLocale('en')).toThrow('[vue-i18n-kit]')
  })

  it('service.availableLocales throws before install', () => {
    const plugin = createVueI18nPlugin(defaultOptions)
    expect(() => plugin.service.availableLocales).toThrow('[vue-i18n-kit]')
  })

  it('service.locale returns the active locale ref after install', () => {
    const plugin = createVueI18nPlugin(defaultOptions)
    const app = createApp({ render: () => h('div') })
    app.use(plugin)
    expect(plugin.service.locale.value).toBe('ru')
  })

  it('service.isLoading is false after sync install', () => {
    const plugin = createVueI18nPlugin(defaultOptions)
    const app = createApp({ render: () => h('div') })
    app.use(plugin)
    expect(plugin.service.isLoading.value).toBe(false)
  })

  it('service.availableLocales returns all registered locales', () => {
    const plugin = createVueI18nPlugin(defaultOptions)
    const app = createApp({ render: () => h('div') })
    app.use(plugin)
    const locales = plugin.service.availableLocales.value
    expect(locales.map((l) => l.code)).toEqual(['ru', 'en'])
  })

  it('service.setLocale switches the locale', async () => {
    const plugin = createVueI18nPlugin(defaultOptions)
    const app = createApp({ render: () => h('div') })
    app.use(plugin)
    await plugin.service.setLocale('en')
    expect(plugin.service.locale.value).toBe('en')
  })

  it('service.locale ref is the same instance as the i18n global locale', () => {
    const plugin = createVueI18nPlugin(defaultOptions)
    const app = createApp({ render: () => h('div') })
    app.use(plugin)
    const { i18n } = getState(app)
    expect(plugin.service.locale).toBe(i18n.global.locale)
  })
})

describe('createVueI18nPlugin — persistLocale', () => {
  it('restores locale from localStorage', () => {
    localStorage.setItem('vue3-i18n-locale', 'en')

    const app = createApp({ render: () => h('div') })
    app.use(createVueI18nPlugin({ ...defaultOptions, persistLocale: true }))

    const state = getState(app)
    expect(state.i18n.global.locale.value).toBe('en')
  })

  it('falls back to defaultLocale if persisted locale is unknown', () => {
    localStorage.setItem('vue3-i18n-locale', 'de')

    const app = createApp({ render: () => h('div') })
    app.use(createVueI18nPlugin({ ...defaultOptions, persistLocale: true }))

    const state = getState(app)
    expect(state.i18n.global.locale.value).toBe('ru')
  })

  it('uses custom storageKey', () => {
    localStorage.setItem('my-app-locale', 'en')

    const app = createApp({ render: () => h('div') })
    app.use(
      createVueI18nPlugin({
        ...defaultOptions,
        persistLocale: true,
        storageKey: 'my-app-locale',
      }),
    )

    const state = getState(app)
    expect(state.i18n.global.locale.value).toBe('en')
  })
})
