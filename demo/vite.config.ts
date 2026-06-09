import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { vueI18nCheckPlugin, vueI18nMapPlugin, vueI18nDevPlugin } from 'vue-i18n-kit/vite'

export default defineConfig({
  plugins: [
    vue(),

    // Warn on missing/extra keys in locale files (dev HMR + build)
    vueI18nCheckPlugin({
      localesDir: 'src/locales',
      defaultLocale: 'en',
    }),

    // Generates i18n-tools/locales.config.json when run with --mode i18n-dump
    // Used by the UI editor server to know file paths and metadata
    vueI18nMapPlugin({
      locales: {
        en: { path: 'src/locales/en.json', meta: { display: 'English',  flag: '🇬🇧' } },
        ru: { path: 'src/locales/ru.json', meta: { display: 'Русский',  flag: '🇷🇺' } },
        de: { path: 'src/locales/de.json', meta: { display: 'Deutsch',  flag: '🇩🇪' } },
      },
    }),

    // Injects the floating edit overlay in dev mode.
    // UI server URL is set automatically by `vue-i18n-kit dev` via I18N_KIT_UI_URL env var.
    vueI18nDevPlugin(),
  ],
})
