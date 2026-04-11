import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { readConfig } from '../../config/index.js'

export type ExportFormat = 'xliff' | 'po'

export interface ExportOptions {
  /** Output format */
  format?: ExportFormat
  /** Locale code to export */
  locale: string
  /** Output file path */
  out?: string
  /** Locales directory */
  dir?: string
  /** Reference locale for source strings */
  referenceLocale?: string
}

function flattenKeys(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(result, flattenKeys(v as Record<string, unknown>, full))
    } else {
      result[full] = v != null ? String(v) : ''
    }
  }
  return result
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildXliff(
  locale: string,
  sourceLocale: string,
  sourceFlat: Record<string, string>,
  targetFlat: Record<string, string>,
  notes: Record<string, string>,
): string {
  const units = Object.entries(sourceFlat).map(([key, source]) => {
    const target = targetFlat[key] ?? ''
    const state = target ? 'translated' : 'needs-translation'
    const noteStr = notes[key] ? `\n      <note>${escapeXml(notes[key])}</note>` : ''
    return [
      `    <trans-unit id="${escapeXml(key)}" resname="${escapeXml(key)}">`,
      `      <source>${escapeXml(source)}</source>`,
      `      <target state="${state}">${escapeXml(target)}</target>${noteStr}`,
      `    </trans-unit>`,
    ].join('\n')
  }).join('\n')

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">`,
    `  <file original="locale.json" source-language="${escapeXml(sourceLocale)}" target-language="${escapeXml(locale)}" datatype="plaintext">`,
    `    <body>`,
    units,
    `    </body>`,
    `  </file>`,
    `</xliff>`,
    '',
  ].join('\n')
}

function buildPo(
  locale: string,
  sourceLocale: string,
  sourceFlat: Record<string, string>,
  targetFlat: Record<string, string>,
  notes: Record<string, string>,
): string {
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const header = [
    `# vue-i18n-kit export — ${locale}`,
    `# Source language: ${sourceLocale}`,
    `msgid ""`,
    `msgstr ""`,
    `"Content-Type: text/plain; charset=UTF-8\\n"`,
    `"Content-Transfer-Encoding: 8bit\\n"`,
    `"Language: ${locale}\\n"`,
    `"PO-Revision-Date: ${now}\\n"`,
    `"Generated-By: vue-i18n-kit\\n"`,
    '',
  ].join('\n')

  const entries = Object.entries(sourceFlat).map(([key, source]) => {
    const target = targetFlat[key] ?? ''
    const noteStr = notes[key] ? `#. ${notes[key].replace(/\n/g, '\n#. ')}\n` : ''
    const ctxStr = `msgctxt ${JSON.stringify(key)}\n`
    return `${noteStr}${ctxStr}msgid ${JSON.stringify(source)}\nmsgstr ${JSON.stringify(target)}\n`
  }).join('\n')

  return header + entries
}

export function runExport(options: ExportOptions): void {
  const cwd = process.cwd()
  const config = readConfig(cwd)
  const format: ExportFormat = options.format ?? 'xliff'
  const dir = resolve(cwd, options.dir ?? config?.localesDir ?? 'src/locales')

  // Resolve target locale path
  const targetLocalePath = config?.locales.find(l => l.code === options.locale)?.path
    ? resolve(cwd, config!.locales.find(l => l.code === options.locale)!.path)
    : join(dir, `${options.locale}.json`)

  if (!existsSync(targetLocalePath)) {
    console.error(`✗ Locale file not found: ${targetLocalePath}`)
    process.exit(1)
  }

  // Resolve reference/source locale
  const refCode = options.referenceLocale ?? config?.locales[0]?.code ?? options.locale
  const refPath = config?.locales.find(l => l.code === refCode)?.path
    ? resolve(cwd, config!.locales.find(l => l.code === refCode)!.path)
    : join(dir, `${refCode}.json`)

  const sourceFlat = existsSync(refPath)
    ? flattenKeys(JSON.parse(readFileSync(refPath, 'utf-8')) as Record<string, unknown>)
    : {}
  const targetFlat = flattenKeys(JSON.parse(readFileSync(targetLocalePath, 'utf-8')) as Record<string, unknown>)

  // Load notes for context
  const notesPath = join(cwd, 'i18n-kit.notes.json')
  let notes: Record<string, string> = {}
  try {
    if (existsSync(notesPath)) notes = JSON.parse(readFileSync(notesPath, 'utf-8')) as Record<string, string>
    // Remove internal _hash.* entries
    notes = Object.fromEntries(Object.entries(notes).filter(([k]) => !k.startsWith('_hash.')))
  } catch { /* ignore */ }

  const ext = format === 'po' ? 'po' : 'xliff'
  const outPath = resolve(cwd, options.out ?? `${options.locale}.${ext}`)

  const content = format === 'po'
    ? buildPo(options.locale, refCode, sourceFlat, targetFlat, notes)
    : buildXliff(options.locale, refCode, sourceFlat, targetFlat, notes)

  writeFileSync(outPath, content, 'utf-8')

  const relOut = outPath.replace(cwd, '').replace(/\\/g, '/').replace(/^\//, '')
  const total = Object.keys(sourceFlat).length
  const translated = Object.values(targetFlat).filter(Boolean).length
  console.log(`✓ Exported ${relOut} — ${translated}/${total} translated (${format.toUpperCase()})`)
}
