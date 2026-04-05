export interface LocaleInfo {
  code: string
  path: string
  meta?: Record<string, unknown>
}

export interface LocaleConfig {
  locales: LocaleInfo[]
  cwd?: string
}

export type LocaleMessages = Record<string, string>
export type LocaleData    = Record<string, LocaleMessages>
export type LocaleEntries = Record<string, string[]>

export function flattenKeys(obj: Record<string, unknown>, prefix = ''): LocaleMessages {
  const result: LocaleMessages = {}
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

export async function fetchConfig(): Promise<LocaleConfig> {
  return fetch('/api/config').then(r => r.json())
}

export async function fetchLocale(code: string): Promise<LocaleMessages> {
  const raw = await fetch(`/api/locale/${code}`).then(r => r.json())
  return flattenKeys(raw)
}

export async function fetchRawLocale(code: string): Promise<Record<string, unknown>> {
  return fetch(`/api/locale/${code}`).then(r => r.json())
}

export async function fetchEntries(): Promise<LocaleEntries> {
  const res = await fetch('/api/entries')
  return res.ok ? res.json() : {}
}

export async function createKey(key: string, values: Record<string, string>): Promise<void> {
  await fetch('/api/key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, values }),
  })
}

export async function deleteKey(key: string): Promise<void> {
  await fetch(`/api/key/${encodeURIComponent(key)}`, { method: 'DELETE' })
}

export async function batchDeleteKeys(keys: string[]): Promise<void> {
  await fetch('/api/keys/batch-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keys }),
  })
}

export async function renameKey(key: string, newKey: string): Promise<void> {
  await fetch(`/api/key/${encodeURIComponent(key)}/rename`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newKey }),
  })
}

export async function duplicateKey(key: string, newKey: string): Promise<void> {
  await fetch(`/api/key/${encodeURIComponent(key)}/duplicate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newKey }),
  })
}

export async function sortKeys(): Promise<void> {
  await fetch('/api/sort', { method: 'POST' })
}

export async function translateMissing(params: {
  values: string[]
  from: string
  to: string
  apiUrl: string
  apiKey?: string
}): Promise<string[]> {
  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json() as { translations: string[] }
  return data.translations
}

export async function fetchNotes(): Promise<Record<string, string>> {
  const res = await fetch('/api/notes')
  return res.ok ? res.json() : {}
}

export async function saveNote(key: string, note: string): Promise<void> {
  await fetch(`/api/notes/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  })
}

export async function fetchGitStatus(): Promise<{ modified: string[] }> {
  const res = await fetch('/api/git/status')
  return res.ok ? res.json() : { modified: [] }
}

export async function addLocale(params: {
  code: string
  path: string
  display?: string
  flag?: string
}): Promise<void> {
  const res = await fetch('/api/locale/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error(await res.text())
}
