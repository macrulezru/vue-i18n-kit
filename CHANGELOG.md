# Changelog

All notable changes to `vue-i18n-kit` are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

---

## [0.2.1] — 2026-04-05

### Added

#### Locale Editor UI — Dashboard
- **Phantom keys panel** — new stat card and key list showing keys referenced in source code via `t()` / `tm()` / `$t()` but absent from all locale files; highlighted in red
- **Phantom filter** in the editor toolbar — filter table to show only phantom keys; badge shows the count; visible only when phantoms exist

#### Locale Editor UI — Editor
- **Plural preview table** — detail panel now shows a rendered preview table for ICU plural keys (`{count, plural, one{…} other{…}}`); covers `n = 0, 1, 2, 5, 11, 21` across all locales simultaneously
- **Add locale dialog** — globe icon button in the header opens a dialog to add a new language: locale code (BCP 47 validated), file path (auto-filled from code), display name, flag emoji; creates the JSON file and updates `i18n-kit.config.json`
- **Immediate focus on edit** — clicking a translation cell now correctly focuses the textarea immediately (fixed Vue template ref array issue in nested `v-for`)
- **Horizontal confirm/cancel buttons** — save/cancel icons in inline edit mode are now side-by-side instead of stacked vertically
- **Custom checkbox component** — native checkboxes replaced with a fully styled dark-theme component (`Checkbox.vue`); supports indeterminate state for the header "select all" checkbox

#### CLI
- **`merge` command** — deep-merge a base or shared JSON dictionary into project locale files; by default only fills in missing keys; `--overwrite` replaces existing values; `--dry` previews without writing; `--locale` targets a single locale
- **`prune` command** — scans source files and removes locale keys that are not referenced anywhere in the project; `--dry` for preview; `--entries` to skip scanning with a pre-built map

#### Vite plugin
- **`vueI18nInlinePlugin`** — new plugin that exposes a virtual module `virtual:vue-i18n-kit/locales` exporting all locale JSON as a static object baked into the bundle; eliminates runtime HTTP requests for translations; ideal for SSR and offline apps

#### Config
- **`extends` field** in `i18n-kit.config.json` — path to a shared/corporate base locale directory or config; base keys are merged under project keys at runtime (project always wins); supports monorepo layouts and npm-published shared dictionaries

#### Server API
- **`POST /api/locale/add`** — creates a new locale JSON file, updates `i18n-kit.config.json`, starts file watcher, broadcasts `locale-added` SSE event

### Fixed
- `editInputEl` focus in `LocaleTable.vue` — the ref was being treated as an array inside nested `v-for` loops, causing `focus()` to silently fail; fixed with `Array.isArray` guard
- Empty virtual group delete — clicking delete on a virtual (key-less) group had no effect; now removed immediately from component state without showing a confirmation dialog
- `watch` not imported in `App.vue` — caused a runtime crash when the Add Locale dialog was opened

### Changed
- Dashboard stat grid expanded from 4 to 5 cards to include phantom key count
- Dashboard panels grid now renders the phantom panel always (empty state: "All code references are declared")
- Mock data (`src/ui-app/mock/data.ts`) expanded with nested groups (`errors.auth`, `errors.form`, `dashboard.widgets.revenue`, `dashboard.widgets.users`, `auth.login`, `auth.register`, `auth.reset`) and two phantom keys for demo purposes
- `coverage/` added to `.gitignore`

---

## [0.1.9] — 2026-03-xx

### Added
- Locale Editor UI: complete rewrite of `App.vue` and `LocaleTable.vue`
- Group operations: create nested subgroups, rename group (renames all keys), delete group and all its keys
- Virtual groups — empty groups that exist in UI state before any key is added; not persisted to disk
- Recursive tree rendering — flat `RenderRow[]` list with `depth` field replaces the previous flat key list; unlimited nesting depth
- Action buttons moved inline — locale key operation icons (rename, duplicate, note, delete) now appear next to the key label on hover, not in a separate far-right column
- Auto-save indicator with last-saved timestamp
- SSE live reload — `EventSource('/api/events')` with auto-reconnect; reloads only the changed locale
- LibreTranslate proxy — server-side POST to avoid browser CORS errors
- Batch delete — checkbox selection + bulk delete bar
- Duplicate key detection — keys where all locales share the same non-empty value
- Sort keys — alphabetical sort across all locale files with undo-stack clear warning
- Find & Replace dialog (`Ctrl+H`)
- Export/Import CSV
- Quick Open fuzzy search (`Ctrl+P`)
- Keyboard shortcut cheatsheet (`?`)
- Settings panel — reference locale, IDE scheme, LibreTranslate config
- Namespace filter — click a namespace card on the dashboard to filter the editor
- Undo stack (up to 100 steps)

---

## [0.1.6] — 2025-xx-xx

### Added
- Locale Editor UI alpha — browser-based editor with inline editing, group tree, usage map, cell validation
- `auto-config` command — scans `createVueI18nPlugin(...)` call and generates `i18n-tools/locales.config.json` + entries map
- `vueI18nMapPlugin` — Vite plugin that writes the locale map in `--mode i18n-dump` and exits; used by `auto-config`
- Nuxt & SSR support — plugin state per Vue app instance, `localStorage` no-op on server
- `vue-i18n-kit ui` command — starts the local editor server

---

## [0.1.0] — 2025-xx-xx

### Added
- `createVueI18nPlugin` — one-liner Vue plugin setup wrapping `vue-i18n` in composition mode
- `useT()` — `t(key, vars?)` for simple strings, `tm(key, vars)` for ICU-pluralized strings
- `useLocale()` — locale switcher with lazy loading, `localStorage` persistence, fallback locale
- `useAvailableLocales()` — list all configured locales with metadata
- `useFormat()` — `Intl`-based date, number, currency formatting that follows the active locale
- `usePluralize()` — low-level ICU plural API using `Intl.PluralRules` + CLDR categories
- `createVueI18nPlugin` returns `.service` — plugin service usable outside Vue components (router guards, Pinia stores, SSR entry points)
- `service.onLocaleChange(cb)` — hook fired after every successful locale switch
- Locale metadata — arbitrary `meta` attached to each locale definition, fully typed via generics
- `vueI18nCheckPlugin` — Vite plugin that checks locale files for missing/extra keys at build time and on HMR
- `vue-i18n-kit init` — interactive setup wizard
- `vue-i18n-kit add <locale>` — copies an existing locale structure into a new file
- `vue-i18n-kit check` — audits all locale files for key completeness; `--fail` for CI
