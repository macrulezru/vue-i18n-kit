export interface LocaleInfo {
  code: string
  path: string
  meta?: Record<string, unknown>
}

export interface I18nKitRules {
  interpolationPatterns?: string[]
  lengthWarningFactor?: number
  warnOnHtmlTags?: boolean
  warnOnIcuErrors?: boolean
  warnOnDuplicateValues?: boolean
  minValueLength?: number
}

export interface I18nKitIgnore {
  prune?: string[]
  duplicates?: string[]
  unused?: string[]
  scanExclude?: string[]
}

export interface LocaleConfig {
  locales: LocaleInfo[]
  cwd?: string
  rules?: I18nKitRules
  ignore?: I18nKitIgnore
  lockedKeys?: string[]
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
  engine?: 'libretranslate' | 'deepl'
  /** LibreTranslate instance URL */
  apiUrl?: string
  /** LibreTranslate API key */
  apiKey?: string
  /** DeepL Auth Key */
  deeplKey?: string
  /** DeepL formality: default | more | less | prefer_more | prefer_less */
  formality?: string
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

export async function exportXliff(locale: string): Promise<void> {
  const res = await fetch(`/api/export/xliff/${locale}`)
  if (!res.ok) throw new Error(await res.text())
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: `${locale}.xliff` })
  a.click(); URL.revokeObjectURL(url)
}

export async function exportPo(locale: string): Promise<void> {
  const res = await fetch(`/api/export/po/${locale}`)
  if (!res.ok) throw new Error(await res.text())
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: `${locale}.po` })
  a.click(); URL.revokeObjectURL(url)
}

export async function importTranslations(file: File): Promise<{ locale: string; updated: number }> {
  const content = await file.text()
  const res = await fetch('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, filename: file.name }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function fetchStale(): Promise<{ staleKeys: string[]; tracking: boolean }> {
  const res = await fetch('/api/stale')
  return res.ok ? res.json() : { staleKeys: [], tracking: false }
}

export async function markReviewed(keys: string[]): Promise<void> {
  await fetch('/api/stale/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keys }),
  })
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
