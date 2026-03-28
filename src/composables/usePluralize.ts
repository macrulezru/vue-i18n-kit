import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ComputedRef, Ref } from 'vue'

/**
 * Variables map for `pluralizeIcu`.
 * Keys are variable names used inside the ICU template; values are strings or numbers.
 */
export type PluralVars = Record<string, string | number>

export interface UsePluralizeReturn {
  /**
   * Processes an ICU-style plural template.
   *
   * Syntax:  `{varName, plural, category {text} …}`
   * - `varName` must be a key in `vars`; its numeric value is used for CLDR category selection.
   * - `#` inside a plural form is replaced with the variable's value.
   * - All other `{varName}` placeholders are replaced with the corresponding value from `vars`.
   * - `other` is the only required category — used as fallback when the active locale's
   *   CLDR category is not present in the template.
   *
   * CLDR categories by language:
   * - English:  one, other
   * - Russian:  one, few, many, other
   * - Polish:   one, few, many, other
   * - Arabic:   zero, one, two, few, many, other
   * - Japanese: other  (no grammatical pluralization)
   * - Turkish:  one, other
   *
   * @see https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html
   *
   * @example
   * // Russian
   * pluralizeIcu(
   *   { points: 3 },
   *   '{points} {points, plural, one {рубль} few {рубля} many {рублей} other {рублей}}'
   * )
   * // → '3 рубля'
   *
   * // Multiple variables
   * pluralizeIcu(
   *   { user: 'Даня', score: 21 },
   *   '{user} набрал {score} {score, plural, one {балл} few {балла} many {баллов} other {баллов}}'
   * )
   * // → 'Даня набрал 21 балл'
   *
   * // `#` is the ICU placeholder for the numeric value inside a plural form
   * pluralizeIcu(
   *   { n: 5 },
   *   '{n, plural, one {# item} other {# items}}'
   * )
   * // → '5 items'
   */
  pluralizeIcu: (vars: PluralVars, template: string) => string

  /**
   * Returns the raw CLDR plural category for `count` in the active locale.
   * Useful when you need the category itself for conditional logic or CSS classes.
   *
   * @example
   * pluralCategory(1)   // 'one'   (en or ru)
   * pluralCategory(3)   // 'few'   (ru)
   * pluralCategory(5)   // 'many'  (ru)  |  'other' (en)
   */
  pluralCategory: (count: number) => Intl.LDMLPluralRule
}

// Matches:  {varName, plural, one {text} few {text} ...}
// Group 1: varName
// Group 2: the whole "category {text} ..." part
const ICU_PLURAL_RE = /\{(\w+),\s*plural,\s*((?:\w+\s*\{[^{}]*\}\s*)+)\}/g

// Matches a single category entry: category {text}
const ICU_FORM_RE = /(\w+)\s*\{([^{}]*)\}/g

/**
 * Locale-aware pluralization based on the native `Intl.PluralRules` API (CLDR standard).
 *
 * Uses ICU MessageFormat syntax so that the variable display and plural form selection
 * live in a single template string — no positional pipe separators, no guessing.
 *
 * The `Intl.PluralRules` instance is cached per locale via `computed` and reused
 * until the locale changes.
 */
export function usePluralize(): UsePluralizeReturn {
  const { locale } = useI18n() as { locale: Ref<string> }

  // Cached per-locale — a new instance is created only when the locale changes
  const rules: ComputedRef<Intl.PluralRules> = computed(
    () => new Intl.PluralRules(locale.value),
  )

  function pluralCategory(count: number): Intl.LDMLPluralRule {
    return rules.value.select(count) as Intl.LDMLPluralRule
  }

  function pluralizeIcu(vars: PluralVars, template: string): string {
    // Step 1 — resolve all {varName, plural, …} constructs
    let result = template.replace(
      ICU_PLURAL_RE,
      (_match, varName: string, formsStr: string) => {
        const count = Number(vars[varName] ?? 0)
        const category = rules.value.select(count) as string

        // Parse individual forms from the matched segment
        const formMap: Record<string, string> = {}
        ICU_FORM_RE.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = ICU_FORM_RE.exec(formsStr)) !== null) {
          formMap[m[1]] = m[2]
        }

        // `#` is the ICU placeholder for the numeric value inside a plural form
        const text = formMap[category] ?? formMap['other'] ?? ''
        return text.replaceAll('#', String(count))
      },
    )

    // Step 2 — replace remaining {varName} placeholders
    result = result.replace(/\{(\w+)\}/g, (_match, varName: string) => {
      return varName in vars ? String(vars[varName]) : `{${varName}}`
    })

    return result
  }

  return { pluralizeIcu, pluralCategory }
}
