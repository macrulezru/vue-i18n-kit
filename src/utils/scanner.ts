import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

export const SCAN_EXTENSIONS = new Set(['.vue', '.ts', '.tsx', '.js', '.jsx'])
export const EXCLUDE_DIRS = new Set([
  'node_modules', 'dist', '.git', 'i18n-tools',
  '.vite', 'coverage', '.nuxt', '.output', '.cache',
])

// Matches: t('key'), $t('key'), tm('key', ...) — not preceded by a letter
// to avoid false positives like fmt('...'), useT('...'), etc.
const KEY_RE = /(?<![a-zA-Z])(?:\$t|tm?)\s*\(\s*['"`]([^'"`\n]+)['"`]/g

export function scanFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry.name)) {
        results.push(...scanFiles(join(dir, entry.name)))
      }
    } else if (entry.isFile()) {
      const dotIdx = entry.name.lastIndexOf('.')
      if (dotIdx !== -1 && SCAN_EXTENSIONS.has(entry.name.slice(dotIdx))) {
        results.push(join(dir, entry.name))
      }
    }
  }
  return results
}

export function buildEntriesMap(root: string): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  const files = scanFiles(root)

  for (const file of files) {
    const content = readFileSync(file, 'utf-8')
    const relPath = relative(root, file).replace(/\\/g, '/')

    KEY_RE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = KEY_RE.exec(content)) !== null) {
      const key = match[1]
      if (!map[key]) map[key] = []
      if (!map[key].includes(relPath)) map[key].push(relPath)
    }
  }

  return Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)))
}
