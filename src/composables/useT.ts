import { useI18n } from 'vue-i18n'
import type { ComposerTranslation } from 'vue-i18n'
import { useI18nKitState } from '../state'
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

// Reads a dot-notation key from a raw messages object without going through
// vue-i18n's message compiler (which rejects ICU plural syntax in v11+).
function getRawMessage(messages: Record<string, unknown>, key: string): string | undefined {
  const parts = key.split('.')
  let cur: unknown = messages
  for (const p of parts) {
    if (typeof cur !== 'object' || cur === null) return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return typeof cur === 'string' ? cur : undefined
}

/**
 * Returns `t` for simple key-based translations and `tm` for ICU-pluralized translations.
 * Both methods are locale-reactive and automatically update when the active locale changes.
 */
export function useT(): UseTReturn {
  const { t } = useI18n()
  const state = useI18nKitState()
  const { pluralizeIcu } = usePluralize()

  function tm(keyOrTemplate: string, vars: PluralVars): string {
    // Retrieve the raw message string directly from the loaded messages object,
    // bypassing vue-i18n's message compiler which rejects ICU plural syntax in v11+.
    const locale = state.i18n.global.locale.value as string
    const msgs = state.i18n.global.getLocaleMessage(locale) as Record<string, unknown>
    let template = getRawMessage(msgs, keyOrTemplate)

    if (template === undefined && state.options.fallbackLocale) {
      const fb = state.i18n.global.getLocaleMessage(state.options.fallbackLocale) as Record<string, unknown>
      template = getRawMessage(fb, keyOrTemplate)
    }

    // When the key is not found, treat the argument itself as a direct ICU template.
    return pluralizeIcu(vars, template ?? keyOrTemplate)
  }

  return { t, tm }
}
