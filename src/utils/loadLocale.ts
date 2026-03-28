import type { LocaleMessages } from '../types'

type LocaleLoader = LocaleMessages | (() => Promise<LocaleMessages | { default: LocaleMessages }>)

/**
 * Resolves locale messages from either a plain object or an async loader function.
 * Handles both direct exports and ES module default exports.
 */
export async function loadLocale(loader: LocaleLoader): Promise<LocaleMessages> {
  if (typeof loader === 'function') {
    const result = await loader()
    // Handle ES module default export (e.g. import('./ru.json'))
    if (result !== null && typeof result === 'object' && 'default' in result) {
      return result.default as LocaleMessages
    }
    return result as LocaleMessages
  }
  return loader
}
