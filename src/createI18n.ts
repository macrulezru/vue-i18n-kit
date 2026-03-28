import { createI18n } from 'vue-i18n'
import type { I18nOptions } from 'vue-i18n'
import type { I18nPluginOptions, LocaleMessages } from './types'

/**
 * Creates a vue-i18n instance in composition mode (legacy: false).
 * Only the initial locale messages are required; others are loaded lazily.
 *
 * The `messages` cast is required because vue-i18n's internal `LocaleMessage`
 * type does not accept `unknown` values, but at runtime any JSON-compatible
 * object is valid.
 */
export function createI18nInstance(
  options: I18nPluginOptions,
  initialMessages: Record<string, LocaleMessages>,
  initialLocale: string,
) {
  const i18nOptions: I18nOptions = {
    legacy: false,
    locale: initialLocale,
    fallbackLocale: options.fallbackLocale,
    // Cast needed: vue-i18n's LocaleMessage uses recursive string types
    // incompatible with Record<string, unknown>, but valid at runtime.
    messages: initialMessages as I18nOptions['messages'],
    ...options.vueI18nOptions,
  }
  return createI18n(i18nOptions)
}
