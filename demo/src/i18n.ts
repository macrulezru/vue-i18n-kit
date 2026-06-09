import { createVueI18nPlugin } from 'vue-i18n-kit'
import enMessages from './locales/en.json'

// English is loaded synchronously so there's no flash on first render.
// Russian and German are loaded lazily — switching to them demonstrates
// the lazy-loading feature and triggers the isLoading indicator.
export const i18nPlugin = createVueI18nPlugin({
  defaultLocale: 'en',
  fallbackLocale: 'en',
  locales: {
    en: {
      messages: enMessages,
      meta: { display: 'English', flag: '🇬🇧' },
    },
    ru: {
      messages: () => import('./locales/ru.json'),
      meta: { display: 'Русский', flag: '🇷🇺' },
    },
    de: {
      messages: () => import('./locales/de.json'),
      meta: { display: 'Deutsch', flag: '🇩🇪' },
    },
  },
})
