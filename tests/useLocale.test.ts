import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { useLocale } from '../src/composables/useLocale'
import { _resetState } from '../src/state'
import { defaultOptions, mountWithI18n, ruMessages, enMessages } from './helpers'

beforeEach(() => {
  _resetState()
  localStorage.clear()
})

describe('useLocale — initial state', () => {
  it('returns defaultLocale as locale', () => {
    const { result } = mountWithI18n(() => useLocale())
    expect(result.locale.value).toBe('ru')
  })

  it('isLoading starts as false for synchronous locales', () => {
    const { result } = mountWithI18n(() => useLocale())
    expect(result.isLoading.value).toBe(false)
  })

  it('exposes setLocale function', () => {
    const { result } = mountWithI18n(() => useLocale())
    expect(typeof result.setLocale).toBe('function')
  })
})

describe('useLocale — setLocale', () => {
  it('switches locale to a loaded one', async () => {
    const { result } = mountWithI18n(() => useLocale())
    await result.setLocale('en')
    expect(result.locale.value).toBe('en')
  })

  it('sets isLoading during async locale load', async () => {
    let resolveLoad!: (v: unknown) => void
    const lazyEn = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveLoad = resolve
        }),
    )

    const { result } = mountWithI18n(() => useLocale(), {
      defaultLocale: 'ru',
      locales: { ru: ruMessages, en: lazyEn },
    })

    const setLocalePromise = result.setLocale('en')
    expect(result.isLoading.value).toBe(true)

    resolveLoad(enMessages)
    await setLocalePromise

    expect(result.isLoading.value).toBe(false)
    expect(result.locale.value).toBe('en')
  })

  it('loads lazy locale only once (caches after first load)', async () => {
    const lazyEn = vi.fn(() => Promise.resolve(enMessages))

    const { result } = mountWithI18n(() => useLocale(), {
      defaultLocale: 'ru',
      locales: { ru: ruMessages, en: lazyEn },
    })

    await result.setLocale('en')
    await result.setLocale('ru')
    await result.setLocale('en')

    expect(lazyEn).toHaveBeenCalledTimes(1)
  })

  it('throws for an unregistered locale', async () => {
    const { result } = mountWithI18n(() => useLocale())
    await expect(result.setLocale('de')).rejects.toThrow('[vue-i18n-kit]')
  })

  it('resets isLoading to false even when load fails', async () => {
    const failingLoader = vi.fn(() => Promise.reject(new Error('network error')))

    const { result } = mountWithI18n(() => useLocale(), {
      defaultLocale: 'ru',
      locales: { ru: ruMessages, en: failingLoader },
    })

    await expect(result.setLocale('en')).rejects.toThrow('network error')
    expect(result.isLoading.value).toBe(false)
  })
})

describe('useLocale — persistLocale', () => {
  it('saves locale to localStorage when persistLocale is true', async () => {
    const { result } = mountWithI18n(() => useLocale(), {
      ...defaultOptions,
      persistLocale: true,
    })

    await result.setLocale('en')
    expect(localStorage.getItem('vue3-i18n-locale')).toBe('en')
  })

  it('does not save locale when persistLocale is false', async () => {
    const { result } = mountWithI18n(() => useLocale(), {
      ...defaultOptions,
      persistLocale: false,
    })

    await result.setLocale('en')
    expect(localStorage.getItem('vue3-i18n-locale')).toBeNull()
  })
})

describe('useLocale — localeMeta', () => {
  it('returns undefined when locale has no meta', () => {
    const { result } = mountWithI18n(() => useLocale())
    expect(result.localeMeta.value).toBeUndefined()
  })

  it('returns meta for the active locale from a LocaleDefinition', () => {
    const { result } = mountWithI18n(() => useLocale(), {
      defaultLocale: 'ru',
      locales: {
        ru: { messages: ruMessages, meta: { display: 'Русский', flag: '🇷🇺' } },
        en: { messages: enMessages, meta: { display: 'English', flag: '🇬🇧' } },
      },
    })
    expect(result.localeMeta.value).toEqual({ display: 'Русский', flag: '🇷🇺' })
  })

  it('updates localeMeta when locale is switched', async () => {
    const { result } = mountWithI18n(() => useLocale(), {
      defaultLocale: 'ru',
      locales: {
        ru: { messages: ruMessages, meta: { display: 'Русский' } },
        en: { messages: enMessages, meta: { display: 'English' } },
      },
    })

    expect(result.localeMeta.value?.display).toBe('Русский')
    await result.setLocale('en')
    expect(result.localeMeta.value?.display).toBe('English')
  })

  it('mixes LocaleDefinition and plain entries in the same config', async () => {
    const { result } = mountWithI18n(() => useLocale(), {
      defaultLocale: 'ru',
      locales: {
        ru: { messages: ruMessages, meta: { display: 'Русский' } },
        en: enMessages, // no meta
      },
    })

    expect(result.localeMeta.value?.display).toBe('Русский')
    await result.setLocale('en')
    expect(result.localeMeta.value).toBeUndefined()
  })
})
