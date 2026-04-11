import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync, watch as fsWatch } from 'node:fs'
import { join, extname, dirname, resolve } from 'node:path'
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readLocalesForServer, readConfig, writeConfig, readBaseLocales, getLockedKeys } from '../config/index.js'
import type { I18nKitRules, I18nKitIgnore } from '../config/index.js'

export interface UiServerOptions {
  cwd?: string
  port?: number
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
}

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
  res.end(JSON.stringify(data))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise(resolve => {
    let body = ''
    req.on('data', (c: Buffer) => { body += c.toString() })
    req.on('end', () => resolve(body))
  })
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: string): void {
  const parts = path.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {}
    cur = cur[parts[i]] as Record<string, unknown>
  }
  cur[parts[parts.length - 1]] = value
}

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const parts = path.split('.')
  let cur: unknown = obj
  for (const p of parts) { if (typeof cur !== 'object' || cur === null) return ''; cur = (cur as Record<string, unknown>)[p] }
  return cur != null ? String(cur) : ''
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

function hashValue(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 8)
}

function matchesLockedKey(flatKey: string, patterns: string[]): boolean {
  return patterns.some(p => {
    if (p === flatKey) return true
    if (p.endsWith('.*')) {
      const prefix = p.slice(0, -2)
      return flatKey === prefix || flatKey.startsWith(prefix + '.')
    }
    if (p.endsWith('.**')) return flatKey.startsWith(p.slice(0, -3) + '.')
    if (p === '**' || p === '*') return true
    if (p.includes('*')) {
      const re = new RegExp('^' + p.replace(/\./g, '\\.').replace(/\*/g, '[^.]*') + '$')
      return re.test(flatKey)
    }
    return false
  })
}

/** Encode all {…} blocks as <x id="N"/> XML tags so DeepL won't translate them */
function encodePlaceholders(text: string): { encoded: string; map: string[] } {
  const map: string[] = []
  let result = ''
  let i = 0
  while (i < text.length) {
    if (text[i] === '{') {
      let depth = 1; let j = i + 1
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth++
        else if (text[j] === '}') depth--
        j++
      }
      map.push(text.slice(i, j))
      result += `<x id="${map.length - 1}"/>`
      i = j
    } else {
      result += text[i++]
    }
  }
  return { encoded: result, map }
}

function decodePlaceholders(text: string, map: string[]): string {
  return text.replace(/<x id="(\d+)"\/>/g, (_, idx) => map[Number(idx)] ?? '')
}

function sortObjectKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(obj).sort())
    sorted[key] = (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key]))
      ? sortObjectKeys(obj[key] as Record<string, unknown>) : obj[key]
  return sorted
}

function serveFile(res: ServerResponse, filePath: string): boolean {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) return false
  const mime = MIME[extname(filePath)] ?? 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': mime })
  res.end(readFileSync(filePath))
  return true
}

export function startUiServer(options: UiServerOptions = {}): void {
  const { cwd = process.cwd(), port = 4173 } = options
  const publicDir  = join(__dirname, '..', 'ui-server', 'public')
  const notesPath  = join(cwd, 'i18n-kit.notes.json')
  const entriesPath = join(cwd, 'i18n-tools', 'locales.entries.json')

  const localesResult = readLocalesForServer(cwd)
  if (!localesResult) {
    console.error(`\n[vue-i18n-kit] No locale configuration found.\n\nRun: npx vue-i18n-kit init\n`)
    process.exit(1)
  }
  if (localesResult.source === 'legacy')
    console.log('[vue-i18n-kit] Using legacy config. Consider running  vue-i18n-kit init  to migrate.')

  const locales = localesResult.locales
  const baseLocales = localesResult.baseLocalesDir
    ? readBaseLocales(localesResult.baseLocalesDir)
    : {}

  // Load rules, ignore, lockedKeys from config
  const kitConfig = readConfig(cwd)
  const configRules: I18nKitRules = kitConfig?.rules ?? {}
  const configIgnore: I18nKitIgnore = kitConfig?.ignore ?? {}
  const lockedKeys: string[] = kitConfig ? getLockedKeys(cwd, kitConfig) : []
  const staleTracking: boolean = kitConfig?.staleTracking ?? false
  const referenceLocaleCode: string = locales[0]?.code ?? ''

  function deepMergeBase(base: Record<string, unknown>, project: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...base }
    for (const [k, v] of Object.entries(project)) {
      if (v !== null && typeof v === 'object' && !Array.isArray(v) &&
          result[k] !== null && typeof result[k] === 'object') {
        result[k] = deepMergeBase(result[k] as Record<string, unknown>, v as Record<string, unknown>)
      } else {
        result[k] = v
      }
    }
    return result
  }

  if (!existsSync(publicDir)) {
    console.error('\n[vue-i18n-kit] UI assets not found.\n')
    process.exit(1)
  }

  // ── SSE clients & broadcaster ─────────────────────────────────────────────

  const sseClients = new Set<ServerResponse>()

  function broadcast(event: object) {
    const msg = `data: ${JSON.stringify(event)}\n\n`
    for (const client of sseClients) {
      try { client.write(msg) } catch { sseClients.delete(client) }
    }
  }

  // Heartbeat every 25 s to keep connections alive through proxies
  setInterval(() => {
    for (const client of sseClients) {
      try { client.write(': heartbeat\n\n') } catch { sseClients.delete(client) }
    }
  }, 25_000)

  // Watch each locale file for external changes
  for (const locale of locales) {
    if (!existsSync(locale.path)) continue
    let debounce: ReturnType<typeof setTimeout> | null = null
    try {
      fsWatch(locale.path, () => {
        if (debounce) clearTimeout(debounce)
        debounce = setTimeout(() => broadcast({ type: 'locale-changed', code: locale.code }), 250)
      })
    } catch { /* watch not available on this platform */ }
  }

  // ── File helpers ──────────────────────────────────────────────────────────

  function readLocaleFile(path: string): Record<string, unknown> {
    return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
  }
  function writeLocaleFile(path: string, data: Record<string, unknown>): void {
    writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  }
  function readNotes(): Record<string, string> {
    if (!existsSync(notesPath)) return {}
    try { return JSON.parse(readFileSync(notesPath, 'utf-8')) as Record<string, string> } catch { return {} }
  }
  function writeNotes(notes: Record<string, string>): void {
    writeFileSync(notesPath, JSON.stringify(notes, null, 2) + '\n', 'utf-8')
  }

  // ── Request handler ───────────────────────────────────────────────────────

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const urlPath = (req.url ?? '/').split('?')[0]

    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE', 'Access-Control-Allow-Headers': 'Content-Type' })
      res.end(); return
    }

    // ── SSE ───────────────────────────────────────────────────────────────────
    if (urlPath === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no',
      })
      res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
      sseClients.add(res)
      req.on('close', () => sseClients.delete(res))
      return
    }

    // ── Config ────────────────────────────────────────────────────────────────
    if (urlPath === '/api/config') {
      json(res, { locales, cwd, rules: configRules, ignore: configIgnore, lockedKeys })
      return
    }

    // ── Add locale ────────────────────────────────────────────────────────────
    if (urlPath === '/api/locale/add' && req.method === 'POST') {
      try {
        const body = JSON.parse(await readBody(req)) as {
          code: string; path: string; display?: string; flag?: string
        }
        const { code, path: relPath, display, flag } = body
        if (!code || !relPath) { res.writeHead(400).end('Missing code or path'); return }
        if (locales.find(l => l.code === code)) { res.writeHead(409).end('Locale already exists'); return }

        const absPath = resolve(cwd, relPath)
        mkdirSync(dirname(absPath), { recursive: true })
        if (!existsSync(absPath)) writeFileSync(absPath, '{}\n', 'utf-8')

        // Update i18n-kit.config.json if present
        const config = readConfig(cwd)
        if (config) {
          const now = new Date().toISOString()
          config.locales.push({
            code, path: relPath,
            meta: { display: display ?? code, ...(flag ? { flag } : {}) },
            createdAt: now, updatedAt: now,
          })
          writeConfig(cwd, config)
        }

        // Add to in-memory list and start watching
        const newLocale = { code, path: absPath, meta: { display: display ?? code, ...(flag ? { flag } : {}) } }
        locales.push(newLocale)
        let debounce: ReturnType<typeof setTimeout> | null = null
        try {
          fsWatch(absPath, () => {
            if (debounce) clearTimeout(debounce)
            debounce = setTimeout(() => broadcast({ type: 'locale-changed', code }), 250)
          })
        } catch { /* watch not available */ }

        broadcast({ type: 'locale-added', code })
        json(res, { ok: true, locale: newLocale })
      } catch (e) {
        res.writeHead(500).end('Failed to add locale')
      }
      return
    }

    // ── Locale read/write ─────────────────────────────────────────────────────
    if (urlPath.startsWith('/api/locale/')) {
      const code = urlPath.slice('/api/locale/'.length)
      const locale = locales.find(l => l.code === code)
      if (!locale) { json(res, { error: `Locale "${code}" not found` }, 404); return }
      if (req.method === 'PUT') {
        try {
          const incoming = JSON.parse(await readBody(req)) as Record<string, unknown>
          if (lockedKeys.length) {
            const existingFlat = existsSync(locale.path)
              ? flattenKeys(JSON.parse(readFileSync(locale.path, 'utf-8')) as Record<string, unknown>)
              : {}
            const incomingFlat = flattenKeys(incoming)
            for (const key of Object.keys(incomingFlat)) {
              if (matchesLockedKey(key, lockedKeys) && incomingFlat[key] !== existingFlat[key]) {
                res.writeHead(403, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' })
                res.end(`Key "${key}" is locked by base dictionary`)
                return
              }
            }
          }
          writeLocaleFile(locale.path, incoming)

          // Stale tracking: when reference locale is saved, update key hashes
          if (staleTracking && code === referenceLocaleCode) {
            const flat = flattenKeys(incoming)
            const notes = readNotes()
            for (const [key, value] of Object.entries(flat)) {
              notes[`_hash.${key}`] = hashValue(value)
            }
            writeNotes(notes)
          }

          json(res, { ok: true })
        }
        catch (e) {
          if ((e as NodeJS.ErrnoException).code) res.writeHead(500).end('Failed to write locale file')
        }
        return
      }
      try {
        const projectData = existsSync(locale.path)
          ? JSON.parse(readFileSync(locale.path, 'utf-8')) as Record<string, unknown>
          : {}
        const base = baseLocales[code]
        const merged = base ? deepMergeBase(base, projectData) : projectData
        json(res, merged)
      }
      catch { res.writeHead(500).end('Failed to read locale file') }
      return
    }

    // ── Sort keys ─────────────────────────────────────────────────────────────
    if (urlPath === '/api/sort' && req.method === 'POST') {
      try {
        for (const locale of locales) {
          if (!existsSync(locale.path)) continue
          writeLocaleFile(locale.path, sortObjectKeys(readLocaleFile(locale.path)))
        }
        json(res, { ok: true })
      } catch { res.writeHead(500).end('Failed to sort keys') }
      return
    }

    // ── Translate proxy ───────────────────────────────────────────────────────
    if (urlPath === '/api/translate' && req.method === 'POST') {
      try {
        const body = JSON.parse(await readBody(req)) as {
          values: string[]; from: string; to: string
          engine?: string
          apiUrl?: string; apiKey?: string
          deeplKey?: string; formality?: string
        }
        const { values, from, to, engine, apiUrl, apiKey, deeplKey, formality } = body

        if (engine === 'deepl') {
          if (!deeplKey) { json(res, { error: 'DeepL API key is required' }, 400); return }
          // Free tier keys end with ":fx"; route accordingly
          const apiBase = deeplKey.endsWith(':fx')
            ? 'https://api-free.deepl.com'
            : 'https://api.deepl.com'

          const translations: string[] = []
          for (const text of values) {
            // Encode all {…} blocks as opaque XML tags so DeepL won't touch them
            const { encoded, map } = encodePlaceholders(text)

            const payload: Record<string, unknown> = {
              text: [encoded],
              source_lang: from.toUpperCase(),
              target_lang: to.toUpperCase(),
              tag_handling: 'xml',
              ignore_tags: ['x'],
            }
            if (formality && formality !== 'default') payload.formality = formality

            const dlRes = await fetch(`${apiBase}/v2/translate`, {
              method: 'POST',
              headers: {
                'Authorization': `DeepL-Auth-Key ${deeplKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload),
            })
            if (!dlRes.ok) {
              const errText = await dlRes.text()
              json(res, { error: `DeepL error ${dlRes.status}: ${errText}` }, 502); return
            }
            const data = await dlRes.json() as { translations: { text: string }[] }
            const translated = data.translations?.[0]?.text ?? text
            translations.push(decodePlaceholders(translated, map))
          }
          json(res, { translations })
        } else {
          // LibreTranslate (default)
          const ltUrl = apiUrl || 'https://libretranslate.com'
          const translations: string[] = []
          for (const text of values) {
            const ltRes = await fetch(`${ltUrl}/translate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ q: text, source: from, target: to, format: 'text', ...(apiKey ? { api_key: apiKey } : {}) }),
            })
            if (!ltRes.ok) { json(res, { error: `LibreTranslate error ${ltRes.status}` }, 502); return }
            const data = await ltRes.json() as { translatedText: string }
            translations.push(data.translatedText ?? text)
          }
          json(res, { translations })
        }
      } catch (e) { json(res, { error: String(e) }, 500) }
      return
    }

    // ── Batch delete ──────────────────────────────────────────────────────────
    if (urlPath === '/api/keys/batch-delete' && req.method === 'POST') {
      try {
        const { keys } = JSON.parse(await readBody(req)) as { keys: string[] }
        for (const locale of locales) {
          if (!existsSync(locale.path)) continue
          const raw = readLocaleFile(locale.path)
          for (const key of keys) deleteNestedKey(raw, key)
          writeLocaleFile(locale.path, raw)
        }
        json(res, { ok: true })
      } catch { res.writeHead(500).end('Failed to batch delete') }
      return
    }

    // ── Rename key ────────────────────────────────────────────────────────────
    if (urlPath.includes('/rename') && req.method === 'PUT') {
      const oldKey = decodeURIComponent(urlPath.slice('/api/key/'.length, urlPath.indexOf('/rename')))
      try {
        const { newKey } = JSON.parse(await readBody(req)) as { newKey: string }
        for (const locale of locales) {
          if (!existsSync(locale.path)) continue
          const raw = readLocaleFile(locale.path)
          setNestedValue(raw, newKey, getNestedValue(raw, oldKey))
          deleteNestedKey(raw, oldKey)
          writeLocaleFile(locale.path, raw)
        }
        if (existsSync(entriesPath)) {
          const e = JSON.parse(readFileSync(entriesPath, 'utf-8')) as Record<string, string[]>
          if (e[oldKey]) { e[newKey] = e[oldKey]; delete e[oldKey] }
          writeFileSync(entriesPath, JSON.stringify(e, null, 2) + '\n', 'utf-8')
        }
        json(res, { ok: true })
      } catch { res.writeHead(500).end('Failed to rename key') }
      return
    }

    // ── Duplicate key ─────────────────────────────────────────────────────────
    if (urlPath.includes('/duplicate') && req.method === 'POST') {
      const srcKey = decodeURIComponent(urlPath.slice('/api/key/'.length, urlPath.indexOf('/duplicate')))
      try {
        const { newKey } = JSON.parse(await readBody(req)) as { newKey: string }
        for (const locale of locales) {
          if (!existsSync(locale.path)) continue
          const raw = readLocaleFile(locale.path)
          setNestedValue(raw, newKey, getNestedValue(raw, srcKey))
          writeLocaleFile(locale.path, raw)
        }
        json(res, { ok: true })
      } catch { res.writeHead(500).end('Failed to duplicate key') }
      return
    }

    // ── Create key ────────────────────────────────────────────────────────────
    if (urlPath === '/api/key' && req.method === 'POST') {
      try {
        const { key, values } = JSON.parse(await readBody(req)) as { key: string; values: Record<string, string> }
        if (!key) { json(res, { error: 'key is required' }, 400); return }
        for (const locale of locales) {
          if (!existsSync(locale.path)) continue
          const raw = readLocaleFile(locale.path)
          setNestedValue(raw, key, values[locale.code] ?? '')
          writeLocaleFile(locale.path, raw)
        }
        json(res, { ok: true })
      } catch { res.writeHead(500).end('Failed to create key') }
      return
    }

    // ── Delete key ────────────────────────────────────────────────────────────
    if (urlPath.startsWith('/api/key/') && req.method === 'DELETE') {
      const key = decodeURIComponent(urlPath.slice('/api/key/'.length))
      try {
        for (const locale of locales) {
          if (!existsSync(locale.path)) continue
          const raw = readLocaleFile(locale.path)
          deleteNestedKey(raw, key)
          writeLocaleFile(locale.path, raw)
        }
        json(res, { ok: true })
      } catch { res.writeHead(500).end('Failed to delete key') }
      return
    }

    // ── Notes ─────────────────────────────────────────────────────────────────
    if (urlPath === '/api/notes') { json(res, readNotes()); return }
    if (urlPath.startsWith('/api/notes/') && req.method === 'PUT') {
      const key = decodeURIComponent(urlPath.slice('/api/notes/'.length))
      try {
        const { note } = JSON.parse(await readBody(req)) as { note: string }
        const notes = readNotes()
        if (note) notes[key] = note; else delete notes[key]
        writeNotes(notes)
        json(res, { ok: true })
      } catch { res.writeHead(500).end('Failed to save note') }
      return
    }

    // ── Stale keys ───────────────────────────────────────────────────────────
    if (urlPath === '/api/stale') {
      const notes = readNotes()
      if (!staleTracking) { json(res, { staleKeys: [], tracking: false }); return }
      const refLocale = locales.find(l => l.code === referenceLocaleCode)
      if (!refLocale || !existsSync(refLocale.path)) { json(res, { staleKeys: [], tracking: true }); return }
      const refFlat = flattenKeys(JSON.parse(readFileSync(refLocale.path, 'utf-8')) as Record<string, unknown>)
      const staleKeys = Object.entries(refFlat)
        .filter(([key, value]) => {
          const stored = notes[`_hash.${key}`]
          return stored !== undefined && stored !== hashValue(value)
        })
        .map(([key]) => key)
      json(res, { staleKeys, tracking: true })
      return
    }

    // ── Mark reviewed ─────────────────────────────────────────────────────────
    if (urlPath === '/api/stale/review' && req.method === 'POST') {
      try {
        const { keys } = JSON.parse(await readBody(req)) as { keys: string[] }
        const refLocale = locales.find(l => l.code === referenceLocaleCode)
        if (!refLocale || !existsSync(refLocale.path)) { json(res, { ok: true }); return }
        const refFlat = flattenKeys(JSON.parse(readFileSync(refLocale.path, 'utf-8')) as Record<string, unknown>)
        const notes = readNotes()
        for (const key of keys) {
          if (refFlat[key] !== undefined) notes[`_hash.${key}`] = hashValue(refFlat[key])
        }
        writeNotes(notes)
        json(res, { ok: true })
      } catch { res.writeHead(500).end('Failed to mark reviewed') }
      return
    }

    // ── Git status ────────────────────────────────────────────────────────────
    if (urlPath === '/api/git/status') {
      try {
        const output = execSync('git status --porcelain', { cwd, encoding: 'utf-8' })
        json(res, { modified: locales.filter(l => output.includes(l.path.replace(cwd, '').replace(/\\/g, '/').replace(/^\//, ''))).map(l => l.code) })
      } catch { json(res, { modified: [] }) }
      return
    }

    // ── Entries ───────────────────────────────────────────────────────────────
    if (urlPath === '/api/entries') {
      if (!existsSync(entriesPath)) { json(res, {}, 200); return }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
      res.end(readFileSync(entriesPath, 'utf-8'))
      return
    }

    // ── Export XLIFF ──────────────────────────────────────────────────────────
    if (urlPath.startsWith('/api/export/xliff/') || urlPath.startsWith('/api/export/po/')) {
      const isXliff = urlPath.startsWith('/api/export/xliff/')
      const code = isXliff
        ? urlPath.slice('/api/export/xliff/'.length)
        : urlPath.slice('/api/export/po/'.length)
      const locale = locales.find(l => l.code === code)
      if (!locale) { json(res, { error: `Locale "${code}" not found` }, 404); return }

      try {
        const refLocale = locales[0]
        const refFlat = refLocale && existsSync(refLocale.path) ? flattenKeys(readLocaleFile(refLocale.path)) : {}
        const targetFlat = existsSync(locale.path) ? flattenKeys(readLocaleFile(locale.path)) : {}
        const rawNotes = readNotes()
        const notes: Record<string, string> = Object.fromEntries(Object.entries(rawNotes).filter(([k]) => !k.startsWith('_hash.')))

        let content: string
        if (isXliff) {
          const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
          const units = Object.entries(refFlat).map(([key, src]) => {
            const tgt = targetFlat[key] ?? ''
            const note = notes[key] ? `\n      <note>${esc(notes[key])}</note>` : ''
            return `    <trans-unit id="${esc(key)}" resname="${esc(key)}">\n      <source>${esc(src)}</source>\n      <target state="${tgt?'translated':'needs-translation'}">${esc(tgt)}</target>${note}\n    </trans-unit>`
          }).join('\n')
          content = `<?xml version="1.0" encoding="UTF-8"?>\n<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n  <file original="locale.json" source-language="${esc(refLocale?.code??'')}" target-language="${esc(code)}" datatype="plaintext">\n    <body>\n${units}\n    </body>\n  </file>\n</xliff>\n`
          res.writeHead(200, { 'Content-Type': 'application/xliff+xml', 'Content-Disposition': `attachment; filename="${code}.xliff"`, 'Access-Control-Allow-Origin': '*' })
        } else {
          const now = new Date().toISOString().slice(0,16).replace('T',' ')
          const uq = (s: string) => JSON.stringify(s)
          const header = `# vue-i18n-kit export — ${code}\nmsgid ""\nmsgstr ""\n"Content-Type: text/plain; charset=UTF-8\\n"\n"Language: ${code}\\n"\n"PO-Revision-Date: ${now}\\n"\n\n`
          const body = Object.entries(refFlat).map(([key, src]) => {
            const tgt = targetFlat[key] ?? ''
            const noteStr = notes[key] ? `#. ${notes[key]}\n` : ''
            return `${noteStr}msgctxt ${uq(key)}\nmsgid ${uq(src)}\nmsgstr ${uq(tgt)}\n`
          }).join('\n')
          content = header + body
          res.writeHead(200, { 'Content-Type': 'text/x-po', 'Content-Disposition': `attachment; filename="${code}.po"`, 'Access-Control-Allow-Origin': '*' })
        }
        res.end(content)
      } catch { res.writeHead(500).end('Failed to export') }
      return
    }

    // ── Import XLIFF/PO ───────────────────────────────────────────────────────
    if (urlPath === '/api/import' && req.method === 'POST') {
      try {
        const { content: fileContent, filename } = JSON.parse(await readBody(req)) as { content: string; filename: string }
        const isPo = filename.toLowerCase().endsWith('.po')

        let targetCode: string
        let translations: Record<string, string>

        if (isPo) {
          const localeMatch = fileContent.match(/"Language:\s*([^\s\\]+)/)
          targetCode = localeMatch?.[1] ?? ''
          translations = {}
          const lines = fileContent.split('\n')
          let ctx = '', msgstr = '', inMsgstr = false
          for (const line of lines) {
            const t = line.trim()
            if (t.startsWith('msgctxt ')) { ctx = JSON.parse(t.slice(8).trim()); msgstr = ''; inMsgstr = false }
            else if (t.startsWith('msgstr ')) { inMsgstr = true; msgstr = JSON.parse(t.slice(7).trim()) }
            else if (inMsgstr && t.startsWith('"')) { try { msgstr += JSON.parse(t) } catch { /* skip */ } }
            else if (t === '' && ctx && msgstr) { translations[ctx] = msgstr; ctx = ''; msgstr = ''; inMsgstr = false }
          }
          if (ctx && msgstr) translations[ctx] = msgstr
        } else {
          const localeMatch = fileContent.match(/target-language="([^"]+)"/)
          targetCode = localeMatch?.[1] ?? ''
          translations = {}
          const unitRe = /<trans-unit[^>]*\sid="([^"]+)"[\s\S]*?<\/trans-unit>/g
          let m: RegExpExecArray | null
          const ues = (s: string) => s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')
          while ((m = unitRe.exec(fileContent)) !== null) {
            const id = ues(m[1])
            const tgt = m[0].match(/<target[^>]*>([\s\S]*?)<\/target>/)
            if (tgt?.[1]) { const v = ues(tgt[1]); if (v) translations[id] = v }
          }
        }

        if (!targetCode) { json(res, { error: 'Cannot determine target locale' }, 400); return }
        const locale = locales.find(l => l.code === targetCode)
        if (!locale) { json(res, { error: `Locale "${targetCode}" not found in project` }, 404); return }

        const existing = existsSync(locale.path) ? readLocaleFile(locale.path) : {}
        for (const [key, value] of Object.entries(translations)) {
          const parts = key.split('.')
          let cur = existing
          for (let i = 0; i < parts.length - 1; i++) {
            if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {}
            cur = cur[parts[i]] as Record<string, unknown>
          }
          cur[parts[parts.length - 1]] = value
        }
        writeLocaleFile(locale.path, sortObjectKeys(existing))
        json(res, { ok: true, locale: targetCode, updated: Object.keys(translations).length })
        broadcast({ type: 'locale-changed', code: targetCode })
      } catch (e) { json(res, { error: String(e) }, 500) }
      return
    }

    // ── Export CSV ────────────────────────────────────────────────────────────
    if (urlPath === '/api/export/csv') {
      try {
        const codes = locales.map(l => l.code)
        const allFlat: Record<string, Record<string, string>> = {}
        for (const locale of locales) {
          if (!existsSync(locale.path)) continue
          for (const [k, v] of Object.entries(flattenKeys(readLocaleFile(locale.path)))) {
            if (!allFlat[k]) allFlat[k] = {}
            allFlat[k][locale.code] = v
          }
        }
        const rows = Object.entries(allFlat).map(([key, vals]) =>
          [`"${key}"`, ...codes.map(c => `"${(vals[c] ?? '').replace(/"/g, '""')}"`)] .join(','))
        const csv = [['key', ...codes].join(','), ...rows].join('\n')
        res.writeHead(200, { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="translations.csv"', 'Access-Control-Allow-Origin': '*' })
        res.end(csv)
      } catch { res.writeHead(500).end('Failed to export CSV') }
      return
    }

    // ── Static UI ─────────────────────────────────────────────────────────────
    if (urlPath !== '/' && serveFile(res, join(publicDir, urlPath))) return
    serveFile(res, join(publicDir, 'index.html'))
  })

  server.listen(port, () => {
    console.log(`\n  vue-i18n-kit — Locale Editor\n`)
    console.log(`  ➜  http://localhost:${port}/\n`)
  })
}
