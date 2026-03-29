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
 * Extracts the raw value text for a given locale code from the locales block.
 * Handles both `code: { ... }` (object) and `code: () => import(...)` (function).
 */
function getLocaleValueText(localesBody: string, localeCode: string): string | undefined {
  const codeRE = new RegExp(`(?:['"]?)${localeCode}(?:['"]?)\\s*:\\s*`)
  const codeMatch = localesBody.match(codeRE)
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

    // ── Find locales: { ... } ────────────────────────────────────────────────
    const localesMatch = pluginBody.match(/\blocales\s*:\s*\{/)
    if (!localesMatch || localesMatch.index === undefined) continue

    const localesBraceIdx = pluginBody.indexOf('{', localesMatch.index + localesMatch[0].length - 1)
    const localesCloseIdx = findMatchingClose(pluginBody, localesBraceIdx)
    if (localesCloseIdx === -1) continue

    const localesBody = pluginBody.slice(localesBraceIdx + 1, localesCloseIdx)
    const fileDir = dirname(file)

    // ── Collect all locale codes ─────────────────────────────────────────────
    const codeRE = /(?:^|,|\n)\s*(?:['"]?)([a-z]{2,3}(?:-[A-Za-z]{2,4})?)(?:['"]?)\s*:/gm
    const results: DiscoveredLocale[] = []
    let m: RegExpExecArray | null

    while ((m = codeRE.exec(localesBody)) !== null) {
      const code = m[1]
      const valueText = getLocaleValueText(localesBody, code)
      if (!valueText) continue

      // Extract import path: import('./locales/en.json')
      const importMatch = valueText.match(/import\s*\(\s*(['"`])([^'"`\n]+)\1\s*\)/)
      if (!importMatch) continue // inline messages object — no file, skip

      const importStr = importMatch[2]
      const absolutePath = resolve(fileDir, importStr)

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

// ── vite.config modification ──────────────────────────────────────────────────

const VITE_CONFIG_NAMES = [
  'vite.config.ts', 'vite.config.js', 'vite.config.mts', 'vite.config.mjs',
]

function findViteConfig(cwd: string): string | null {
  for (const name of VITE_CONFIG_NAMES) {
    const p = join(cwd, name)
    if (existsSync(p)) return p
  }
  return null
}

function buildPluginCall(locales: DiscoveredLocale[]): string {
  const entries = locales.map(l => {
    const metaPart = l.meta && Object.keys(l.meta).length > 0
      ? `, meta: ${serializeMeta(l.meta)}`
      : ''
    return `        ${l.code}: { path: '${l.relativePath}'${metaPart} },`
  }).join('\n')
  return `vueI18nMapPlugin({\n      locales: {\n${entries}\n      },\n    })`
}

export function updateViteConfig(configPath: string, locales: DiscoveredLocale[]): void {
  let content = readFileSync(configPath, 'utf-8')
  const pluginCall = buildPluginCall(locales)
  const hasImport = content.includes("from 'vue-i18n-kit/vite'")
    || content.includes('from "vue-i18n-kit/vite"')

  const pluginCallIdx = content.indexOf('vueI18nMapPlugin(')

  if (pluginCallIdx !== -1) {
    // Plugin already present — replace the entire call
    const openParenIdx = pluginCallIdx + 'vueI18nMapPlugin'.length
    const closeIdx = findMatchingClose(content, openParenIdx)
    if (closeIdx === -1) {
      console.warn('[vue-i18n-kit] Could not parse vueI18nMapPlugin call — skipping vite config update')
      return
    }
    content = content.slice(0, pluginCallIdx) + pluginCall + content.slice(closeIdx + 1)
  } else {
    // Plugin absent — add import + insert into plugins: [
    if (!hasImport) {
      const importMatches = [...content.matchAll(/^import .+$/gm)]
      if (importMatches.length > 0) {
        const last = importMatches[importMatches.length - 1]
        const insertAt = last.index! + last[0].length
        content =
          content.slice(0, insertAt) +
          "\nimport { vueI18nMapPlugin } from 'vue-i18n-kit/vite'" +
          content.slice(insertAt)
      } else {
        content = "import { vueI18nMapPlugin } from 'vue-i18n-kit/vite'\n\n" + content
      }
    }

    const pluginsMatch = content.match(/plugins\s*:\s*\[/)
    if (!pluginsMatch || pluginsMatch.index === undefined) {
      console.warn('[vue-i18n-kit] Could not find plugins: [ in vite config — skipping auto-insert')
      printManualInstructions(locales)
      return
    }

    const bracketIdx = pluginsMatch.index + pluginsMatch[0].length - 1 // points to '['
    const closeBracketIdx = findMatchingClose(content, bracketIdx)
    if (closeBracketIdx === -1) {
      console.warn('[vue-i18n-kit] Could not find closing ] of plugins array — skipping auto-insert')
      printManualInstructions(locales)
      return
    }

    // Find the start of the line that contains the closing ] and insert before it
    let insertPos = closeBracketIdx
    while (insertPos > 0 && content[insertPos - 1] !== '\n') insertPos--
    content = content.slice(0, insertPos) + '    ' + pluginCall + ',\n' + content.slice(insertPos)
  }

  writeFileSync(configPath, content, 'utf-8')
}

// ── Console instructions fallback ─────────────────────────────────────────────

function printManualInstructions(locales: DiscoveredLocale[]): void {
  const entries = locales.map(l => {
    const metaPart = l.meta && Object.keys(l.meta).length > 0
      ? `, meta: ${serializeMeta(l.meta)}`
      : ''
    return `      ${l.code}: { path: '${l.relativePath}'${metaPart} },`
  }).join('\n')
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

// ── Main entry point ──────────────────────────────────────────────────────────

export function runAutoConfig(cwd: string): void {
  // 1. Discover locales from createVueI18nPlugin — the single source of truth
  const locales = discoverLocales(cwd)

  if (locales.length === 0) {
    console.error(
      '[vue-i18n-kit] Could not find createVueI18nPlugin(...) with locale file imports.\n' +
      '  Make sure your app calls app.use(createVueI18nPlugin({ locales: { ... } }))\n' +
      '  with at least one locale using a lazy loader: () => import(\'./locales/en.json\')',
    )
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

  // 4. Update vite.config (or print instructions if not found)
  const configPath = findViteConfig(cwd)

  if (!configPath) {
    console.log('\n[vue-i18n-kit] vite.config.ts not found.')
    printManualInstructions(locales)
    return
  }

  updateViteConfig(configPath, locales)
  const relConfig = relative(cwd, configPath).replace(/\\/g, '/')
  console.log(`[vue-i18n-kit] Updated ${relConfig}`)
  console.log('\n[vue-i18n-kit] Done. Run: vue-i18n-kit ui')
}
