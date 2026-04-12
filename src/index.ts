// Plugin
export { createVueI18nPlugin } from './plugin'

// Composables
export { useLocale } from './composables/useLocale'
export { useT } from './composables/useT'
export { useAvailableLocales } from './composables/useAvailableLocales'
export { useFormat } from './composables/useFormat'
export { usePluralize } from './composables/usePluralize'
export { useNamespace } from './composables/useNamespace'
export type { UseNamespaceReturn } from './composables/useNamespace'

// Types
export type { I18nPluginOptions, LocaleMessages, LocaleEntry, LocaleDefinition, LocaleInfo, I18nService, I18nPlugin } from './types'
export type { UseLocaleReturn } from './composables/useLocale'
export type { UseTReturn } from './composables/useT'
export type { UseAvailableLocalesReturn } from './composables/useAvailableLocales'
export type { UseFormatReturn } from './composables/useFormat'
export type { UsePluralizeReturn, PluralVars } from './composables/usePluralize'
