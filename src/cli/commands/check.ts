import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { compareLocales } from '../../utils/localeKeys.js'

export interface CheckOptions {
  dir: string
  defaultLocale?: string
  fail: boolean
}

export function runCheck(options: CheckOptions): void {
  const { dir, fail } = options

  if (!existsSync(dir)) {
    console.error(`✗ Directory not found: ${dir}`)
    process.exit(1)
  }

  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()

  if (files.length < 2) {
    console.log('Nothing to check — fewer than 2 locale files found.')
    return
  }

  const locales: Record<string, Record<string, unknown>> = {}
  for (const file of files) {
    const locale = file.slice(0, -5)
    try {
      locales[locale] = JSON.parse(readFileSync(join(dir, file), 'utf-8')) as Record<string, unknown>
    } catch {
      console.error(`✗ Failed to parse: ${file}`)
    }
  }

  const refLocale = options.defaultLocale ?? files[0].slice(0, -5)
  const reference = locales[refLocale]

  if (!reference) {
    console.error(`✗ Reference locale "${refLocale}" not found.`)
    process.exit(1)
  }

  const others: Record<string, Record<string, unknown>> = {}
  for (const [name, msgs] of Object.entries(locales)) {
    if (name !== refLocale) others[name] = msgs
  }

  const mismatches = compareLocales(reference, others)

  if (mismatches.length === 0) {
    console.log(`✓ All locales are complete (reference: ${refLocale})`)
    return
  }

  process.stderr.write(`\n✗ Incomplete translations (reference: "${refLocale}"):\n\n`)

  for (const m of mismatches) {
    process.stderr.write(`  Locale "${m.locale}":\n`)
    if (m.missing.length) {
      process.stderr.write(`    Missing keys (${m.missing.length}):\n`)
      m.missing.forEach((k) => process.stderr.write(`      - ${k}\n`))
    }
    if (m.extra.length) {
      process.stderr.write(`    Extra keys (${m.extra.length}):\n`)
      m.extra.forEach((k) => process.stderr.write(`      + ${k}\n`))
    }
  }

  process.stderr.write('\n')

  if (fail) process.exit(1)
}
