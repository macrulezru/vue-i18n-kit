import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { readConfig } from '../../config/index.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function flattenKeys(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v))
      Object.assign(result, flattenKeys(v as Record<string, unknown>, full))
    else result[full] = v != null ? String(v) : ''
  }
  return result
}

function setNested(obj: Record<string, unknown>, path: string, value: string): void {
  const parts = path.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {}
    cur = cur[parts[i]] as Record<string, unknown>
  }
  cur[parts[parts.length - 1]] = value
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function runSplit(options: {
  dir?: string
  out?: string
  dry?: boolean
  cwd?: string
}): void {
  const cwd = options.cwd ?? process.cwd()
  const config = readConfig(cwd)
  const dir = options.dir ?? config?.localesDir ?? 'src/locales'
  const out = options.out ?? `${dir}/split`
  const dry = options.dry ?? false

  const absDir = resolve(cwd, dir)
  const absOut = resolve(cwd, out)

  if (!existsSync(absDir)) {
    console.error(`[split] Directory not found: ${dir}`)
    process.exit(1)
  }

  const files = readdirSync(absDir).filter(f => f.endsWith('.json'))
  if (files.length === 0) {
    console.error(`[split] No JSON files found in ${dir}`)
    process.exit(1)
  }

  let totalNs = 0
  let totalFiles = 0

  for (const file of files) {
    const code = file.replace(/\.json$/, '')
    const raw = JSON.parse(readFileSync(join(absDir, file), 'utf-8')) as Record<string, unknown>

    // Group by top-level key (namespace)
    const namespaces = new Map<string, Record<string, unknown>>()
    for (const [topKey, value] of Object.entries(raw)) {
      const ns = topKey
      // Each top-level key becomes a namespace; its value may be nested or a string
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        namespaces.set(ns, value as Record<string, unknown>)
      } else {
        // Flat value — put under a special "_root" namespace
        const root = namespaces.get('_root') ?? {}
        root[ns] = value
        namespaces.set('_root', root)
      }
    }

    const localeOut = join(absOut, code)
    if (!dry) mkdirSync(localeOut, { recursive: true })

    for (const [ns, content] of namespaces) {
      const nsFile = join(localeOut, `${ns}.json`)
      const nsRel  = `${out}/${code}/${ns}.json`
      if (dry) {
        console.log(`  [dry] would write ${nsRel}  (${Object.keys(flattenKeys(content)).length} keys)`)
      } else {
        writeFileSync(nsFile, JSON.stringify(content, null, 2) + '\n', 'utf-8')
        console.log(`  ✓  ${nsRel}`)
      }
      totalNs++
    }
    totalFiles++
  }

  if (dry) {
    console.log(`\n[split] Dry run — ${totalFiles} locale(s), ${totalNs} namespace file(s) would be written.`)
  } else {
    console.log(`\n[split] Done — split ${totalFiles} locale(s) into ${totalNs} namespace file(s) → ${out}`)
  }
}
