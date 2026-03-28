export interface LocaleMismatch {
  /** Locale code being compared */
  locale: string
  /** Keys present in the reference locale but absent here */
  missing: string[]
  /** Keys present here but absent in the reference locale */
  extra: string[]
}

/**
 * Recursively flattens a nested message object into dot-separated key paths.
 *
 * @example
 * flattenKeys({ buttons: { submit: 'OK' }, greeting: 'Hi' })
 * // → ['buttons.submit', 'greeting']
 */
export function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Record<string, unknown>, full))
    } else {
      keys.push(full)
    }
  }
  return keys
}

/**
 * Compares a reference locale against one or more other locales
 * and returns any key mismatches found.
 *
 * Returns only locales that have at least one missing or extra key.
 */
export function compareLocales(
  reference: Record<string, unknown>,
  others: Record<string, Record<string, unknown>>,
): LocaleMismatch[] {
  const refKeys = new Set(flattenKeys(reference))
  return Object.entries(others)
    .map(([locale, messages]) => {
      const localeKeys = new Set(flattenKeys(messages))
      return {
        locale,
        missing: [...refKeys].filter((k) => !localeKeys.has(k)),
        extra: [...localeKeys].filter((k) => !refKeys.has(k)),
      }
    })
    .filter((m) => m.missing.length > 0 || m.extra.length > 0)
}
