import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from 'node:fs'
import { join, resolve, relative, dirname } from 'node:path'
import { buildEntriesMap, scanFiles } from '../../utils/scanner.js'

// ── Bracket/string-literal-aware matching ─────────────────────────────────────

/**
 * Returns the index of the closing bracket that matches the opening one at
 * `openIdx`. Skips over string literals so their contents don't confuse the
 * depth counter. Returns -1 if no match is found.
 */
function findMatchingClose(content: string, openIdx: number): number {
  const open = content[openIdx]
  const close = open === '(' ? ')' : open === '{' ? '}' : open === '[' ? ']' : null
  if (!close) return -1

  let depth = 0
  let i = openIdx
  while (i < content.length) {
    const ch = content[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      i++
      while (i < content.length && content[i] !== quote) {
        if (content[i] === '\\') i++
        i++
      }
    } else if (ch === open) {
      depth++
    } else if (ch === close) {
      depth--
      if (depth === 0) return i
    }
    i++
  }
  return -1
}

// ── Parse simple flat object body ─────────────────────────────────────────────

/**
 * Parses string / number / boolean values from a flat object body
 * (the content between the outer braces).
 */
function parseSimpleObject(body: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const RE = /(\w+)\s*:\s*(?:(['"`])((?:\\.|[^\\])*?)\2|(-?\d+(?:\.\d+)?)|(\btrue\b|\bfalse\b))/g
  let m: RegExpExecArray | null
  while ((m = RE.exec(body)) !== null) {
    const [, key, , strVal, numVal, boolVal] = m
    if (strVal !== undefined) result[key] = strVal
    else if (numVal !== undefined) result[key] = Number(numVal)
    else if (boolVal !== undefined) result[key] = boolVal === 'true'
  }
  return result
}

// ── Import path resolution ────────────────────────────────────────────────────

/**
 * Resolves an import string to an absolute path, handling common project aliases:
 *   `~/path`  — Nuxt root alias → cwd/path
 *   `@/path`  — Vite alias → tries cwd/src/path first (standard convention),
 *               then falls back to cwd/path (Nuxt-style)
 *   `./path`  — relative to the source file's directory
 */
function resolveImportPath(cwd: string, fileDir: string, importStr: string): string {
  if (importStr.startsWith('~/')) {
    return resolve(cwd, importStr.slice(2))
  }
  if (importStr.startsWith('@/')) {
    const rel = importStr.slice(2)
    const withSrc = resolve(cwd, 'src', rel)
    return existsSync(withSrc) ? withSrc : resolve(cwd, rel)
  }
  return resolve(fileDir, importStr)
}

// ── Locales block extraction ──────────────────────────────────────────────────

/**
 * Extracts the inner content of the `locales` object from the plugin call body.
 *
 * Handles three forms:
 *   1. `locales: { en: ..., ru: ... }` — inline object
 *   2. `locales: appLocales`            — reference to a variable in the same file
 *   3. `{ locales }`                    — shorthand property (varName = 'locales')
 *
 * Returns the content between the outer braces, or `null` if not found.
 */
function extractLocalesBody(pluginBody: string, fileContent: string): string | null {
  // ── Case 1: inline object ────────────────────────────────────────────────────
  const inlineMatch = pluginBody.match(/\blocales\s*:\s*\{/)
  if (inlineMatch && inlineMatch.index !== undefined) {
    const braceIdx = pluginBody.indexOf('{', inlineMatch.index + inlineMatch[0].length - 1)
    const closeIdx = findMatchingClose(pluginBody, braceIdx)
    return closeIdx !== -1 ? pluginBody.slice(braceIdx + 1, closeIdx) : null
  }

  // ── Determine variable name ──────────────────────────────────────────────────
  // Case 2: explicit reference  →  locales: varName
  const explicitRef = pluginBody.match(/\blocales\s*:\s*([a-zA-Z_$][\w$]*)/)
  const varName = explicitRef
    ? explicitRef[1]
    // Case 3: shorthand  →  { ..., locales }  (no colon follows)
    : /(?:^|[{,\n])\s*\blocales\b(?!\s*:)/.test(pluginBody) ? 'locales' : null

  if (!varName) return null

  // ── Find declaration in the file ─────────────────────────────────────────────
  // Matches:  const varName = {
  //           const varName: SomeType = {
  //           export const varName = {
  const escapedName = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const declRE = new RegExp(
    `(?:export\\s+)?(?:const|let|var)\\s+${escapedName}[^=]*=\\s*\\{`,
  )
  const declMatch = fileContent.match(declRE)
  if (!declMatch || declMatch.index === undefined) return null

  const braceStart = fileContent.indexOf('{', declMatch.index + declMatch[0].length - 1)
  if (braceStart === -1) return null
  const braceEnd = findMatchingClose(fileContent, braceStart)
  return braceEnd !== -1 ? fileContent.slice(braceStart + 1, braceEnd) : null
}

// ── Source of truth: createVueI18nPlugin config ───────────────────────────────

export interface DiscoveredLocale {
  code: string
  /** Path relative to project root (forward slashes) */
  relativePath: string
  /** Absolute path */
  absolutePath: string
  /** Metadata from the LocaleDefinition.meta field, if present */
  meta?: Record<string, unknown>
}

/**
 * Extracts the raw value text for a given locale key from the locales block.
 * Handles both `code: { ... }` and `[Expr]: { ... }` (computed property) forms,
 * as well as `code: () => import(...)` function values.
 */
function getLocaleValueText(localesBody: string, localeCode: string, isComputed = false): string | undefined {
  const pattern = isComputed
    ? `\\[${localeCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\s*:\\s*`
    : `(?:['"]?)${localeCode}(?:['"]?)\\s*:\\s*`
  const codeMatch = localesBody.match(new RegExp(pattern))
  if (!codeMatch || codeMatch.index === undefined) return undefined

  const start = codeMatch.index + codeMatch[0].length

  if (localesBody[start] === '{') {
    // Object value — grab everything up to and including the matching }
    const closeIdx = findMatchingClose(localesBody, start)
    return closeIdx !== -1 ? localesBody.slice(start, closeIdx + 1) : undefined
  }

  // Function / other value — grab up to the next comma at depth 0,
  // or the end of the locales block
  let depth = 0
  for (let i = start; i < localesBody.length; i++) {
    const ch = localesBody[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      const q = ch; i++
      while (i < localesBody.length && localesBody[i] !== q) {
        if (localesBody[i] === '\\') i++
        i++
      }
    } else if ('({['.includes(ch)) {
      depth++
    } else if (')}]'.includes(ch)) {
      if (depth === 0) return localesBody.slice(start, i)
      depth--
    } else if (ch === ',' && depth === 0) {
      return localesBody.slice(start, i)
    }
  }
  return localesBody.slice(start)
}

/**
 * Scans all source files to find the one containing `createVueI18nPlugin(` and
 * returns the resolved list of locales with their file paths and meta.
 *
 * This is the **single source of truth** — only locales explicitly registered
 * in `createVueI18nPlugin` are included.
 */
export function discoverLocales(cwd: string): DiscoveredLocale[] {
  const files = scanFiles(cwd)

  for (const file of files) {
    const content = readFileSync(file, 'utf-8')
    const pluginIdx = content.indexOf('createVueI18nPlugin(')
    if (pluginIdx === -1) continue

    // ── Extract the full plugin call body ────────────────────────────────────
    const pluginOpenIdx = content.indexOf('(', pluginIdx)
    const pluginCloseIdx = findMatchingClose(content, pluginOpenIdx)
    if (pluginCloseIdx === -1) continue

    const pluginBody = content.slice(pluginOpenIdx + 1, pluginCloseIdx)

    // ── Extract the locales object body (inline, external var, or shorthand) ──
    const localesBody = extractLocalesBody(pluginBody, content)
    if (!localesBody) continue
    const fileDir = dirname(file)

    // ── Collect all locale codes ─────────────────────────────────────────────
    // Matches plain string keys ('en', ru) AND computed keys ([LocalesEnum.EN])
    const codeRE = /(?:^|,|\n)\s*(?:\[([^\]\n]+)\]|(?:['"]?)([a-z]{2,3}(?:-[A-Za-z]{2,4})?)(?:['"]?))\s*:/gm
    const results: DiscoveredLocale[] = []
    let m: RegExpExecArray | null

    while ((m = codeRE.exec(localesBody)) !== null) {
      const computedExpr = m[1]  // e.g. 'LocalesEnum.EN' — present for [Expr]: keys
      const plainCode   = m[2]  // e.g. 'en'             — present for plain string keys

      const valueText = computedExpr
        ? getLocaleValueText(localesBody, computedExpr, true)
        : getLocaleValueText(localesBody, plainCode)
      if (!valueText) continue

      // Extract import path: import('./locales/en.json') or import('~/locales/en.json')
      const importMatch = valueText.match(/import\s*\(\s*(['"`])([^'"`\n]+)\1\s*\)/)
      if (!importMatch) continue // inline messages object — no file, skip

      const importStr = importMatch[2]

      // For computed keys the locale code is unknown at parse time — derive it from the filename
      const code = plainCode ?? importStr.split('/').pop()!.replace(/\.[^.]+$/, '')

      const absolutePath = resolveImportPath(cwd, fileDir, importStr)

      if (!existsSync(absolutePath)) {
        console.warn(`[vue-i18n-kit] Locale file not found: ${absolutePath} (locale: ${code})`)
        continue
      }

      // Extract meta (only present in LocaleDefinition form)
      let meta: Record<string, unknown> | undefined
      if (valueText.trimStart().startsWith('{')) {
        const metaMatch = valueText.match(/\bmeta\s*:\s*\{/)
        if (metaMatch && metaMatch.index !== undefined) {
          const metaBraceIdx = valueText.indexOf('{', metaMatch.index + metaMatch[0].length - 1)
          const metaCloseIdx = findMatchingClose(valueText, metaBraceIdx)
          if (metaCloseIdx !== -1) {
            const parsed = parseSimpleObject(valueText.slice(metaBraceIdx + 1, metaCloseIdx))
            if (Object.keys(parsed).length > 0) meta = parsed
          }
        }
      }

      results.push({
        code,
        relativePath: relative(cwd, absolutePath).replace(/\\/g, '/'),
        absolutePath,
        ...(meta ? { meta } : {}),
      })
    }

    if (results.length > 0) return results
  }

  return []
}

// ── Serialization helpers ─────────────────────────────────────────────────────

function serializeMeta(meta: Record<string, unknown>): string {
  const entries = Object.entries(meta).map(([k, v]) => {
    if (typeof v === 'string') {
      const escaped = v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      return `${k}: '${escaped}'`
    }
    return `${k}: ${JSON.stringify(v)}`
  })
  return `{ ${entries.join(', ')} }`
}

// ── JSON file generation ──────────────────────────────────────────────────────

function generateLocaleMap(cwd: string, locales: DiscoveredLocale[], output: string): void {
  const outPath = resolve(cwd, output)
  const outDir = outPath.slice(0, Math.max(outPath.lastIndexOf('/'), outPath.lastIndexOf('\\')) + 1)
  mkdirSync(outDir, { recursive: true })

  const map = {
    root: cwd,
    generatedAt: new Date().toISOString(),
    locales: locales.map(l => {
      const entry: Record<string, unknown> = { code: l.code, path: l.absolutePath }
      if (l.meta && Object.keys(l.meta).length > 0) entry['meta'] = l.meta
      return entry
    }),
  }
  writeFileSync(outPath, JSON.stringify(map, null, 2) + '\n', 'utf-8')
}

function generateEntriesMap(cwd: string, output: string): void {
  const map = buildEntriesMap(cwd)
  const outPath = resolve(cwd, output)
  writeFileSync(outPath, JSON.stringify(map, null, 2) + '\n', 'utf-8')
}

// ── Config file detection ─────────────────────────────────────────────────────

type ConfigKind = 'vite' | 'nuxt'

const VITE_CONFIG_NAMES = [
  'vite.config.ts', 'vite.config.js', 'vite.config.mts', 'vite.config.mjs',
]
const NUXT_CONFIG_NAMES = [
  'nuxt.config.ts', 'nuxt.config.js', 'nuxt.config.mts', 'nuxt.config.mjs',
]

export function findProjectConfig(cwd: string): { path: string; kind: ConfigKind } | null {
  for (const name of VITE_CONFIG_NAMES) {
    const p = join(cwd, name)
    if (existsSync(p)) return { path: p, kind: 'vite' }
  }
  for (const name of NUXT_CONFIG_NAMES) {
    const p = join(cwd, name)
    if (existsSync(p)) return { path: p, kind: 'nuxt' }
  }
  return null
}

/**
 * Builds the `vueI18nMapPlugin({...})` call string.
 * `outerIndent` — the spaces prepended to the first line (and used for the closing paren).
 */
function buildPluginCall(locales: DiscoveredLocale[], outerIndent = '    '): string {
  const i1 = outerIndent + '  '   // locales: key
  const i2 = outerIndent + '    ' // locale entries
  const entries = locales.map(l => {
    const metaPart = l.meta && Object.keys(l.meta).length > 0
      ? `, meta: ${serializeMeta(l.meta)}`
      : ''
    return `${i2}${l.code}: { path: '${l.relativePath}'${metaPart} },`
  }).join('\n')
  return `vueI18nMapPlugin({\n${i1}locales: {\n${entries}\n${i1}},\n${outerIndent}})`
}

/** Adds the import line after the last existing import in the file. */
function addImport(content: string): string {
  const importMatches = [...content.matchAll(/^import .+$/gm)]
  if (importMatches.length > 0) {
    const last = importMatches[importMatches.length - 1]
    const insertAt = last.index! + last[0].length
    return (
      content.slice(0, insertAt) +
      "\nimport { vueI18nMapPlugin } from 'vue-i18n-kit/vite'" +
      content.slice(insertAt)
    )
  }
  return "import { vueI18nMapPlugin } from 'vue-i18n-kit/vite'\n\n" + content
}

/**
 * Merges `vueI18nDevPlugin` into an existing `import { … } from 'vue-i18n-kit/vite'` line,
 * or adds a new import line after the last existing import.
 */
function addDevPluginImport(content: string): string {
  // Find an existing import from 'vue-i18n-kit/vite' (single or double quotes)
  const importLineRE = /^(import\s*\{)([^}]+)(\}\s*from\s*['"]vue-i18n-kit\/vite['"].*)/m
  const m = content.match(importLineRE)
  if (m && m.index !== undefined) {
    if (m[2].includes('vueI18nDevPlugin')) return content // already present
    const newLine = m[1] + m[2].trimEnd() + ', vueI18nDevPlugin ' + m[3]
    return content.slice(0, m.index) + newLine + content.slice(m.index + m[0].length)
  }
  // No 'vue-i18n-kit/vite' import yet — add new line after last import
  const importMatches = [...content.matchAll(/^import .+$/gm)]
  if (importMatches.length > 0) {
    const last = importMatches[importMatches.length - 1]
    const insertAt = last.index! + last[0].length
    return (
      content.slice(0, insertAt) +
      "\nimport { vueI18nDevPlugin } from 'vue-i18n-kit/vite'" +
      content.slice(insertAt)
    )
  }
  return "import { vueI18nDevPlugin } from 'vue-i18n-kit/vite'\n\n" + content
}

/** Inserts `vueI18nDevPlugin()` before the closing `]` of the plugins array. */
function insertDevPluginAtEndOfPluginsArray(
  content: string,
  pluginsMatch: RegExpMatchArray,
  outerIndent: string,
): string {
  const bracketIdx = pluginsMatch.index! + pluginsMatch[0].length - 1
  const closeBracketIdx = findMatchingClose(content, bracketIdx)
  if (closeBracketIdx === -1) return content

  let insertPos = closeBracketIdx
  while (insertPos > 0 && content[insertPos - 1] !== '\n') insertPos--
  return content.slice(0, insertPos) + outerIndent + 'vueI18nDevPlugin(),' + '\n' + content.slice(insertPos)
}

/** Inserts `pluginCall` before the closing `]` of the plugins array. */
function insertAtEndOfPluginsArray(content: string, pluginsMatch: RegExpMatchArray, outerIndent: string, locales: DiscoveredLocale[]): string {
  const bracketIdx = pluginsMatch.index! + pluginsMatch[0].length - 1
  const closeBracketIdx = findMatchingClose(content, bracketIdx)
  if (closeBracketIdx === -1) return content

  const pluginCall = buildPluginCall(locales, outerIndent)
  let insertPos = closeBracketIdx
  while (insertPos > 0 && content[insertPos - 1] !== '\n') insertPos--
  return content.slice(0, insertPos) + outerIndent + pluginCall + ',\n' + content.slice(insertPos)
}

export function updateConfig(configPath: string, kind: ConfigKind, locales: DiscoveredLocale[]): void {
  let content = readFileSync(configPath, 'utf-8')

  const hasImport = content.includes("from 'vue-i18n-kit/vite'")
    || content.includes('from "vue-i18n-kit/vite"')

  // ── Plugin already present — replace the entire call (same for both kinds) ──
  const pluginCallIdx = content.indexOf('vueI18nMapPlugin(')
  if (pluginCallIdx !== -1) {
    const openParenIdx = pluginCallIdx + 'vueI18nMapPlugin'.length
    const closeIdx = findMatchingClose(content, openParenIdx)
    if (closeIdx === -1) {
      console.warn('[vue-i18n-kit] Could not parse vueI18nMapPlugin call — skipping config update')
      return
    }
    // Detect current indentation from the line containing the call
    let lineStart = pluginCallIdx
    while (lineStart > 0 && content[lineStart - 1] !== '\n') lineStart--
    const currentIndent = content.slice(lineStart, pluginCallIdx)
    const pluginCall = buildPluginCall(locales, currentIndent)
    content = content.slice(0, pluginCallIdx) + pluginCall + content.slice(closeIdx + 1)
    writeFileSync(configPath, content, 'utf-8')
    return
  }

  // ── Plugin absent — add import first ─────────────────────────────────────────
  if (!hasImport) content = addImport(content)

  if (kind === 'vite') {
    // vite.config.ts — plugins: [ ... ] at top level
    const pluginsMatch = content.match(/plugins\s*:\s*\[/)
    if (!pluginsMatch || pluginsMatch.index === undefined) {
      console.warn('[vue-i18n-kit] Could not find plugins: [ — skipping auto-insert')
      printManualInstructions(kind, locales)
      return
    }
    content = insertAtEndOfPluginsArray(content, pluginsMatch, '    ', locales)

  } else {
    // nuxt.config.ts — vite: { plugins: [ ... ] }

    const pluginsMatch = content.match(/plugins\s*:\s*\[/)
    if (pluginsMatch) {
      // vite.plugins already exists — insert at end
      content = insertAtEndOfPluginsArray(content, pluginsMatch, '      ', locales)

    } else {
      const viteMatch = content.match(/\bvite\s*:\s*\{/)
      if (viteMatch && viteMatch.index !== undefined) {
        // vite: {} exists but has no plugins — add plugins inside it
        const viteBraceIdx = content.indexOf('{', viteMatch.index + viteMatch[0].length - 1)
        const viteCloseIdx = findMatchingClose(content, viteBraceIdx)
        if (viteCloseIdx === -1) {
          printManualInstructions(kind, locales)
          return
        }
        const pluginCall = buildPluginCall(locales, '      ')
        const pluginsBlock = `\n    plugins: [\n      ${pluginCall},\n    ],\n  `
        content = content.slice(0, viteCloseIdx) + pluginsBlock + content.slice(viteCloseIdx)

      } else {
        // No vite: section at all — add it inside defineNuxtConfig({...})
        const nuxtConfigMatch = content.match(/defineNuxtConfig\s*\(/)
        if (!nuxtConfigMatch || nuxtConfigMatch.index === undefined) {
          printManualInstructions(kind, locales)
          return
        }
        const nuxtOpenIdx = content.indexOf('(', nuxtConfigMatch.index + nuxtConfigMatch[0].length - 1)
        const nuxtInnerIdx = content.indexOf('{', nuxtOpenIdx)
        if (nuxtInnerIdx === -1) {
          printManualInstructions(kind, locales)
          return
        }
        const pluginCall = buildPluginCall(locales, '      ')
        const viteBlock = `\n  vite: {\n    plugins: [\n      ${pluginCall},\n    ],\n  },`
        content = content.slice(0, nuxtInnerIdx + 1) + viteBlock + content.slice(nuxtInnerIdx + 1)
      }
    }
  }

  writeFileSync(configPath, content, 'utf-8')
}

/**
 * Adds `vueI18nDevPlugin()` to the vite/nuxt config.
 * - Merges the import into an existing `vue-i18n-kit/vite` import, or adds a new one.
 * - Inserts the plugin call at the end of the plugins array.
 * - No-ops if `vueI18nDevPlugin(` is already present.
 */
export function updateDevPlugin(configPath: string, kind: ConfigKind): void {
  let content = readFileSync(configPath, 'utf-8')

  if (content.includes('vueI18nDevPlugin(')) return // already present

  content = addDevPluginImport(content)

  if (kind === 'vite') {
    const pluginsMatch = content.match(/plugins\s*:\s*\[/)
    if (!pluginsMatch || pluginsMatch.index === undefined) {
      console.warn('[vue-i18n-kit] Could not find plugins: [ — skipping dev plugin insert')
      return
    }
    content = insertDevPluginAtEndOfPluginsArray(content, pluginsMatch, '    ')
  } else {
    // Nuxt — insert into vite.plugins if it exists (structure was likely created by updateConfig)
    const pluginsMatch = content.match(/plugins\s*:\s*\[/)
    if (pluginsMatch) {
      content = insertDevPluginAtEndOfPluginsArray(content, pluginsMatch, '      ')
    }
  }

  writeFileSync(configPath, content, 'utf-8')
}

// ── Console instructions fallback ─────────────────────────────────────────────

function printManualInstructions(kind: ConfigKind, locales: DiscoveredLocale[]): void {
  const entries = locales.map(l => {
    const metaPart = l.meta && Object.keys(l.meta).length > 0
      ? `, meta: ${serializeMeta(l.meta)}`
      : ''
    return `      ${l.code}: { path: '${l.relativePath}'${metaPart} },`
  }).join('\n')

  if (kind === 'nuxt') {
    console.log(`
  Add the following to your nuxt.config.ts manually:

  import { vueI18nMapPlugin } from 'vue-i18n-kit/vite'

  export default defineNuxtConfig({
    vite: {
      plugins: [
        vueI18nMapPlugin({
          locales: {
${entries}
          },
        }),
      ],
    },
  })
`)
  } else {
    console.log(`
  Add the following to your vite.config.ts manually:

  import { vueI18nMapPlugin } from 'vue-i18n-kit/vite'

  export default defineConfig({
    plugins: [
      vueI18nMapPlugin({
        locales: {
${entries}
        },
      }),
      // ... your other plugins
    ],
  })
`)
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function runAutoConfig(cwd: string): void {
  // 1. Discover locales from createVueI18nPlugin — the single source of truth
  const locales = discoverLocales(cwd)

  if (locales.length === 0) {
    console.error(`
[vue-i18n-kit] auto-config: could not find locale definitions.

The scanner looks for createVueI18nPlugin({ locales: ... }) in your source files
and supports the following patterns:

  ✔  Inline object
       createVueI18nPlugin({
         locales: {
           en: { messages: () => import('./locales/en.json') },
           ru: () => import('./locales/ru.json'),
         },
       })

  ✔  Computed / enum keys
       locales: {
         [LocalesEnum.EN]: { messages: () => import('./locales/en.json') },
       }

  ✔  External variable declared in the same file
       const locales = { en: { messages: () => import('./locales/en.json') } }
       createVueI18nPlugin({ locales })          // shorthand
       createVueI18nPlugin({ locales: locales })  // explicit

The following patterns are NOT supported and must be configured manually:

  ✘  Locales object imported from another file
       import { locales } from './locales.config'
       createVueI18nPlugin({ locales })

  ✘  Dynamic import() paths (template literals or computed strings)
       en: () => import(\`./locales/\${code}.json\`)

  ✘  Locales built at runtime (Object.fromEntries, Array.reduce, etc.)

For unsupported cases, add vueI18nMapPlugin manually and run  vue-i18n-kit ui
directly (without auto-config). Examples:

  vite.config.ts (Vue / Vite):
    import { vueI18nMapPlugin } from 'vue-i18n-kit/vite'

    export default defineConfig({
      plugins: [
        vue(),
        vueI18nMapPlugin({
          locales: {
            en: { path: 'src/locales/en.json', meta: { display: 'English' } },
            ru: { path: 'src/locales/ru.json', meta: { display: 'Русский' } },
          },
        }),
      ],
    })

  nuxt.config.ts (Nuxt):
    import { vueI18nMapPlugin } from 'vue-i18n-kit/vite'

    export default defineNuxtConfig({
      vite: {
        plugins: [
          vueI18nMapPlugin({
            locales: {
              en: { path: 'locales/en.json', meta: { display: 'English' } },
              ru: { path: 'locales/ru.json', meta: { display: 'Русский' } },
            },
          }),
        ],
      },
    })
`)
    process.exit(1)
  }

  const withMeta = locales.filter(l => l.meta).map(l => l.code)
  const metaNote = withMeta.length > 0 ? ` (meta: ${withMeta.join(', ')})` : ''
  console.log(`[vue-i18n-kit] Found ${locales.length} locale(s): ${locales.map(l => l.code).join(', ')}${metaNote}`)

  // 2. Generate i18n-tools/locales.config.json
  const configOutput = 'i18n-tools/locales.config.json'
  generateLocaleMap(cwd, locales, configOutput)
  console.log(`[vue-i18n-kit] Written ${configOutput}`)

  // 3. Generate i18n-tools/locales.entries.json
  const entriesOutput = 'i18n-tools/locales.entries.json'
  generateEntriesMap(cwd, entriesOutput)
  console.log(`[vue-i18n-kit] Written ${entriesOutput}`)

  // 4. Update vite.config.ts / nuxt.config.ts (or print instructions if not found)
  const projectConfig = findProjectConfig(cwd)

  if (!projectConfig) {
    console.log('\n[vue-i18n-kit] Neither vite.config.ts nor nuxt.config.ts found.')
    printManualInstructions('vite', locales)
    return
  }

  updateConfig(projectConfig.path, projectConfig.kind, locales)
  const relConfig = relative(cwd, projectConfig.path).replace(/\\/g, '/')
  console.log(`[vue-i18n-kit] Updated ${relConfig}`)
  console.log('\n[vue-i18n-kit] Done. Run: vue-i18n-kit ui')
}
