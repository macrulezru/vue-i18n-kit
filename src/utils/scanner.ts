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

/**
 * Converts a glob pattern (with / separators and * / **) to a RegExp
 * for matching relative file paths.
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*\//g, '(.+/)?')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
  return new RegExp('^' + escaped + '(/.*)?$')
}

function isExcludedPath(relPath: string, excludePatterns: string[]): boolean {
  return excludePatterns.some(p => globToRegex(p).test(relPath))
}

export function scanFiles(dir: string, root?: string, excludePatterns: string[] = []): string[] {
  const scanRoot = root ?? dir
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = join(dir, entry.name)
    const relPath = relative(scanRoot, entryPath).replace(/\\/g, '/')
    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry.name) && !isExcludedPath(relPath, excludePatterns)) {
        results.push(...scanFiles(entryPath, scanRoot, excludePatterns))
      }
    } else if (entry.isFile()) {
      if (isExcludedPath(relPath, excludePatterns)) continue
      const dotIdx = entry.name.lastIndexOf('.')
      if (dotIdx !== -1 && SCAN_EXTENSIONS.has(entry.name.slice(dotIdx))) {
        results.push(entryPath)
      }
    }
  }
  return results
}

export function buildEntriesMap(root: string, excludePatterns: string[] = []): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  const files = scanFiles(root, root, excludePatterns)

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
