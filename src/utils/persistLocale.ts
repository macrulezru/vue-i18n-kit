/**
 * Saves a locale string to localStorage.
 * Silently fails if localStorage is unavailable (e.g. private mode, SSR).
 */
export function saveLocale(key: string, locale: string): void {
  try {
    localStorage.setItem(key, locale)
  } catch {
    // localStorage unavailable — ignore
  }
}

/**
 * Loads a previously saved locale from localStorage.
 * Returns null if not found or localStorage is unavailable.
 */
export function loadPersistedLocale(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * Removes a saved locale from localStorage.
 */
export function clearPersistedLocale(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // localStorage unavailable — ignore
  }
}
