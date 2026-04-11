import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve, extname } from 'node:path'
import { readConfig } from '../../config/index.js'
import { sortObjectKeys } from '../../utils/sort.js'

export interface ImportOptions {
  /** Path to XLIFF or PO file */
  file: string
  /** Locales directory */
  dir?: string
  /** Preview without writing */
  dry?: boolean
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: string): void {
  const parts = path.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {}
    cur = cur[parts[i]] as Record<string, unknown>
  }
  cur[parts[parts.length - 1]] = value
}

// ── XLIFF parser ──────────────────────────────────────────────────────────────

function parseXliff(content: string): { locale: string; translations: Record<string, string> } {
  const localeMatch = content.match(/target-language="([^"]+)"/)
  const locale = localeMatch?.[1] ?? ''

  const translations: Record<string, string> = {}
  const unitRe = /<trans-unit[^>]*\sid="([^"]+)"[\s\S]*?<\/trans-unit>/g
  let m: RegExpExecArray | null

  while ((m = unitRe.exec(content)) !== null) {
    const id = m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    const targetMatch = m[0].match(/<target[^>]*>([\s\S]*?)<\/target>/)
    if (targetMatch) {
      const value = targetMatch[1]
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      if (value) translations[id] = value
    }
  }

  return { locale, translations }
}

// ── PO parser ─────────────────────────────────────────────────────────────────

function unquotePo(s: string): string {
  return s.replace(/^"|"$/g, '').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
}

function parsePo(content: string): { locale: string; translations: Record<string, string> } {
  const localeMatch = content.match(/"Language:\s*([^\s\\]+)/)
  const locale = localeMatch?.[1] ?? ''

  const translations: Record<string, string> = {}
  const lines = content.split('\n')
  let ctx = ''; let msgstr = ''; let inMsgstr = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('msgctxt ')) {
      ctx = unquotePo(trimmed.slice(8).trim())
      msgstr = ''
      inMsgstr = false
    } else if (trimmed.startsWith('msgstr ')) {
      inMsgstr = true
      msgstr = unquotePo(trimmed.slice(7).trim())
    } else if (inMsgstr && trimmed.startsWith('"')) {
      msgstr += unquotePo(trimmed)
    } else if (trimmed === '' && ctx && msgstr) {
      translations[ctx] = msgstr
      ctx = ''; msgstr = ''; inMsgstr = false
    }
  }
  if (ctx && msgstr) translations[ctx] = msgstr

  return { locale, translations }
}

export function runImport(options: ImportOptions): void {
  const cwd = process.cwd()
  const config = readConfig(cwd)
  const filePath = resolve(cwd, options.file)

  if (!existsSync(filePath)) {
    console.error(`✗ File not found: ${filePath}`)
    process.exit(1)
  }

  const content = readFileSync(filePath, 'utf-8')
  const ext = extname(filePath).toLowerCase()

  const { locale, translations } = ext === '.po'
    ? parsePo(content)
    : parseXliff(content)

  if (!locale) {
    console.error('✗ Could not determine target locale from file. Check target-language / Language header.')
    process.exit(1)
  }

  if (!Object.keys(translations).length) {
    console.log('Nothing to import — no translated strings found in file.')
    return
  }

  // Find target locale file
  const dir = resolve(cwd, options.dir ?? config?.localesDir ?? 'src/locales')
  const localePath = config?.locales.find(l => l.code === locale)?.path
    ? resolve(cwd, config!.locales.find(l => l.code === locale)!.path)
    : join(dir, `${locale}.json`)

  let existing: Record<string, unknown> = {}
  if (existsSync(localePath)) {
    try {
      existing = JSON.parse(readFileSync(localePath, 'utf-8')) as Record<string, unknown>
    } catch {
      console.error(`✗ Failed to parse ${localePath}`)
      process.exit(1)
    }
  }

  let updated = 0
  for (const [key, value] of Object.entries(translations)) {
    setNestedValue(existing, key, value)
    updated++
  }

  if (options.dry) {
    console.log(`~ ${locale}: would update ${updated} key(s) [dry run]`)
    return
  }

  writeFileSync(localePath, JSON.stringify(sortObjectKeys(existing), null, 2) + '\n', 'utf-8')
  console.log(`✓ ${locale}: updated ${updated} key(s) from ${ext.slice(1).toUpperCase()} → ${localePath.replace(cwd, '').replace(/\\/g, '/').replace(/^\//, '')}`)
}
