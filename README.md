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
- **TypeScript-first** — all public APIs are fully typed, no `any` leaks into consumer code
- **Vite plugin** — checks all locale files for missing or extra keys at build time (import from `vue-i18n-kit/vite`)
- **CLI** — `vue-i18n-kit init / add / check` scaffolds and audits locale files from the terminal

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

## TypeScript

All public types are re-exported for use in consumer projects:

```ts
import type {
  // Plugin
  I18nPluginOptions,

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
├── state.ts                        # Module-level singleton (plugin context)
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
│   └── index.ts                    # vueI18nCheckPlugin (Node.js, optional)
└── cli/
    ├── index.ts                    # CLI entry point (bin: vue-i18n-kit)
    └── commands/
        ├── init.ts                 # vue-i18n-kit init
        ├── add.ts                  # vue-i18n-kit add <locale>
        └── check.ts                # vue-i18n-kit check
```

The package ships three independent entry points:

| Import | Description |
|---|---|
| `vue-i18n-kit` | Runtime composables and plugin — for Vue apps |
| `vue-i18n-kit/vite` | Vite plugin — for `vite.config.ts` |
| `vue-i18n-kit` (bin) | CLI — invoked as `npx vue-i18n-kit` |

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
| `tests/plugin.test.ts` | Plugin installation, initial locale, lazy pre-loading, `persistLocale` restore logic |
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
