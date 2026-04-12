import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { readConfig } from '../../config/index.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function sortObjectKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(obj).sort())
    sorted[key] = (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key]))
      ? sortObjectKeys(obj[key] as Record<string, unknown>) : obj[key]
  return sorted
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function runMergeNs(options: {
  dir?: string
  out?: string
  dry?: boolean
  noSort?: boolean
  cwd?: string
}): void {
  const cwd = options.cwd ?? process.cwd()
  const config = readConfig(cwd)
  const dir = options.dir ?? `${config?.localesDir ?? 'src/locales'}/split`
  const out = options.out ?? config?.localesDir ?? 'src/locales'
  const dry = options.dry ?? false
  const noSort = options.noSort ?? false

  const absDir = resolve(cwd, dir)
  const absOut = resolve(cwd, out)

  if (!existsSync(absDir)) {
    console.error(`[merge-ns] Directory not found: ${dir}`)
    process.exit(1)
  }

  // Find locale subdirectories (each is a locale code)
  const localeDirs = readdirSync(absDir).filter(entry => {
    const fullPath = join(absDir, entry)
    return statSync(fullPath).isDirectory()
  })

  if (localeDirs.length === 0) {
    console.error(`[merge-ns] No locale subdirectories found in ${dir}`)
    process.exit(1)
  }

  let totalLocales = 0
  let totalKeys = 0

  for (const code of localeDirs) {
    const localeDir = join(absDir, code)
    const nsFiles = readdirSync(localeDir).filter(f => f.endsWith('.json'))

    if (nsFiles.length === 0) continue

    // Merge all namespaces into a single object
    const merged: Record<string, unknown> = {}

    for (const nsFile of nsFiles.sort()) {
      const ns = nsFile.replace(/\.json$/, '')
      const content = JSON.parse(readFileSync(join(localeDir, nsFile), 'utf-8')) as Record<string, unknown>

      if (ns === '_root') {
        // Flat keys at root level
        Object.assign(merged, content)
      } else {
        merged[ns] = content
      }
    }

    const final = noSort ? merged : sortObjectKeys(merged)
    const outFile = join(absOut, `${code}.json`)
    const outRel = `${out}/${code}.json`

    const keyCount = Object.keys(merged).length

    if (dry) {
      console.log(`  [dry] would write ${outRel}  (${keyCount} top-level keys)`)
    } else {
      writeFileSync(outFile, JSON.stringify(final, null, 2) + '\n', 'utf-8')
      console.log(`  ✓  ${outRel}`)
    }

    totalLocales++
    totalKeys += keyCount
  }

  if (totalLocales === 0) {
    console.log('[merge-ns] Nothing to merge.')
    return
  }

  if (dry) {
    console.log(`\n[merge-ns] Dry run — would merge ${totalLocales} locale(s) → ${out}`)
  } else {
    console.log(`\n[merge-ns] Done — merged ${totalLocales} locale(s) into ${out}`)
  }
}
