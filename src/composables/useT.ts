import { useI18n } from 'vue-i18n'
import type { ComposerTranslation } from 'vue-i18n'
import { usePluralize } from './usePluralize'
import type { PluralVars } from './usePluralize'

export interface UseTReturn {
  /**
   * Translates a key with optional named-variable interpolation.
   * The key is looked up in the active locale's message file; falls back to
   * `fallbackLocale` when the key is missing.
   *
   * @example
   * t('buttons.submit')                     // 'Отправить'
   * t('greeting', { name: 'Danil' })        // 'Привет, Danil!'
   */
  t: ComposerTranslation

  /**
   * Translates and pluralizes using ICU MessageFormat syntax.
   *
   * The first argument is either:
   * - a **locale key** whose value in the JSON file is an ICU template, or
   * - a **direct ICU template string** (used as-is when key lookup returns nothing)
   *
   * ICU template rules:
   * - `{varName, plural, one {…} few {…} many {…} other {…}}` — plural form selected
   *   by `Intl.PluralRules` for the active locale
   * - `#` inside a plural form is replaced with the variable's numeric value
   * - `{varName}` outside plural constructs is replaced with the value from `vars`
   * - `other` is the only required category — used as fallback
   *
   * @example
   * // Direct ICU template
   * tm(
   *   '{points} {points, plural, one {рубль} few {рубля} many {рублей} other {рублей}}',
   *   { points: 11 }
   * )
   * // → '11 рублей'
   *
   * // Key stored in locale file:
   * // "balance": "{points} {points, plural, one {рубль} few {рубля} many {рублей} other {рублей}}"
   * tm('balance', { points: 3 })
   * // → '3 рубля'
   */
  tm: (keyOrTemplate: string, vars: PluralVars) => string
}

/**
 * Returns `t` for simple key-based translations and `tm` for ICU-pluralized translations.
 * Both methods are locale-reactive and automatically update when the active locale changes.
 */
export function useT(): UseTReturn {
  const { t } = useI18n()
  const { pluralizeIcu } = usePluralize()

  function tm(keyOrTemplate: string, vars: PluralVars): string {
    // t() returns the key itself when the key is not found in any locale —
    // in that case the raw ICU template string is used directly.
    const template = t(keyOrTemplate) as string
    return pluralizeIcu(vars, template)
  }

  return { t, tm }
}
