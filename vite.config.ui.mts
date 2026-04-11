import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import type { Plugin, Connect } from 'vite'

function mockApiPlugin(): Plugin {
  return {
    name: 'vue-i18n-kit-mock-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (
        req: Connect.IncomingMessage,
        res: import('node:http').ServerResponse,
        next: Connect.NextFunction,
      ) => {
        const url = req.url ?? ''
        if (!url.startsWith('/api/')) { next(); return }

        const { mockConfig, mockLocales, mockEntries, mockNotes } = await import('./src/ui-app/mock/data.js')

        const json = (data: unknown, status = 200) => {
          res.writeHead(status, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(data))
        }

        const readBody = (): Promise<string> =>
          new Promise(resolve => { let s = ''; req.on('data', c => { s += c }); req.on('end', () => resolve(s)) })

        // ── Flat helpers ──────────────────────────────────────────────────────

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

        function setNestedValue(obj: Record<string, unknown>, path: string, value: string) {
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

        function deleteNestedKey(obj: Record<string, unknown>, path: string) {
          const parts = path.split('.')
          let cur = obj
          for (let i = 0; i < parts.length - 1; i++) {
            if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) return
            cur = cur[parts[i]] as Record<string, unknown>
          }
          delete cur[parts[parts.length - 1]]
        }

        function sortObjectKeys(obj: Record<string, unknown>): Record<string, unknown> {
          const sorted: Record<string, unknown> = {}
          for (const key of Object.keys(obj).sort())
            sorted[key] = (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key]))
              ? sortObjectKeys(obj[key] as Record<string, unknown>) : obj[key]
          return sorted
        }

        // ── SSE ───────────────────────────────────────────────────────────────
        if (url === '/api/events') {
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' })
          res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
          // Keep open; dev server handles cleanup
          return
        }

        // ── Config ────────────────────────────────────────────────────────────
        if (url === '/api/config') { json({ ...mockConfig, cwd: '/mock/project' }); return }
        if (url === '/api/entries') { json(mockEntries); return }
        if (url === '/api/notes') { json(mockNotes); return }

        if (url.startsWith('/api/notes/') && req.method === 'PUT') {
          const key = decodeURIComponent(url.slice('/api/notes/'.length))
          const { note } = JSON.parse(await readBody())
          if (note) mockNotes[key] = note; else delete mockNotes[key]
          json({ ok: true }); return
        }

        if (url === '/api/git/status') { json({ modified: ['en', 'ru', 'de'] }); return }

        // ── Add locale (mock) ─────────────────────────────────────────────────
        if (url === '/api/locale/add' && req.method === 'POST') {
          const { code, path: lPath, display, flag } = JSON.parse(await readBody()) as { code: string; path: string; display?: string; flag?: string }
          if (!code || !lPath) { res.writeHead(400).end('Missing code or path'); return }
          if (mockConfig.locales.find(l => l.code === code)) { res.writeHead(409).end('Locale already exists'); return }
          mockConfig.locales.push({ code, path: lPath, meta: { display: display ?? code, ...(flag ? { flag } : {}) } });
          (mockLocales as Record<string, unknown>)[code] = {}
          json({ ok: true }); return
        }

        // ── Sort ──────────────────────────────────────────────────────────────
        if (url === '/api/sort' && req.method === 'POST') {
          for (const code of Object.keys(mockLocales))
            (mockLocales as Record<string, Record<string, unknown>>)[code] = sortObjectKeys(mockLocales[code] as Record<string, unknown>) as Record<string, unknown>
          json({ ok: true }); return
        }

        // ── Translate (mock) ──────────────────────────────────────────────────
        if (url === '/api/translate' && req.method === 'POST') {
          const { values } = JSON.parse(await readBody()) as { values: string[] }
          json({ translations: values.map(v => `[mock] ${v}`) }); return
        }

        // ── Locale read/write ─────────────────────────────────────────────────
        if (url.startsWith('/api/locale/')) {
          const code = url.slice('/api/locale/'.length)
          if (!(mockLocales as Record<string, unknown>)[code]) { json({ error: `Locale "${code}" not found` }, 404); return }
          if (req.method === 'PUT') {
            const flat = flattenKeys(JSON.parse(await readBody()) as Record<string, unknown>)
            for (const [k, v] of Object.entries(flat)) setNestedValue(mockLocales[code] as Record<string, unknown>, k, v)
            json({ ok: true }); return
          }
          json(mockLocales[code]); return
        }

        // ── Batch delete ──────────────────────────────────────────────────────
        if (url === '/api/keys/batch-delete' && req.method === 'POST') {
          const { keys } = JSON.parse(await readBody()) as { keys: string[] }
          for (const code of Object.keys(mockLocales))
            for (const key of keys) deleteNestedKey(mockLocales[code] as Record<string, unknown>, key)
          json({ ok: true }); return
        }

        // ── Create key ────────────────────────────────────────────────────────
        if (url === '/api/key' && req.method === 'POST') {
          const { key, values } = JSON.parse(await readBody()) as { key: string; values: Record<string, string> }
          for (const code of Object.keys(mockLocales)) setNestedValue(mockLocales[code] as Record<string, unknown>, key, values[code] ?? '')
          json({ ok: true }); return
        }

        // ── Rename ────────────────────────────────────────────────────────────
        if (url.includes('/rename') && req.method === 'PUT') {
          const oldKey = decodeURIComponent(url.slice('/api/key/'.length, url.indexOf('/rename')))
          const { newKey } = JSON.parse(await readBody())
          for (const code of Object.keys(mockLocales)) {
            const val = getNestedValue(mockLocales[code] as Record<string, unknown>, oldKey)
            deleteNestedKey(mockLocales[code] as Record<string, unknown>, oldKey)
            setNestedValue(mockLocales[code] as Record<string, unknown>, newKey, val)
          }
          if (mockEntries[oldKey]) { mockEntries[newKey] = mockEntries[oldKey]; delete mockEntries[oldKey] }
          json({ ok: true }); return
        }

        // ── Duplicate ─────────────────────────────────────────────────────────
        if (url.includes('/duplicate') && req.method === 'POST') {
          const srcKey = decodeURIComponent(url.slice('/api/key/'.length, url.indexOf('/duplicate')))
          const { newKey } = JSON.parse(await readBody())
          for (const code of Object.keys(mockLocales)) {
            const val = getNestedValue(mockLocales[code] as Record<string, unknown>, srcKey)
            setNestedValue(mockLocales[code] as Record<string, unknown>, newKey, val)
          }
          json({ ok: true }); return
        }

        // ── Delete ────────────────────────────────────────────────────────────
        if (url.startsWith('/api/key/') && req.method === 'DELETE') {
          const key = decodeURIComponent(url.slice('/api/key/'.length))
          for (const code of Object.keys(mockLocales)) deleteNestedKey(mockLocales[code] as Record<string, unknown>, key)
          delete mockEntries[key]
          json({ ok: true }); return
        }

        // ── Stale keys ────────────────────────────────────────────────────────
        if (url === '/api/stale') {
          json({ staleKeys: [], tracking: false }); return
        }
        if (url === '/api/stale/review' && req.method === 'POST') {
          json({ ok: true }); return
        }

        // ── Export XLIFF / PO ─────────────────────────────────────────────────
        if (url.startsWith('/api/export/xliff/') || url.startsWith('/api/export/po/')) {
          const isXliff = url.startsWith('/api/export/xliff/')
          const code = isXliff ? url.slice('/api/export/xliff/'.length) : url.slice('/api/export/po/'.length)
          const locale = mockConfig.locales.find(l => l.code === code)
          if (!locale) { res.writeHead(404).end('Locale not found'); return }
          const refCode = mockConfig.locales[0].code
          const refData = mockLocales[refCode] as Record<string, unknown>
          const targetData = mockLocales[code] as Record<string, unknown>
          const refFlat = flattenKeys(refData)
          const targetFlat = flattenKeys(targetData)
          const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
          if (isXliff) {
            const units = Object.entries(refFlat).map(([key, src]) => {
              const tgt = targetFlat[key] ?? ''
              const note = mockNotes[key] ? `\n      <note>${esc(mockNotes[key])}</note>` : ''
              return `    <trans-unit id="${esc(key)}" resname="${esc(key)}">\n      <source>${esc(src)}</source>\n      <target state="${tgt?'translated':'needs-translation'}">${esc(tgt)}</target>${note}\n    </trans-unit>`
            }).join('\n')
            const content = `<?xml version="1.0" encoding="UTF-8"?>\n<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n  <file original="locale.json" source-language="${esc(refCode)}" target-language="${esc(code)}" datatype="plaintext">\n    <body>\n${units}\n    </body>\n  </file>\n</xliff>\n`
            res.writeHead(200, { 'Content-Type': 'application/xliff+xml', 'Content-Disposition': `attachment; filename="${code}.xliff"` })
            res.end(content)
          } else {
            const now = new Date().toISOString().slice(0,16).replace('T',' ')
            const uq = (s: string) => JSON.stringify(s)
            const header = `# vue-i18n-kit mock export — ${code}\nmsgid ""\nmsgstr ""\n"Content-Type: text/plain; charset=UTF-8\\n"\n"Language: ${code}\\n"\n"PO-Revision-Date: ${now}\\n"\n\n`
            const body = Object.entries(refFlat).map(([key, src]) => {
              const tgt = targetFlat[key] ?? ''
              const noteStr = mockNotes[key] ? `#. ${mockNotes[key]}\n` : ''
              return `${noteStr}msgctxt ${uq(key)}\nmsgid ${uq(src)}\nmsgstr ${uq(tgt)}\n`
            }).join('\n')
            res.writeHead(200, { 'Content-Type': 'text/x-po', 'Content-Disposition': `attachment; filename="${code}.po"` })
            res.end(header + body)
          }
          return
        }

        // ── Import XLIFF / PO ─────────────────────────────────────────────────
        if (url === '/api/import' && req.method === 'POST') {
          try {
            const { content: fileContent, filename } = JSON.parse(await readBody()) as { content: string; filename: string }
            const isPo = filename.toLowerCase().endsWith('.po')
            let targetCode = ''
            let translations: Record<string, string> = {}
            if (isPo) {
              const m = fileContent.match(/"Language:\s*([^\s\\]+)/)
              targetCode = m?.[1] ?? ''
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
              const m = fileContent.match(/target-language="([^"]+)"/)
              targetCode = m?.[1] ?? ''
              const unitRe = /<trans-unit[^>]*\sid="([^"]+)"[\s\S]*?<\/trans-unit>/g
              let m2: RegExpExecArray | null
              const ues = (s: string) => s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')
              while ((m2 = unitRe.exec(fileContent)) !== null) {
                const id = ues(m2[1])
                const tgt = m2[0].match(/<target[^>]*>([\s\S]*?)<\/target>/)
                if (tgt?.[1]) { const v = ues(tgt[1]); if (v) translations[id] = v }
              }
            }
            if (!targetCode || !mockLocales[targetCode]) { res.writeHead(400).end('Unknown locale'); return }
            for (const [key, value] of Object.entries(translations))
              setNestedValue(mockLocales[targetCode] as Record<string, unknown>, key, value)
            json({ ok: true, locale: targetCode, updated: Object.keys(translations).length })
          } catch (e) { res.writeHead(500).end(String(e)) }
          return
        }

        // ── Export CSV (mock) ─────────────────────────────────────────────────
        if (url === '/api/export/csv') {
          const codes = mockConfig.locales.map(l => l.code)
          const allFlat: Record<string, Record<string, string>> = {}
          for (const code of codes) {
            for (const [k, v] of Object.entries(flattenKeys(mockLocales[code] as Record<string, unknown>))) {
              if (!allFlat[k]) allFlat[k] = {}
              allFlat[k][code] = v
            }
          }
          const rows = Object.entries(allFlat).map(([key, vals]) =>
            [`"${key}"`, ...codes.map(c => `"${(vals[c]??'').replace(/"/g,'""')}"`)] .join(','))
          const csv = [['key',...codes].join(','), ...rows].join('\n')
          res.writeHead(200, { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="translations.csv"' })
          res.end(csv); return
        }

        next()
      })
    },
  }
}

export default defineConfig({
  root: 'src/ui-app',
  plugins: [vue(), mockApiPlugin()],
  build: {
    outDir: fileURLToPath(new URL('./dist/ui-server/public', import.meta.url)),
    emptyOutDir: true,
  },
})
