import { describe, it, expect } from 'vitest'
import { flattenKeys, compareLocales } from '../src/utils/localeKeys'

describe('flattenKeys', () => {
  it('flattens a simple flat object', () => {
    const result = flattenKeys({ greeting: 'Hello', farewell: 'Bye' })
    expect(result).toEqual(['greeting', 'farewell'])
  })

  it('flattens nested objects with dot notation', () => {
    const result = flattenKeys({
      buttons: { submit: 'OK', cancel: 'Cancel' },
      greeting: 'Hello',
    })
    expect(result).toEqual(['buttons.submit', 'buttons.cancel', 'greeting'])
  })

  it('handles deeply nested objects', () => {
    const result = flattenKeys({ a: { b: { c: 'deep' } } })
    expect(result).toEqual(['a.b.c'])
  })

  it('treats arrays as leaf values (not iterated)', () => {
    const result = flattenKeys({ items: ['one', 'two'], name: 'test' })
    expect(result).toEqual(['items', 'name'])
  })

  it('treats null as a leaf value', () => {
    const result = flattenKeys({ key: null })
    expect(result).toEqual(['key'])
  })

  it('returns empty array for empty object', () => {
    expect(flattenKeys({})).toEqual([])
  })

  it('applies prefix correctly', () => {
    const result = flattenKeys({ submit: 'OK' }, 'buttons')
    expect(result).toEqual(['buttons.submit'])
  })
})

describe('compareLocales', () => {
  const reference = {
    buttons: { submit: 'Submit', cancel: 'Cancel' },
    greeting: 'Hello, {name}!',
  }

  it('returns empty array when all locales match', () => {
    const ru = {
      buttons: { submit: 'Отправить', cancel: 'Отмена' },
      greeting: 'Привет, {name}!',
    }
    expect(compareLocales(reference, { ru })).toEqual([])
  })

  it('detects missing keys', () => {
    const ru = {
      buttons: { submit: 'Отправить' }, // cancel is missing
      greeting: 'Привет, {name}!',
    }
    const mismatches = compareLocales(reference, { ru })
    expect(mismatches).toHaveLength(1)
    expect(mismatches[0].locale).toBe('ru')
    expect(mismatches[0].missing).toContain('buttons.cancel')
    expect(mismatches[0].extra).toHaveLength(0)
  })

  it('detects extra keys', () => {
    const ru = {
      buttons: { submit: 'Отправить', cancel: 'Отмена', extra: 'Лишнее' },
      greeting: 'Привет, {name}!',
    }
    const mismatches = compareLocales(reference, { ru })
    expect(mismatches).toHaveLength(1)
    expect(mismatches[0].missing).toHaveLength(0)
    expect(mismatches[0].extra).toContain('buttons.extra')
  })

  it('detects both missing and extra keys at once', () => {
    const ru = {
      buttons: { submit: 'Отправить' }, // cancel missing
      farewell: 'Пока!', // extra key
    }
    const mismatches = compareLocales(reference, { ru })
    expect(mismatches[0].missing).toContain('buttons.cancel')
    expect(mismatches[0].missing).toContain('greeting')
    expect(mismatches[0].extra).toContain('farewell')
  })

  it('reports mismatches for multiple locales independently', () => {
    const de = { buttons: { submit: 'Senden' } } // cancel + greeting missing
    const fr = { buttons: { submit: 'Envoyer', cancel: 'Annuler' } } // greeting missing

    const mismatches = compareLocales(reference, { de, fr })
    expect(mismatches).toHaveLength(2)

    const deMismatch = mismatches.find((m) => m.locale === 'de')!
    expect(deMismatch.missing).toContain('buttons.cancel')
    expect(deMismatch.missing).toContain('greeting')

    const frMismatch = mismatches.find((m) => m.locale === 'fr')!
    expect(frMismatch.missing).toEqual(['greeting'])
  })

  it('returns only locales with differences', () => {
    const perfect = {
      buttons: { submit: 'Envoyer', cancel: 'Annuler' },
      greeting: 'Bonjour, {name}!',
    }
    const broken = { buttons: { submit: 'Senden' } }
    const result = compareLocales(reference, { perfect, broken })
    expect(result.map((m) => m.locale)).toEqual(['broken'])
  })
})
