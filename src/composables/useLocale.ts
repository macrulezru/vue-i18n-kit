import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useI18nKitState } from '../state'
import { setLocale as _setLocale } from '../plugin'
import { extractMeta } from '../utils/localeEntry'
import type { ComputedRef, Ref } from 'vue'

export interface UseLocaleReturn<
  TMeta extends Record<string, unknown> = Record<string, unknown>,
> {
  /** The currently active locale code */
  locale: Ref<string>
  /** Switch to a different locale, loading it lazily if needed */
  setLocale: (lang: string) => Promise<void>
  /** True while a locale's messages are being fetched */
  isLoading: Ref<boolean>
  /**
   * Metadata of the currently active locale, or `undefined` if the locale
   * was registered without a `LocaleDefinition`.
   *
   * @example
   * // Locale switcher label
   * {{ localeMeta?.display ?? locale }}
   */
  localeMeta: ComputedRef<TMeta | undefined>
}

/**
 * Returns the current locale, a setter for switching locales,
 * a loading flag, and the active locale's metadata.
 *
 * Pass a generic type parameter to get typed `localeMeta` without casting:
 *
 * @example
 * interface AppLocaleMeta { display: string; flag: string }
 * const { locale, setLocale, isLoading, localeMeta } = useLocale<AppLocaleMeta>()
 * localeMeta.value?.display  // string | undefined
 */
export function useLocale<
  TMeta extends Record<string, unknown> = Record<string, unknown>,
>(): UseLocaleReturn<TMeta> {
  const { locale } = useI18n()
  const state = useI18nKitState()

  const localeMeta = computed<TMeta | undefined>(() => {
    const entry = state.options.locales[locale.value as string]
    return entry ? (extractMeta(entry) as TMeta | undefined) : undefined
  })

  return {
    locale: locale as Ref<string>,
    setLocale: (lang: string) => _setLocale(state, lang),
    isLoading: state.isLoading,
    localeMeta,
  }
}
