import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { readConfig } from '../../config/index.js'

export interface StaleOptions {
  /** Locales directory */
  dir?: string
  /** Reference locale code */
  locale?: string
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

export function hashValue(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 8)
}

export function runStale(options: StaleOptions = {}): void {
  const cwd = process.cwd()
  const config = readConfig(cwd)

  const dir = resolve(cwd, options.dir ?? config?.localesDir ?? 'src/locales')
  if (!existsSync(dir)) {
    console.error(`✗ Locales directory not found: ${dir}`)
    process.exit(1)
  }

  // Resolve reference locale
  const refCode = options.locale
    ?? config?.locales[0]?.code
    ?? readdirSync(dir).filter(f => f.endsWith('.json')).sort()[0]?.slice(0, -5)
  if (!refCode) { console.error('✗ No locale files found'); process.exit(1) }

  // Read reference locale
  const refPath = config?.locales.find(l => l.code === refCode)?.path
    ? resolve(cwd, config!.locales.find(l => l.code === refCode)!.path)
    : join(dir, `${refCode}.json`)

  if (!existsSync(refPath)) { console.error(`✗ Reference locale not found: ${refPath}`); process.exit(1) }

  const refFlat = flattenKeys(JSON.parse(readFileSync(refPath, 'utf-8')) as Record<string, unknown>)

  // Read stored hashes
  const notesPath = join(cwd, 'i18n-kit.notes.json')
  let notes: Record<string, string> = {}
  if (existsSync(notesPath)) {
    try { notes = JSON.parse(readFileSync(notesPath, 'utf-8')) as Record<string, string> } catch { /* ignore */ }
  }

  // Find stale keys — stored hash doesn't match current reference value
  const staleKeys: string[] = []
  for (const [key, value] of Object.entries(refFlat)) {
    const hashKey = `_hash.${key}`
    if (notes[hashKey] && notes[hashKey] !== hashValue(value)) {
      staleKeys.push(key)
    }
  }

  if (!staleKeys.length) {
    console.log('✓ No stale keys found — all translations are up-to-date.')
    return
  }

  // Count which non-reference locales have this key translated
  const otherLocales = (config?.locales ?? [])
    .filter(l => l.code !== refCode)
    .map(l => ({ code: l.code, flat: flattenKeys(JSON.parse(existsSync(resolve(cwd, l.path)) ? readFileSync(resolve(cwd, l.path), 'utf-8') : '{}') as Record<string, unknown>) }))

  console.log(`\n⚠  ${staleKeys.length} stale key${staleKeys.length > 1 ? 's' : ''} (reference value changed):\n`)
  for (const key of staleKeys) {
    const affected = otherLocales.filter(l => l.flat[key] !== undefined && l.flat[key] !== '').map(l => l.code)
    const affectedStr = affected.length ? `  → affects: ${affected.join(', ')}` : ''
    console.log(`  - ${key}${affectedStr}`)
  }
  console.log()
}
