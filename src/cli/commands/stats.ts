import { readFileSync, existsSync, readdirSync, writeFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { readConfig } from '../../config/index.js'

export interface StatsOptions {
  /** Output format: 'console' (default) | 'json' | 'html' */
  format?: 'console' | 'json' | 'html'
  /** Output file path (for json/html). Defaults to stdout / stats.html */
  out?: string
  /** Locales directory (fallback when no config) */
  dir?: string
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function flattenKeys(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v))
      Object.assign(result, flattenKeys(v as Record<string, unknown>, full))
    else
      result[full] = v != null ? String(v) : ''
  }
  return result
}

function readJson<T>(path: string): T | null {
  try { return JSON.parse(readFileSync(path, 'utf-8')) as T } catch { return null }
}

function bar(pct: number, width = 20): string {
  const filled = Math.round((pct / 100) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function pad(s: string, n: number): string {
  return s + ' '.repeat(Math.max(0, n - s.length))
}

// ── Stats data model ──────────────────────────────────────────────────────────

interface LocaleStat {
  code: string
  display: string
  flag: string
  total: number
  filled: number
  empty: number
  missing: number
  coverage: number
  bytes: number
}

interface NamespaceStat {
  name: string
  keys: number
  bytes: number
  byLocale: Record<string, number>
}

interface StatsReport {
  generated: string
  totalKeys: number
  locales: LocaleStat[]
  namespaces: NamespaceStat[]
  phantom: number
  unused: number
}

// ── Data collection ───────────────────────────────────────────────────────────

export function collectStats(cwd: string, dir?: string): StatsReport {
  const config = readConfig(cwd)
  const localesDir = resolve(cwd, dir ?? config?.localesDir ?? 'src/locales')

  // Resolve locale list
  const localeConfigs: Array<{ code: string; path: string; display: string; flag: string }> = []
  if (config?.locales.length) {
    for (const l of config.locales) {
      localeConfigs.push({
        code: l.code,
        path: resolve(cwd, l.path),
        display: (l.meta?.display as string | undefined) ?? l.code,
        flag: (l.meta?.flag as string | undefined) ?? '',
      })
    }
  } else if (existsSync(localesDir)) {
    for (const f of readdirSync(localesDir).filter(f => f.endsWith('.json')).sort()) {
      const code = f.slice(0, -5)
      localeConfigs.push({ code, path: join(localesDir, f), display: code, flag: '' })
    }
  }

  if (!localeConfigs.length) {
    console.error('✗ No locale files found')
    process.exit(1)
  }

  // Read all flattened locales
  const flats: Record<string, Record<string, string>> = {}
  const bytes: Record<string, number> = {}
  for (const l of localeConfigs) {
    if (!existsSync(l.path)) { flats[l.code] = {}; bytes[l.code] = 0; continue }
    const raw = readJson<Record<string, unknown>>(l.path) ?? {}
    flats[l.code] = flattenKeys(raw)
    bytes[l.code] = statSync(l.path).size
  }

  // All known keys = union of all locale keys
  const allKeysSet = new Set<string>()
  for (const flat of Object.values(flats))
    for (const k of Object.keys(flat)) allKeysSet.add(k)
  const allKeys = [...allKeysSet].sort()

  // Entries map (for phantom / unused)
  const entriesPath = join(cwd, 'i18n-tools', 'locales.entries.json')
  const entries = existsSync(entriesPath)
    ? (readJson<Record<string, string[]>>(entriesPath) ?? {})
    : {}
  const entryKeys = new Set(Object.keys(entries))
  const phantomCount = [...entryKeys].filter(k => !allKeysSet.has(k)).length
  const unusedCount = allKeys.filter(k => entryKeys.size > 0 && !entryKeys.has(k)).length

  // Per-locale stats
  const localeStats: LocaleStat[] = localeConfigs.map(l => {
    const flat = flats[l.code]
    const filled = allKeys.filter(k => flat[k] !== undefined && flat[k] !== '').length
    const empty  = allKeys.filter(k => flat[k] !== undefined && flat[k] === '').length
    const missing = allKeys.length - filled - empty
    return {
      code: l.code, display: l.display, flag: l.flag,
      total: allKeys.length, filled, empty, missing,
      coverage: allKeys.length ? Math.round((filled / allKeys.length) * 100) : 100,
      bytes: bytes[l.code],
    }
  })

  // Namespace stats
  const nsMap = new Map<string, string[]>()
  for (const key of allKeys) {
    const dot = key.indexOf('.')
    const ns = dot === -1 ? '(root)' : key.slice(0, dot)
    if (!nsMap.has(ns)) nsMap.set(ns, [])
    nsMap.get(ns)!.push(key)
  }

  const namespaces: NamespaceStat[] = [...nsMap.entries()].map(([name, keys]) => {
    const byLocale: Record<string, number> = {}
    for (const l of localeConfigs) {
      const filled = keys.filter(k => flats[l.code][k] !== undefined && flats[l.code][k] !== '').length
      byLocale[l.code] = keys.length ? Math.round((filled / keys.length) * 100) : 100
    }
    const nsBytes = localeConfigs.reduce((sum, l) => {
      const nsRaw = keys.reduce((acc, k) => acc + (flats[l.code][k]?.length ?? 0), 0)
      return sum + nsRaw
    }, 0)
    return { name, keys: keys.length, bytes: nsBytes, byLocale }
  }).sort((a, b) => {
    const avgA = Object.values(a.byLocale).reduce((s, v) => s + v, 0) / localeConfigs.length
    const avgB = Object.values(b.byLocale).reduce((s, v) => s + v, 0) / localeConfigs.length
    return avgA - avgB
  })

  return {
    generated: new Date().toISOString(),
    totalKeys: allKeys.length,
    locales: localeStats,
    namespaces,
    phantom: phantomCount,
    unused: unusedCount,
  }
}

// ── Console renderer ──────────────────────────────────────────────────────────

function renderConsole(r: StatsReport): string {
  const lines: string[] = []
  const CYAN   = '\x1b[36m'
  const GREEN  = '\x1b[32m'
  const YELLOW = '\x1b[33m'
  const RED    = '\x1b[31m'
  const DIM    = '\x1b[2m'
  const BOLD   = '\x1b[1m'
  const RESET  = '\x1b[0m'

  lines.push('')
  lines.push(`${BOLD}  vue-i18n-kit stats${RESET}  ${DIM}${r.generated.slice(0, 10)}${RESET}`)
  lines.push(`  ${DIM}${r.totalKeys} keys · ${r.locales.length} locales${RESET}`)
  lines.push('')

  // Coverage per locale
  lines.push(`${BOLD}  Coverage${RESET}`)
  const maxDisplay = Math.max(...r.locales.map(l => `${l.flag} ${l.display} (${l.code})`.length))
  for (const l of r.locales) {
    const label = pad(`${l.flag} ${l.display} (${l.code})`, maxDisplay + 2)
    const pctStr = pad(`${l.coverage}%`, 5)
    const color = l.coverage === 100 ? GREEN : l.coverage >= 80 ? CYAN : l.coverage >= 50 ? YELLOW : RED
    const missingStr = l.missing > 0 ? `  ${DIM}${l.missing} missing${RESET}` : ''
    const emptyStr   = l.empty > 0   ? `  ${DIM}${l.empty} empty${RESET}` : ''
    lines.push(`  ${label}  ${color}${bar(l.coverage)}${RESET}  ${color}${pctStr}${RESET}${missingStr}${emptyStr}`)
  }
  lines.push('')

  // Namespace breakdown
  lines.push(`${BOLD}  By namespace${RESET}`)
  const maxNs = Math.max(...r.namespaces.map(n => n.name.length), 4)
  const codeHeader = r.locales.map(l => pad(l.code, 7)).join('')
  lines.push(`  ${pad('namespace', maxNs + 2)}  ${pad('keys', 6)}  ${DIM}${codeHeader}${RESET}`)
  for (const ns of r.namespaces) {
    const rowParts = r.locales.map(l => {
      const p = ns.byLocale[l.code] ?? 0
      const color = p === 100 ? GREEN : p >= 80 ? CYAN : p >= 50 ? YELLOW : RED
      return `${color}${pad(p + '%', 7)}${RESET}`
    }).join('')
    const kbStr = `${DIM}(${Math.ceil(ns.bytes / 1024)}kb)${RESET}`
    lines.push(`  ${pad(ns.name, maxNs + 2)}  ${pad(String(ns.keys), 6)}  ${rowParts}${kbStr}`)
  }
  lines.push('')

  // Issues
  const issues: string[] = []
  const totalMissing = r.locales.reduce((s, l) => s + l.missing, 0)
  const totalEmpty   = r.locales.reduce((s, l) => s + l.empty,   0)
  if (totalMissing) issues.push(`${YELLOW}${totalMissing} missing${RESET}`)
  if (totalEmpty)   issues.push(`${DIM}${totalEmpty} empty${RESET}`)
  if (r.phantom)    issues.push(`${RED}${r.phantom} phantom${RESET} ${DIM}(used in code, absent from files)${RESET}`)
  if (r.unused)     issues.push(`${DIM}${r.unused} unused${RESET} ${DIM}(in files but not in code)${RESET}`)

  if (issues.length) {
    lines.push(`${BOLD}  Issues${RESET}`)
    for (const i of issues) lines.push(`  • ${i}`)
    lines.push('')
  } else {
    lines.push(`  ${GREEN}✓ No issues${RESET}`)
    lines.push('')
  }

  return lines.join('\n')
}

// ── HTML renderer ─────────────────────────────────────────────────────────────

function renderHtml(r: StatsReport): string {
  const pctColor = (p: number) => p === 100 ? '#22c55e' : p >= 80 ? '#818cf8' : p >= 50 ? '#f59e0b' : '#ef4444'

  const localeRows = r.locales.map(l => {
    const col = pctColor(l.coverage)
    const missingBadge = l.missing > 0
      ? `<span style="color:#f59e0b;font-size:11px">${l.missing} missing</span>` : ''
    const emptyBadge = l.empty > 0
      ? `<span style="color:#71717a;font-size:11px">${l.empty} empty</span>` : ''
    return `
      <tr>
        <td style="padding:8px 12px;white-space:nowrap">${l.flag} <strong>${l.display}</strong> <span style="color:#71717a">${l.code}</span></td>
        <td style="padding:8px 12px;width:40%">
          <div style="background:#27272a;border-radius:4px;height:8px;overflow:hidden">
            <div style="background:${col};width:${l.coverage}%;height:100%;border-radius:4px"></div>
          </div>
        </td>
        <td style="padding:8px 12px;color:${col};font-weight:600;text-align:right">${l.coverage}%</td>
        <td style="padding:8px 12px;color:#71717a;font-size:11px">${l.filled}/${l.total}</td>
        <td style="padding:8px 12px">${missingBadge} ${emptyBadge}</td>
      </tr>`
  }).join('')

  const nsRows = r.namespaces.map(ns => {
    const cells = r.locales.map(l => {
      const p = ns.byLocale[l.code] ?? 0
      const col = pctColor(p)
      return `<td style="padding:6px 12px;color:${col};text-align:center;font-weight:${p === 100 ? '400' : '600'}">${p}%</td>`
    }).join('')
    const kb = Math.ceil(ns.bytes / 1024) || '< 1'
    return `<tr>
      <td style="padding:6px 12px;font-family:monospace;font-size:12px">${ns.name}</td>
      <td style="padding:6px 12px;color:#71717a;text-align:center">${ns.keys}</td>
      <td style="padding:6px 12px;color:#71717a;text-align:center;font-size:11px">${kb}kb</td>
      ${cells}
    </tr>`
  }).join('')

  const localeHeaders = r.locales.map(l =>
    `<th style="padding:6px 12px;color:#71717a;font-weight:500;text-align:center">${l.flag} ${l.code}</th>`
  ).join('')

  const issues: string[] = []
  const totalMissing = r.locales.reduce((s, l) => s + l.missing, 0)
  if (totalMissing) issues.push(`<span style="color:#f59e0b">⚠ ${totalMissing} missing translations</span>`)
  if (r.phantom)    issues.push(`<span style="color:#ef4444">✗ ${r.phantom} phantom keys (used in code, not in files)</span>`)
  if (r.unused)     issues.push(`<span style="color:#71717a">◦ ${r.unused} unused keys</span>`)

  const issueBlock = issues.length
    ? `<div style="margin-top:24px;padding:16px;background:#1c1c1f;border:1px solid #27272a;border-radius:8px">
        <div style="font-weight:600;margin-bottom:8px;color:#d4d4d8">Issues</div>
        ${issues.map(i => `<div style="margin:4px 0;font-size:13px">${i}</div>`).join('')}
      </div>`
    : `<div style="margin-top:24px;padding:12px 16px;background:#052e16;border:1px solid #166534;border-radius:8px;color:#22c55e;font-size:13px">✓ No issues found</div>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>i18n Coverage Report — ${r.generated.slice(0, 10)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #09090b; color: #d4d4d8; padding: 32px; }
  h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  h2 { font-size: 14px; font-weight: 600; color: #a1a1aa; margin: 28px 0 12px; text-transform: uppercase; letter-spacing: .06em; }
  .meta { color: #52525b; font-size: 12px; margin-bottom: 28px; }
  table { width: 100%; border-collapse: collapse; background: #18181b; border: 1px solid #27272a; border-radius: 8px; overflow: hidden; font-size: 13px; }
  tr:not(:last-child) { border-bottom: 1px solid #27272a; }
  th { background: #18181b; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
  tr:hover { background: #1c1c1f; }
</style>
</head>
<body>
<h1>i18n Coverage Report</h1>
<p class="meta">Generated ${r.generated} · ${r.totalKeys} keys · ${r.locales.length} locales</p>

<h2>Coverage per locale</h2>
<table>
  <thead><tr>
    <th>Locale</th><th>Progress</th><th style="text-align:right">Coverage</th>
    <th>Filled / Total</th><th>Status</th>
  </tr></thead>
  <tbody>${localeRows}</tbody>
</table>

<h2>By namespace</h2>
<table>
  <thead><tr>
    <th>Namespace</th><th style="text-align:center">Keys</th><th style="text-align:center">Size</th>
    ${localeHeaders}
  </tr></thead>
  <tbody>${nsRows}</tbody>
</table>

${issueBlock}
</body>
</html>
`
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function runStats(options: StatsOptions = {}): void {
  const cwd = process.cwd()
  const format = options.format ?? 'console'
  const report = collectStats(cwd, options.dir)

  if (format === 'json') {
    const out = options.out
    if (out) {
      writeFileSync(out, JSON.stringify(report, null, 2) + '\n', 'utf-8')
      console.log(`✓ Stats written to ${out}`)
    } else {
      process.stdout.write(JSON.stringify(report, null, 2) + '\n')
    }
    return
  }

  if (format === 'html') {
    const out = options.out ?? 'i18n-stats.html'
    writeFileSync(out, renderHtml(report), 'utf-8')
    console.log(`✓ HTML report written to ${out}`)
    return
  }

  // Console (default)
  process.stdout.write(renderConsole(report))
}
