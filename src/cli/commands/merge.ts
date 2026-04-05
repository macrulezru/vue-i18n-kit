import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

export interface MergeOptions {
  /** Source JSON file to merge from */
  source: string
  /** Locales directory */
  dir: string
  /** Only merge into this locale code; omit to merge into all */
  locale?: string
  /** Overwrite existing keys (default: false — only add missing keys) */
  overwrite?: boolean
  /** Preview changes without writing files */
  dry?: boolean
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  overwrite: boolean,
): { merged: Record<string, unknown>; added: number; skipped: number } {
  let added = 0
  let skipped = 0

  function walk(t: Record<string, unknown>, s: Record<string, unknown>): void {
    for (const [k, v] of Object.entries(s)) {
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        if (typeof t[k] !== 'object' || t[k] === null) t[k] = {}
        walk(t[k] as Record<string, unknown>, v as Record<string, unknown>)
      } else {
        if (k in t) {
          if (overwrite) { t[k] = v; added++ } else { skipped++ }
        } else {
          t[k] = v; added++
        }
      }
    }
  }

  const merged = JSON.parse(JSON.stringify(target)) as Record<string, unknown>
  walk(merged, source)
  return { merged, added, skipped }
}

export function runMerge(options: MergeOptions): void {
  const { source, dir, locale, overwrite = false, dry = false } = options

  const sourcePath = resolve(source)
  if (!existsSync(sourcePath)) {
    console.error(`✗ Source file not found: ${sourcePath}`)
    process.exit(1)
  }

  let sourceData: Record<string, unknown>
  try {
    sourceData = JSON.parse(readFileSync(sourcePath, 'utf-8')) as Record<string, unknown>
  } catch {
    console.error(`✗ Failed to parse: ${sourcePath}`)
    process.exit(1)
  }

  if (!existsSync(dir)) {
    console.error(`✗ Locales directory not found: ${dir}`)
    process.exit(1)
  }

  const targets = locale
    ? [`${locale}.json`]
    : readdirSync(dir).filter(f => f.endsWith('.json'))

  if (!targets.length) {
    console.log('Nothing to merge — no locale files found.')
    return
  }

  let anyChanged = false

  for (const file of targets) {
    const filePath = join(dir, file)
    const code = file.slice(0, -5)

    let target: Record<string, unknown> = {}
    if (existsSync(filePath)) {
      try {
        target = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, unknown>
      } catch {
        console.error(`  ✗ Failed to parse ${file}, skipping`)
        continue
      }
    }

    const { merged, added, skipped } = deepMerge(target, sourceData, overwrite)

    if (added === 0 && skipped === 0) {
      console.log(`  ○ ${code}: nothing to merge`)
      continue
    }

    anyChanged = true
    const status = dry ? '[dry]' : ''
    console.log(`  ${dry ? '~' : '✓'} ${code}: +${added} added, ${skipped} skipped ${status}`)

    if (!dry) {
      writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf-8')
    }
  }

  if (!anyChanged) {
    console.log('✓ All locales already up-to-date.')
  } else if (dry) {
    console.log('\nDry run — no files were written. Remove --dry to apply.')
  } else {
    console.log('\n✓ Merge complete.')
  }
}
