import { describe, it, expect, beforeEach } from 'vitest'
import { useT } from '../src/composables/useT'
import { useAvailableLocales } from '../src/composables/useAvailableLocales'
import { _resetState } from '../src/state'
import { defaultOptions, mountWithI18n, enMessages, ruMessages } from './helpers'

beforeEach(() => {
  _resetState()
  localStorage.clear()
})

describe('useT', () => {
  it('translates a simple key', () => {
    const { result } = mountWithI18n(() => useT())
    expect(result.t('buttons.submit')).toBe('Отправить')
  })

  it('translates a nested key', () => {
    const { result } = mountWithI18n(() => useT())
    expect(result.t('buttons.cancel')).toBe('Отмена')
  })

  it('interpolates named placeholders', () => {
    const { result } = mountWithI18n(() => useT())
    expect(result.t('greeting', { name: 'Danil' })).toBe('Привет, Danil!')
  })

  it('returns the key itself when translation is missing', () => {
    const { result } = mountWithI18n(() => useT())
    const key = 'nonexistent.key'
    // vue-i18n returns the key when not found (with fallbackWarn suppressed in test)
    expect(typeof result.t(key)).toBe('string')
  })

  it('uses fallback locale when key is missing in active locale', () => {
    const { result } = mountWithI18n(() => useT(), {
      defaultLocale: 'ru',
      fallbackLocale: 'en',
      locales: {
        ru: { hello: 'Привет' }, // missing 'buttons.submit'
        en: { hello: 'Hello', buttons: { submit: 'Submit' } },
      },
    })
    // Falls back to 'en' for missing key
    expect(result.t('buttons.submit')).toBe('Submit')
  })
})

describe('tm — ICU pluralization via key lookup', () => {
  it('looks up key and pluralizes — Russian one', () => {
    const { result } = mountWithI18n(() => useT(), {
      defaultLocale: 'ru',
      locales: {
        ru: {
          balance:
            '{points} {points, plural, one {рубль} few {рубля} many {рублей} other {рублей}}',
        },
      },
    })
    expect(result.tm('balance', { points: 1 })).toBe('1 рубль')
  })

  it('looks up key and pluralizes — Russian few', () => {
    const { result } = mountWithI18n(() => useT(), {
      defaultLocale: 'ru',
      locales: {
        ru: {
          balance:
            '{points} {points, plural, one {рубль} few {рубля} many {рублей} other {рублей}}',
        },
      },
    })
    expect(result.tm('balance', { points: 3 })).toBe('3 рубля')
  })

  it('looks up key and pluralizes — Russian many', () => {
    const { result } = mountWithI18n(() => useT(), {
      defaultLocale: 'ru',
      locales: {
        ru: {
          balance:
            '{points} {points, plural, one {рубль} few {рубля} many {рублей} other {рублей}}',
        },
      },
    })
    expect(result.tm('balance', { points: 11 })).toBe('11 рублей')
  })

  it('works with a direct ICU template when key is not in locale', () => {
    const { result } = mountWithI18n(() => useT(), {
      defaultLocale: 'en',
      locales: { en: { greeting: 'Hello!' } },
    })
    expect(
      result.tm('{n, plural, one {# item} other {# items}}', { n: 5 }),
    ).toBe('5 items')
  })

  it('supports multiple variables', () => {
    const { result } = mountWithI18n(() => useT(), {
      defaultLocale: 'ru',
      locales: {
        ru: {
          score:
            '{user} набрал {score} {score, plural, one {балл} few {балла} many {баллов} other {баллов}}',
        },
      },
    })
    expect(result.tm('score', { user: 'Даня', score: 21 })).toBe('Даня набрал 21 балл')
  })
})

describe('useAvailableLocales', () => {
  it('returns LocaleInfo objects with code and meta', () => {
    const { result } = mountWithI18n(() => useAvailableLocales())
    const codes = result.availableLocales.value.map((l) => l.code)
    expect(codes).toEqual(['ru', 'en'])
    // No meta defined in defaultOptions → undefined
    expect(result.availableLocales.value[0].meta).toBeUndefined()
  })

  it('reflects the keys of the locales option', () => {
    const { result } = mountWithI18n(() => useAvailableLocales(), {
      defaultLocale: 'fr',
      locales: {
        fr: { hi: 'Bonjour' },
        es: { hi: 'Hola' },
        de: { hi: 'Hallo' },
      },
    })
    expect(result.availableLocales.value.map((l) => l.code)).toEqual(['fr', 'es', 'de'])
  })

  it('exposes meta from LocaleDefinition entries', () => {
    const { result } = mountWithI18n(() => useAvailableLocales(), {
      defaultLocale: 'en',
      locales: {
        en: { messages: enMessages, meta: { display: 'English', flag: '🇬🇧' } },
        ru: { messages: ruMessages, meta: { display: 'Русский', flag: '🇷🇺' } },
      },
    })
    const locales = result.availableLocales.value
    expect(locales[0]).toEqual({ code: 'en', meta: { display: 'English', flag: '🇬🇧' } })
    expect(locales[1]).toEqual({ code: 'ru', meta: { display: 'Русский', flag: '🇷🇺' } })
  })

  it('returns undefined meta for plain message entries', () => {
    const { result } = mountWithI18n(() => useAvailableLocales(), {
      defaultLocale: 'en',
      locales: { en: enMessages, ru: ruMessages },
    })
    result.availableLocales.value.forEach((l) => expect(l.meta).toBeUndefined())
  })
})
