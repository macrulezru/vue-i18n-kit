import type { LocaleDefinition, LocaleEntry, LocaleLoader, LocaleMessages } from '../types'

/**
 * Returns true when `entry` is a LocaleDefinition object (has `meta` or
 * contains a loader function under `messages`).
 *
 * Disambiguation rules that avoid false positives with plain message objects:
 * - If `entry` is a function → it is a LocaleLoader, not a LocaleDefinition.
 * - If `entry.meta` is present → it can only be a LocaleDefinition.
 * - If `entry.messages` is a function → it can only be a loader inside a LocaleDefinition.
 *
 * A plain message object that happens to have a `messages` key with a string
 * or nested object value will NOT be misidentified.
 */
export function isLocaleDefinition(entry: LocaleEntry): entry is LocaleDefinition {
  if (typeof entry === 'function') return false
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return false
  const obj = entry as Record<string, unknown>
  if ('meta' in obj) return true
  if ('messages' in obj && typeof obj['messages'] === 'function') return true
  return false
}

/**
 * Extracts the raw messages object or loader from any LocaleEntry form.
 */
export function extractMessages(entry: LocaleEntry): LocaleMessages | LocaleLoader {
  if (isLocaleDefinition(entry)) return entry.messages as LocaleMessages | LocaleLoader
  return entry as LocaleMessages | LocaleLoader
}

/**
 * Extracts the metadata from a LocaleDefinition, or returns undefined for
 * plain message objects and loader functions.
 */
export function extractMeta(entry: LocaleEntry): Record<string, unknown> | undefined {
  if (isLocaleDefinition(entry)) return entry.meta
  return undefined
}
