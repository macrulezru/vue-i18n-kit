import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createApp, h } from 'vue'
import { createVueI18nPlugin } from '../src/plugin'
import { getState, _resetState } from '../src/state'
import { defaultOptions, ruMessages } from './helpers'

beforeEach(() => {
  _resetState()
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
    const state = getState()
    expect(state).toBeDefined()
    expect(state.options).toBe(defaultOptions)
  })

  it('sets initial locale to defaultLocale', () => {
    const app = createApp({ render: () => h('div') })
    app.use(createVueI18nPlugin(defaultOptions))
    const state = getState()
    expect(state.i18n.global.locale.value).toBe('ru')
  })

  it('pre-loads synchronous locale messages', () => {
    const app = createApp({ render: () => h('div') })
    app.use(createVueI18nPlugin(defaultOptions))
    const state = getState()
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
    const state = getState()
    expect(state.loadedLocales.has('ru')).toBe(false)
    expect(state.isLoading.value).toBe(true)
  })

  it('throws if getState called before plugin install', () => {
    expect(() => getState()).toThrow('[vue-i18n-kit]')
  })
})

describe('createVueI18nPlugin — persistLocale', () => {
  it('restores locale from localStorage', () => {
    localStorage.setItem('vue3-i18n-locale', 'en')

    const app = createApp({ render: () => h('div') })
    app.use(createVueI18nPlugin({ ...defaultOptions, persistLocale: true }))

    const state = getState()
    expect(state.i18n.global.locale.value).toBe('en')
  })

  it('falls back to defaultLocale if persisted locale is unknown', () => {
    localStorage.setItem('vue3-i18n-locale', 'de')

    const app = createApp({ render: () => h('div') })
    app.use(createVueI18nPlugin({ ...defaultOptions, persistLocale: true }))

    const state = getState()
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

    const state = getState()
    expect(state.i18n.global.locale.value).toBe('en')
  })
})
