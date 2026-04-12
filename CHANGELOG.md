# Changelog

All notable changes to `vue-i18n-kit` are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

---

## [0.4.0] — 2026-04-12

### Added

#### CLI — `split` command (namespace code splitting)
- New `vue-i18n-kit split` command — splits a flat `<locale>.json` into per-namespace files (`en/auth.json`, `en/dashboard.json`, etc.)
- `--dir <path>` — source locales directory
- `--out <path>` — output directory for namespace files (default: `<dir>/split`)

#### CLI — `merge-ns` command (inverse of split)
- New `vue-i18n-kit merge-ns` command — reassembles namespace files back into a single flat `<locale>.json`

#### Vite plugin — `vueI18nNamespacePlugin` (lazy namespace loading)
- New plugin that registers each namespace as a separate dynamic chunk
- Namespaces are loaded on demand as the user navigates between routes, reducing initial bundle size
- Configured via `i18n-kit.config.json` — set `namespaces: true` to enable namespace mode for both the runtime and the editor

#### Init wizard — `vueI18nDevPlugin` auto-setup
- The `vue-i18n-kit init` wizard now asks whether to add `vueI18nDevPlugin` to `vite.config.ts`
- Import is merged into an existing `import { … } from 'vue-i18n-kit/vite'` line when one is already present (avoids duplicate imports)
- Final output now shows the complete `main.ts` snippet **without a box border** (easier to copy), followed by a separate block with the in-context editor registration code

#### In-context editing — `vueI18nDevPlugin`
- New Vite plugin `vueI18nDevPlugin` — active only in `serve` mode; fully inert in `build`
- Injects a `DevOverlay` root app into `document.body` via a virtual module
- Exposes `I18nInspect` component and `vI18nInspect` directive as `window.__I18N_KIT_INSPECT_COMPONENT__` / `window.__I18N_KIT_INSPECT_DIRECTIVE__` globals for registration in the host app's `main.ts`
- `uiUrl` option — URL of the running `vue-i18n-kit ui` server (default: `http://localhost:4173`)
- `autoWrap` option — enable/disable automatic `t()` wrapping in `.vue` templates (default: `true`)
- `iframeWidth` option — width of the inline iframe editor panel (default: `100vw`)

#### In-context editing — `I18nInspect` component
- New dev-only component `<I18nInspect i18n-key="nav.home">{{ t('nav.home') }}</I18nInspect>`
- Renders the slot content as-is plus a pencil icon that appears on hover
- Clicking the icon opens the `DevOverlay` popup pre-filled with the key and all locale values
- Styles are fully scoped with `__ik-` prefixed class names — no conflicts with host app styles

#### In-context editing — `DevOverlay` popup
- Floating popup mounted independently on `document.body` (separate Vue app)
- Loads all locale values for the clicked key from the running UI server (`GET /api/locale/:code`)
- Editable textarea per locale with dirty tracking — only changed locales are sent on save (`PUT /api/locale/:code`)
- Vite HMR picks up the saved JSON change and hot-reloads the locale in the host app automatically
- Header: key badge, `Ctrl+Enter` / `Cmd+Enter` to save, `Esc` to close, open-in-editor button
- Backdrop click closes the popup; scroll of the host page is blocked while the popup is open
- Dark theme matching the main editor UI: `#18181b` background, `#818cf8` indigo accent, zinc palette

#### In-context editing — Vite transform (auto-wrap)
- `transform` hook in `vueI18nDevPlugin` rewrites `.vue` files in dev mode
- Finds all `{{ t('key') }}` / `{{ $t('key') }}` / `{{ tm('key') }}` interpolations with **literal string keys** and wraps them: `{{ t('key') }}` → `<I18nInspect i18n-key="key">{{ t('key') }}</I18nInspect>`
- Dynamic keys (`t(someVar)`) are left untouched — use `v-i18n-inspect` for those
- Attribute bindings (`:placeholder="t('key')"`) are not transformed (limitation by design)
- Transform runs lazily on first request per file (Vite's module graph); navigating to a route triggers transform for components on that route

#### In-context editing — `v-i18n-inspect` directive (dynamic keys)
- New `vI18nInspect` directive for cases where the translation key is dynamic at runtime
- Usage: `<span v-i18n-inspect="myKey">{{ t(myKey) }}</span>` or inside `v-for`
- `mounted` hook attaches hover listeners; `updated` hook tracks binding value changes; `unmounted` cleans up
- On hover: adds `__ik-w--on` outline and renders an absolutely positioned pencil button inside the element
- In production — directive is never registered, `v-i18n-inspect` attributes are silently ignored by Vue (no warnings, zero bundle impact)

#### In-context editing — `DevOverlay` iframe panel
- The open-in-editor button in the popup now opens the full UI editor as a side panel **inside the current tab** instead of a new browser window
- The iframe panel overlays the right side of the page; the application remains visible and interactive behind it
- Panel header (rendered outside the iframe, in `DevOverlay`):
  - **×** — closes the panel, restores normal DevOverlay mode
  - **↗ Open in new tab** — `window.open` with the same URL, then closes the panel
- If the popup is opened for a different key while the iframe panel is already visible, the iframe `src` is updated in place (no full panel close/reopen)
- `Escape` closes the popup first; a second `Escape` closes the iframe panel
- Scroll of the host page is blocked while either the popup or the iframe panel is open

#### In-context editing — `vue-i18n-kit dev` command
- New `vue-i18n-kit dev` command — starts the host app dev server and `vue-i18n-kit ui` in parallel
- Auto-detects the project's dev command from `package.json` `scripts.dev`
- `--ui-port <n>` — port for the UI server (default: `4173`)

#### UI — namespace mode
- In `namespaces: true` projects, each namespace appears as a separate pill-filter tab in the editor toolbar
- Switching tabs filters the key table to that namespace

#### UI — translation memory
- Editor cells show fuzzy-match suggestions from `i18n-kit.memory.json` when entering edit mode
- One-click **Apply** chip inserts a past translation
- Settings panel: **Clear memory** and **Export memory** buttons
- `memory: { enabled: false }` in `i18n-kit.config.json` disables the feature entirely

#### Config — `namespaces` field
- New boolean field in `i18n-kit.config.json` — enables namespace splitting mode

#### Config — `memory` field
- New optional field in `i18n-kit.config.json`: `memory.enabled` (default: `true`)

### Changed
- `vue-i18n-kit init` final step no longer wraps the `app.use()` code in a bordered box — the snippet is printed as plain indented text for easier copy-paste

---

## [0.3.0] — 2026-04-05

### Added

#### Config — `rules` section
- New `rules` field in `i18n-kit.config.json` with validation settings:
  - `interpolationPatterns` — list of placeholder patterns (default: `["{var}"]`); supports `{{var}}`, `:param`, `%(var)s`
  - `lengthWarningFactor` — length warning threshold (default: `2.5`); set to `0` to disable
  - `warnOnHtmlTags` — enable/disable HTML tag mismatch warnings (default: `true`)
  - `warnOnIcuErrors` — enable/disable ICU syntax error warnings (default: `true`)
  - `warnOnDuplicateValues` — enable/disable same-value-across-locales warnings (default: `true`)
  - `minValueLength` — warn if translation value is shorter than this (default: `0` = disabled)
- Rules are applied in the locale editor table (cell highlighting, tooltips)
- `vueI18nCheckPlugin` now accepts a `rules` option with the same shape

#### Config — `ignore` section
- New `ignore` field in `i18n-kit.config.json`:
  - `ignore.prune` — key glob patterns that `prune` will never delete (e.g. `"status.*"`, `"dynamic.*"`)
  - `ignore.duplicates` — key patterns excluded from duplicate-value warnings in the editor
  - `ignore.unused` — key patterns excluded from unused-key warnings in the editor
  - `ignore.scanExclude` — file/directory glob patterns excluded from the source code scanner (e.g. `"src/tests/**"`)
- `vue-i18n-kit prune` reads `ignore.prune` automatically from config; also accepts `--ignore "status.*,legacy.*"` flag
- Scanner (`buildEntriesMap`) respects `scanExclude` patterns

#### Config — `locked` keys (extends / base dictionary)
- New `locked` field in `i18n-kit.config.json` (base config only) — list of key patterns that child projects cannot modify
- Supports glob: `"legal.*"`, `"brand.name"`, `"**"`
- **Server** — `PUT /api/locale/:code` returns `403` when a request attempts to change a locked key
- **Editor UI** — locked cells are rendered as read-only (greyed out, lock icon, tooltip "Key locked by base dictionary")
- **CLI `merge`** — locked keys are never overwritten, even with `--overwrite`
- **CLI `prune`** — locked keys are never removed
- **`/api/config`** now returns `lockedKeys: string[]`

#### CLI — `merge` improvements
- Alphabetical key sort applied to result after merge (matches behaviour of `sort` command)
- New `--no-sort` flag to skip sorting (for projects where key order matters)

#### Config schema — TypeScript interfaces exported
- `I18nKitRules` — validation rules type
- `I18nKitIgnore` — exclusion lists type
- Both exported from `vue-i18n-kit/config`

#### UI — unused keys computed
- `unusedKeys` computed (keys in locale files but not in code) is now filtered by `ignore.unused` patterns
- Passed as `unusedKeys` prop to Dashboard component

#### `/api/config` response extended
- Now returns `rules`, `ignore`, `lockedKeys` alongside existing `locales` and `cwd`

#### CLI — `types` command (TypeScript type generation)
- New `vue-i18n-kit types` command — scans the reference locale and generates a `TranslationKey` union type + `TranslationKeyPrefix` type
- Output written to `src/i18n.d.ts` by default; configurable via `--out <path>`
- `--locale <code>` — choose which locale to use as the key source (default: first in config)
- `--dir <path>` — locales directory (default: `src/locales`)
- `--watch` — regenerates automatically when the locale file changes on disk (uses `fs.watchFile`)
- Generated file includes a `declare module 'vue-i18n-kit' { interface Register { key: TranslationKey } }` block for typed `t()` calls

#### CLI — `stale` command (outdated translation detection)
- New `vue-i18n-kit stale` command — compares current reference locale values against SHA1 hashes stored in `i18n-kit.notes.json`
- Reports keys whose reference text changed since the last review, with old and new values side-by-side
- Requires `"staleTracking": true` in `i18n-kit.config.json`
- `--locale <code>` and `--dir <path>` flags mirror other commands

#### CLI — `export` command (XLIFF / PO export)
- New `vue-i18n-kit export` command — exports a locale to XLIFF 1.2 or Gettext PO format
- `--locale <code>` (required) — target locale to export
- `--format <xliff|po>` — output format (default: `xliff`)
- `--out <path>` — output file path (default: `<locale>.<format>`)
- `--dir <path>` — locales directory
- `--ref <code>` — reference locale used as source language (default: first in config)
- XLIFF output: standard `<file>` / `<body>` / `<trans-unit>` structure; notes as `<note>` elements
- PO output: `msgctxt` = key, `msgid` = reference value, `msgstr` = translation; notes as `#.` comments

#### CLI — `import` command (XLIFF / PO import)
- New `vue-i18n-kit import <file>` command — reads a completed XLIFF or PO file and writes translated values into locale JSON
- Target locale is read from the file itself (`target-language` in XLIFF, `Language:` header in PO)
- `--dir <path>` — locales directory
- `--dry` — preview changes without writing files
- Output is sorted alphabetically; unrelated keys left untouched

#### Config — `staleTracking` field
- New boolean field in `i18n-kit.config.json` — enables hash-based stale tracking for the reference locale
- When enabled, saving a reference locale value via the UI writes `_hash.<key>` to `i18n-kit.notes.json`

#### Server — stale tracking endpoints
- `GET /api/stale` — returns `{ staleKeys: string[], tracking: boolean }`
- `POST /api/stale/review` — marks keys as reviewed (updates stored hashes)

#### Server — export / import endpoints
- `GET /api/export/xliff/:code` — generates and returns an XLIFF file
- `GET /api/export/po/:code` — generates and returns a PO file
- `POST /api/import` — accepts XLIFF or PO content, updates locale JSON

#### UI — stale keys
- `⚠ outdated` badge on key rows whose reference value changed
- `stale` filter button in the toolbar (visible only when stale keys exist)
- Detail panel for stale keys shows the current reference value and a **Mark as reviewed** button
- Stale state loaded from `/api/stale` on startup

#### UI — XLIFF / PO export and import
- **Export** button in the header opens a locale-picker dialog with XLIFF / PO format toggle
- **Import** file input (next to Import CSV) accepts `.xliff` and `.po` files; locale is detected from the file automatically

#### Config — `translation` field
- New optional `translation` field in `i18n-kit.config.json`:
  - `translation.engine` — `"libretranslate"` (default) or `"deepl"`
  - `translation.deepl.formality` — formality level (`default` / `more` / `less` / `prefer_more` / `prefer_less`)
  - `translation.libretranslate.apiUrl` — LibreTranslate instance URL for project-level config

#### Server — DeepL translation proxy
- `POST /api/translate` now routes by `engine` field in the request body
- **DeepL engine**: proxies to `api-free.deepl.com` (keys ending in `:fx`) or `api.deepl.com` (Pro keys); supports `formality` parameter; sends one request per string
- **Placeholder encoding**: all `{…}` blocks (simple vars and ICU plural blocks) are replaced with `<x id="N"/>` XML tags before the request and restored after — translations survive word-order changes intact; uses DeepL's `tag_handling: "xml"` + `ignore_tags: ["x"]`
- LibreTranslate path unchanged; falls back to `apiUrl` from request body

#### CLI — `stats` command (coverage report)
- New `vue-i18n-kit stats` command — prints a full coverage report to the terminal
- Console output: per-locale coverage with ANSI progress bars (`█░`), namespace breakdown table (keys + % per locale), issues summary (missing / phantom / unused counts)
- `--format json` — outputs a machine-readable JSON object; `--out <path>` writes to a file instead of stdout
  - Fields: `generated`, `totalKeys`, `locales[]` (filled / empty / missing / coverage / bytes), `namespaces[]` (keys / bytes / byLocale coverage %), `phantom`, `unused`
- `--format html` — writes a self-contained dark-theme HTML report (`i18n-stats.html` by default) with per-locale progress bars and namespace table
- `--dir <path>` — locales directory override
- Byte sizes are computed per namespace by summing raw string lengths across all locales

#### UI Settings — machine translation engine selector
- New **Translation engine** toggle in the Settings popover (LibreTranslate / DeepL)
- **LibreTranslate** fields: URL + API key (existing, unchanged)
- **DeepL** fields: Auth Key (password input), Formality selector (`Default` / `More formal` / `Less formal` / `Prefer more formal` / `Prefer less formal`); hint explains `:fx` suffix and free-plan limits
- All settings persisted to `localStorage`; engine choice sent to `/api/translate` on each translation run
- Translate dialog footer shows the active engine name and current formality setting

#### UI Dashboard — Coverage card
- The single overall-coverage bar has been replaced with a full **Coverage** card section
- Shows overall coverage percentage + bar at the top
- Below: compact per-locale rows with flag, name, progress bar, percentage, and missing count
- Bar and percentage colour-coded: green (100%) / purple (≥ 80%) / yellow (50–79%) / red (< 50%)

### Changed
- `buildEntriesMap(root)` signature extended to `buildEntriesMap(root, excludePatterns?)` — fully backward compatible
- `scanFiles` now accepts `root` and `excludePatterns` parameters; exclude check uses relative paths

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
