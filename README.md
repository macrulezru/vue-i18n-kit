# **i18n Kit**

![i18n Kit](https://github.com/macrulezru/assets/blob/master/packages-images/vue-i18n-kit.png?raw=true)

A reusable Vue 3 localization plugin that wraps [`vue-i18n`](https://vue-i18n.intlify.dev/) and provides a ready-to-use integration layer — set up once, reuse across every project in your team.

---

## Features

- **One-liner setup** — install the plugin in `main.ts` and start using composables immediately
- **Two-method translation API** — `t(key, vars?)` for simple strings, `tm(key, vars)` for ICU-pluralized strings; both from `useT()`
- **ICU pluralization** — `Intl.PluralRules`-based with named CLDR categories (`one`, `few`, `many`, …); correct for every language including Arabic (6 forms)
- **Lazy loading** — locale JSON files are fetched on demand; only the active locale is loaded at startup
- **Namespace code splitting** — split large locale files by feature and lazy-load namespaces on demand with `useNamespace()`
- **Persist locale** — selected language is automatically saved to `localStorage` and restored on next visit
- **Fallback locale** — missing translation keys transparently fall back to the configured fallback language
- **Locale metadata** — attach any custom data to a locale (`display`, `flag`, `author`, …) and read it back through `useLocale` and `useAvailableLocales`
- **Date / number / currency formatting** — `useFormat` wraps `Intl` and always uses the active locale
- **Plugin service** — `createVueI18nPlugin` returns an `I18nPlugin` with a `.service` property — fully usable outside Vue components (router guards, Pinia stores, SSR entry points)
- **Locale change hook** — `service.onLocaleChange(cb)` fires after every successful locale switch; returns an unsubscribe function
- **TypeScript-first** — all public APIs are fully typed, no `any` leaks into consumer code
- **Vite check plugin** — checks all locale files for missing or extra keys at build time (import from `vue-i18n-kit/vite`)
- **Vite inline plugin** — `vueI18nInlinePlugin` bakes all locale JSON into the bundle as a static virtual module — zero HTTP requests at runtime
- **Vite namespace plugin** — `vueI18nNamespacePlugin` scans split locale directories and generates a virtual module with per-namespace dynamic imports
- **In-context translation editor** — `vueI18nDevPlugin` overlays a pencil icon on every translated string during development; click to edit inline
- **CLI** — `vue-i18n-kit init / add / check / merge / prune` scaffolds, audits, and cleans locale files from the terminal
- **Dictionary merge** — `vue-i18n-kit merge` deep-merges a shared/corporate base dictionary into project locale files
- **Dead key pruning** — `vue-i18n-kit prune` removes keys not referenced anywhere in the source code
- **Base dictionary (extends)** — `extends` field in `i18n-kit.config.json` loads a shared locale directory and merges it under project keys
- **Locked keys** — declare immutable keys in the base config; editor shows them read-only, server rejects edits with 403, CLI tools never touch them
- **Validation rules** — configure `rules` in `i18n-kit.config.json` to tune length thresholds, placeholder patterns, HTML/ICU warnings per project
- **Ignore lists** — `ignore.prune`, `ignore.duplicates`, `ignore.unused`, `ignore.scanExclude` whitelists protect dynamic keys, brand names, and test files
- **Alphabetical merge** — `merge` now always sorts output keys alphabetically (like `sort`); use `--no-sort` to opt out
- **TypeScript type generation** — `vue-i18n-kit types` generates a `TranslationKey` union type from locale files; `--watch` mode regenerates on change
- **Stale translation detection** — tracks when reference values change and flags translations in other locales as outdated; CLI `stale` command + editor filter + "Mark as reviewed" button
- **XLIFF / PO export** — `vue-i18n-kit export` generates industry-standard XLIFF 1.2 or Gettext PO files for professional translators; translator notes are included
- **XLIFF / PO import** — `vue-i18n-kit import` reads completed XLIFF or PO files back into locale JSON
- **Coverage report** — `vue-i18n-kit stats` prints fill rate per locale and namespace to the console; `--format json` for CI pipelines; `--format html` for a self-contained visual report
- **Machine translation** — auto-translate missing keys via LibreTranslate or DeepL (500k chars/month free); ICU placeholders and plurals are encoded as opaque XML tags so they survive translation intact
- **Locale Editor UI** — browser-based editor with dashboard, inline editing, group operations, phantom key detection, plural preview, stale filter, XLIFF/PO export-import, and more

---

## Installation

| Peer dependency | Version   | Required                 |
| ------------------ | ----------- | --------------------------- |
| `vue`           | `^3.3.0`  | yes                          |
| `vue-i18n`      | `^11.0.0` | yes                          |
| `vite`          | `>=5.0.0` | only for the Vite plugin     |

Neither `vue` nor `vue-i18n` is bundled — they must be installed in the consuming project.

```bash
npm install vue-i18n-kit vue vue-i18n
```

### Quick start

**1. Create locale files**

```
src/
└── locales/
    ├── en.json
    └── ru.json
```

```json
// locales/en.json
{
  "buttons": {
    "submit": "Submit",
    "cancel": "Cancel"
  },
  "greeting": "Hello, {name}!",
  "items": "{count, plural, one {# item} other {# items}}"
}
```

> **Tip:** Run `vue-i18n-kit init` to scaffold step 1 automatically (locale files, config, Vite plugin).

**2. Register the plugin**

```ts
// main.ts
import { createApp } from 'vue'
import { createVueI18nPlugin } from 'vue-i18n-kit'
import App from './App.vue'

const app = createApp(App)

app.use(
  createVueI18nPlugin({
    defaultLocale: 'en',
    fallbackLocale: 'en',
    locales: {
      en: {
        messages: () => import('./locales/en.json'),
        meta: { display: 'English', flag: '🇬🇧' },
      },
      ru: {
        messages: () => import('./locales/ru.json'),
        meta: { display: 'Русский', flag: '🇷🇺' },
      },
    },
    persistLocale: true,
  }),
)

app.mount('#app')
```

**3. Use composables in components**

```vue
<script setup lang="ts">
import { useT, useLocale, useAvailableLocales } from 'vue-i18n-kit'

const { t, tm } = useT()
const { locale, setLocale, isLoading, localeMeta } = useLocale()
const { availableLocales } = useAvailableLocales()
</script>

<template>
  <div>
    <p>{{ t('greeting', { name: 'Alice' }) }}</p>
    <p>{{ tm('items', { count: 5 }) }}</p>

    <select :value="locale" @change="setLocale(($event.target as HTMLSelectElement).value)">
      <option v-for="loc in availableLocales" :key="loc.code" :value="loc.code">
        {{ loc.meta?.flag }} {{ loc.meta?.display ?? loc.code }}
      </option>
    </select>

    <span v-if="isLoading">Loading…</span>
    <button :disabled="isLoading">{{ t('buttons.submit') }}</button>
  </div>
</template>
```

### More examples

#### Dates, numbers, and currency adapt themselves to the language

`formatDate`/`formatNumber`/`formatCurrency` wrap the native Intl APIs, follow the active locale, and re-render themselves the moment it switches — no hand-rolled per-language formatting.

```ts
import { useFormat } from 'vue-i18n-kit'

const { formatDate, formatNumber, formatCurrency } = useFormat()

formatDate(new Date(), { dateStyle: 'long' }) // '28 марта 2026 г.'  (ru)
formatNumber(1_234_567.89) // '1 234 567,89'     (ru)
formatCurrency(1999.99, 'EUR') // '1 999,99 €'       (ru)

// Switch the active locale and every formatter re-renders itself — no
// manual re-formatting, no separate en/ru number-formatting code paths.
```

#### Pluralization that actually handles Russian

One ICU template, and `Intl.PluralRules` picks the right form — one/few/many/other — instead of a hand-rolled if/else chain per number.

```ts
import { useT } from 'vue-i18n-kit'

const { tm } = useT()

// locale: "{points} {points, plural, one {рубль} few {рубля} many {рублей} other {рублей}}"
tm('balance', { points: 1 }) // → '1 рубль'
tm('balance', { points: 3 }) // → '3 рубля'
tm('balance', { points: 21 }) // → '21 рубль'
tm('balance', { points: 25 }) // → '25 рублей'

// Same template, four different real Russian plural forms — driven by
// Intl.PluralRules under the hood, not a hand-rolled if/else chain.
```

#### A forgotten translation breaks the build, not production

The Vite plugin diffs every locale against the reference one on every save and on build — a missing key surfaces in seconds, not after a user complaint.

```ts
import { vueI18nCheckPlugin } from 'vue-i18n-kit/vite'

export default defineConfig({
  plugins: [
    vue(),
    vueI18nCheckPlugin({
      localesDir: 'src/locales',
      defaultLocale: 'en',
      failOnMissing: true,
    }),
  ],
})

// Runs on every locale-file save (HMR) and again at build start:
//
// [vue-i18n-kit] Incomplete translations detected (reference: "en"):
//   Locale "ru":
//     Missing keys (2):
//       - buttons.cancel
//       - profile.title
```

---

## Documentation & links

- 📖 **Full documentation:** [npm.vuecraft.ru/en/packages/vue-i18n-kit](https://npm.vuecraft.ru/en/packages/vue-i18n-kit/guide/overview.html)
- 🌐 **VueCraft:** [vuecraft.ru/en](https://vuecraft.ru/en)
- 👤 **Author:** [macrulez.ru/en](https://macrulez.ru/en)
- 💻 **GitHub:** [macrulezru/vue-i18n-kit](https://github.com/macrulezru/vue-i18n-kit)
- 📦 **NPM:** [vue-i18n-kit](https://www.npmjs.com/package/vue-i18n-kit)
- 🐛 **Issues:** [github.com/macrulezru/vue-i18n-kit/issues](https://github.com/macrulezru/vue-i18n-kit/issues)

---

## License

MIT

---

## 💖 Support the project

Open source takes time and effort. If this library saves you time or brings value, consider supporting further development.

<a href="https://donate.cryptocloud.plus/M6O34NIN" target="_blank">
  <img src="https://img.shields.io/badge/Donate-CryptoCloud-8A2BE2?style=for-the-badge&logo=cryptocurrency&logoColor=white" alt="Donate via CryptoCloud">
</a>

Thank you for being part of this journey. ❤️
