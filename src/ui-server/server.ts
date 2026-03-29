import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

interface LocaleEntry {
  code: string
  path: string
  meta?: Record<string, unknown>
}

interface LocaleMap {
  root: string
  generatedAt: string
  locales: LocaleEntry[]
}

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

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T
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
  const configPath = join(cwd, 'i18n-tools', 'locales.config.json')

  // Pre-built UI assets live next to this bundled file: dist/cli/ → dist/ui-server/public/
  const publicDir = join(__dirname, '..', 'ui-server', 'public')

  if (!existsSync(configPath)) {
    console.error(
      '\n[vue-i18n-kit] Locale map not found.\n' +
      'Run the map generator first:\n\n  npm run i18n:map\n\n' +
      'Or create i18n-tools/locales.config.json manually.\n',
    )
    process.exit(1)
  }

  if (!existsSync(publicDir)) {
    console.error(
      '\n[vue-i18n-kit] UI assets not found.\n' +
      'The package may not have been built correctly.\n',
    )
    process.exit(1)
  }

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const urlPath = (req.url ?? '/').split('?')[0]

    // ── API ──────────────────────────────────────────────────────────────────

    if (urlPath === '/api/config') {
      try {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
        res.end(readFileSync(configPath, 'utf-8'))
      } catch {
        res.writeHead(500).end('Failed to read config')
      }
      return
    }

    if (urlPath.startsWith('/api/locale/')) {
      const code = urlPath.slice('/api/locale/'.length)

      if (req.method === 'PUT') {
        let body = ''
        req.on('data', (chunk: Buffer) => { body += chunk.toString() })
        req.on('end', () => {
          try {
            const config = readJson<LocaleMap>(configPath)
            const locale = config.locales.find(l => l.code === code)
            if (!locale) { json(res, { error: `Locale "${code}" not found` }, 404); return }
            const parsed = JSON.parse(body)
            writeFileSync(locale.path, JSON.stringify(parsed, null, 2) + '\n', 'utf-8')
            json(res, { ok: true })
          } catch {
            res.writeHead(500).end('Failed to write locale file')
          }
        })
        return
      }

      try {
        const config = readJson<LocaleMap>(configPath)
        const locale = config.locales.find(l => l.code === code)
        if (!locale) {
          json(res, { error: `Locale "${code}" not found` }, 404)
          return
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
        res.end(readFileSync(locale.path, 'utf-8'))
      } catch {
        res.writeHead(500).end('Failed to read locale file')
      }
      return
    }

    if (urlPath === '/api/entries') {
      const entriesPath = join(cwd, 'i18n-tools', 'locales.entries.json')
      if (!existsSync(entriesPath)) {
        json(res, { error: 'locales.entries.json not found' }, 404)
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
      res.end(readFileSync(entriesPath, 'utf-8'))
      return
    }

    // ── Static UI ─────────────────────────────────────────────────────────────

    // Try to serve the exact file (assets, etc.)
    if (urlPath !== '/' && serveFile(res, join(publicDir, urlPath))) return

    // Fallback: serve index.html for SPA routing
    serveFile(res, join(publicDir, 'index.html'))
  })

  server.listen(port, () => {
    console.log(`\n  vue-i18n-kit — Locale Editor\n`)
    console.log(`  ➜  http://localhost:${port}/\n`)
  })
}
