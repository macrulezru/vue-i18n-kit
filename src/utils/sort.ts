/**
 * Recursively sorts all keys of a plain object alphabetically.
 * Arrays are left untouched.
 */
export function sortObjectKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(obj).sort()) {
    const val = obj[key]
    sorted[key] =
      val !== null && typeof val === 'object' && !Array.isArray(val)
        ? sortObjectKeys(val as Record<string, unknown>)
        : val
  }
  return sorted
}

/**
 * Glob-style pattern matching for dot-separated i18n keys.
 * Supports:
 *   "exact.key"         — exact match
 *   "namespace.*"       — all keys starting with "namespace."
 *   "*"                 — matches any single segment (no dots)
 *   "**"                — matches everything
 */
export function matchesPattern(key: string, pattern: string): boolean {
  if (pattern === '**' || pattern === '*') return true
  if (pattern === key) return true
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2)
    return key === prefix || key.startsWith(prefix + '.')
  }
  if (pattern.endsWith('.**')) {
    const prefix = pattern.slice(0, -3)
    return key.startsWith(prefix + '.')
  }
  // Treat single trailing * as prefix wildcard within a segment
  if (pattern.includes('*')) {
    const re = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '[^.]*') + '$')
    return re.test(key)
  }
  return false
}

/**
 * Returns true if the key matches any pattern in the list.
 */
export function matchesAnyPattern(key: string, patterns: string[]): boolean {
  return patterns.some(p => matchesPattern(key, p))
}
