# **i18n Kit**

![i18n Kit](https://github.com/macrulezru/assets/blob/master/packages-images/vue-i18n-kit.png?raw=true)

A reusable Vue 3 localization plugin that wraps [`vue-i18n`](https://vue-i18n.intlify.dev/) and provides a ready-to-use integration layer — set up once, reuse across every project in your team.

---

## Contents

- [Features](#features)
- [Requirements](#requirements)
- [Demo](#demo)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Plugin options](#plugin-options)
- [useLocale](#uselocale)
- [useT](#uset)
- [useAvailableLocales](#useavailablelocales)
- [useFormat](#useformat)
- [usePluralize](#usepluralize)
- [Plugin service](#plugin-service)
- [TypeScript](#typescript)
- [Error handling](#error-handling)
- [Locale persistence](#locale-persistence)
- [Vite plugin — completeness check](#vite-plugin--translation-completeness-check)
- [Vite plugin — inline translations](#vite-plugin--inline-translations)
- [Vite plugin — namespace code splitting](#vite-plugin--namespace-code-splitting)
- [Vite plugin — in-context editor](#vite-plugin--in-context-translation-editor-dev-only)
- [CLI — init](#init--interactive-setup-wizard)
- [CLI — add](#add--add-a-new-locale)
- [CLI — check](#check--audit-translation-completeness)
- [CLI — merge](#merge--merge-a-shared-dictionary)
- [CLI — prune](#prune--remove-unused-keys)
- [CLI — types](#types--generate-typescript-types)
- [CLI — split / merge-ns](#split--split-a-monolithic-locale-into-namespaces)
- [CLI — stale](#stale--show-outdated-translations)
- [CLI — export / import](#export--export-for-translators-xliff--po)
- [CLI — stats](#coverage-report-vue-i18n-kit-stats)
- [Stale translation detection](#stale-translation-detection)
- [XLIFF / PO export & import](#xliff--po-export--import)
- [Machine translation](#machine-translation)
- [Locale editor UI](#locale-editor-ui)
- [Base dictionary (extends)](#base-dictionary-extends)
- [Locked keys](#locked-keys)
- [Validation rules](#validation-rules-rules)
- [Ignore lists](#ignore-lists-ignore)
- [Nuxt & SSR](#nuxt--ssr)
- [Architecture](#architecture)
- [Bundle size & peer dependencies](#bundle-size--peer-dependencies)

---

## Features

- **One-liner setup** — install the plugin in `main.ts` and start using composables immediately
- **Two-method translation API** — `t(key, vars?)` for simple strings, `tm(key, vars)` for ICU-pluralized strings; both from `useT()`
- **ICU pluralization** — `Intl.PluralRules`-based with named CLDR categories (`one`, `few`, `many`, …); correct for every language including Arabic (6 forms)
- **Lazy loading** — locale JSON files are fetched on demand; only the active locale is loaded at startup
- **Persist locale** — selected language is automatically saved to `localStorage` and restored on next visit
- **Fallback locale** — missing translation keys transparently fall back to the configured fallback language
- **Locale metadata** — attach any custom data to a locale (`display`, `flag`, `author`, …) and read it back through `useLocale` and `useAvailableLocales`
- **Date / number / currency formatting** — `useFormat` wraps `Intl` and always uses the active locale
- **Plugin service** — `createVueI18nPlugin` returns an `I18nPlugin` with a `.service` property — fully usable outside Vue components (router guards, Pinia stores, SSR entry points)
- **Locale change hook** — `service.onLocaleChange(cb)` fires after every successful locale switch; returns an unsubscribe function
- **TypeScript-first** — all public APIs are fully typed, no `any` leaks into consumer code
- **Vite check plugin** — checks all locale files for missing or extra keys at build time (import from `vue-i18n-kit/vite`)
- **Vite inline plugin** — `vueI18nInlinePlugin` bakes all locale JSON into the bundle as a static virtual module — zero HTTP requests at runtime
- **Vite namespace plugin** — `vueI18nNamespacePlugin` scans split locale directories and generates a virtual module with per-namespace dynamic imports; lazy-load namespaces on demand with `useNamespace()`
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

## Requirements

| Peer dependency | Version | Required |
|---|---|---|
| `vue` | `^3.3.0` | yes |
| `vue-i18n` | `^11.0.0` | yes |
| `vite` | `>=5.0.0` | only for the Vite plugin |

Neither `vue` nor `vue-i18n` is bundled — they must be installed in the consuming project.

---

## Demo

The `demo/` folder contains a ready-to-run Vue 3 app that showcases the key features of vue-i18n-kit: lazy locale loading, ICU plurals, locale-aware formatting, and the in-context translation editor.

**What the demo includes:**

- Three locales — English (full), Russian (full, with `one/few/many/other` plurals), German (intentionally incomplete — 8 keys missing to demonstrate the editor)
- EN loaded synchronously, RU/DE lazy-loaded on demand — Vite code-splits them into separate chunks
- `useT` / `tm()` with ICU plural sliders — move the slider to watch plural forms change in real time
- `useFormat` formatting — numbers, currency, and dates rendered with `Intl` and the active locale
- `useLocale` locale switcher with loading indicator while the new locale chunk is fetched
- Dev overlay — hover any translated text to see a pencil icon; click it to open the inline key editor. Only works with `npm run demo:full` (pencil icons are not injected in plain `npm run demo`)
- **Editor UI button** — when running `demo:full`, a purple **"Editor UI ↗"** button appears in the top-right corner of the NavBar; click it to open the full dictionary editor at `http://localhost:4173`

**Run from the repository root:**

```bash
# Build the package, install demo dependencies, start Vite dev server
npm run demo           # app → http://localhost:5173

# Same as above + starts the full dictionary editor UI
npm run demo:full      # app → http://localhost:5173  |  editor → http://localhost:4173
```

`npm run demo:full` uses `vue-i18n-kit dev` under the hood, which spawns both the Vite app server and the UI editor server in parallel and wires them together automatically.

> **Note:** Both scripts rebuild the package first so the dev overlay bundle is always up to date.

---

## Installation

```bash
npm install vue-i18n-kit vue vue-i18n
```

---

## Quick start

### 1. Create locale files

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

```json
// locales/ru.json
{
  "buttons": {
    "submit": "Отправить",
    "cancel": "Отмена"
  },
  "greeting": "Привет, {name}!",
  "items": "{count, plural, one {# товар} few {# товара} many {# товаров} other {# товаров}}"
}
```

> **Tip:** Run `vue-i18n-kit init` to scaffold step 1 automatically (locale files, config, Vite plugin).
> The wizard detects your entry file and prints the ready-to-paste snippet for step 2 below.

### 2. Register the plugin

This step is **always manual** — `vue-i18n-kit init` never modifies `main.ts`, it only prints the snippet so you can paste it yourself.

```ts
// main.ts
import { createApp } from 'vue'
import { createVueI18nPlugin } from 'vue-i18n-kit'
import App from './App.vue'

const app = createApp(App)

app.use(createVueI18nPlugin({
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
}))

app.mount('#app')
```

### 3. Use composables in components

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
    <p>Active: {{ localeMeta?.flag }} {{ localeMeta?.display }}</p>
  </div>
</template>
```

---

## Plugin options

```ts
interface I18nPluginOptions {
  defaultLocale: string
  fallbackLocale?: string
  locales: Record<string, LocaleEntry>
  persistLocale?: boolean
  storageKey?: string
  vueI18nOptions?: Record<string, unknown>
}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultLocale` | `string` | — | **Required.** Locale loaded on startup. |
| `fallbackLocale` | `string` | — | Locale used when a key is missing in the active locale. Also pre-loaded synchronously so it is available immediately. |
| `locales` | `Record<string, LocaleEntry>` | — | **Required.** Map of locale codes to message objects, loader functions, or `LocaleDefinition` objects. See formats below. |
| `persistLocale` | `boolean` | `false` | Save the selected locale to `localStorage` and restore it on next visit. |
| `storageKey` | `string` | `'vue3-i18n-locale'` | Key used for `localStorage` when `persistLocale` is `true`. |
| `vueI18nOptions` | `object` | — | Extra options forwarded directly to `vue-i18n`'s `createI18n`. |

### Locale entry formats

Each locale in the `locales` map accepts one of three forms. They can be freely mixed within the same config.

**1. Plain message object (synchronous)**

```ts
locales: {
  en: { buttons: { submit: 'Submit' }, greeting: 'Hello, {name}!' },
}
```

Messages are bundled into the app at build time and available immediately.

**2. Async loader function (lazy)**

```ts
locales: {
  ru: () => import('./locales/ru.json'),
}
```

The JSON file is fetched only when `setLocale('ru')` is called. Until then it has zero impact on the initial bundle size.

**3. `LocaleDefinition` — messages + custom metadata**

```ts
locales: {
  en: {
    messages: () => import('./locales/en.json'),
    meta: { display: 'English', flag: '🇬🇧' },
  },
  ru: {
    messages: () => import('./locales/ru.json'),
    meta: { display: 'Русский', flag: '🇷🇺', author: 'Danil Lisin' },
  },
}
```

`meta` is an arbitrary object — the shape is entirely up to the project. It is accessible through `useLocale().localeMeta` and `useAvailableLocales().availableLocales[n].meta`. All three forms can be mixed freely in the same `locales` map.

---

## useLocale

Returns the current locale, a switcher function, a loading flag, and the active locale's metadata.

```ts
import { useLocale } from 'vue-i18n-kit'

const { locale, setLocale, isLoading, localeMeta } = useLocale()
```

| Return value | Type | Description |
|---|---|---|
| `locale` | `Ref<string>` | Currently active locale code (reactive). |
| `setLocale` | `(lang: string) => Promise<void>` | Switch to a different locale. Lazy-loads the JSON if needed, then updates `locale`. Throws if `lang` is not registered. |
| `isLoading` | `Ref<boolean>` | `true` while a locale's JSON is being fetched. |
| `localeMeta` | `ComputedRef<Record<string, unknown> \| undefined>` | Metadata of the active locale from its `LocaleDefinition.meta`. Updates reactively on locale switch. |

Pass a generic type for typed `localeMeta` without manual casting:

```ts
interface AppLocaleMeta {
  display: string
  flag: string
  author?: string
}

const { localeMeta } = useLocale<AppLocaleMeta>()
localeMeta.value?.display  // string | undefined — fully typed
```

**Example — locale switcher:**

```vue
<script setup lang="ts">
import { useLocale, useAvailableLocales } from 'vue-i18n-kit'

const { locale, setLocale, isLoading, localeMeta } = useLocale()
const { availableLocales } = useAvailableLocales()

async function handleChange(code: string) {
  try {
    await setLocale(code)
  } catch (err) {
    console.error('Failed to load locale:', err)
  }
}
</script>

<template>
  <span>{{ localeMeta?.flag }} {{ localeMeta?.display ?? locale }}</span>

  <select :value="locale" @change="handleChange(($event.target as HTMLSelectElement).value)">
    <option v-for="loc in availableLocales" :key="loc.code" :value="loc.code">
      {{ loc.meta?.flag }} {{ loc.meta?.display ?? loc.code }}
    </option>
  </select>

  <span v-if="isLoading">Loading…</span>
</template>
```

---

## useT

The primary translation composable. Returns two methods — `t` for plain strings and `tm` for ICU-pluralized strings. Both are locale-reactive and update automatically when the active locale changes.

```ts
import { useT } from 'vue-i18n-kit'

const { t, tm } = useT()
```

### `t(key, vars?)`

Looks up a key in the active locale file and interpolates named `{placeholder}` tokens.

```ts
t('buttons.submit')                   // → 'Submit'
t('greeting', { name: 'Alice' })      // → 'Hello, Alice!'
```

| Argument | Type | Description |
|---|---|---|
| `key` | `string` | Dot-separated path in the locale file (`'buttons.submit'`, `'greeting'`). |
| `vars` | `object` | Optional. Named values substituted into `{placeholder}` tokens. |

### `tm(key, vars)`

Looks up a key whose value is an ICU plural template, then selects the correct plural form using `Intl.PluralRules` for the active locale.

```ts
tm('items',   { count: 1  })   // → '1 item'
tm('items',   { count: 5  })   // → '5 items'
tm('balance', { points: 3 })   // → '3 рубля'
tm('balance', { points: 11 })  // → '11 рублей'
```

**ICU template syntax:**

| Construct | Description |
|---|---|
| `{varName, plural, …}` | Plural form selector. `varName` must be a key in `vars`; its numeric value determines the CLDR category. |
| `one {…}` `few {…}` `many {…}` `other {…}` | Form for each CLDR category. `other` is required — used as fallback. |
| `#` inside a form | Replaced with the variable's numeric value. |
| `{varName}` outside plural | Simple interpolation — replaced with `vars.varName`. |

**Examples:**

```ts
// Display + plural in one template
tm('balance', { points: 21 })
// locale: "{points} {points, plural, one {рубль} few {рубля} many {рублей} other {рублей}}"
// → '21 рубль'

// Multiple variables
tm('score', { user: 'Даня', score: 21 })
// locale: "{user} набрал {score} {score, plural, one {балл} few {балла} many {баллов} other {баллов}}"
// → 'Даня набрал 21 балл'

// Multiple plural constructs in one string
tm('report', { files: 2, errors: 5 })
// → '2 файла (5 ошибок)'
```

**CLDR categories by language:**

| Language | Categories used |
|---|---|
| English, Turkish | `one`, `other` |
| Russian, Polish | `one`, `few`, `many`, `other` |
| Arabic | `zero`, `one`, `two`, `few`, `many`, `other` |
| Japanese, Chinese | `other` (no grammatical plural) |

Full rules: [CLDR Plural Rules](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html)

---

## useAvailableLocales

Returns a computed list of all locales registered in the plugin config. Each item is a `LocaleInfo` object containing the locale code and its metadata.

```ts
import { useAvailableLocales } from 'vue-i18n-kit'

const { availableLocales } = useAvailableLocales()
// availableLocales.value →
// [
//   { code: 'en', meta: { display: 'English', flag: '🇬🇧' } },
//   { code: 'ru', meta: { display: 'Русский', flag: '🇷🇺' } },
// ]
```

| Return value | Type | Description |
|---|---|---|
| `availableLocales` | `ComputedRef<LocaleInfo[]>` | All locales in declaration order. Each item has `code: string` and `meta: TMeta \| undefined`. |

Pass a generic type to get typed `meta` without casting:

```ts
interface AppLocaleMeta { display: string; flag: string }

const { availableLocales } = useAvailableLocales<AppLocaleMeta>()
availableLocales.value[0].meta?.display  // string | undefined
```

---

## useFormat

Provides locale-aware formatting using the native `Intl` APIs. All formatters automatically use the currently active locale and update when the locale is switched.

```ts
import { useFormat } from 'vue-i18n-kit'

const { formatDate, formatNumber, formatCurrency } = useFormat()
```

### `formatDate(value, options?)`

```ts
// value: Date | number (timestamp) | string (ISO)
// options: Intl.DateTimeFormatOptions

formatDate(new Date())                                          // '28.03.2026'  (ru)
formatDate(new Date(), { dateStyle: 'long' })                   // '28 марта 2026 г.'  (ru)
formatDate(new Date(), { dateStyle: 'long' })                   // 'March 28, 2026'  (en)
formatDate(new Date(), { hour: '2-digit', minute: '2-digit' })  // '19:45'
```

### `formatNumber(value, options?)`

```ts
formatNumber(1_234_567.89)                    // '1 234 567,89'  (ru)
formatNumber(1_234_567.89)                    // '1,234,567.89'  (en)
formatNumber(0.42, { style: 'percent' })      // '42 %'
```

### `formatCurrency(value, currency, options?)`

```ts
// currency: ISO 4217 code (USD, EUR, RUB, ...)

formatCurrency(1999.99, 'USD')                               // '$1,999.99'   (en)
formatCurrency(1999.99, 'EUR')                               // '1 999,99 €'  (ru)
formatCurrency(1999,    'USD', { minimumFractionDigits: 0 }) // '$1,999'
```

---

## usePluralize

For ICU pluralization use `tm()` from `useT()` — it is the primary API. `usePluralize` exposes one additional utility: `pluralCategory`, which returns the raw CLDR category for a count value.

```ts
import { usePluralize } from 'vue-i18n-kit'

const { pluralCategory } = usePluralize()
```

### `pluralCategory(count)`

Returns the raw CLDR plural category string for `count` in the active locale. Useful for applying CSS classes or driving conditional rendering.

```ts
// English locale
pluralCategory(1)   // 'one'
pluralCategory(5)   // 'other'

// Russian locale
pluralCategory(1)   // 'one'
pluralCategory(3)   // 'few'
pluralCategory(5)   // 'many'
```

---

## Plugin service

`createVueI18nPlugin` returns an `I18nPlugin` object — it satisfies Vue's `Plugin` interface (so `app.use(plugin)` works unchanged) and exposes a `.service` property that is usable **anywhere in the application**, including outside Vue component `setup()`.

```ts
import { createVueI18nPlugin } from 'vue-i18n-kit'

export const i18nPlugin = createVueI18nPlugin({
  defaultLocale: 'en',
  locales: {
    en: { messages: () => import('./locales/en.json'), meta: { display: 'English' } },
    ru: { messages: () => import('./locales/ru.json'), meta: { display: 'Русский' } },
  },
})
```

```ts
// router/index.ts — outside setup()
import { i18nPlugin } from '@/i18n'

router.beforeEach(async (to) => {
  const lang = to.params.lang as string
  if (lang) await i18nPlugin.service.setLocale(lang)
})
```

### `service` API

| Property | Type | Description |
|---|---|---|
| `locale` | `Ref<string>` | Currently active locale — the same ref instance as `useLocale().locale`. |
| `isLoading` | `Ref<boolean>` | `true` while a locale file is being fetched. |
| `setLocale` | `(lang: string) => Promise<void>` | Switch locale. Lazy-loads if needed. Throws if `lang` is not registered. |
| `availableLocales` | `ComputedRef<LocaleInfo[]>` | All registered locales with their metadata. Same computed instance on every access. |
| `onLocaleChange` | `(cb: (lang: string) => void) => () => void` | Subscribe to locale switches. Returns an unsubscribe function. |

### `onLocaleChange`

Subscribe to locale switches from anywhere — useful for syncing external state that cannot be driven by Vue reactivity.

```ts
// Update <html lang> on every switch
i18nPlugin.service.onLocaleChange((lang) => {
  document.documentElement.lang = lang
})

// Unsubscribe when no longer needed
const unsubscribe = i18nPlugin.service.onLocaleChange((lang) => {
  analytics.track('locale_changed', { lang })
})
unsubscribe()
```

### `service` vs composables — when to use which

| Context | Recommended API |
|---|---|
| Vue component `setup()` | `useLocale()`, `useT()`, `useAvailableLocales()` — reactive, template-friendly |
| Router guards, Pinia stores, utility modules | `plugin.service` — no `getCurrentInstance()` needed |
| SSR entry points, server middleware | `plugin.service` — inject the plugin instance from your plugin file |

### SSR note

`service` stores state in a closure created when `createVueI18nPlugin` is called. In SSR the plugin **must be created per request**, not at module level:

```ts
// ✅ Correct — one plugin instance per Nuxt request
export default defineNuxtPlugin((nuxtApp) => {
  const plugin = createVueI18nPlugin({ ... })
  nuxtApp.vueApp.use(plugin)
})
```

```ts
// ❌ Wrong — shared across all SSR requests
const plugin = createVueI18nPlugin({ ... })   // module level
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(plugin)   // plugin.service.locale is shared — requests contaminate each other
})
```

---

## TypeScript

All public types are re-exported for use in consumer projects:

```ts
import type {
  // Plugin
  I18nPluginOptions,
  I18nPlugin,               // return type of createVueI18nPlugin — Plugin & { service }
  I18nService,              // { locale, isLoading, setLocale, availableLocales, onLocaleChange }

  // Locale entry types
  LocaleMessages,           // Record<string, unknown>
  LocaleEntry,              // LocaleMessages | LocaleLoader | LocaleDefinition
  LocaleDefinition,         // { messages, meta? }
  LocaleInfo,               // { code, meta } — returned by useAvailableLocales

  // Composable return shapes
  UseLocaleReturn,
  UseTReturn,
  UseAvailableLocalesReturn,
  UseFormatReturn,
  UsePluralizeReturn,

  // Pluralization
  PluralVars,               // Record<string, string | number>
} from 'vue-i18n-kit'
```

### Typing locale metadata

Define a project-wide interface for your `meta` shape and pass it as a generic to both composables:

```ts
// types/i18n.ts
export interface AppLocaleMeta {
  display: string   // human-readable locale name
  flag?: string     // emoji flag, optional
  author?: string   // translator credit, optional
}
```

```ts
import type { AppLocaleMeta } from '@/types/i18n'
import { useLocale, useAvailableLocales } from 'vue-i18n-kit'

const { localeMeta } = useLocale<AppLocaleMeta>()
localeMeta.value?.display   // string | undefined  ✓

const { availableLocales } = useAvailableLocales<AppLocaleMeta>()
availableLocales.value[0].meta?.flag  // string | undefined  ✓
```

---

## Error handling

### Unknown locale

`setLocale` throws a descriptive error if the requested locale is not registered:

```ts
try {
  await setLocale('de')
} catch (err) {
  // [vue-i18n-kit] Locale "de" is not registered. Available locales: en, ru
  console.error(err.message)
}
```

### Failed network request

If the async loader function rejects, `setLocale` resets `isLoading` to `false` and re-throws the original error. `isLoading.value` is guaranteed to be `false` after the `catch` block.

### Plugin not installed

Calling any composable before `app.use(createVueI18nPlugin(...))` throws immediately:

```
[vue-i18n-kit] Plugin not installed. Call app.use(createVueI18nPlugin(...)) before using composables.
```

---

## Locale persistence

When `persistLocale: true` is set, the selected locale is saved to `localStorage` under the configured `storageKey`. On the next page load the plugin reads this value and uses it as the initial locale, falling back to `defaultLocale` if the saved value is not a registered locale code.

`localStorage` calls are wrapped in `try/catch` so the plugin works without issues in environments where storage is restricted (private browsing, certain iframe contexts).

### `persistLocale` vs manual `localStorage`

| | `persistLocale: true` | Manual `localStorage` |
|---|---|---|
| **Setup** | One option in `createVueI18nPlugin` | Read on startup, write in `onLocaleChange` |
| **Restore on page load** | Automatic | You read the key and pass the value as `defaultLocale` |
| **Good when** | You just need locale to survive a page reload | You store extra data alongside the locale, use `sessionStorage`, or share the key with other parts of the app |

**Option A — let the plugin handle it (recommended for most projects):**

```ts
app.use(createVueI18nPlugin({
  defaultLocale: 'en',
  locales: { ... },
  persistLocale: true,
}))
```

**Option B — manage storage yourself:**

```ts
const saved = localStorage.getItem('my-locale')
const initial = ['en', 'ru'].includes(saved ?? '') ? saved! : 'en'

app.use(i18nPlugin)   // persistLocale is NOT set

i18nPlugin.service.onLocaleChange((lang) => {
  localStorage.setItem('my-locale', lang)
})
```

> **Do not combine both options for the same storage key.** If `persistLocale: true` is set and you also call `localStorage.setItem` manually, the plugin will overwrite your value on the next `setLocale`.

---

## Vite plugin — Translation completeness check

Checks all locale JSON files against a reference locale and reports any missing or extra keys. Runs at `buildStart` and on every locale file save during development (HMR).

```ts
// vite.config.ts
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
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `localesDir` | `string` | `'src/locales'` | Directory containing locale JSON files, relative to Vite project root. |
| `defaultLocale` | `string` | first file alphabetically | Locale used as the reference when comparing keys. |
| `failOnMissing` | `boolean` | `false` | When `true`, missing keys abort the build with an error. |

### Example output

```
[vue-i18n-kit] Incomplete translations detected (reference: "en"):
  Locale "ru":
    Missing keys (2):
      - buttons.cancel
      - profile.title
  Locale "de":
    Missing keys (1):
      - profile.title
    Extra keys (1):
      + legacy.old_key
```

---

## Vite plugin — Inline translations

`vueI18nInlinePlugin` bakes all locale JSON files into the production bundle at build time via a virtual module. There are **no runtime HTTP requests** — the translations are a plain JavaScript object embedded in the bundle.

Ideal for: SSR apps, offline-capable PWAs, small projects where bundle size matters less than loading latency.

```ts
// vite.config.ts
import { vueI18nInlinePlugin } from 'vue-i18n-kit/vite'

export default defineConfig({
  plugins: [
    vue(),
    vueI18nInlinePlugin({
      locales: {
        en: 'src/locales/en.json',
        ru: 'src/locales/ru.json',
        de: 'src/locales/de.json',
      },
    }),
  ],
})
```

### Usage in your app

```ts
import inlineLocales from 'virtual:vue-i18n-kit/locales'

app.use(
  createVueI18nPlugin({
    defaultLocale: 'en',
    locales: {
      en: { messages: inlineLocales.en, meta: { display: 'English' } },
      ru: { messages: inlineLocales.ru, meta: { display: 'Русский' } },
    },
  })
)
```

TypeScript — add to `env.d.ts` or `vite-env.d.ts`:

```ts
declare module 'virtual:vue-i18n-kit/locales' {
  const locales: Record<string, Record<string, unknown>>
  export default locales
}
```

---

## Vite plugin — Namespace code splitting

`vueI18nNamespacePlugin` scans a directory of split locale files and generates the virtual module `virtual:vue-i18n-namespaces`. The module exports a `locales` object ready to pass to `createVueI18nPlugin` — each locale entry includes per-namespace dynamic `import()` calls so Vite code-splits them automatically.

```ts
// vite.config.ts
import { vueI18nNamespacePlugin } from 'vue-i18n-kit/vite'

export default defineConfig({
  plugins: [
    vue(),
    vueI18nNamespacePlugin({
      dir: 'src/locales/split',
      locales: {
        en: { meta: { display: 'English', flag: '🇬🇧' }, eagerNamespaces: ['common'] },
        ru: { meta: { display: 'Русский',  flag: '🇷🇺' }, eagerNamespaces: ['common'] },
      },
    }),
  ],
})
```

### Usage in your app

```ts
import { locales } from 'virtual:vue-i18n-namespaces'

app.use(createVueI18nPlugin({ defaultLocale: 'en', locales }))
```

Namespaces not in `eagerNamespaces` are loaded lazily with `useNamespace()`:

```ts
const { isLoading } = useNamespace('dashboard')
// or several at once:
const { isLoading } = useNamespace(['dashboard', 'charts'])
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `dir` | `string` | `'src/locales/split'` | Directory containing locale subdirectories (`<dir>/<locale>/<namespace>.json`). |
| `locales` | `Record<string, { meta?, eagerNamespaces? }>` | `{}` | Per-locale config. Locales found in the directory but not listed here are included automatically. |

HMR: when any namespace JSON file inside `dir` changes, Vite invalidates and reloads the virtual module automatically.

---

## Vite plugin — In-context translation editor (dev only)

`vueI18nDevPlugin` injects a floating editor overlay into your running application during development. Translated strings can be wrapped with the `<I18nInspect>` component to show a pencil icon on hover; clicking it opens an inline popup for editing that key.

**The plugin is a complete no-op during production builds.**

```ts
// vite.config.ts
import { vueI18nDevPlugin } from 'vue-i18n-kit/vite'

export default defineConfig({
  plugins: [
    vue(),
    vueI18nDevPlugin(),  // uiUrl is set automatically by vue-i18n-kit dev
  ],
})
```

Start both servers with one command:

```bash
npx vue-i18n-kit dev
```

This auto-detects `scripts.dev` from `package.json`, starts both Vite and the locale editor UI in parallel, and passes `I18N_KIT_UI_URL` to `vueI18nDevPlugin` automatically.

### Auto-wrap (default)

By default `vueI18nDevPlugin` automatically rewrites Vue SFC templates at dev time. Every `{{ t('key') }}`, `{{ tm('key') }}`, and `{{ $t('key') }}` interpolation is wrapped with `<I18nInspect>` — **no manual markup needed**.

```vue
<!-- Source as written -->
<template>
  <p>{{ t('nav.home') }}</p>
</template>

<!-- What Vite actually compiles in dev mode -->
<template>
  <p><I18nInspect i18n-key="nav.home">{{ t('nav.home') }}</I18nInspect></p>
</template>
```

Set `autoWrap: false` to use explicit `<I18nInspect i18n-key="…">` markup or the `v-i18n-inspect` directive instead.

### Dynamic keys — `v-i18n-inspect` directive

For runtime keys (variables, computed values, loop indices) use the directive which attaches hover behaviour to the existing element without adding a wrapper node:

```vue
<span v-i18n-inspect="activeKey">{{ t(activeKey) }}</span>
<span v-i18n-inspect="`items.${item.id}`">{{ t(`items.${item.id}`) }}</span>
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `uiUrl` | `string` | `I18N_KIT_UI_URL` env or `'http://localhost:4173'` | URL of the running `vue-i18n-kit ui` server. |
| `autoWrap` | `boolean` | `true` | Automatically wrap `t()` / `tm()` / `$t()` interpolations with `<I18nInspect>` at dev time. |
| `wrapFunctions` | `string[]` | `['t', 'tm', '$t']` | Function names to look for when `autoWrap` is enabled. |
| `iframeWidth` | `string` | `'480px'` | Width of the right-side iframe editor panel. |

---

## CLI — Locale file management

The `vue-i18n-kit` CLI helps scaffold and audit locale JSON files.

```bash
# Via npx (no install needed)
npx vue-i18n-kit <command> [options]

# Or after installing the package
vue-i18n-kit <command> [options]
```

### `init` — Interactive setup wizard

Launches an interactive wizard that scaffolds the entire localization setup.

```bash
vue-i18n-kit init
```

**What it does:**

1. Auto-scans the project for an existing `createVueI18nPlugin` call and pre-fills locale codes as defaults.
2. Prompts for locale codes, display names, and flag emojis.
3. Prompts for the locales directory and toolkit directory paths.
4. Detects `vite.config.ts` / `nuxt.config.ts` and optionally adds `vueI18nMapPlugin` automatically.
5. Handles existing locale JSON files — keep, overwrite, or copy structure from another locale.
6. Writes `i18n-kit.config.json`, `i18n-tools/locales.config.json`, locale JSON stubs.

Running `vue-i18n-kit init` on an existing project offers three choices: use the current config as-is, update settings, or reinitialize from scratch.

**i18n Ally integration** — the wizard optionally generates `.vscode/settings.json` for [i18n Ally](https://marketplace.visualstudio.com/items?itemName=lokalise.i18n-ally) with inline translation previews and missing-key highlighting.

---

### `add` — Add a new locale

Copies the structure of an existing locale file into a new one.

```bash
vue-i18n-kit add fr
vue-i18n-kit add fr --from en --empty
vue-i18n-kit add de --dir src/i18n --from en --empty
```

| Flag | Default | Description |
|---|---|---|
| `--dir <path>` | `src/locales` | Locales directory. |
| `--from <locale>` | first file in dir | Source locale to copy structure from. |
| `--empty` | `false` | Write empty strings instead of copying source values. |

---

### `check` — Audit translation completeness

Reads all `.json` files in the locales directory and reports missing or extra keys compared to the reference locale.

```bash
vue-i18n-kit check
vue-i18n-kit check --default en --dir src/i18n

# Exit with code 1 if any keys are missing (useful in CI)
vue-i18n-kit check --default en --fail
```

| Flag | Default | Description |
|---|---|---|
| `--dir <path>` | `src/locales` | Locales directory. |
| `--default <locale>` | first alphabetically | Reference locale. |
| `--fail` | `false` | Exit with code `1` if any keys are missing. |

**CI integration (GitHub Actions):**

```yaml
- name: Check i18n completeness
  run: npx vue-i18n-kit check --default en --fail
```

---

### `merge` — Merge a shared dictionary

Deep-merges a base or corporate JSON dictionary into project locale files. Only adds missing keys by default — existing translations are left untouched unless `--overwrite` is passed.

```bash
vue-i18n-kit merge shared/base.json --dry
vue-i18n-kit merge shared/base.json
vue-i18n-kit merge updates.json --locale ru --overwrite
```

| Flag | Default | Description |
|---|---|---|
| `--dir <path>` | `src/locales` | Locales directory. |
| `--locale <code>` | all locales | Only merge into this locale code. |
| `--overwrite` | `false` | Overwrite existing keys instead of skipping them. |
| `--dry` | `false` | Preview changes without writing any files. |
| `--no-sort` | `false` | Skip alphabetical sort of result keys. |

> Keys listed in `ignore.prune` and `locked` in `i18n-kit.config.json` are never overwritten — even with `--overwrite`.

---

### `prune` — Remove unused keys

Scans source files for `t()`, `tm()`, `$t()` calls and removes any locale keys not referenced anywhere in the project.

```bash
vue-i18n-kit prune --dry
vue-i18n-kit prune
vue-i18n-kit prune --entries i18n-tools/locales.entries.json
```

| Flag | Default | Description |
|---|---|---|
| `--dir <path>` | `src/locales` | Locales directory. |
| `--entries <file>` | _(scan)_ | Path to a pre-built `locales.entries.json`; skips scanning. |
| `--dry` | `false` | Print keys that would be removed, without writing files. |
| `--yes` | `false` | Skip confirmation prompt. |
| `--ignore <patterns>` | _(none)_ | Comma-separated key patterns to never remove (e.g. `"status.*,legacy.*"`). |

> **Tip:** Run `prune --dry` in CI and fail the build if output is non-empty to enforce a "no dead keys" policy.

---

### `types` — Generate TypeScript types

Generates a `TranslationKey` union type from a reference locale file. Gives you autocomplete and compile-time key checking when calling `t()`.

```bash
vue-i18n-kit types
vue-i18n-kit types --out src/types/i18n.d.ts --locale en --watch
```

| Flag | Default | Description |
|---|---|---|
| `--out <path>` | `src/i18n.d.ts` | Output file path. |
| `--locale <code>` | first in config | Locale to use as the key source. |
| `--dir <path>` | `src/locales` | Locales directory. |
| `--watch` | `false` | Regenerate automatically when the locale file changes. |

**Generated file example:**

```ts
// src/i18n.d.ts — generated by vue-i18n-kit, do not edit

export type TranslationKey =
  | 'buttons.cancel'
  | 'buttons.submit'
  | 'greeting'
  | 'items'

declare module 'vue-i18n-kit' {
  interface Register {
    key: TranslationKey
  }
}
```

With the `Register` augmentation the compiler will error on unknown keys:

```ts
const { t } = useT()
t('buttons.submit')   // ✓
t('buttons.submitt')  // ✗ TypeScript error
```

---

### `split` — Split a monolithic locale into namespaces

Splits each `{locale}.json` into per-namespace files: `{locale}/{namespace}.json`.

```bash
vue-i18n-kit split
vue-i18n-kit split --dir src/locales --out src/locales/split --dry
```

| Flag | Default | Description |
|---|---|---|
| `--dir <path>` | `localesDir` from config | Source locales directory. |
| `--out <path>` | `<dir>/split` | Output directory. |
| `--dry` | `false` | Preview without writing files. |

---

### `merge-ns` — Merge namespace files back into flat JSON

Reverse operation of `split`: reads all `*.json` files in each locale subdirectory and merges them into a single `{locale}.json`.

```bash
vue-i18n-kit merge-ns
vue-i18n-kit merge-ns --dir src/locales/split --out src/locales --dry
```

---

### `stale` — Show outdated translations

Reports keys whose reference locale value has changed since the translation was last reviewed. Requires `staleTracking: true` in `i18n-kit.config.json`.

```bash
vue-i18n-kit stale
```

Output:

```
Stale keys (reference locale changed since last review):
  buttons.submit      stored: "Submit"  →  current: "Submit form"
  errors.auth.invalid  stored: "Invalid"  →  current: "Invalid credentials"
```

---

### `export` — Export for translators (XLIFF / PO)

Exports a locale to XLIFF 1.2 or Gettext PO format, ready to send to a professional translation agency or CAT tool.

```bash
vue-i18n-kit export --locale ru
vue-i18n-kit export --locale ru --format po --out translations/ru.po
vue-i18n-kit export --locale ru --format xliff --ref en
```

| Flag | Default | Description |
|---|---|---|
| `--locale <code>` | — | **Required.** Locale to export. |
| `--format <xliff\|po>` | `xliff` | Output format. |
| `--out <path>` | `<locale>.<format>` | Output file path. |
| `--dir <path>` | `src/locales` | Locales directory. |
| `--ref <code>` | first in config | Reference locale (source language). |

---

### `import` — Import from XLIFF / PO

Reads a completed XLIFF or PO file from a translator and writes the translated values back into the locale JSON file.

```bash
vue-i18n-kit import ru.xliff
vue-i18n-kit import translations/ru.po --dry
```

The target locale code is read from the file itself. Only keys present in the import file are updated; unrelated keys are left untouched.

---

## Coverage report (`vue-i18n-kit stats`)

Get a quick snapshot of translation completeness without opening the editor.

```bash
vue-i18n-kit stats
vue-i18n-kit stats --format json --out ci-report.json
vue-i18n-kit stats --format html
```

**Console output:**

```
  vue-i18n-kit stats  2026-04-11
  35 keys · 3 locales

  Coverage
  🇬🇧 English (en)    ████████████████████  100%
  🇷🇺 Русский (ru)    ████████████████░░░░   89%  4 missing
  🇩🇪 Deutsch (de)    ███████████████░░░░░   77%  8 missing
```

**GitHub Actions example:**

```yaml
- name: Check i18n coverage
  run: |
    npx vue-i18n-kit stats --format json --out coverage.json
    node -e "
      const r = require('./coverage.json');
      const low = r.locales.filter(l => l.coverage < 80);
      if (low.length) { console.error('Low coverage:', low.map(l => l.code + ' ' + l.coverage + '%')); process.exit(1); }
    "
```

| Option | Description |
|---|---|
| `--format console` | Terminal output with ANSI colours (default) |
| `--format json` | Machine-readable JSON; writes to stdout or `--out` |
| `--format html` | Self-contained HTML file (default: `i18n-stats.html`) |
| `--out <path>` | Write to file instead of stdout (json/html) |
| `--dir <path>` | Locales directory (default: `src/locales`) |

---

## Stale translation detection

When `staleTracking: true` is set, the editor tracks changes to the reference locale and marks translations in other locales as potentially outdated.

```json
// i18n-kit.config.json
{
  "staleTracking": true
}
```

**How it works:**

1. When you save a value in the reference locale via the editor, a SHA1 hash is stored in `i18n-kit.notes.json` under `_hash.<key>`.
2. On the next load the editor compares every reference value to its stored hash.
3. Keys with a mismatched hash appear with an `⚠ outdated` badge in the editor.
4. A dedicated `stale` filter shows only outdated keys.
5. Clicking **Mark as reviewed** resets the hash — use this after updating all translations.

---

## XLIFF / PO export & import

Industry-standard translation file formats — compatible with Phrase, Lokalise, Weblate, OmegaT, Poedit, and most CAT tools.

The XLIFF file includes `<source>` (reference text) and `<target>` (current translation). Translator notes from the editor appear as `<note>` elements. The PO file uses `msgctxt` for the key name, `msgid` for the source text, and `msgstr` for the translation.

The locale editor header has **Export XLIFF**, **Export PO**, and **Import** buttons that open locale-picker dialogs.

---

## Machine translation

The editor can auto-translate all missing keys with one click. Two engines are supported — choose in **Settings → Translation engine**.

### LibreTranslate

An open-source, self-hostable translation API. The public instance at `https://libretranslate.com` is free for low traffic.

### DeepL

Higher translation quality. The free plan covers **500,000 characters/month** — sign up at [deepl.com/pro](https://www.deepl.com/pro) for **DeepL API Free**.

Keys ending in `:fx` use the free-tier endpoint `api-free.deepl.com` automatically.

### Placeholder handling

Both engines receive strings with `{variable}` and ICU plural blocks (`{count, plural, ...}`) replaced by opaque XML tags (`<x id="0"/>`). After translation, the tags are substituted back — placeholders survive translation unchanged regardless of word order changes.

---

## Locale editor UI

A browser-based editor for viewing and editing locale files directly in your project — no external service, runs entirely on your machine.

### Setup

```json
// package.json
"i18n:ui": "vue-i18n-kit auto-config && vue-i18n-kit ui"
```

```bash
npm run i18n:ui
```

The editor opens at `http://localhost:4173`. `auto-config` reads your `createVueI18nPlugin(...)` call as the **single source of truth** — only the locales explicitly registered there are included.

Or start everything together (Vite + editor):

```bash
vue-i18n-kit dev
```

### Dashboard

- **Coverage overview** — overall coverage bar, per-locale progress with missing key count
- **Namespace cards** — coverage percentage per namespace
- **Unused keys** — keys with no `t()`/`tm()`/`$t()` usages found in source files
- **Phantom keys** — keys referenced in code but absent from all locale files; highlighted in red
- **Duplicate values** — keys where all locales share the same non-empty value (likely untranslated)

### Editor table

- **Inline editing** — click any cell to edit in place; save with Enter or ✓, cancel with Escape
- **Namespace groups** — keys grouped by dotted prefix; groups collapse/expand; arbitrary nesting depth
- **Group operations** — add sub-group, add key, rename namespace, delete group
- **Inline key actions** — rename, duplicate, add/edit note, delete
- **Batch select & delete** — row checkboxes + bulk delete bar
- **Usage map** — expand any key row to see which source files reference it; clickable file chips open the file in your IDE (VS Code, Cursor, WebStorm, PhpStorm, IntelliJ)
- **Cell validation** — inline warnings for placeholder mismatch, HTML tag mismatch, ICU syntax errors, length > 2.5× reference
- **Translation memory** — previously saved translations for similar source strings are shown as one-click suggestion chips
- **Plural preview** — for ICU keys, shows rendered forms for `n = 0, 1, 2, 5, 11, 21` across all locales
- **Interpolation preview** — expand a key row to fill in `{variable}` values and see the rendered output per locale
- **Keyboard navigation** — arrow keys move between cells; Enter starts editing; Space toggles selection
- **Live reload** — when a locale file changes on disk, the affected locale reloads automatically via SSE

### Toolbar & header

| Feature | Shortcut | Description |
|---|---|---|
| Quick Open | `Ctrl+P` | Fuzzy-search all keys by name; jump instantly |
| Find & Replace | `Ctrl+H` | Search values across all or a specific locale, preview and apply replacements |
| Undo | `Ctrl+Z` | Undo the last saved change (up to 100 steps) |
| Export CSV | — | Download all translations as a CSV file |
| Import CSV | — | Upload a CSV; preview diff before applying |
| Export XLIFF / PO | — | Export a locale for CAT tools / Poedit / Weblate |
| Import XLIFF / PO | — | Import completed file from a translator |
| Translate missing | — | Auto-translate missing values via LibreTranslate or DeepL |
| Shortcut help | `?` | Show keyboard shortcut cheatsheet |

### Filter bar

| Filter | Description |
|---|---|
| `all` / `missing` / `complete` | Show all keys, only keys with missing translations, or only fully translated keys |
| `unused` | Show only keys not referenced in any source file |
| `phantom` | Show only keys used in code but absent from all locale files |
| `stale` | Show only keys whose reference value changed since last review |

---

## Base dictionary (extends)

The `extends` field in `i18n-kit.config.json` lets a project inherit translations from a shared base — for example, a corporate terminology dictionary maintained centrally in a monorepo or npm package.

```json
// i18n-kit.config.json
{
  "extends": "../../shared-i18n"
}
```

When the editor reads a locale, base keys are merged underneath project keys — **the project always wins**. Base-only keys appear in the editor but are not written to project locale files on save.

**Typical structure:**

```
monorepo/
├── shared-i18n/
│   ├── en.json     ← base dictionary (company-wide terms)
│   └── ru.json
└── my-app/
    ├── i18n-kit.config.json   ← "extends": "../shared-i18n"
    └── src/locales/
        ├── en.json   ← app-specific overrides
        └── ru.json
```

---

## Locked keys

The `locked` field in the **base** config declares keys that child projects cannot modify.

```jsonc
// shared-i18n/i18n-kit.config.json
{
  "localesDir": "locales",
  "locked": [
    "brand.name",
    "brand.tagline",
    "legal.*"
  ]
}
```

| Layer | Behaviour |
|---|---|
| Editor UI | Cell is greyed out with a lock icon; tooltip "Key locked by base dictionary" |
| `PUT /api/locale/:code` | Server returns `403` if a locked key value changes |
| `merge --overwrite` | Locked keys are skipped even with `--overwrite` |
| `prune` | Locked keys are never removed |

Locked key patterns support globs: `"legal.*"` (all keys under `legal`), `"brand.name"` (exact), `"**"` (everything).

---

## Validation rules (`rules`)

The `rules` section in `i18n-kit.config.json` configures the locale editor's validation behaviour. All fields are optional.

```jsonc
// i18n-kit.config.json
{
  "rules": {
    "interpolationPatterns": ["{var}", "{{var}}"],
    "lengthWarningFactor": 3,
    "warnOnHtmlTags": true,
    "warnOnIcuErrors": true,
    "warnOnDuplicateValues": true,
    "minValueLength": 0
  }
}
```

| Field | Default | Description |
|---|---|---|
| `interpolationPatterns` | `["{var}"]` | What counts as an interpolation variable. Also supports `"{{var}}"`, `":param"`, `"%(var)s"`. |
| `lengthWarningFactor` | `2.5` | Warn if value.length > ref.length × factor. Set to `0` to disable. |
| `warnOnHtmlTags` | `true` | Warn when values contain HTML tags. |
| `warnOnIcuErrors` | `true` | Warn on malformed ICU (unclosed braces, missing `other{}`). |
| `warnOnDuplicateValues` | `true` | Warn if a key has identical values across all locales. |
| `minValueLength` | `0` | Warn if value is shorter than this many characters (`0` = off). |

The same `rules` object can be passed to `vueI18nCheckPlugin`.

---

## Ignore lists (`ignore`)

The `ignore` section lets you whitelist keys and paths that would otherwise trigger warnings or be removed by CLI tools.

```jsonc
// i18n-kit.config.json
{
  "ignore": {
    "prune": [
      "status.*",
      "dynamic.*"
    ],
    "duplicates": [
      "brand.name",
      "app.version"
    ],
    "unused": [
      "seo.*",
      "meta.*"
    ],
    "scanExclude": [
      "src/tests/**",
      "scripts/**"
    ]
  }
}
```

All patterns support glob syntax: `*` matches any single segment, `**` matches any number of path segments.

`ignore.prune` patterns are also respected by the `prune --dry` preview.

---

## Nuxt & SSR

`vue-i18n-kit` is SSR-safe. Plugin state is stored per Vue app instance via `provide/inject` instead of a module-level singleton, so concurrent SSR requests cannot contaminate each other.

`localStorage` calls (used by `persistLocale`) are silently no-op on the server — `try/catch` handles the missing global.

### Nuxt setup

```ts
// plugins/i18n.ts
import { defineNuxtPlugin } from '#app'
import { createVueI18nPlugin } from 'vue-i18n-kit'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(
    createVueI18nPlugin({
      defaultLocale: 'en',
      fallbackLocale: 'en',
      locales: {
        en: {
          messages: () => import('~/locales/en.json'),
          meta: { display: 'English', flag: '🇬🇧' },
        },
        ru: {
          messages: () => import('~/locales/ru.json'),
          meta: { display: 'Русский', flag: '🇷🇺' },
        },
      },
    }),
  )
})
```

### Server-side locale detection

To pick the locale based on the `Accept-Language` header:

```ts
// plugins/i18n.ts
import { defineNuxtPlugin, useRequestHeaders } from '#app'
import { createVueI18nPlugin } from 'vue-i18n-kit'

const SUPPORTED = ['en', 'ru']

export default defineNuxtPlugin((nuxtApp) => {
  const headers = useRequestHeaders(['accept-language'])
  const accepted = headers['accept-language'] ?? ''
  const detected = SUPPORTED.find((code) => accepted.toLowerCase().includes(code))

  nuxtApp.vueApp.use(
    createVueI18nPlugin({
      defaultLocale: detected ?? 'en',
      fallbackLocale: 'en',
      locales: {
        en: () => import('~/locales/en.json'),
        ru: () => import('~/locales/ru.json'),
      },
    }),
  )
})
```

### Notes

- **`persistLocale`** — works on the client only; on the server it is silently ignored.
- **Hydration** — the server and client render with the same `defaultLocale`. If you use `persistLocale`, the client will restore the user's saved locale after hydration.
- **Vite plugin and CLI** — work the same way in Nuxt projects. Add `vueI18nMapPlugin` to `nuxt.config.ts` under `vite.plugins`.
- **`plugin.service` in Nuxt** — create the plugin inside `defineNuxtPlugin` (not at module level) so each SSR request gets its own `service` instance.

---

## Architecture

```
vue-i18n-kit
│
├── plugin.ts
│     createVueI18nPlugin() — installs vue-i18n, pre-loads defaultLocale/fallbackLocale,
│     stores I18nService via app.provide(); returns Plugin & { service }
│
├── state.ts
│     Per-app state via provide/inject — locale Ref, isLoading Ref, availableLocales,
│     subscribers list, messages cache; SSR-safe (no module-level singletons)
│
├── composables/
│     useLocale()           — locale, setLocale, isLoading, localeMeta
│     useT()                — t() key lookup + interpolation; tm() ICU pluralization
│     useAvailableLocales() — computed list of { code, meta } from registered locales
│     useFormat()           — formatDate / formatNumber / formatCurrency via Intl
│     usePluralize()        — Intl.PluralRules engine powering tm(); exports pluralCategory()
│
├── utils/
│     loadLocale.ts    — resolves sync objects and async loaders; caches by locale code
│     persistLocale.ts — localStorage read / write helpers (try/catch for SSR/private mode)
│     localeKeys.ts    — flattenKeys, compareLocales (shared by CLI + Vite plugin)
│     localeEntry.ts   — isLocaleDefinition, extractMessages, extractMeta
│
├── vite-plugin/
│     vueI18nCheckPlugin     — buildStart + HMR key-diff against reference locale
│     vueI18nInlinePlugin    — virtual:vue-i18n-kit/locales (bakes JSON into bundle)
│     vueI18nNamespacePlugin — virtual:vue-i18n-namespaces (per-namespace dynamic imports)
│     vueI18nDevPlugin       — SFC template rewrite (auto-wrap); injects I18nInspect overlay
│     vueI18nMapPlugin       — locales map for the editor server (written by auto-config)
│
├── ui-app/               — Locale editor Vue SPA (built to dist/ui-server/public/)
│     App.vue, LocaleTable.vue, Dashboard.vue, api.ts
│
├── ui-server/
│     server.ts           — Node.js HTTP server; reads/writes locale JSON; SSE for live reload
│
└── cli/
      init / add / check / merge / prune / types / split / merge-ns
      stale / export / import / stats / auto-config / ui / dev
```

---

## Bundle size & peer dependencies

| Entry point | Peer deps | Notes |
|---|---|---|
| `vue-i18n-kit` | `vue ^3.3`, `vue-i18n ^9.0` | Runtime composables and plugin — for Vue apps |
| `vue-i18n-kit/vite` | `vue ^3.3`, `vite >=5.0` (optional) | Vite plugins — for `vite.config.ts` |
| `vue-i18n-kit` (bin) | — | CLI — `init`, `add`, `check`, `ui`, `dev`, and more |

The package ships as tree-shakeable ESM (`dist/index.mjs`) and CommonJS (`dist/index.cjs`). Composables that are not used are tree-shaken away. The Vite plugins and CLI are not included in the browser bundle.

---

## Development

```bash
# Install dependencies
npm install

# Build (ESM + CJS + type declarations)
npm run build

# Run tests
npm test

# Watch mode
npm run test:watch

# Type check
npm run typecheck
```

Tests are written with [Vitest](https://vitest.dev/) and [`@vue/test-utils`](https://test-utils.vuejs.org/). The test suite covers the plugin, all composables, the ICU engine, locale key utilities, and the `LocaleEntry` disambiguation logic.

---

## License

MIT

---

## Author

Danil Lisin Vladimirovich aka Macrulez

GitHub: [macrulezru](https://github.com/macrulezru) · Website: [npm.vuecraft.ru/en/](https://npm.vuecraft.ru/en/packages/vue-i18n-kit/)

Bugs and questions — [issues](https://github.com/macrulezru/vue-i18n-kit/issues)

---

## 💖 Support the project

Open source takes time and effort. If my work saves you time or brings value, consider supporting further development.

<a href="https://donate.cryptocloud.plus/M6O34NIN" target="_blank">
  <img src="https://img.shields.io/badge/Donate-CryptoCloud-8A2BE2?style=for-the-badge&logo=cryptocurrency&logoColor=white" alt="Donate via CryptoCloud">
</a>

Thank you for being part of this journey. ❤️
