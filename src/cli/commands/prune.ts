import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { buildEntriesMap } from '../../utils/scanner.js'
import { matchesAnyPattern } from '../../utils/sort.js'
import { readConfig, getLockedKeys } from '../../config/index.js'

export interface PruneOptions {
  /** Locales directory */
  dir: string
  /** Project root — used for scanning source files */
  cwd: string
  /** Preview changes without writing files */
  dry?: boolean
  /** Skip confirmation prompt */
  yes?: boolean
  /** Path to pre-built entries JSON (skip scanning) */
  entriesFile?: string
  /** Keys to never remove, even if not found in code — supports glob */
  ignore?: string[]
}

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Record<string, unknown>, full))
    } else {
      keys.push(full)
    }
  }
  return keys
}

function deleteNestedKey(obj: Record<string, unknown>, path: string): void {
  const parts = path.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) return
    cur = cur[parts[i]] as Record<string, unknown>
  }
  delete cur[parts[parts.length - 1]]
}

function removeEmptyObjects(obj: Record<string, unknown>): void {
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      removeEmptyObjects(v as Record<string, unknown>)
      if (Object.keys(v as object).length === 0) delete obj[k]
    }
  }
}

export function runPrune(options: PruneOptions): void {
  const { dir, cwd, dry = false, entriesFile } = options

  // Merge ignore patterns from options and i18n-kit.config.json
  const config = readConfig(cwd)
  const lockedPatterns: string[] = config ? getLockedKeys(cwd, config) : []
  const ignorePatterns: string[] = [
    ...(options.ignore ?? []),
    ...(config?.ignore?.prune ?? []),
    ...lockedPatterns,
  ]

  if (!existsSync(dir)) {
    console.error(`✗ Locales directory not found: ${dir}`)
    process.exit(1)
  }

  // Build or load entries map
  let usedKeys: Set<string>
  if (entriesFile) {
    const ef = resolve(entriesFile)
    if (!existsSync(ef)) { console.error(`✗ Entries file not found: ${ef}`); process.exit(1) }
    const entries = JSON.parse(readFileSync(ef, 'utf-8')) as Record<string, string[]>
    usedKeys = new Set(Object.keys(entries))
  } else {
    console.log('Scanning source files…')
    const scanExclude = config?.ignore?.scanExclude ?? []
    const entries = buildEntriesMap(cwd, scanExclude)
    usedKeys = new Set(Object.keys(entries))
  }

  console.log(`Found ${usedKeys.size} keys in code.`)
  if (ignorePatterns.length) console.log(`Ignoring patterns: ${ignorePatterns.join(', ')}`)
  console.log()

  const files = readdirSync(dir).filter(f => f.endsWith('.json'))
  if (!files.length) { console.log('No locale files found.'); return }

  let totalRemoved = 0

  for (const file of files) {
    const code = file.slice(0, -5)
    const filePath = join(dir, file)

    let data: Record<string, unknown>
    try {
      data = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, unknown>
    } catch {
      console.error(`  ✗ Failed to parse ${file}, skipping`)
      continue
    }

    const allKeys = flattenKeys(data)
    const toRemove = allKeys.filter(k =>
      !usedKeys.has(k) && (ignorePatterns.length === 0 || !matchesAnyPattern(k, ignorePatterns))
    )

    if (!toRemove.length) {
      console.log(`  ○ ${code}: nothing to prune`)
      continue
    }

    totalRemoved += toRemove.length
    console.log(`  ${dry ? '~' : '✓'} ${code}: removing ${toRemove.length} unused key(s)`)
    for (const k of toRemove) console.log(`      - ${k}`)

    if (!dry) {
      for (const k of toRemove) deleteNestedKey(data, k)
      removeEmptyObjects(data)
      writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
    }
  }

  if (totalRemoved === 0) {
    console.log('\n✓ All keys are used — nothing pruned.')
  } else if (dry) {
    console.log(`\nDry run — ${totalRemoved} key(s) would be removed. Remove --dry to apply.`)
  } else {
    console.log(`\n✓ Pruned ${totalRemoved} unused key(s).`)
  }
}
