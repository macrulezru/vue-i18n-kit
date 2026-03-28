import { describe, it, expect, beforeEach } from 'vitest'
import { useFormat } from '../src/composables/useFormat'
import { useLocale } from '../src/composables/useLocale'
import { _resetState } from '../src/state'
import { mountWithI18n, enMessages, ruMessages } from './helpers'

beforeEach(() => {
  _resetState()
  localStorage.clear()
})

describe('useFormat — formatDate', () => {
  it('returns a non-empty string for a valid Date', () => {
    const { result } = mountWithI18n(() => useFormat())
    const output = result.formatDate(new Date('2024-06-15'))
    expect(typeof output).toBe('string')
    expect(output.length).toBeGreaterThan(0)
  })

  it('accepts a numeric timestamp', () => {
    const { result } = mountWithI18n(() => useFormat())
    const ts = new Date('2024-01-01').getTime()
    expect(() => result.formatDate(ts)).not.toThrow()
  })

  it('accepts an ISO string', () => {
    const { result } = mountWithI18n(() => useFormat())
    expect(() => result.formatDate('2024-01-01T00:00:00Z')).not.toThrow()
  })

  it('respects Intl options', () => {
    const { result } = mountWithI18n(() => useFormat())
    const withYear = result.formatDate(new Date('2024-06-15'), { year: 'numeric' })
    expect(withYear).toContain('2024')
  })

  it('changes output when locale changes', async () => {
    const { result } = mountWithI18n(
      () => ({ format: useFormat(), ...useLocale() }),
      { defaultLocale: 'ru', locales: { ru: ruMessages, en: enMessages } },
    )

    const date = new Date('2024-12-31')
    const outputRu = result.format.formatDate(date)

    await result.setLocale('en')
    const outputEn = result.format.formatDate(date)

    // Both are strings, and locale change produces different formatting
    expect(typeof outputRu).toBe('string')
    expect(typeof outputEn).toBe('string')
    // 'ru' and 'en' format dates differently (e.g. order of day/month/year)
    expect(outputRu).not.toBe(outputEn)
  })
})

describe('useFormat — formatNumber', () => {
  it('returns a non-empty string', () => {
    const { result } = mountWithI18n(() => useFormat())
    const output = result.formatNumber(1234567.89)
    expect(typeof output).toBe('string')
    expect(output.length).toBeGreaterThan(0)
  })

  it('result contains the integer part of the number', () => {
    const { result } = mountWithI18n(() => useFormat())
    const output = result.formatNumber(42)
    expect(output).toContain('42')
  })

  it('formats percentage', () => {
    const { result } = mountWithI18n(() => useFormat())
    const output = result.formatNumber(0.75, { style: 'percent' })
    expect(output).toContain('75')
  })

  it('produces different output for different locales', async () => {
    // ru uses space as thousands separator, en uses comma
    const { result: enResult } = mountWithI18n(() => useFormat(), {
      defaultLocale: 'en',
      locales: { en: enMessages, ru: ruMessages },
    })
    const { result: ruResult } = (() => {
      _resetState()
      return mountWithI18n(() => useFormat(), {
        defaultLocale: 'ru',
        locales: { en: enMessages, ru: ruMessages },
      })
    })()

    const enOutput = enResult.formatNumber(1000000)
    const ruOutput = ruResult.formatNumber(1000000)

    // Both should be strings containing 1000000 digits
    expect(enOutput).toContain('1')
    expect(ruOutput).toContain('1')
    // They should format differently (different locale)
    expect(enOutput).not.toBe(ruOutput)
  })
})

describe('useFormat — formatCurrency', () => {
  it('returns a non-empty string', () => {
    const { result } = mountWithI18n(() => useFormat())
    const output = result.formatCurrency(100, 'USD')
    expect(typeof output).toBe('string')
    expect(output.length).toBeGreaterThan(0)
  })

  it('includes the numeric value', () => {
    const { result } = mountWithI18n(() => useFormat())
    const output = result.formatCurrency(100, 'USD')
    expect(output).toContain('100')
  })

  it('includes the currency code or symbol', () => {
    const { result } = mountWithI18n(() => useFormat(), {
      defaultLocale: 'en',
      locales: { en: enMessages },
    })
    const output = result.formatCurrency(100, 'USD')
    // Should contain either '$' or 'USD'
    expect(output.includes('$') || output.includes('USD')).toBe(true)
  })

  it('respects extra Intl options (minimumFractionDigits)', () => {
    const { result } = mountWithI18n(() => useFormat())
    const output = result.formatCurrency(100, 'USD', { minimumFractionDigits: 0 })
    // 100 with 0 fraction digits should not show '.00'
    expect(output).not.toContain('.00')
  })
})
