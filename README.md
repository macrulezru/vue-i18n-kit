# vue-i18n-kit

A reusable Vue 3 localization plugin that wraps [`vue-i18n`](https://vue-i18n.intlify.dev/) and provides a ready-to-use integration layer — set up once, reuse across every project in your team.

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

## Requirements

| Peer dependency | Version | Required |
|---|---|---|
| `vue` | `^3.3.0` | yes |
| `vue-i18n` | `^9.0.0` | yes |
| `vite` | `>=5.0.0` | only for the Vite plugin |

Neither `vue` nor `vue-i18n` is bundled — they must be installed in the consuming project.

## Installation

```bash
npm install vue-i18n-kit vue vue-i18n
```

---

## Quick Start

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

### 2. Register the plugin

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

    <!-- Locale selector with display names from meta -->
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

## Plugin Options

```ts
interface I18nPluginOptions {
  defaultLocale: string
  fallbackLocale?: string
  locales: Record<string, LocaleEntry>   // see "Locale entry formats" below
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

#### 1. Plain message object (synchronous)

```ts
locales: {
  en: { buttons: { submit: 'Submit' }, greeting: 'Hello, {name}!' },
}
```

Messages are bundled into the app at build time and available immediately.

#### 2. Async loader function (lazy)

```ts
locales: {
  ru: () => import('./locales/ru.json'),
}
```

The JSON file is fetched only when `setLocale('ru')` is called. Until then it has zero impact on the initial bundle size.

#### 3. `LocaleDefinition` — messages + custom metadata

```ts
locales: {
  en: {
    messages: () => import('./locales/en.json'),  // loader or plain object
    meta: { display: 'English', flag: '🇬🇧' },
  },
  ru: {
    messages: () => import('./locales/ru.json'),
    meta: { display: 'Русский', flag: '🇷🇺', author: 'Danil Lisin' },
  },
}
```

`meta` is an arbitrary object — the shape is entirely up to the project. It is accessible through `useLocale().localeMeta` and `useAvailableLocales().availableLocales[n].meta`. All three forms can be mixed freely in the same `locales` map (locales without `meta` return `undefined` for it).

> **Note:** `LocaleDefinition` is identified internally by the presence of `meta` or a function-typed `messages`. If your translation files happen to have a top-level `messages` key with a string value, they will not be misidentified.

The `defaultLocale` and `fallbackLocale` are pre-loaded synchronously when their messages are a plain object. Lazy loaders set `isLoading: true` until the initial fetch completes.

---

## Composables

### `useLocale()`

Returns the current locale, a switcher function, a loading flag, and the active locale's metadata.

```ts
import { useLocale } from 'vue-i18n-kit'

const { locale, setLocale, isLoading, localeMeta } = useLocale()
```

| Return value | Type | Description |
|---|---|---|
| `locale` | `Ref<string>` | Currently active locale code (reactive). |
| `setLocale` | `(lang: string) => Promise<void>` | Switch to a different locale. Lazy-loads the JSON if needed, then updates `locale`. Throws if `lang` is not registered in `locales`. |
| `isLoading` | `Ref<boolean>` | `true` while a locale's JSON is being fetched. |
| `localeMeta` | `ComputedRef<Record<string, unknown> \| undefined>` | Metadata of the active locale from its `LocaleDefinition.meta`, or `undefined` if none was provided. Updates reactively on locale switch. |

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

### `useT()`

The primary translation composable. Returns two methods — `t` for plain strings and `tm` for ICU-pluralized strings. Both are locale-reactive and update automatically when the active locale changes.

```ts
import { useT } from 'vue-i18n-kit'

const { t, tm } = useT()
```

#### `t(key, vars?)`

Looks up a key in the active locale file and interpolates named `{placeholder}` tokens.

```ts
t('buttons.submit')                   // → 'Submit'
t('greeting', { name: 'Alice' })      // → 'Hello, Alice!'
```

| Argument | Type | Description |
|---|---|---|
| `key` | `string` | Dot-separated path in the locale file (`'buttons.submit'`, `'greeting'`). |
| `vars` | `object` | Optional. Named values substituted into `{placeholder}` tokens. |

Locale file:

```json
{
  "buttons": { "submit": "Submit" },
  "greeting": "Hello, {name}!"
}
```

#### `tm(key, vars)`

Looks up a key whose value is an ICU plural template, then selects the correct plural form using `Intl.PluralRules` for the active locale.

```ts
tm('items',   { count: 1  })   // → '1 item'
tm('items',   { count: 5  })   // → '5 items'
tm('balance', { points: 3 })   // → '3 рубля'
tm('balance', { points: 11 })  // → '11 рублей'
```

| Argument | Type | Description |
|---|---|---|
| `key` | `string` | Locale key whose value is an ICU template. Can also be a direct ICU template string (used as-is when the key is not found). |
| `vars` | `PluralVars` | Values used for plural category selection and `{var}` / `#` substitution. |

Locale file:

```json
{
  "items":   "{count, plural, one {# item} other {# items}}",
  "balance": "{points} {points, plural, one {рубль} few {рубля} many {рублей} other {рублей}}"
}
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

// Using # as the numeric placeholder
tm('items', { count: 5 })
// locale: "{count, plural, one {# item} other {# items}}"
// → '5 items'

// Multiple variables
tm('score', { user: 'Даня', score: 21 })
// locale: "{user} набрал {score} {score, plural, one {балл} few {балла} many {баллов} other {баллов}}"
// → 'Даня набрал 21 балл'

// Multiple plural constructs in one string
tm('report', { files: 2, errors: 5 })
// locale: "{files, plural, one {# файл} few {# файла} many {# файлов} other {# файлов}} ({errors, plural, one {# ошибка} few {# ошибки} many {# ошибок} other {# ошибок}})"
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

### `useAvailableLocales()`

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

Locales registered as plain objects or functions (without `LocaleDefinition`) have `meta: undefined` and still appear in the list.

---

### `useFormat()`

Provides locale-aware formatting using the native `Intl` APIs. All formatters automatically use the currently active locale and update when the locale is switched.

```ts
import { useFormat } from 'vue-i18n-kit'

const { formatDate, formatNumber, formatCurrency } = useFormat()
```

#### `formatDate(value, options?)`

```ts
// value: Date | number (timestamp) | string (ISO)
// options: Intl.DateTimeFormatOptions

formatDate(new Date())                                          // '28.03.2026'  (ru)
formatDate(new Date(), { dateStyle: 'long' })                   // '28 марта 2026 г.'  (ru)
formatDate(new Date(), { dateStyle: 'long' })                   // 'March 28, 2026'  (en)
formatDate(new Date(), { hour: '2-digit', minute: '2-digit' })  // '19:45'
```

#### `formatNumber(value, options?)`

```ts
// options: Intl.NumberFormatOptions

formatNumber(1_234_567.89)                    // '1 234 567,89'  (ru)
formatNumber(1_234_567.89)                    // '1,234,567.89'  (en)
formatNumber(0.42, { style: 'percent' })      // '42 %'
```

#### `formatCurrency(value, currency, options?)`

```ts
// currency: ISO 4217 code (USD, EUR, RUB, ...)
// options: Intl.NumberFormatOptions (except style and currency)

formatCurrency(1999.99, 'USD')                              // '$1,999.99'   (en)
formatCurrency(1999.99, 'EUR')                              // '1 999,99 €'  (ru)
formatCurrency(1999,    'USD', { minimumFractionDigits: 0 }) // '$1,999'
```

**Example in a component:**

```vue
<script setup lang="ts">
import { useFormat, useLocale } from 'vue-i18n-kit'

const { formatDate, formatNumber, formatCurrency } = useFormat()
const { setLocale } = useLocale()

const price = 4299.0
const today = new Date()
</script>

<template>
  <p>{{ formatDate(today, { dateStyle: 'long' }) }}</p>
  <p>{{ formatCurrency(price, 'EUR') }}</p>

  <button @click="setLocale('en')">EN</button>
  <button @click="setLocale('ru')">RU</button>
</template>
```

---

### `usePluralize()` — low-level plural API

For ICU pluralization use `tm()` from `useT()` — it is the primary API. `usePluralize` exposes one additional utility: `pluralCategory`, which returns the raw CLDR category for a count value.

```ts
import { usePluralize } from 'vue-i18n-kit'

const { pluralCategory } = usePluralize()
```

#### `pluralCategory(count)`

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

## Plugin Service

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
// main.ts
app.use(i18nPlugin)   // install as before
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

All properties throw a descriptive error if accessed before `app.use(plugin)`:

```
[vue-i18n-kit] Plugin is not installed yet. Call app.use(plugin) before using service.
```

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
// later:
unsubscribe()
```

Multiple subscribers are supported. Each call to `onLocaleChange` registers an independent callback; all are called in registration order after every successful `setLocale`.

### `service` vs composables — when to use which

Both APIs control the same underlying locale state. Choose based on **where** the code runs:

| Context | Recommended API |
|---|---|
| Vue component `setup()` | `useLocale()`, `useT()`, `useAvailableLocales()` — reactive, template-friendly |
| Router guards, Pinia stores, utility modules | `plugin.service` — no `getCurrentInstance()` needed |
| SSR entry points, server middleware | `plugin.service` — inject the plugin instance from your plugin file |

There is no functional difference between `useLocale().setLocale('en')` and `plugin.service.setLocale('en')` — both mutate the same ref and trigger the same reactivity. The composables are simply the ergonomic wrapper for component scope.

> **Do not mix both APIs to manage the same locale switch.** Calling `useLocale().setLocale()` in a component and also `service.setLocale()` in a router guard for the same navigation event will trigger two back-to-back locale loads. Pick one callsite per action.

### SSR note

`service` stores state in a closure created when `createVueI18nPlugin` is called. In SSR this means the plugin **must be created per request**, not at module level:

```ts
// ✅ Correct — one plugin instance per Nuxt request
export default defineNuxtPlugin((nuxtApp) => {
  const plugin = createVueI18nPlugin({ ... })
  nuxtApp.vueApp.use(plugin)
  // plugin.service is safe to use here — scoped to this request
})
```

```ts
// ❌ Wrong — shared across all SSR requests
const plugin = createVueI18nPlugin({ ... })   // module level

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(plugin)
  // plugin.service.locale is shared — requests will contaminate each other
})
```

For client-only Vue apps (SPA) this distinction does not apply — the module executes once per page load.

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
// In any component
import type { AppLocaleMeta } from '@/types/i18n'
import { useLocale, useAvailableLocales } from 'vue-i18n-kit'

const { localeMeta } = useLocale<AppLocaleMeta>()
localeMeta.value?.display   // string | undefined  ✓

const { availableLocales } = useAvailableLocales<AppLocaleMeta>()
availableLocales.value[0].meta?.flag  // string | undefined  ✓
```

---

## Error Handling

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

If the async loader function rejects, `setLocale` resets `isLoading` to `false` and re-throws the original error:

```ts
try {
  await setLocale('ru')
} catch (err) {
  // Handle fetch / import error
}
// isLoading.value is guaranteed to be false here
```

### Plugin not installed

Calling any composable before `app.use(createVueI18nPlugin(...))` throws immediately with a clear message:

```
[vue-i18n-kit] Plugin not installed. Call app.use(createVueI18nPlugin(...)) before using composables.
```

---

## Locale Persistence

When `persistLocale: true` is set, the selected locale is saved to `localStorage` under the configured `storageKey`. On the next page load the plugin reads this value and uses it as the initial locale, falling back to `defaultLocale` if the saved value is not a registered locale code.

```ts
app.use(createVueI18nPlugin({
  defaultLocale: 'en',
  locales: { en: enMessages, ru: ruMessages },
  persistLocale: true,
  storageKey: 'my-app-locale',   // optional, default: 'vue3-i18n-locale'
}))
```

`localStorage` calls are wrapped in `try/catch` so the plugin works without issues in environments where storage is restricted (private browsing, certain iframe contexts).

### `persistLocale` vs manual `localStorage`

Two patterns exist for persisting the locale — choose one and stick to it. Mixing them creates two writers on the same key and leads to unpredictable restore order.

| | `persistLocale: true` | Manual `localStorage` |
|---|---|---|
| **Setup** | One option in `createVueI18nPlugin` | Read on startup, write in `onLocaleChange` |
| **Restore on page load** | Automatic | You read the key and pass the value as `defaultLocale` |
| **Control** | Plugin-managed | Full control over key name, storage type, serialization |
| **Good when** | You just need locale to survive a page reload | You store extra data alongside the locale, use `sessionStorage`, or share the key with other parts of the app |

**Option A — let the plugin handle it (recommended for most projects):**

```ts
// main.ts — nothing else needed
app.use(createVueI18nPlugin({
  defaultLocale: 'en',
  locales: { ... },
  persistLocale: true,
}))
```

**Option B — manage storage yourself:**

```ts
// main.ts — read persisted locale and pass it as defaultLocale
const saved = localStorage.getItem('my-locale')
const initial = ['en', 'ru'].includes(saved ?? '') ? saved! : 'en'

app.use(i18nPlugin)   // persistLocale is NOT set

// Write on every switch
i18nPlugin.service.onLocaleChange((lang) => {
  localStorage.setItem('my-locale', lang)
})
```

> **Do not combine both options for the same storage key.** If `persistLocale: true` is set and you also call `localStorage.setItem` manually, the plugin will overwrite your value on the next `setLocale`, and your code will overwrite the plugin's value on the next navigation.

### Using a custom storage key

When `persistLocale: true` is set, use `storageKey` to avoid conflicts when multiple apps share the same origin:

```ts
app.use(createVueI18nPlugin({
  defaultLocale: 'en',
  locales: { en: enMessages, ru: ruMessages },
  persistLocale: true,
  storageKey: 'my-app-locale',   // default: 'vue3-i18n-locale'
}))
```

---

## Vite Plugin — Translation Completeness Check

Checks all locale JSON files against a reference locale and reports any missing or extra keys. Runs at `buildStart` and on every locale file save during development (HMR).

### Setup

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { vueI18nCheckPlugin } from 'vue-i18n-kit/vite'

export default defineConfig({
  plugins: [
    vue(),
    vueI18nCheckPlugin({
      localesDir: 'src/locales',   // relative to project root
      defaultLocale: 'en',         // reference locale
      failOnMissing: true,         // abort build on missing keys
    }),
  ],
})
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `localesDir` | `string` | `'src/locales'` | Directory containing locale JSON files, relative to Vite project root. |
| `defaultLocale` | `string` | first file alphabetically | Locale used as the reference when comparing keys. |
| `failOnMissing` | `boolean` | `false` | When `true`, missing keys abort the build with an error. When `false`, missing keys produce warnings only. |

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

## Vite Plugin — Inline Translations

`vueI18nInlinePlugin` bakes all locale JSON files into the production bundle at build time via a virtual module. There are **no runtime HTTP requests** — the translations are a plain JavaScript object embedded in the bundle.

Ideal for: SSR apps, offline-capable PWAs, small projects where bundle size matters less than loading latency.

### Setup

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
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
// main.ts
import { createVueI18nPlugin } from 'vue-i18n-kit'
import inlineLocales from 'virtual:vue-i18n-kit/locales'

app.use(
  createVueI18nPlugin({
    defaultLocale: 'en',
    locales: {
      en: { messages: inlineLocales.en, meta: { display: 'English' } },
      ru: { messages: inlineLocales.ru, meta: { display: 'Русский' } },
      de: { messages: inlineLocales.de, meta: { display: 'Deutsch' } },
    },
  })
)
```

Because `inlineLocales.ru` is a plain object (not a function), `vue-i18n-kit` skips the network request and uses it directly.

### TypeScript — virtual module type declaration

Add to your project's `env.d.ts` or `vite-env.d.ts`:

```ts
declare module 'virtual:vue-i18n-kit/locales' {
  const locales: Record<string, Record<string, unknown>>
  export default locales
}
```

### Options

| Option | Type | Description |
|---|---|---|
| `locales` | `Record<string, string \| { path, meta? }>` | Map of locale codes to JSON file paths (relative to project root). |

---

## CLI — Locale File Management

The `vue-i18n-kit` CLI helps scaffold and audit locale JSON files.

```bash
# Via npx (no install needed)
npx vue-i18n-kit <command> [options]

# Or after installing the package
vue-i18n-kit <command> [options]
```

### `init` — Create locale files

Creates the locales directory and generates example JSON files.

```bash
vue-i18n-kit init
vue-i18n-kit init --dir src/i18n --locales en,ru,de,fr
```

| Flag | Default | Description |
|---|---|---|
| `--dir <path>` | `src/locales` | Directory to create locale files in. |
| `--locales <list>` | `en` | Comma-separated locale codes to generate. |

After running, the CLI prints a ready-to-paste `main.ts` snippet.

### `add` — Add a new locale

Copies the structure of an existing locale file into a new one.

```bash
# Copy 'en' structure into 'fr.json', keeping values as placeholders
vue-i18n-kit add fr

# Same, but write empty strings instead of source values
vue-i18n-kit add fr --from en --empty

# Custom directory
vue-i18n-kit add de --dir src/i18n --from en --empty
```

| Flag | Default | Description |
|---|---|---|
| `--dir <path>` | `src/locales` | Locales directory. |
| `--from <locale>` | first file in dir | Source locale to copy structure from. |
| `--empty` | `false` | Write empty strings instead of copying source values. |

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

### `merge` — Merge a shared dictionary

Deep-merges a base or corporate JSON dictionary into project locale files. Only adds missing keys by default — existing translations are left untouched unless `--overwrite` is passed.

```bash
# Add all missing keys from a shared base (dry run first)
vue-i18n-kit merge shared/base.json --dry
vue-i18n-kit merge shared/base.json

# Merge into a single locale only, overwriting existing values
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

**Use case — corporate shared dictionary:**

Maintain a `shared/base.json` in a monorepo or npm package and run `merge` after pulling to keep all project locales up to date with company-wide terms.

### `prune` — Remove unused keys

Scans source files for `t()`, `tm()`, `$t()` calls and removes any locale keys not referenced anywhere in the project. Useful before a release to keep JSON files lean.

```bash
# Preview what would be removed
vue-i18n-kit prune --dry

# Apply (will scan source files first)
vue-i18n-kit prune

# Use a pre-built entries file (skips scanning, faster in CI)
vue-i18n-kit prune --entries i18n-tools/locales.entries.json
```

| Flag | Default | Description |
|---|---|---|
| `--dir <path>` | `src/locales` | Locales directory. |
| `--entries <file>` | _(scan)_ | Path to a pre-built `locales.entries.json`; skips scanning. |
| `--dry` | `false` | Print keys that would be removed, without writing files. |
| `--yes` | `false` | Skip confirmation prompt. |
| `--ignore <patterns>` | _(none)_ | Comma-separated key patterns to never remove (e.g. `"status.*,legacy.*"`). |

Keys listed in `ignore.prune` from `i18n-kit.config.json` are automatically included — no flag needed. Keys declared as `locked` in the base config are also protected.

> **Tip:** Run `prune --dry` in CI and fail the build if output is non-empty to enforce a "no dead keys" policy.

### `types` — Generate TypeScript types

Generates a `TranslationKey` union type from a reference locale file. Gives you autocomplete and compile-time key checking when calling `t()`.

```bash
# Generate src/i18n.d.ts (default output)
vue-i18n-kit types

# Custom output path, specific locale, watch mode
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

export type TranslationKeyPrefix =
  | 'buttons'

declare module 'vue-i18n-kit' {
  interface Register {
    key: TranslationKey
  }
}
```

### `stale` — Show outdated translations

Reports keys whose reference locale value has changed since the translation was last reviewed. Requires `staleTracking: true` in `i18n-kit.config.json`.

```bash
vue-i18n-kit stale
vue-i18n-kit stale --locale en --dir src/locales
```

| Flag | Default | Description |
|---|---|---|
| `--dir <path>` | `src/locales` | Locales directory. |
| `--locale <code>` | first in config | Reference locale. |

**How it works:** When a value in the reference locale is saved via the UI, its SHA1 hash is stored in `i18n-kit.notes.json` under `_hash.<key>`. On the next `stale` run (or editor load), the stored hash is compared to the current value — a mismatch means the source text changed and the translation may be outdated.

Enable tracking in config:

```json
{
  "staleTracking": true
}
```

### `export` — Export for translators (XLIFF / PO)

Exports a locale to XLIFF 1.2 or Gettext PO format, ready to send to a professional translation agency or CAT tool. The reference locale values are exported as `<source>` / `msgid`; the target locale as `<target>` / `msgstr`. Translator notes from the editor are included.

```bash
# Export Russian locale to XLIFF (default)
vue-i18n-kit export --locale ru

# Export to PO format, custom output path
vue-i18n-kit export --locale ru --format po --out translations/ru.po

# Use a different reference locale
vue-i18n-kit export --locale ru --format xliff --ref en
```

| Flag | Default | Description |
|---|---|---|
| `--locale <code>` | — | **Required.** Locale to export. |
| `--format <xliff\|po>` | `xliff` | Output format. |
| `--out <path>` | `<locale>.<format>` | Output file path. |
| `--dir <path>` | `src/locales` | Locales directory. |
| `--ref <code>` | first in config | Reference locale (source language). |

### `import` — Import from XLIFF / PO

Reads a completed XLIFF or PO file from a translator and writes the translated values back into the locale JSON file.

```bash
vue-i18n-kit import ru.xliff
vue-i18n-kit import translations/ru.po --dir src/locales

# Preview without writing
vue-i18n-kit import ru.po --dry
```

| Flag | Default | Description |
|---|---|---|
| `--dir <path>` | `src/locales` | Locales directory. |
| `--dry` | `false` | Preview changes without writing files. |

The target locale code is read from the file itself (`target-language` attribute in XLIFF, `Language:` header in PO). The output file is sorted alphabetically and existing keys not present in the import file are left untouched.

---

## TypeScript Type Generation

The `types` command integrates into your development workflow to catch translation key typos at compile time.

### Usage in components

After running `vue-i18n-kit types`, the generated `TranslationKey` type is automatically available if you have a `Register` augmentation:

```ts
// This is already in the generated src/i18n.d.ts:
declare module 'vue-i18n-kit' {
  interface Register { key: TranslationKey }
}
```

With `vue-i18n-kit`'s typed API the compiler will error on unknown keys:

```ts
const { t } = useT()
t('buttons.submit')   // ✓
t('buttons.submitt')  // ✗ TypeScript error: Argument of type '"buttons.submitt"' is not assignable...
```

### Keeping types in sync

Add the `types` command to your development scripts:

```json
{
  "scripts": {
    "i18n:types": "vue-i18n-kit types --watch",
    "i18n:ui": "vue-i18n-kit auto-config && vue-i18n-kit ui"
  }
}
```

Or run it once as a pre-build step:

```json
{
  "scripts": {
    "prebuild": "vue-i18n-kit types"
  }
}
```

---

## Stale Translation Detection

When `staleTracking: true` is set, the editor tracks changes to the reference locale and marks translations in other locales as potentially outdated.

```json
// i18n-kit.config.json
{
  "staleTracking": true
}
```

### How stale detection works

1. When you save a value in the reference locale via the editor, a SHA1 hash of the new value is stored in `i18n-kit.notes.json` under `_hash.<key>`.
2. On the next load the editor compares every reference value to its stored hash.
3. Keys with a mismatched hash appear with an `⚠ outdated` badge in the editor.
4. A dedicated `stale` filter button lets you view only outdated keys.
5. The detail panel for a stale key shows the current reference text.
6. Clicking **Mark as reviewed** resets the hash for the selected keys — use this after updating all translations.

### CLI

```bash
# List all stale keys to the console
vue-i18n-kit stale
```

Output:

```
Stale keys (reference locale changed since last review):
  buttons.submit      stored: "Submit"  →  current: "Submit form"
  errors.auth.invalid  stored: "Invalid"  →  current: "Invalid credentials"
```

---

## XLIFF / PO Export & Import

Industry-standard translation file formats — compatible with Phrase, Lokalise, Weblate, OmegaT, Poedit, and most CAT tools.

### Export workflow

```bash
# 1. Export the locale for a translator
vue-i18n-kit export --locale ru --format xliff --out send-to-translator/ru.xliff

# or PO for Poedit / Weblate
vue-i18n-kit export --locale ru --format po --out send-to-translator/ru.po
```

The XLIFF file includes `<source>` (reference text) and `<target>` (current translation). Translator notes from the editor appear as `<note>` elements.

The PO file uses `msgctxt` for the key name, `msgid` for the source text, and `msgstr` for the translation. Notes appear as `#.` comments.

### Import workflow

```bash
# 2. After the translator returns the file, import it
vue-i18n-kit import send-to-translator/ru.xliff

# Preview first
vue-i18n-kit import ru.po --dry
```

The locale code is read from the file header — no flag needed. Only keys present in the import file are updated; unrelated keys are left untouched.

### UI integration

The locale editor header has **Export XLIFF** and **Export PO** buttons that open a locale-picker dialog. The **Import** button (next to Import CSV) accepts both XLIFF and PO files.

---

## Coverage Report (`vue-i18n-kit stats`)

Get a quick snapshot of translation completeness without opening the editor.

### Console output (default)

```bash
vue-i18n-kit stats
```

```
  vue-i18n-kit stats  2026-04-11
  35 keys · 3 locales

  Coverage
  🇬🇧 English (en)    ████████████████████  100%
  🇷🇺 Русский (ru)    ████████████████░░░░   89%  4 missing
  🇩🇪 Deutsch (de)    ███████████████░░░░░   77%  8 missing

  By namespace
  namespace    keys    en      ru      de
  auth           12    100%    100%    92%
  dashboard      10    100%    0%      0%
  errors          8    100%    100%    75%

  Issues
  • 12 missing
  • 2 phantom (used in code, absent from files)
```

### JSON output — CI pipelines

```bash
vue-i18n-kit stats --format json --out ci-report.json
```

```json
{
  "generated": "2026-04-11T10:00:00.000Z",
  "totalKeys": 35,
  "locales": [
    { "code": "en", "display": "English", "total": 35, "filled": 35, "empty": 0, "missing": 0, "coverage": 100, "bytes": 2048 },
    { "code": "ru", "display": "Русский", "total": 35, "filled": 31, "empty": 0, "missing": 4,  "coverage": 89,  "bytes": 1820 }
  ],
  "namespaces": [
    { "name": "auth", "keys": 12, "bytes": 640, "byLocale": { "en": 100, "ru": 100, "de": 92 } }
  ],
  "phantom": 2,
  "unused": 3
}
```

#### GitHub Actions example

```yaml
- name: Check i18n coverage
  run: |
    npx vue-i18n-kit stats --format json --out coverage.json
    # Fail if any locale is below 80%
    node -e "
      const r = require('./coverage.json');
      const low = r.locales.filter(l => l.coverage < 80);
      if (low.length) { console.error('Low coverage:', low.map(l => l.code + ' ' + l.coverage + '%')); process.exit(1); }
    "
```

### HTML report

```bash
vue-i18n-kit stats --format html
# Opens i18n-stats.html — a self-contained dark-theme report with progress bars
```

### Options

| Option | Description |
|---|---|
| `--format console` | Terminal output with ANSI colours (default) |
| `--format json` | Machine-readable JSON; writes to stdout or `--out` |
| `--format html` | Self-contained HTML file (default: `i18n-stats.html`) |
| `--out <path>` | Write to file instead of stdout (json/html) |
| `--dir <path>` | Locales directory (default: `src/locales`) |

---

## Machine Translation

The editor can auto-translate all missing keys with one click. Two engines are supported — choose in **Settings → Translation engine**.

### LibreTranslate

An open-source, self-hostable translation API. The public instance at `https://libretranslate.com` is free for low traffic; for production use, self-host or buy an API key.

**Settings:**
- **URL** — your LibreTranslate instance (default: `https://libretranslate.com`)
- **API key** — optional; required on the public instance for sustained usage

### DeepL

Significantly higher translation quality than LibreTranslate. The free plan covers **500,000 characters/month**.

**Getting a key:**
1. Sign up at [deepl.com/pro](https://www.deepl.com/pro) — choose **DeepL API Free**
2. Go to your account → **API Keys** → copy the key (ends with `:fx`)
3. Paste it into **Settings → DeepL Auth Key** in the editor

**Settings:**
- **Auth Key** — keys ending in `:fx` use the free-tier endpoint `api-free.deepl.com` automatically; Pro keys use `api.deepl.com`
- **Formality** — controls the register of the translated text; supported for DE, FR, IT, ES, NL, PL, PT-PT, PT-BR, JA, RU:

  | Value | Meaning |
  |---|---|
  | `default` | Engine chooses (default) |
  | `more` | Formal / polite register |
  | `less` | Informal register |
  | `prefer_more` | Formal if supported, otherwise default |
  | `prefer_less` | Informal if supported, otherwise default |

### Placeholder handling

Both engines receive strings with `{variable}` and ICU plural blocks (`{count, plural, ...}`) replaced by opaque XML tags (`<x id="0"/>`). After translation, the tags are substituted back — placeholders survive translation unchanged regardless of word order changes.

---

## Locale Editor UI

A browser-based editor for viewing and editing locale files directly in your project — no external service, runs entirely on your machine.

### What it does

#### Dashboard

- **Coverage overview** — overall coverage bar, per-locale progress with missing key count
- **Namespace cards** — coverage percentage per namespace; click any card to jump straight to that namespace in the editor
- **Unused keys** — keys with no `t()`/`tm()`/`$t()` usages found in source files
- **Phantom keys** — keys referenced in code via `t()` but absent from all locale files; highlighted in red so they are hard to miss
- **Duplicate values** — keys where all locales share the same non-empty value (likely untranslated)

#### Editor table

- **Inline editing** — click any cell to edit in place; input immediately receives focus; multiline textarea auto-resizes; save with Enter or ✓, cancel with Escape or ✕; changes are written immediately to locale JSON on disk
- **Namespace groups** — keys grouped by dotted prefix (`auth.form.label` → group `auth` → sub-group `form` → key `label`); groups collapse/expand; arbitrary nesting depth is supported
- **Group operations** — on any group row: add a nested sub-group, add a key, rename the namespace (renames all keys), delete the group and all its keys
- **Empty groups** — create a group without any keys first; the group persists in the UI until a key is added or the page reloads
- **Inline key actions** — rename, duplicate, add/edit note, delete — appear next to the key label on hover
- **Batch select & delete** — row checkboxes + bulk delete bar
- **Usage map** — expand any key row to see which source files reference it; clickable file chips open the file in your IDE (VS Code, Cursor, WebStorm, PhpStorm, IntelliJ)
- **Cell validation** — inline warnings for: placeholder mismatch `{var}`, HTML tag mismatch, ICU syntax errors (unbalanced braces, missing `other {}`), length > 2.5× reference
- **Empty vs missing** — visual distinction between a key that is absent (`— missing —`) and one intentionally set to an empty string (`— empty —`)
- **Duplicate badge** — `dup` badge on keys where all locales have identical non-empty values
- **Copy from reference** — one-click button on missing/empty cells to copy the value from the reference locale
- **Interpolation preview** — expand a key row to fill in `{variable}` values and see the rendered output per locale
- **Plural preview** — for keys with ICU plural format (`{count, plural, one{...} other{...}}`), the detail panel shows a table of rendered forms for `n = 0, 1, 2, 5, 11, 21` across all locales
- **Density toggle** — compact / default / relaxed row height
- **Keyboard navigation** — arrow keys move between cells; Enter starts editing; Space toggles selection

#### Toolbar & header

| Feature | Shortcut | Description |
|---|---|---|
| Quick Open | `Ctrl+P` | Fuzzy-search all keys by name; jump instantly |
| Find & Replace | `Ctrl+H` | Search values across all or a specific locale, preview and apply replacements |
| Undo | `Ctrl+Z` | Undo the last saved change (up to 100 steps) |
| Export CSV | — | Download all translations as a CSV file |
| Import CSV | — | Upload a CSV; preview diff before applying |
| Export XLIFF | — | Export a locale to XLIFF 1.2 format for CAT tools |
| Export PO | — | Export a locale to Gettext PO format for Poedit / Weblate |
| Import XLIFF/PO | — | Import completed XLIFF or PO file from a translator |
| Sort keys | — | Sort all keys alphabetically in every locale file |
| Add locale | — | Add a new language to the project — creates the JSON file and updates the config |
| Translate missing | — | Auto-translate missing values via LibreTranslate or DeepL (configured in Settings) |
| Shortcut help | `?` | Show keyboard shortcut cheatsheet |

#### Filter bar

| Filter | Description |
|---|---|
| `all` / `missing` / `complete` | Show all keys, only keys with missing translations, or only fully translated keys |
| `unused` | Show only keys not referenced in any source file |
| `phantom` | Show only keys used in code but absent from all locale files (appears when phantoms exist) |
| `stale` | Show only keys whose reference value changed since last review (appears when `staleTracking: true` and stale keys exist) |

#### Settings (gear icon)

- **Reference locale** — used as baseline for validation and copy-from-reference; persisted to `localStorage`
- **IDE scheme** — choose VS Code, Cursor, WebStorm, PhpStorm or IntelliJ for file-chip links
- **Translation engine** — switch between LibreTranslate and DeepL (toggle button); all settings are stored in `localStorage`
  - *LibreTranslate*: URL (default `https://libretranslate.com`) + optional API key
  - *DeepL*: Auth Key (keys ending in `:fx` automatically use the free-tier endpoint `api-free.deepl.com`); optional **Formality** (`more` / `less` / `prefer_more` / `prefer_less`) for supported languages (DE, FR, IT, ES, NL, PL, PT, JA, RU)

#### Live reload

The editor connects to the server via SSE. When a locale file changes on disk (e.g. after a `git pull` or a manual edit), the affected locale reloads automatically in the browser without a full page refresh. A green dot in the header indicates the connection is active.

#### Git status

Locale column headers are highlighted when the corresponding JSON file has uncommitted changes (`git status --porcelain`).

### Setup

**1. Add the script to `package.json`:**

```json
"i18n:ui": "vue-i18n-kit auto-config && vue-i18n-kit ui"
```

**2. Run:**

```bash
npm run i18n:ui
```

`auto-config` reads your `createVueI18nPlugin(...)` call as the **single source of truth** — only the locales explicitly registered there are included. It generates the data index and configures `vueI18nMapPlugin` automatically. The editor then opens at `http://localhost:4173`.

### `auto-config` — what it does

1. **Reads locale list from `createVueI18nPlugin`** — scans source files for the plugin call and extracts locale codes, file paths (from `import(...)` / `~/...`), and `meta` from each `LocaleDefinition`. Only locales wired up to the app are included.
2. **Generates `i18n-tools/locales.config.json`** — resolved paths and metadata for each locale.
3. **Generates `i18n-tools/locales.entries.json`** — map of `{ "key": ["src/file.vue", …] }` built by scanning `t()`, `tm()`, `$t()` calls across the project.
4. **Updates the project config** — detects `vite.config.ts` or `nuxt.config.ts` and adds or updates `vueI18nMapPlugin` accordingly. Prints copy-paste instructions if neither file is found.

Both generated files can be added to `.gitignore`.

### What gets written to the project config

`auto-config` detects the project type automatically and writes to the correct file.

**`vite.config.ts` (Vue / Vite):**

```ts
import { vueI18nMapPlugin } from 'vue-i18n-kit/vite'

export default defineConfig({
  plugins: [
    vue(),
    vueI18nMapPlugin({
      locales: {
        en: { path: 'src/locales/en.json', meta: { display: 'English', flag: '🇬🇧' } },
        ru: { path: 'src/locales/ru.json', meta: { display: 'Русский', flag: '🇷🇺' } },
      },
    }),
  ],
})
```

**`nuxt.config.ts` (Nuxt):**

```ts
import { vueI18nMapPlugin } from 'vue-i18n-kit/vite'

export default defineNuxtConfig({
  vite: {
    plugins: [
      vueI18nMapPlugin({
        locales: {
          en: { path: 'locales/en.json', meta: { display: 'English', flag: '🇬🇧' } },
          ru: { path: 'locales/ru.json', meta: { display: 'Русский', flag: '🇷🇺' } },
        },
      }),
    ],
  },
})
```

On subsequent runs `auto-config` replaces the entire `vueI18nMapPlugin(...)` call with fresh data from `createVueI18nPlugin` — `meta` included. Any other config changes are preserved.

### `vue-i18n-kit ui`

```bash
vue-i18n-kit ui [--port <number>]
```

| Flag | Default | Description |
|---|---|---|
| `--port <number>` | `4173` | Port for the local editor server. |

### Running the editor without `auto-config`

`auto-config` and `ui` are independent commands — the editor works fine without the auto-scan step. This is useful when `auto-config` cannot parse your locale setup (e.g. the locales object is imported from a separate file).

**1.** Add `vueI18nMapPlugin` to your config manually using the same format shown in [What gets written to the project config](#what-gets-written-to-the-project-config) above.

**2.** Run the editor directly — skip `auto-config` in the script:

```json
"i18n:ui": "vue-i18n-kit ui"
```

With a manually maintained config you are responsible for keeping `vueI18nMapPlugin` in sync when you add or rename locales. The recommended `auto-config && ui` combination does this automatically.

---

## Base Dictionary (extends)

The `extends` field in `i18n-kit.config.json` lets a project inherit translations from a shared base — for example, a corporate terminology dictionary maintained centrally in a monorepo or npm package.

```json
// i18n-kit.config.json
{
  "extends": "../../shared-i18n",
  ...
}
```

**How it works:**

1. The value of `extends` is resolved relative to the project root.
2. It can point to a directory containing locale JSON files (e.g. `en.json`, `ru.json`) or to another `i18n-kit.config.json` whose `localesDir` will be followed.
3. When the editor reads a locale, base keys are merged underneath project keys — **the project always wins**. Base-only keys appear in the editor but are not written to project locale files on save.

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

**Combined with `merge`:**

To copy base keys into project files permanently (rather than loading them dynamically), use the `merge` CLI command:

```bash
vue-i18n-kit merge ../shared-i18n/en.json --locale en
vue-i18n-kit merge ../shared-i18n/ru.json --locale ru
```

---

## Locked Keys

The `locked` field in the **base** config declares keys that child projects cannot modify. Locked keys behave like CSS `!important` — they propagate from the base dictionary and cannot be overridden downstream.

```jsonc
// shared-i18n/i18n-kit.config.json (base config)
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

## Validation Rules (`rules`)

The `rules` section in `i18n-kit.config.json` configures the locale editor's validation behaviour. All fields are optional — defaults match the previous hardcoded values.

```jsonc
// i18n-kit.config.json
{
  "rules": {
    // Placeholder patterns — what counts as an interpolation variable
    // Default: ["{var}"]  — also supports "{{var}}", ":param", "%(var)s"
    "interpolationPatterns": ["{var}", "{{var}}"],

    // Length warning: warn if value.length > ref.length × factor
    // Set to 0 to disable. Default: 2.5
    "lengthWarningFactor": 3,

    // Warn when values contain HTML tags. Default: true
    "warnOnHtmlTags": true,

    // Warn on malformed ICU (unclosed braces, missing other{}). Default: true
    "warnOnIcuErrors": true,

    // Warn when a key has identical values across all locales. Default: true
    "warnOnDuplicateValues": true,

    // Warn if value is shorter than this many characters. Default: 0 (off)
    "minValueLength": 0
  }
}
```

The same `rules` object can be passed to `vueI18nCheckPlugin`:

```ts
vueI18nCheckPlugin({
  localesDir: 'src/locales',
  rules: {
    interpolationPatterns: ['{var}', '{{var}}'],
    lengthWarningFactor: 3,
  },
})
```

---

## Ignore Lists (`ignore`)

The `ignore` section lets you whitelist keys and paths that would otherwise trigger warnings or be removed by CLI tools.

```jsonc
// i18n-kit.config.json
{
  "ignore": {
    // Keys that prune will never remove — useful for dynamically referenced keys
    // e.g. t('status.' + code)
    "prune": [
      "status.*",
      "dynamic.*",
      "legacy.migrated_key"
    ],

    // Keys excluded from "duplicate values" warnings
    // Useful for brand names, numbers, abbreviations
    "duplicates": [
      "brand.name",
      "brand.tagline",
      "app.version"
    ],

    // Keys excluded from "unused" warnings in the editor
    "unused": [
      "seo.*",
      "meta.*"
    ],

    // File/directory patterns excluded from the source code scanner
    // In addition to built-in exclusions (node_modules, dist, etc.)
    "scanExclude": [
      "src/tests/**",
      "src/__fixtures__/**",
      "scripts/**"
    ]
  }
}
```

All patterns support glob syntax: `*` matches any single segment, `**` matches any number of path segments.

`ignore.prune` patterns are also respected by the `prune --dry` preview, so you can see exactly what would be removed without the whitelisted keys.

---

## Nuxt & SSR

`vue-i18n-kit` is SSR-safe. Plugin state is stored per Vue app instance via `provide/inject` instead of a module-level singleton, so concurrent SSR requests cannot contaminate each other.

`localStorage` calls (used by `persistLocale`) are silently no-op on the server — `try/catch` handles the missing global.

### Nuxt setup

**1. Create `plugins/i18n.ts`:**

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

**2. Use composables in components — same as SPA:**

```vue
<script setup lang="ts">
import { useT, useLocale } from 'vue-i18n-kit'

const { t } = useT()
const { locale, setLocale } = useLocale()
</script>
```

### Server-side locale detection

To pick the locale based on the `Accept-Language` header instead of a fixed default, read it in the plugin before calling `createVueI18nPlugin`:

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

- **`persistLocale`** — works on the client only; on the server it is silently ignored (no `localStorage`). It is safe to leave `persistLocale: true` in a Nuxt app — the plugin handles the missing global.
- **Hydration** — the server and client render with the same `defaultLocale` (or the detected one). If you use `persistLocale`, the client will restore the user's saved locale after hydration.
- **Vite plugin and CLI** — work the same way in Nuxt projects. Add `vueI18nMapPlugin` to `nuxt.config.ts` under `vite.plugins`.
- **`plugin.service` in Nuxt** — create the plugin inside `defineNuxtPlugin` (not at module level) so each SSR request gets its own `service` instance. See [SSR note](#ssr-note) in the Plugin Service section.

---

## Advanced: Passing Extra vue-i18n Options

Anything accepted by `vue-i18n`'s `createI18n` can be forwarded through `vueI18nOptions`:

```ts
app.use(createVueI18nPlugin({
  defaultLocale: 'en',
  locales: { en: enMessages },
  vueI18nOptions: {
    warnHtmlMessage: false,
    missingWarn: false,
    fallbackWarn: false,
  },
}))
```

---

## Project Structure (package internals)

```
src/
├── index.ts                        # Public API re-exports (browser/universal)
├── plugin.ts                       # createVueI18nPlugin()
├── createI18n.ts                   # vue-i18n instance factory
├── state.ts                        # Per-app state via provide/inject (SSR-safe)
├── types/
│   └── index.ts                    # I18nPluginOptions, LocaleMessages, LocaleEntry
├── composables/
│   ├── useLocale.ts                # locale, setLocale, isLoading, localeMeta
│   ├── useT.ts                     # t(), tm()
│   ├── useAvailableLocales.ts      # availableLocales
│   ├── useFormat.ts                # formatDate, formatNumber, formatCurrency
│   └── usePluralize.ts             # pluralCategory + engine powering tm() (Intl.PluralRules)
├── utils/
│   ├── loadLocale.ts               # Resolves sync objects and async loaders
│   ├── persistLocale.ts            # localStorage read / write helpers
│   ├── localeKeys.ts               # flattenKeys, compareLocales (shared by CLI + Vite plugin)
│   └── localeEntry.ts              # isLocaleDefinition, extractMessages, extractMeta
├── vite-plugin/
│   └── index.ts                    # vueI18nCheckPlugin + vueI18nMapPlugin (Node.js, optional)
├── ui-app/                         # Locale editor Vue SPA (built to dist/ui-server/public/)
│   ├── index.html
│   ├── main.ts
│   ├── App.vue
│   ├── api.ts
│   └── components/
│       └── LocaleTable.vue
├── ui-server/
│   └── server.ts                   # Node.js HTTP server for the locale editor
└── cli/
    ├── index.ts                    # CLI entry point (bin: vue-i18n-kit)
    └── commands/
        ├── init.ts                 # vue-i18n-kit init
        ├── add.ts                  # vue-i18n-kit add <locale>
        ├── check.ts                # vue-i18n-kit check
        ├── merge.ts                # vue-i18n-kit merge
        ├── prune.ts                # vue-i18n-kit prune
        ├── types.ts                # vue-i18n-kit types
        ├── stale.ts                # vue-i18n-kit stale
        ├── export-translations.ts  # vue-i18n-kit export
        └── import-translations.ts  # vue-i18n-kit import
```

The package ships three independent entry points:

| Import | Description |
|---|---|
| `vue-i18n-kit` | Runtime composables and plugin — for Vue apps |
| `vue-i18n-kit/vite` | Vite plugins (`vueI18nCheckPlugin`, `vueI18nMapPlugin`) — for `vite.config.ts` |
| `vue-i18n-kit` (bin) | CLI — `init`, `add`, `check`, `ui` commands |

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

### Running tests

Tests are written with [Vitest](https://vitest.dev/) and [`@vue/test-utils`](https://test-utils.vuejs.org/). The test suite covers:

| Test file | What is covered |
|---|---|
| `tests/plugin.test.ts` | Plugin installation, initial locale, lazy pre-loading, `persistLocale` restore logic, `service` property (pre-install guards, post-install refs, `onLocaleChange` subscribe/unsubscribe) |
| `tests/useLocale.test.ts` | `locale` ref, `setLocale`, `isLoading` flag, lazy caching, error handling, `localeMeta` |
| `tests/useT.test.ts` | `t()` key lookup and interpolation; `tm()` ICU pluralization via key and direct template |
| `tests/useFormat.test.ts` | `formatDate`, `formatNumber`, `formatCurrency`, locale reactivity |
| `tests/usePluralize.test.ts` | ICU engine: Russian/English forms, `#` replacement, `other` fallback, `pluralCategory`, locale reactivity |
| `tests/localeKeys.test.ts` | `flattenKeys` (nested objects, arrays, null), `compareLocales` (missing / extra / multiple locales) |
| `tests/localeEntry.test.ts` | `isLocaleDefinition`, `extractMessages`, `extractMeta` disambiguation |

---

## License

Danil Lisin Vladimirovich aka Macrulez

GitHub: [macrulezru](https://github.com/macrulezru) · Website: [macrulez.ru](https://macrulez.ru/)

[MIT](./LICENSE)
