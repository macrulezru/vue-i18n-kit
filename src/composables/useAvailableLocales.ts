import { computed } from 'vue'
import { useI18nKitState } from '../state'
import { extractMeta } from '../utils/localeEntry'
import type { ComputedRef } from 'vue'
import type { LocaleInfo } from '../types'

export interface UseAvailableLocalesReturn<
  TMeta extends Record<string, unknown> = Record<string, unknown>,
> {
  /**
   * All locales registered in the plugin config.
   * Each item contains the locale `code` and any `meta` defined in LocaleDefinition.
   *
   * @example
   * // Build a locale selector
   * <option v-for="loc in availableLocales" :key="loc.code" :value="loc.code">
   *   {{ loc.meta?.display ?? loc.code }}
   * </option>
   */
  availableLocales: ComputedRef<LocaleInfo<TMeta>[]>
}

/**
 * Returns a computed list of all locales registered in the plugin config,
 * including any metadata attached via `LocaleDefinition`.
 *
 * Pass a generic type parameter to get typed `meta` without manual casting:
 *
 * @example
 * interface AppLocaleMeta { display: string; flag: string }
 * const { availableLocales } = useAvailableLocales<AppLocaleMeta>()
 * availableLocales.value[0].meta?.display  // string
 */
export function useAvailableLocales<
  TMeta extends Record<string, unknown> = Record<string, unknown>,
>(): UseAvailableLocalesReturn<TMeta> {
  const { options } = useI18nKitState()

  const availableLocales = computed<LocaleInfo<TMeta>[]>(() =>
    Object.entries(options.locales).map(([code, entry]) => ({
      code,
      meta: extractMeta(entry) as TMeta | undefined,
    })),
  )

  return { availableLocales }
}
