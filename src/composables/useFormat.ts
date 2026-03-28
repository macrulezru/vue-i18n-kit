import { useI18n } from 'vue-i18n'
import type { Ref } from 'vue'

export interface UseFormatReturn {
  /**
   * Format a date/time value using the current locale.
   *
   * @example
   * formatDate(new Date())                                  // '28.03.2026' (ru)
   * formatDate(new Date(), { dateStyle: 'long' })           // '28 марта 2026 г.' (ru)
   * formatDate(new Date(), { hour: '2-digit', minute: '2-digit' }) // '19:45' (ru)
   */
  formatDate: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string

  /**
   * Format a number using the current locale.
   *
   * @example
   * formatNumber(1234567.89)                                // '1 234 567,89' (ru)
   * formatNumber(0.42, { style: 'percent' })                // '42 %' (ru)
   */
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string

  /**
   * Format a number as currency using the current locale.
   *
   * @example
   * formatCurrency(1999.99, 'USD')                          // '$1,999.99' (en)
   * formatCurrency(1999.99, 'EUR')                          // '1 999,99 €' (ru)
   */
  formatCurrency: (
    value: number,
    currency: string,
    options?: Omit<Intl.NumberFormatOptions, 'style' | 'currency'>,
  ) => string
}

/**
 * Provides locale-aware formatting helpers for dates, numbers, and currency.
 * All formatters automatically use the currently active locale and update
 * when the locale is switched via `setLocale()`.
 *
 * Wraps the native `Intl.DateTimeFormat` and `Intl.NumberFormat` APIs —
 * no extra configuration needed beyond setting the active locale.
 */
export function useFormat(): UseFormatReturn {
  const { locale } = useI18n() as { locale: Ref<string> }

  function formatDate(
    value: Date | number | string,
    options: Intl.DateTimeFormatOptions = {},
  ): string {
    const date = value instanceof Date ? value : new Date(value)
    return new Intl.DateTimeFormat(locale.value, options).format(date)
  }

  function formatNumber(value: number, options: Intl.NumberFormatOptions = {}): string {
    return new Intl.NumberFormat(locale.value, options).format(value)
  }

  function formatCurrency(
    value: number,
    currency: string,
    options: Omit<Intl.NumberFormatOptions, 'style' | 'currency'> = {},
  ): string {
    return new Intl.NumberFormat(locale.value, {
      style: 'currency',
      currency,
      ...options,
    }).format(value)
  }

  return { formatDate, formatNumber, formatCurrency }
}
