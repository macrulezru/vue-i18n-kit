export interface LocaleInfo {
  code: string
  path: string
  meta?: Record<string, unknown>
}

export interface LocaleConfig {
  root: string
  generatedAt: string
  locales: LocaleInfo[]
}

export type LocaleMessages = Record<string, string>
export type LocaleData = Record<string, LocaleMessages>
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

export async function fetchEntries(): Promise<LocaleEntries> {
  const res = await fetch('/api/entries')
  return res.ok ? res.json() : {}
}
