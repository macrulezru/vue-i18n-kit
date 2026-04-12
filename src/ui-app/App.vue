<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import LocaleTable from './components/LocaleTable.vue'
import Dashboard from './components/Dashboard.vue'
import Icon from './components/Icon.vue'
import Checkbox from './components/Checkbox.vue'
import Toast from './components/Toast.vue'
import { usePersisted } from './composables/usePersisted'
import { useToast } from './composables/useToast'
import {
  fetchConfig, fetchLocale, fetchEntries, fetchNotes, fetchGitStatus,
  fetchStale, markReviewed,
  exportXliff, exportPo, importTranslations,
  createKey, deleteKey, renameKey, duplicateKey, saveNote,
  batchDeleteKeys, sortKeys, translateMissing, addLocale,
  clearMemory, exportMemoryUrl,
} from './api'
import type { LocaleInfo, LocaleData, LocaleEntries, I18nKitIgnore, I18nKitRules } from './api'

type Section = 'dashboard' | 'editor'
const section        = usePersisted<Section>('section', 'dashboard')
const referenceLocale = usePersisted<string>('referenceLocale', '')
const ideScheme      = usePersisted<string>('ideScheme', 'vscode')
const libreUrl       = usePersisted<string>('libreUrl', 'https://libretranslate.com')
const libreKey       = usePersisted<string>('libreKey', '')
const translateEngine = usePersisted<'libretranslate' | 'deepl'>('translateEngine', 'libretranslate')
const deeplKey       = usePersisted<string>('deeplKey', '')
const deeplFormality = usePersisted<string>('deeplFormality', 'default')

const { show: toast } = useToast()

const loading         = ref(true)
const locales         = ref<LocaleInfo[]>([])
const localeData      = ref<LocaleData>({})
const rawLocaleData   = ref<Record<string, Record<string, unknown>>>({})
const entries         = ref<LocaleEntries>({})
const notes           = ref<Record<string, string>>({})
const modifiedLocales = ref<string[]>([])
const projectCwd      = ref<string | undefined>(undefined)
const configIgnore    = ref<I18nKitIgnore>({})
const configRules     = ref<I18nKitRules>({})
const lockedKeys      = ref<string[]>([])
const staleKeys       = ref<string[]>([])
const staleTracking   = ref(false)
const memoryEnabled   = ref(true)
const namespacesMode  = ref(false)

// Auto-save indicator
const isSaving  = ref(0)
const lastSaved = ref<Date | null>(null)

// External search from Dashboard namespace click
const externalSearch = ref('')

// ── Undo stack ────────────────────────────────────────────────────────────────

interface UndoEntry { code: string; key: string; prev: string }
const undoStack = ref<UndoEntry[]>([])

// ── Pattern matching for ignore lists ────────────────────────────────────────

function matchesPattern(key: string, pattern: string): boolean {
  if (pattern === '**' || pattern === '*') return true
  if (pattern === key) return true
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2)
    return key === prefix || key.startsWith(prefix + '.')
  }
  if (pattern.endsWith('.**')) {
    const prefix = pattern.slice(0, -3)
    return key.startsWith(prefix + '.')
  }
  if (pattern.includes('*')) {
    const re = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '[^.]*') + '$')
    return re.test(key)
  }
  return false
}

function matchesAnyPattern(key: string, patterns: string[]): boolean {
  return patterns.some(p => matchesPattern(key, p))
}

// ── All keys ──────────────────────────────────────────────────────────────────

const allKeys = computed(() => {
  const keys = new Set<string>()
  for (const data of Object.values(localeData.value))
    for (const key of Object.keys(data)) keys.add(key)
  return [...keys].sort()
})

// ── Phantom key detection (used in code but absent from ALL locales) ──────────

const phantomKeys = computed<string[]>(() =>
  Object.keys(entries.value).filter(k => !allKeys.value.includes(k))
)

// Keys for the table: locale keys + phantom keys so phantom filter works
const tableKeys = computed<string[]>(() =>
  [...new Set([...allKeys.value, ...phantomKeys.value])].sort()
)

// ── Unused key detection (in locales but not in code) ─────────────────────────

const unusedKeys = computed<string[]>(() => {
  const entriesKeys = Object.keys(entries.value)
  if (!entriesKeys.length) return []
  const ignoreUnused = configIgnore.value.unused ?? []
  return allKeys.value.filter(k =>
    !entriesKeys.includes(k) &&
    (ignoreUnused.length === 0 || !matchesAnyPattern(k, ignoreUnused))
  )
})

// ── Duplicate key detection ───────────────────────────────────────────────────

const duplicateKeys = computed<string[]>(() => {
  if (locales.value.length < 2) return []
  const ignoreDuplicates = configIgnore.value.duplicates ?? []
  return allKeys.value.filter(key => {
    if (ignoreDuplicates.length > 0 && matchesAnyPattern(key, ignoreDuplicates)) return false
    const vals = locales.value.map(l => localeData.value[l.code]?.[key] ?? '')
    return vals.every(v => v !== '' && v === vals[0])
  })
})

// ── Nested value helpers ──────────────────────────────────────────────────────

function setNestedValue(obj: Record<string, unknown>, path: string, value: string): void {
  const parts = path.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {}
    cur = cur[parts[i]] as Record<string, unknown>
  }
  cur[parts[parts.length - 1]] = value
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

// ── Reload locale (SSE-triggered) ─────────────────────────────────────────────

async function reloadLocale(code: string) {
  try {
    const raw = await fetch(`/api/locale/${code}`).then(r => r.json())
    rawLocaleData.value = { ...rawLocaleData.value, [code]: raw }
    const flat: Record<string, string> = {}
    function flatten(o: Record<string, unknown>, prefix = '') {
      for (const [k, v] of Object.entries(o)) {
        const full = prefix ? `${prefix}.${k}` : k
        if (v !== null && typeof v === 'object' && !Array.isArray(v))
          flatten(v as Record<string, unknown>, full)
        else flat[full] = v != null ? String(v) : ''
      }
    }
    flatten(raw)
    localeData.value = { ...localeData.value, [code]: flat }
  } catch { /* ignore */ }
}

// ── SSE connection ────────────────────────────────────────────────────────────

let sseSource: EventSource | null = null
let sseReconnectTimer: ReturnType<typeof setTimeout> | null = null

function connectSSE() {
  if (sseSource) { sseSource.close(); sseSource = null }
  const es = new EventSource('/api/events')
  sseSource = es
  es.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data) as { type: string; locale?: string }
      if (msg.type === 'locale-changed' && msg.locale) {
        reloadLocale(msg.locale)
        toast(`${msg.locale} reloaded`, 'info', 2000)
      }
    } catch { /* ignore */ }
  }
  es.onerror = () => {
    es.close()
    sseSource = null
    if (sseReconnectTimer) clearTimeout(sseReconnectTimer)
    sseReconnectTimer = setTimeout(connectSSE, 3000)
  }
}

// ── Save / Undo ───────────────────────────────────────────────────────────────

async function applyTranslation(code: string, key: string, value: string, pushUndo = true) {
  if (pushUndo) {
    const prev = localeData.value[code]?.[key] ?? ''
    undoStack.value.push({ code, key, prev })
    if (undoStack.value.length > 100) undoStack.value.shift()
  }
  localeData.value = { ...localeData.value, [code]: { ...localeData.value[code], [key]: value } }
  if (!rawLocaleData.value[code]) rawLocaleData.value[code] = {}
  setNestedValue(rawLocaleData.value[code], key, value)
  isSaving.value++
  try {
    await fetch(`/api/locale/${code}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rawLocaleData.value[code]),
    })
    lastSaved.value = new Date()
  } finally {
    isSaving.value--
  }
}

function handleUndo() {
  const entry = undoStack.value.pop()
  if (entry) {
    applyTranslation(entry.code, entry.key, entry.prev, false)
    toast('Undone', 'info', 1500)
  }
}

// ── Create key ────────────────────────────────────────────────────────────────

const showCreateDialog = ref(false)
const newKeyPath   = ref('')
const newKeyValues = ref<Record<string, string>>({})
const createError  = ref('')

function openCreateDialog(prefill = '') {
  newKeyPath.value   = prefill
  newKeyValues.value = Object.fromEntries(locales.value.map(l => [l.code, '']))
  createError.value  = ''
  showCreateDialog.value = true
}

function handleCreateKeyInGroup(prefix: string) {
  openCreateDialog(prefix + '.')
}

async function submitCreateKey() {
  const key = newKeyPath.value.trim()
  if (!key) { createError.value = 'Key path is required.'; return }
  if (!/^[a-zA-Z0-9_][\w.]*$/.test(key)) { createError.value = 'Invalid format. Use letters, numbers, underscores, dots.'; return }
  if (allKeys.value.includes(key)) { createError.value = `Key "${key}" already exists.`; return }

  await createKey(key, newKeyValues.value)
  for (const locale of locales.value) {
    const val = newKeyValues.value[locale.code] ?? ''
    localeData.value = { ...localeData.value, [locale.code]: { ...localeData.value[locale.code], [key]: val } }
    if (!rawLocaleData.value[locale.code]) rawLocaleData.value[locale.code] = {}
    setNestedValue(rawLocaleData.value[locale.code], key, val)
  }
  showCreateDialog.value = false
  section.value = 'editor'
  toast(`Key "${key}" created`, 'success')
}

// ── Delete / Rename / Duplicate / Note ───────────────────────────────────────

async function handleDeleteKey(key: string) {
  await deleteKey(key)
  for (const locale of locales.value) {
    const flat = { ...localeData.value[locale.code] }
    delete flat[key]
    localeData.value = { ...localeData.value, [locale.code]: flat }
    if (rawLocaleData.value[locale.code]) deleteNestedKey(rawLocaleData.value[locale.code], key)
  }
  toast(`Key "${key}" deleted`, 'success')
}

async function handleBatchDeleteKeys(keys: string[]) {
  await batchDeleteKeys(keys)
  for (const key of keys) {
    for (const locale of locales.value) {
      const flat = { ...localeData.value[locale.code] }
      delete flat[key]
      localeData.value = { ...localeData.value, [locale.code]: flat }
      if (rawLocaleData.value[locale.code]) deleteNestedKey(rawLocaleData.value[locale.code], key)
    }
  }
  toast(`${keys.length} key${keys.length > 1 ? 's' : ''} deleted`, 'success')
}

async function handleRenameKey(oldKey: string, newKey: string) {
  await renameKey(oldKey, newKey)
  for (const locale of locales.value) {
    const flat = { ...localeData.value[locale.code] }
    flat[newKey] = flat[oldKey] ?? ''
    delete flat[oldKey]
    localeData.value = { ...localeData.value, [locale.code]: flat }
    if (rawLocaleData.value[locale.code]) {
      const re = await fetch(`/api/locale/${locale.code}`).then(r => r.json())
      rawLocaleData.value[locale.code] = re
    }
  }
  if (notes.value[oldKey]) {
    notes.value[newKey] = notes.value[oldKey]
    delete notes.value[oldKey]
  }
  undoStack.value = undoStack.value.filter(e => e.key !== oldKey)
  toast(`Renamed to "${newKey}"`, 'success')
}

async function handleRenameGroup(oldPrefix: string, newPrefix: string) {
  const groupKeys = allKeys.value.filter(k => k.startsWith(oldPrefix + '.'))
  for (const oldKey of groupKeys) {
    const newKey = newPrefix + oldKey.slice(oldPrefix.length)
    await renameKey(oldKey, newKey)
    for (const locale of locales.value) {
      const flat = { ...localeData.value[locale.code] }
      flat[newKey] = flat[oldKey] ?? ''
      delete flat[oldKey]
      localeData.value = { ...localeData.value, [locale.code]: flat }
    }
    if (notes.value[oldKey]) {
      notes.value[newKey] = notes.value[oldKey]
      delete notes.value[oldKey]
    }
    undoStack.value = undoStack.value.filter(e => e.key !== oldKey)
  }
  // Reload raw locale data
  await Promise.all(locales.value.map(async l => {
    const raw = await fetch(`/api/locale/${l.code}`).then(r => r.json())
    rawLocaleData.value = { ...rawLocaleData.value, [l.code]: raw }
  }))
  toast(`Namespace renamed to "${newPrefix}" (${groupKeys.length} keys)`, 'success')
}

async function handleDuplicateKey(srcKey: string, newKey: string) {
  await duplicateKey(srcKey, newKey)
  for (const locale of locales.value) {
    const val = localeData.value[locale.code]?.[srcKey] ?? ''
    localeData.value = { ...localeData.value, [locale.code]: { ...localeData.value[locale.code], [newKey]: val } }
    if (rawLocaleData.value[locale.code]) setNestedValue(rawLocaleData.value[locale.code], newKey, val)
  }
  toast(`Duplicated as "${newKey}"`, 'success')
}

async function handleMarkReviewed(keys: string[]) {
  await markReviewed(keys)
  staleKeys.value = staleKeys.value.filter(k => !keys.includes(k))
  toast(`${keys.length} key${keys.length > 1 ? 's' : ''} marked as reviewed`, 'success')
}

async function handleSaveNote(key: string, note: string) {
  await saveNote(key, note)
  notes.value = { ...notes.value, [key]: note }
  if (!note) {
    const n = { ...notes.value }
    delete n[key]
    notes.value = n
  }
}

// ── Add locale ────────────────────────────────────────────────────────────────

const showAddLocale   = ref(false)
const addLocaleCode   = ref('')
const addLocalePath   = ref('')
const addLocaleDisplay = ref('')
const addLocaleFlag   = ref('')
const addLocaleError  = ref('')

function openAddLocale() {
  addLocaleCode.value    = ''
  addLocalePath.value    = ''
  addLocaleDisplay.value = ''
  addLocaleFlag.value    = ''
  addLocaleError.value   = ''
  showAddLocale.value    = true
}

watch(addLocaleCode, code => {
  // Auto-fill path when user types the code (only if path not manually edited)
  const cfg = locales.value[0]
  if (!cfg) return
  const dir = cfg.path.replace(/[^/\\]+$/, '') // strip filename, keep dir
  if (!addLocalePath.value || addLocalePath.value.match(/^.*[/\\][a-z]{0,8}\.json$/i)) {
    addLocalePath.value = dir + code.trim() + '.json'
  }
})

async function submitAddLocale() {
  const code = addLocaleCode.value.trim()
  const path = addLocalePath.value.trim()
  if (!code) { addLocaleError.value = 'Enter a locale code (e.g. fr, zh-CN).'; return }
  if (!/^[a-zA-Z]{2,8}(-[a-zA-Z0-9]{2,8})*$/.test(code)) { addLocaleError.value = 'Invalid BCP 47 code (e.g. en, zh-CN, pt-BR).'; return }
  if (!path) { addLocaleError.value = 'Enter a file path (e.g. src/locales/fr.json).'; return }
  if (locales.value.find(l => l.code === code)) { addLocaleError.value = `Locale "${code}" already exists.`; return }

  try {
    await addLocale({ code, path, display: addLocaleDisplay.value.trim() || code, flag: addLocaleFlag.value.trim() || undefined })
    showAddLocale.value = false
    // Reload config and locale data
    const cfg = await fetchConfig()
    locales.value = cfg.locales
    const messages = await fetchLocale(code)
    localeData.value = { ...localeData.value, [code]: messages }
    rawLocaleData.value = { ...rawLocaleData.value, [code]: {} }
    toast.success(`Locale "${code}" added`)
  } catch (e: unknown) {
    addLocaleError.value = e instanceof Error ? e.message : 'Failed to add locale.'
  }
}

// ── Sort keys ─────────────────────────────────────────────────────────────────

const showSortConfirm = ref(false)

async function handleSort() {
  showSortConfirm.value = false
  isSaving.value++
  try {
    await sortKeys()
    // Reload all locales after sort
    await Promise.all(locales.value.map(async l => {
      const raw = await fetch(`/api/locale/${l.code}`).then(r => r.json())
      rawLocaleData.value = { ...rawLocaleData.value, [l.code]: raw }
    }))
    lastSaved.value = new Date()
    toast('Keys sorted alphabetically', 'success')
  } catch {
    toast('Sort failed', 'error')
  } finally {
    isSaving.value--
  }
}

// ── Find & Replace ────────────────────────────────────────────────────────────

const showFindReplace  = ref(false)
const findStr          = ref('')
const replaceStr       = ref('')
const findLocaleFilter = ref('all')

interface ReplaceMatch { key: string; code: string; oldValue: string; newValue: string }

const replaceMatches = computed<ReplaceMatch[]>(() => {
  if (!findStr.value) return []
  const codes = findLocaleFilter.value === 'all'
    ? locales.value.map(l => l.code)
    : [findLocaleFilter.value]
  const result: ReplaceMatch[] = []
  for (const key of allKeys.value) {
    for (const code of codes) {
      const val = localeData.value[code]?.[key] ?? ''
      if (val.includes(findStr.value))
        result.push({ key, code, oldValue: val, newValue: val.split(findStr.value).join(replaceStr.value) })
    }
  }
  return result
})

async function applyReplace() {
  for (const m of replaceMatches.value) await applyTranslation(m.code, m.key, m.newValue)
  const count = replaceMatches.value.length
  showFindReplace.value = false
  toast(`Replaced ${count} occurrence${count !== 1 ? 's' : ''}`, 'success')
}

// ── Quick Open ────────────────────────────────────────────────────────────────

const tableRef       = ref<InstanceType<typeof LocaleTable> | null>(null)
const showQuickOpen  = ref(false)
const quickOpenQuery = ref('')
const quickOpenSel   = ref(0)

const quickOpenResults = computed(() => {
  const q = quickOpenQuery.value.toLowerCase()
  if (!q) return allKeys.value.slice(0, 50)
  return allKeys.value.filter(k => k.toLowerCase().includes(q)).slice(0, 50)
})

function openQuickOpen() { showQuickOpen.value = true; quickOpenQuery.value = ''; quickOpenSel.value = 0 }
function closeQuickOpen() { showQuickOpen.value = false }

function quickOpenKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') { e.preventDefault(); quickOpenSel.value = Math.min(quickOpenSel.value + 1, quickOpenResults.value.length - 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); quickOpenSel.value = Math.max(quickOpenSel.value - 1, 0) }
  else if (e.key === 'Enter')  { selectQuickOpenKey(quickOpenResults.value[quickOpenSel.value]) }
  else if (e.key === 'Escape') { closeQuickOpen() }
}

function selectQuickOpenKey(key: string) {
  if (!key) return
  closeQuickOpen()
  section.value = 'editor'
  setTimeout(() => tableRef.value?.jumpToKey(key), 50)
}

// ── Export CSV ────────────────────────────────────────────────────────────────

function exportCsv() {
  const codes  = locales.value.map(l => l.code)
  const header = ['key', ...codes].join(',')
  const rows   = allKeys.value.map(key => {
    const vals = codes.map(c => `"${(localeData.value[c]?.[key] ?? '').replace(/"/g, '""')}"`)
    return [`"${key}"`, ...vals].join(',')
  })
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'translations.csv' })
  a.click(); URL.revokeObjectURL(url)
  toast('CSV exported', 'success')
}

// ── Export XLIFF/PO ──────────────────────────────────────────────────────────

const showExportLocale = ref(false)
const exportLocaleCode = ref('')
const exportFormat     = ref<'xliff' | 'po'>('xliff')
const showExportMenu   = ref(false)
const showImportMenu   = ref(false)

function openExportLocale(format?: 'xliff' | 'po') {
  exportLocaleCode.value = locales.value[0]?.code ?? ''
  if (format) exportFormat.value = format
  showExportLocale.value = true
  showExportMenu.value = false
}

function closeHeaderMenus() {
  showExportMenu.value = false
  showImportMenu.value = false
}

async function submitExportLocale() {
  try {
    if (exportFormat.value === 'po') await exportPo(exportLocaleCode.value)
    else await exportXliff(exportLocaleCode.value)
    showExportLocale.value = false
    toast(`Exported ${exportLocaleCode.value}.${exportFormat.value}`, 'success')
  } catch (e) {
    toast(`Export failed: ${(e as Error).message}`, 'error', 4000)
  }
}

// ── Import XLIFF/PO ───────────────────────────────────────────────────────────

const xliffImportEl = ref<HTMLInputElement | null>(null)

async function handleXliffImportFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const { locale: importedLocale, updated } = await importTranslations(file)
    // Reload the locale in memory
    const messages = await import('./api').then(m => m.fetchLocale(importedLocale))
    localeData.value = { ...localeData.value, [importedLocale]: messages }
    const raw = await fetch(`/api/locale/${importedLocale}`).then(r => r.json())
    rawLocaleData.value = { ...rawLocaleData.value, [importedLocale]: raw }
    if (xliffImportEl.value) xliffImportEl.value.value = ''
    toast(`Imported ${updated} key(s) into ${importedLocale}`, 'success')
  } catch (e) {
    toast(`Import failed: ${(e as Error).message}`, 'error', 4000)
    if (xliffImportEl.value) xliffImportEl.value.value = ''
  }
}

// ── Import CSV ────────────────────────────────────────────────────────────────

const showImport    = ref(false)
const importChanges = ref<ReplaceMatch[]>([])
const importFileEl  = ref<HTMLInputElement | null>(null)

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let cur = ''; let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) { result.push(cur); cur = '' }
    else cur += ch
  }
  result.push(cur)
  return result
}

function handleImportFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = ev => {
    const text = ev.target?.result as string
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) return
    const [headerLine, ...dataLines] = lines
    const [, ...importCodes] = parseCSVLine(headerLine).map(h => h.replace(/^"|"$/g, ''))
    const changes: ReplaceMatch[] = []
    for (const line of dataLines) {
      const cols = parseCSVLine(line)
      const key  = cols[0]?.replace(/^"|"$/g, '') ?? ''
      if (!key) continue
      importCodes.forEach((code, i) => {
        const newVal = cols[i + 1]?.replace(/^"|"$/g, '') ?? ''
        const oldVal = localeData.value[code]?.[key] ?? ''
        if (newVal !== oldVal) changes.push({ key, code, oldValue: oldVal, newValue: newVal })
      })
    }
    importChanges.value = changes
    showImport.value = true
  }
  reader.readAsText(file)
}

async function applyImport() {
  for (const m of importChanges.value) await applyTranslation(m.code, m.key, m.newValue)
  const count = importChanges.value.length
  showImport.value = false
  importChanges.value = []
  if (importFileEl.value) importFileEl.value.value = ''
  toast(`Imported ${count} change${count !== 1 ? 's' : ''}`, 'success')
}

// ── Translate missing ─────────────────────────────────────────────────────────

const showTranslate   = ref(false)
const translateFrom   = ref('')
const translateTo     = ref<string[]>([])
const translateProg   = ref(0)       // 0-100
const translateRunning = ref(false)
const translateDone   = ref(false)

function openTranslate() {
  translateFrom.value = referenceLocale.value
  translateTo.value   = locales.value.map(l => l.code).filter(c => c !== referenceLocale.value)
  translateProg.value  = 0
  translateRunning.value = false
  translateDone.value   = false
  showTranslate.value   = true
}

async function runTranslate() {
  // Pre-flight: check engine is configured
  if (translateEngine.value === 'deepl' && !deeplKey.value) {
    toast('DeepL Auth Key is not set — configure it in Settings', 'error', 6000)
    return
  }

  translateRunning.value = true
  translateDone.value    = false
  translateProg.value    = 0
  const targets = translateTo.value.filter(Boolean)
  if (!targets.length) { translateRunning.value = false; return }

  let done = 0
  for (const toCode of targets) {
    const missing = allKeys.value.filter(k => !localeData.value[toCode]?.[k])
    if (missing.length) {
      const values = missing.map(k => localeData.value[translateFrom.value]?.[k] ?? '')
      try {
        const translated = await translateMissing({
          values, from: translateFrom.value, to: toCode,
          engine: translateEngine.value,
          apiUrl: libreUrl.value, apiKey: libreKey.value || undefined,
          deeplKey: deeplKey.value || undefined,
          formality: deeplFormality.value || undefined,
        })
        for (let i = 0; i < missing.length; i++)
          if (translated[i]) await applyTranslation(toCode, missing[i], translated[i])
      } catch (err) {
        const msg = (err as Error).message
        const hint = translateEngine.value === 'libretranslate'
          ? ' — check LibreTranslate URL and API key in Settings'
          : ' — check DeepL Auth Key in Settings'
        toast(`Translation to ${toCode} failed: ${msg}${hint}`, 'error', 7000)
        translateRunning.value = false
        translateDone.value    = false
        return
      }
    }
    done++
    translateProg.value = Math.round((done / targets.length) * 100)
  }
  translateRunning.value = false
  translateDone.value    = true
  toast('Translation complete', 'success')
}

// ── Settings ──────────────────────────────────────────────────────────────────

const showSettings = ref(false)

// ── Shortcut help ─────────────────────────────────────────────────────────────

const showShortcuts = ref(false)

const shortcuts = [
  { keys: 'Ctrl+P',    desc: 'Quick Open — jump to key' },
  { keys: 'Ctrl+H',    desc: 'Find & Replace in translations' },
  { keys: 'Ctrl+Z',    desc: 'Undo last change' },
  { keys: '?',         desc: 'Show shortcut cheatsheet' },
  { keys: 'Esc',       desc: 'Close open panel / dialog' },
  { keys: 'Enter',     desc: 'Save cell (table edit mode)' },
  { keys: 'Tab',       desc: 'Move to next locale cell' },
]

// ── Dashboard namespace filter ─────────────────────────────────────────────────

function handleFilterNamespace(ns: string) {
  externalSearch.value = ns
  section.value = 'editor'
}

// ── Global keyboard shortcuts ─────────────────────────────────────────────────

function handleGlobalKey(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement).tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  if (e.ctrlKey && e.key === 'p') { e.preventDefault(); openQuickOpen() }
  if (e.ctrlKey && e.key === 'h') { e.preventDefault(); showFindReplace.value = true }
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); handleUndo() }
  if (e.key === '?' && !e.ctrlKey && !e.altKey) { e.preventDefault(); showShortcuts.value = !showShortcuts.value }
  if (e.key === 'Escape') {
    if (showShortcuts.value)   { showShortcuts.value = false;   return }
    if (showSettings)          { showSettings.value = false;    return }
    if (showTranslate.value)   { showTranslate.value = false;   return }
    if (showSortConfirm.value) { showSortConfirm.value = false; return }
    if (showAddLocale.value)   { showAddLocale.value = false;   return }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKey)
  document.addEventListener('click', closeHeaderMenus)
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKey)
  document.removeEventListener('click', closeHeaderMenus)
  if (sseSource) { sseSource.close(); sseSource = null }
  if (sseReconnectTimer) clearTimeout(sseReconnectTimer)
})

// ── Mount ─────────────────────────────────────────────────────────────────────

onMounted(async () => {
  const config = await fetchConfig()
  locales.value      = config.locales
  projectCwd.value   = config.cwd
  configIgnore.value = config.ignore ?? {}
  configRules.value  = config.rules ?? {}
  lockedKeys.value   = config.lockedKeys ?? []
  memoryEnabled.value  = config.memoryEnabled !== false
  namespacesMode.value = config.namespacesMode ?? false
  if (!referenceLocale.value) referenceLocale.value = config.locales[0]?.code ?? ''

  await Promise.all(config.locales.map(async locale => {
    const raw = await fetch(`/api/locale/${locale.code}`).then(r => r.json())
    rawLocaleData.value = { ...rawLocaleData.value, [locale.code]: raw }
    const messages = await fetchLocale(locale.code)
    localeData.value = { ...localeData.value, [locale.code]: messages }
  }))

  const [entriesResult, notesResult, gitResult, staleResult] = await Promise.all([
    fetchEntries(),
    fetchNotes(),
    fetchGitStatus(),
    fetchStale(),
  ])
  entries.value = entriesResult
  notes.value = notesResult
  modifiedLocales.value = gitResult.modified
  staleKeys.value = staleResult.staleKeys
  staleTracking.value = staleResult.tracking

  loading.value = false
  connectSSE()

  // ── Deep-link: ?key=nav.home&edit=en ─────────────────────────────────────
  // Set by DevOverlay "Open in full editor" button. Jump to the key and
  // optionally open it in edit mode for the specified locale.
  const params   = new URLSearchParams(location.search)
  const deepKey  = params.get('key')
  const deepEdit = params.get('edit')

  if (deepKey) {
    // Clean up URL so a page refresh doesn't re-trigger the deep-link
    history.replaceState(null, '', location.pathname)

    section.value = 'editor'
    setTimeout(() => {
      tableRef.value?.jumpToKey(deepKey)
      if (deepEdit) {
        const currentValue = localeData.value[deepEdit]?.[deepKey] ?? ''
        tableRef.value?.startEdit(deepKey, deepEdit, currentValue)
      }
    }, 50)
  }
})
</script>

<template>
  <!-- ── Header ────────────────────────────────────────────────────────────── -->
  <header class="header">
    <div class="header-brand">
      <Icon name="globe" :size="14" class="brand-icon" />
      <span class="header-title">vue-i18n-kit</span>
    </div>

    <nav class="nav">
      <button class="nav-btn" :class="{ active: section === 'dashboard' }" @click="section = 'dashboard'">
        <Icon name="dashboard" :size="13" />Dashboard
      </button>
      <button class="nav-btn" :class="{ active: section === 'editor' }" @click="section = 'editor'">
        <Icon name="editor" :size="13" />Editor
      </button>
    </nav>

    <template v-if="!loading">
      <span class="header-stats">
        <Icon name="layers" :size="12" />{{ allKeys.length }} keys
        <span class="sep">&bull;</span>
        <Icon name="globe" :size="12" />{{ locales.length }} locales
        <span v-if="undoStack.length" class="undo-hint">
          <span class="sep">&bull;</span>
          <Icon name="undo" :size="11" />{{ undoStack.length }}
        </span>
      </span>

      <!-- Auto-save indicator -->
      <span v-if="isSaving > 0" class="save-indicator save-indicator--saving">
        <span class="save-dot" />Saving…
      </span>
      <span v-else-if="lastSaved" class="save-indicator save-indicator--saved">
        <Icon name="check" :size="10" />Saved
      </span>

      <!-- SSE live indicator -->
      <span v-if="sseSource" class="sse-dot" title="Live reload connected" />

      <!-- Action buttons -->
      <div class="header-actions">
        <button class="header-icon-btn" title="Quick Open (Ctrl+P)" @click="openQuickOpen">
          <Icon name="search" :size="13" />
        </button>
        <button class="header-icon-btn" title="Find &amp; Replace (Ctrl+H)" @click="showFindReplace = true">
          <Icon name="replace" :size="13" />
        </button>
        <button class="header-icon-btn" title="Translate missing (LibreTranslate)" @click="openTranslate">
          <Icon name="languages" :size="13" />
        </button>
        <button class="header-icon-btn" title="Sort keys alphabetically" @click="showSortConfirm = true">
          <Icon name="sort" :size="13" />
        </button>
        <button class="header-icon-btn" title="Add locale" @click="openAddLocale">
          <Icon name="globe" :size="13" />
        </button>
        <!-- Export dropdown -->
        <div class="header-dropdown" @click.stop>
          <button
            class="header-icon-btn"
            :class="{ active: showExportMenu }"
            title="Export"
            @click="showExportMenu = !showExportMenu; showImportMenu = false"
          >
            <Icon name="download" :size="13" />
          </button>
          <div v-if="showExportMenu" class="header-dropdown-menu">
            <button class="header-dropdown-item" @click="exportCsv(); showExportMenu = false">
              <Icon name="download" :size="12" />Export CSV
            </button>
            <div class="header-dropdown-sep" />
            <button class="header-dropdown-item" @click="openExportLocale('xliff')">
              <Icon name="languages" :size="12" />Export XLIFF…
            </button>
            <button class="header-dropdown-item" @click="openExportLocale('po')">
              <Icon name="languages" :size="12" />Export PO…
            </button>
          </div>
        </div>

        <!-- Import dropdown -->
        <div class="header-dropdown" @click.stop>
          <button
            class="header-icon-btn"
            :class="{ active: showImportMenu }"
            title="Import"
            @click="showImportMenu = !showImportMenu; showExportMenu = false"
          >
            <Icon name="upload" :size="13" />
          </button>
          <div v-if="showImportMenu" class="header-dropdown-menu">
            <label class="header-dropdown-item">
              <Icon name="upload" :size="12" />Import CSV
              <input ref="importFileEl" type="file" accept=".csv" class="sr-only" @change="handleImportFile($event); showImportMenu = false" />
            </label>
            <label class="header-dropdown-item">
              <Icon name="upload" :size="12" />Import XLIFF / PO
              <input ref="xliffImportEl" type="file" accept=".xliff,.xlf,.po" class="sr-only" @change="handleXliffImportFile($event); showImportMenu = false" />
            </label>
          </div>
        </div>
        <button class="header-icon-btn" title="Undo (Ctrl+Z)" :disabled="!undoStack.length" @click="handleUndo">
          <Icon name="undo" :size="13" />
        </button>
        <button class="header-icon-btn" title="Keyboard shortcuts (?)" @click="showShortcuts = true">
          <Icon name="info" :size="13" />
        </button>
        <div class="header-sep" />
        <button class="header-icon-btn" :class="{ active: showSettings }" title="Settings" @click="showSettings = !showSettings">
          <Icon name="settings" :size="13" />
        </button>
      </div>

      <!-- Settings popover -->
      <div v-if="showSettings" class="settings-popover">
        <div class="settings-title">
          <Icon name="settings" :size="12" />Settings
        </div>

        <label class="settings-field-label">Reference locale</label>
        <div class="settings-locale-list">
          <button
            v-for="locale in locales"
            :key="locale.code"
            class="settings-locale-btn"
            :class="{ active: referenceLocale === locale.code }"
            @click="referenceLocale = locale.code"
          >
            <span>{{ locale.meta?.flag ?? '🌐' }}</span>
            <span>{{ locale.meta?.display ?? locale.code }}</span>
            <Icon v-if="referenceLocale === locale.code" name="check" :size="11" class="ref-check" />
          </button>
        </div>

        <label class="settings-field-label">IDE scheme</label>
        <select v-model="ideScheme" class="settings-select">
          <option value="vscode">VS Code</option>
          <option value="cursor">Cursor</option>
          <option value="webstorm">WebStorm</option>
          <option value="phpstorm">PhpStorm</option>
          <option value="idea">IntelliJ IDEA</option>
        </select>

        <label class="settings-field-label">Translation engine</label>
        <div class="settings-engine-toggle">
          <button
            class="settings-engine-btn"
            :class="{ active: translateEngine === 'libretranslate' }"
            @click="translateEngine = 'libretranslate'"
          >LibreTranslate</button>
          <button
            class="settings-engine-btn"
            :class="{ active: translateEngine === 'deepl' }"
            @click="translateEngine = 'deepl'"
          >DeepL</button>
        </div>

        <template v-if="translateEngine === 'libretranslate'">
          <label class="settings-field-label">LibreTranslate URL</label>
          <input v-model="libreUrl" class="settings-input" placeholder="https://libretranslate.com" />
          <label class="settings-field-label">LibreTranslate API key <span class="settings-optional">(optional)</span></label>
          <input v-model="libreKey" class="settings-input" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" type="password" />
        </template>

        <template v-else>
          <label class="settings-field-label">DeepL Auth Key</label>
          <input v-model="deeplKey" class="settings-input" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx" type="password" />
          <label class="settings-field-label">Formality <span class="settings-optional">(DE, FR, IT, ES, NL, PL, PT, JA, RU)</span></label>
          <select v-model="deeplFormality" class="settings-select">
            <option value="default">Default</option>
            <option value="more">More formal</option>
            <option value="less">Less formal</option>
            <option value="prefer_more">Prefer more formal</option>
            <option value="prefer_less">Prefer less formal</option>
          </select>
          <p class="settings-hint">
            Free plan: 500,000 chars/month. Keys ending in <code style="font-size:10px">:fx</code> use the free API endpoint automatically.
          </p>
        </template>

        <template v-if="memoryEnabled">
          <label class="settings-field-label">Translation memory</label>
          <div class="settings-memory-row">
            <a class="settings-memory-btn" :href="exportMemoryUrl()" download="i18n-kit.memory.json">
              <Icon name="copy" :size="11" />Export
            </a>
            <button class="settings-memory-btn settings-memory-btn--danger" @click="clearMemory().then(() => toast('Translation memory cleared', 'success'))">
              <Icon name="trash" :size="11" />Clear
            </button>
          </div>
        </template>

        <p class="settings-hint">
          Reference locale is used for placeholder, HTML tag, and length validation.
          Settings are saved to localStorage.
        </p>
      </div>

      <button v-if="section === 'editor'" class="btn-new-key" @click="openCreateDialog">
        <Icon name="plus" :size="13" />New key
      </button>
    </template>
  </header>

  <!-- Click-outside to close settings -->
  <div v-if="showSettings" class="settings-backdrop" @click="showSettings = false" />

  <!-- ── Content ────────────────────────────────────────────────────────────── -->
  <div v-if="loading" class="loading">
    <span class="loading-dot" />Loading locales…
  </div>

  <template v-else>
    <Dashboard
      v-if="section === 'dashboard'"
      :locales="locales"
      :locale-data="localeData"
      :all-keys="allKeys"
      :entries="entries"
      :duplicate-keys="duplicateKeys"
      :phantom-keys="phantomKeys"
      :unused-keys="unusedKeys"
      @filter-namespace="handleFilterNamespace"
    />

    <LocaleTable
      v-else
      ref="tableRef"
      :keys="tableKeys"
      :locales="locales"
      :locale-data="localeData"
      :entries="entries"
      :reference-locale="referenceLocale"
      :notes="notes"
      :modified-locales="modifiedLocales"
      :project-cwd="projectCwd"
      :ide-scheme="ideScheme"
      :external-search="externalSearch"
      :duplicate-keys="duplicateKeys"
      :phantom-keys="phantomKeys"
      :locked-keys="lockedKeys"
      :stale-keys="staleKeys"
      :rules="configRules"
      :memory-enabled="memoryEnabled"
      :namespaces-mode="namespacesMode"
      @save="(c, k, v) => applyTranslation(c, k, v)"
      @delete-key="handleDeleteKey"
      @delete-keys="handleBatchDeleteKeys"
      @rename-key="handleRenameKey"
      @duplicate-key="handleDuplicateKey"
      @save-note="handleSaveNote"
      @mark-reviewed="handleMarkReviewed"
      @create-key-in-group="handleCreateKeyInGroup"
      @rename-group="handleRenameGroup"
    />
  </template>

  <!-- ── Toast ─────────────────────────────────────────────────────────────── -->
  <Toast />

  <!-- ── Overlays ───────────────────────────────────────────────────────────── -->
  <Teleport to="body">

    <!-- Create key -->
    <div v-if="showCreateDialog" class="overlay" @click.self="showCreateDialog = false">
      <div class="dialog">
        <div class="dialog-header">
          <div class="dlg-icon dlg-icon--indigo"><Icon name="plus" :size="14" /></div>
          <p class="dialog-title">New translation key</p>
        </div>
        <label class="field-label">Key path</label>
        <input v-model="newKeyPath" class="field-input" placeholder="e.g. buttons.submit" @keydown.enter="submitCreateKey" @keydown.esc="showCreateDialog = false" />
        <p v-if="createError" class="field-error"><Icon name="warning" :size="12" />{{ createError }}</p>
        <template v-if="locales.length">
          <label class="field-label mt">Initial values <span class="field-note">(optional)</span></label>
          <div class="locale-fields">
            <div v-for="locale in locales" :key="locale.code" class="locale-field-row">
              <span class="locale-field-lbl">{{ locale.meta?.flag ?? '' }} {{ locale.meta?.display ?? locale.code }}</span>
              <input v-model="newKeyValues[locale.code]" class="field-input" :placeholder="locale.code" @keydown.esc="showCreateDialog = false" />
            </div>
          </div>
        </template>
        <div class="dialog-actions">
          <button class="dlg-btn dlg-btn--cancel" @click="showCreateDialog = false"><Icon name="close" :size="11" />Cancel</button>
          <button class="dlg-btn dlg-btn--confirm" @click="submitCreateKey"><Icon name="check" :size="11" />Create</button>
        </div>
      </div>
    </div>

    <!-- Quick Open -->
    <div v-if="showQuickOpen" class="overlay" @click.self="closeQuickOpen">
      <div class="quick-open">
        <div class="qo-search-wrap">
          <Icon name="search" :size="14" class="qo-icon" />
          <input
            v-model="quickOpenQuery"
            class="qo-input"
            placeholder="Jump to key…"
            autofocus
            @keydown="quickOpenKeydown"
          />
          <span class="qo-hint">↑↓ navigate · Enter select · Esc close</span>
        </div>
        <div class="qo-list">
          <button
            v-for="(key, idx) in quickOpenResults"
            :key="key"
            class="qo-item"
            :class="{ 'qo-item--sel': idx === quickOpenSel }"
            @mouseenter="quickOpenSel = idx"
            @click="selectQuickOpenKey(key)"
          >
            <Icon name="key" :size="11" class="qo-key-icon" />
            <span class="qo-key-text">{{ key }}</span>
          </button>
          <div v-if="quickOpenResults.length === 0" class="qo-empty">No keys found</div>
        </div>
      </div>
    </div>

    <!-- Find & Replace -->
    <div v-if="showFindReplace" class="overlay" @click.self="showFindReplace = false">
      <div class="dialog dialog--wide">
        <div class="dialog-header">
          <div class="dlg-icon dlg-icon--indigo"><Icon name="replace" :size="14" /></div>
          <p class="dialog-title">Find &amp; Replace</p>
        </div>
        <div class="fr-row">
          <div class="fr-field">
            <label class="field-label">Find</label>
            <input v-model="findStr" class="field-input" placeholder="Search text…" />
          </div>
          <div class="fr-field">
            <label class="field-label">Replace with</label>
            <input v-model="replaceStr" class="field-input" placeholder="Replacement text…" />
          </div>
          <div class="fr-field fr-field--narrow">
            <label class="field-label">In locale</label>
            <select v-model="findLocaleFilter" class="field-input field-select">
              <option value="all">All locales</option>
              <option v-for="l in locales" :key="l.code" :value="l.code">{{ l.meta?.display ?? l.code }}</option>
            </select>
          </div>
        </div>
        <div class="fr-preview">
          <div class="fr-preview-header">
            <span class="field-label">Preview</span>
            <span class="fr-count">{{ replaceMatches.length }} matches</span>
          </div>
          <div class="fr-preview-list">
            <div v-if="!findStr" class="fr-empty">Enter search text to see matches.</div>
            <div v-else-if="replaceMatches.length === 0" class="fr-empty">No matches found.</div>
            <div v-for="m in replaceMatches.slice(0, 100)" :key="m.key + m.code" class="fr-match">
              <span class="fr-match-key"><Icon name="key" :size="10" />{{ m.key }}</span>
              <span class="fr-match-code">{{ m.code }}</span>
              <span class="fr-match-old">{{ m.oldValue }}</span>
              <Icon name="chevronRight" :size="10" class="fr-arrow" />
              <span class="fr-match-new">{{ m.newValue }}</span>
            </div>
          </div>
        </div>
        <div class="dialog-actions">
          <button class="dlg-btn dlg-btn--cancel" @click="showFindReplace = false"><Icon name="close" :size="11" />Cancel</button>
          <button class="dlg-btn dlg-btn--confirm" :disabled="replaceMatches.length === 0" @click="applyReplace">
            <Icon name="replace" :size="11" />Replace {{ replaceMatches.length > 0 ? replaceMatches.length : '' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Import CSV preview -->
    <div v-if="showImport" class="overlay" @click.self="showImport = false">
      <div class="dialog dialog--wide">
        <div class="dialog-header">
          <div class="dlg-icon dlg-icon--indigo"><Icon name="upload" :size="14" /></div>
          <p class="dialog-title">Import CSV — Preview</p>
        </div>
        <div class="fr-preview">
          <div class="fr-preview-header">
            <span class="field-label">Changes</span>
            <span class="fr-count">{{ importChanges.length }} cells affected</span>
          </div>
          <div class="fr-preview-list">
            <div v-if="importChanges.length === 0" class="fr-empty">No changes detected.</div>
            <div v-for="m in importChanges.slice(0, 150)" :key="m.key + m.code" class="fr-match">
              <span class="fr-match-key"><Icon name="key" :size="10" />{{ m.key }}</span>
              <span class="fr-match-code">{{ m.code }}</span>
              <span class="fr-match-old">{{ m.oldValue || '—' }}</span>
              <Icon name="chevronRight" :size="10" class="fr-arrow" />
              <span class="fr-match-new">{{ m.newValue }}</span>
            </div>
          </div>
        </div>
        <div class="dialog-actions">
          <button class="dlg-btn dlg-btn--cancel" @click="showImport = false"><Icon name="close" :size="11" />Cancel</button>
          <button class="dlg-btn dlg-btn--confirm" :disabled="importChanges.length === 0" @click="applyImport">
            <Icon name="upload" :size="11" />Apply {{ importChanges.length > 0 ? importChanges.length + ' changes' : '' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Sort confirm -->
    <div v-if="showSortConfirm" class="overlay" @click.self="showSortConfirm = false">
      <div class="dialog">
        <div class="dialog-header">
          <div class="dlg-icon dlg-icon--yellow"><Icon name="sort" :size="14" /></div>
          <p class="dialog-title">Sort all keys?</p>
        </div>
        <p class="dlg-body-text">
          This will alphabetically sort all keys in every locale file and save the result immediately.
          The undo stack will be cleared.
        </p>
        <div class="dialog-actions">
          <button class="dlg-btn dlg-btn--cancel" @click="showSortConfirm = false"><Icon name="close" :size="11" />Cancel</button>
          <button class="dlg-btn dlg-btn--confirm" @click="handleSort"><Icon name="sort" :size="11" />Sort keys</button>
        </div>
      </div>
    </div>

    <!-- Add locale -->
    <div v-if="showAddLocale" class="overlay" @click.self="showAddLocale = false">
      <div class="dialog">
        <div class="dialog-header">
          <div class="dlg-icon dlg-icon--indigo"><Icon name="globe" :size="14" /></div>
          <p class="dialog-title">Add locale</p>
        </div>
        <div class="add-locale-grid">
          <div class="fr-field">
            <label class="field-label">Locale code <span class="field-hint">BCP 47, e.g. fr, zh-CN</span></label>
            <input v-model="addLocaleCode" class="field-input" placeholder="fr" @keydown.enter="submitAddLocale" @keydown.esc="showAddLocale = false" @input="addLocaleError = ''" />
          </div>
          <div class="fr-field">
            <label class="field-label">File path <span class="field-hint">relative to project root</span></label>
            <input v-model="addLocalePath" class="field-input" placeholder="src/locales/fr.json" @keydown.enter="submitAddLocale" @keydown.esc="showAddLocale = false" @input="addLocaleError = ''" />
          </div>
          <div class="fr-field">
            <label class="field-label">Display name <span class="field-hint">optional</span></label>
            <input v-model="addLocaleDisplay" class="field-input" placeholder="Français" @keydown.enter="submitAddLocale" @keydown.esc="showAddLocale = false" />
          </div>
          <div class="fr-field">
            <label class="field-label">Flag emoji <span class="field-hint">optional</span></label>
            <input v-model="addLocaleFlag" class="field-input" placeholder="🇫🇷" @keydown.enter="submitAddLocale" @keydown.esc="showAddLocale = false" />
          </div>
        </div>
        <p v-if="addLocaleError" class="dialog-error">{{ addLocaleError }}</p>
        <div class="dialog-actions">
          <button class="dlg-btn dlg-btn--cancel" @click="showAddLocale = false"><Icon name="close" :size="11" />Cancel</button>
          <button class="dlg-btn dlg-btn--confirm" @click="submitAddLocale"><Icon name="plus" :size="11" />Add locale</button>
        </div>
      </div>
    </div>

    <!-- Export XLIFF/PO -->
    <div v-if="showExportLocale" class="overlay" @click.self="showExportLocale = false">
      <div class="dialog">
        <div class="dialog-header">
          <div class="dlg-icon dlg-icon--indigo"><Icon name="languages" :size="14" /></div>
          <p class="dialog-title">Export for translators</p>
        </div>
        <label class="field-label">Locale</label>
        <div class="settings-locale-list">
          <button v-for="locale in locales" :key="locale.code"
            class="settings-locale-btn" :class="{ active: exportLocaleCode === locale.code }"
            @click="exportLocaleCode = locale.code">
            <span>{{ locale.meta?.flag ?? '🌐' }}</span>
            <span>{{ locale.meta?.display ?? locale.code }}</span>
            <Icon v-if="exportLocaleCode === locale.code" name="check" :size="11" class="ref-check" />
          </button>
        </div>
        <label class="field-label mt">Format</label>
        <div class="format-btns">
          <button class="format-btn" :class="{ active: exportFormat === 'xliff' }" @click="exportFormat = 'xliff'">XLIFF</button>
          <button class="format-btn" :class="{ active: exportFormat === 'po' }" @click="exportFormat = 'po'">PO (Gettext)</button>
        </div>
        <p class="field-hint-text">XLIFF is supported by most translation management systems (Lokalise, Phrase, etc.). PO is the Gettext standard used by many open-source tools.</p>
        <div class="dialog-actions">
          <button class="dlg-btn dlg-btn--cancel" @click="showExportLocale = false"><Icon name="close" :size="11" />Cancel</button>
          <button class="dlg-btn dlg-btn--confirm" @click="submitExportLocale"><Icon name="download" :size="11" />Export</button>
        </div>
      </div>
    </div>

    <!-- Translate missing -->
    <div v-if="showTranslate" class="overlay" @click.self="!translateRunning && (showTranslate = false)">
      <div class="dialog dialog--wide">
        <div class="dialog-header">
          <div class="dlg-icon dlg-icon--indigo"><Icon name="languages" :size="14" /></div>
          <p class="dialog-title">Translate missing</p>
        </div>

        <div v-if="translateDone" class="translate-done">
          <Icon name="check" :size="16" />
          Translation complete!
        </div>
        <template v-else>
          <div class="fr-row">
            <div class="fr-field fr-field--narrow">
              <label class="field-label">Source locale</label>
              <select v-model="translateFrom" class="field-input field-select">
                <option v-for="l in locales" :key="l.code" :value="l.code">{{ l.meta?.display ?? l.code }}</option>
              </select>
            </div>
            <div class="fr-field">
              <label class="field-label">Target locales</label>
              <div class="translate-targets">
                <label
                  v-for="l in locales.filter(x => x.code !== translateFrom)"
                  :key="l.code"
                  class="translate-target-check"
                >
                  <Checkbox
                    :model-value="translateTo.includes(l.code)"
                    @update:model-value="v => { if (v) translateTo.push(l.code); else translateTo.splice(translateTo.indexOf(l.code), 1) }"
                  />
                  <span>{{ l.meta?.flag ?? '' }} {{ l.meta?.display ?? l.code }}</span>
                  <span class="translate-missing-count">
                    {{ allKeys.filter(k => !localeData[l.code]?.[k]).length }} missing
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div v-if="translateRunning" class="translate-progress">
            <div class="translate-prog-bar">
              <div class="translate-prog-fill" :style="{ width: translateProg + '%' }" />
            </div>
            <span class="translate-prog-txt">{{ translateProg }}%</span>
          </div>

          <p v-if="translateEngine === 'deepl' && !deeplKey" class="translate-warn">
            <Icon name="warning" :size="11" />
            DeepL Auth Key is not set. Open <strong>Settings</strong> to add it.
          </p>
          <p v-else-if="translateEngine === 'libretranslate' && libreUrl === 'https://libretranslate.com' && !libreKey" class="translate-warn">
            <Icon name="warning" :size="11" />
            The public LibreTranslate instance requires an API key. Open <strong>Settings</strong> to add it, or change the URL to a self-hosted instance.
          </p>
          <p class="settings-hint">
            Uses <strong>{{ translateEngine === 'deepl' ? 'DeepL' : 'LibreTranslate' }}</strong> (configured in Settings).
            Existing translations are not overwritten.
            <template v-if="translateEngine === 'deepl' && deeplFormality !== 'default'">
              Formality: <strong>{{ deeplFormality }}</strong>.
            </template>
          </p>
        </template>

        <div class="dialog-actions">
          <button class="dlg-btn dlg-btn--cancel" :disabled="translateRunning" @click="showTranslate = false">
            <Icon name="close" :size="11" />{{ translateDone ? 'Close' : 'Cancel' }}
          </button>
          <button
            v-if="!translateDone"
            class="dlg-btn dlg-btn--confirm"
            :disabled="translateRunning || translateTo.length === 0"
            @click="runTranslate"
          >
            <Icon name="wand" :size="11" />
            {{ translateRunning ? 'Translating…' : 'Translate' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Shortcut cheatsheet -->
    <div v-if="showShortcuts" class="overlay" @click.self="showShortcuts = false">
      <div class="dialog shortcuts-dialog">
        <div class="dialog-header">
          <div class="dlg-icon dlg-icon--indigo"><Icon name="info" :size="14" /></div>
          <p class="dialog-title">Keyboard shortcuts</p>
        </div>
        <div class="shortcuts-list">
          <div v-for="s in shortcuts" :key="s.keys" class="shortcut-row">
            <kbd class="kbd">{{ s.keys }}</kbd>
            <span class="shortcut-desc">{{ s.desc }}</span>
          </div>
        </div>
        <div class="dialog-actions">
          <button class="dlg-btn dlg-btn--cancel" @click="showShortcuts = false"><Icon name="close" :size="11" />Close</button>
        </div>
      </div>
    </div>

  </Teleport>
</template>

<style scoped>
/* ── Header ── */
.header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  height: 52px;
  background: #18181b;
  border-bottom: 1px solid #27272a;
  flex-shrink: 0;
  z-index: 50;
}

.header-brand { display: flex; align-items: center; gap: 7px; }
.brand-icon { color: #52525b; }
.header-title { font-size: 13px; font-weight: 600; color: #52525b; letter-spacing: 0.04em; }

.nav {
  display: flex; gap: 2px;
  background: #0f0f11; border: 1px solid #27272a; border-radius: 7px; padding: 3px;
}
.nav-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 12px; border-radius: 5px; border: none;
  background: transparent; color: #52525b;
  font-size: 12px; font-weight: 600; cursor: pointer;
  transition: background 0.15s, color 0.15s; font-family: inherit; letter-spacing: 0.03em;
}
.nav-btn:hover { color: #a1a1aa; }
.nav-btn.active { background: #27272a; color: #e4e4e7; }

.header-stats {
  display: flex; align-items: center; gap: 5px;
  font-size: 12px; color: #52525b;
}
.sep { color: #3f3f46; }
.undo-hint { display: flex; align-items: center; gap: 4px; color: #3f3f46; }

/* Save indicator */
.save-indicator {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; white-space: nowrap;
}
.save-indicator--saving { color: #fbbf24; }
.save-indicator--saved  { color: #4ade80; }
.save-dot {
  width: 6px; height: 6px; background: #fbbf24; border-radius: 50%;
  animation: pulse 0.8s ease-in-out infinite;
}

/* SSE dot */
.sse-dot {
  width: 6px; height: 6px;
  background: #4ade80;
  border-radius: 50%;
  box-shadow: 0 0 4px #4ade80;
  flex-shrink: 0;
}

.header-actions { display: flex; align-items: center; gap: 2px; margin-left: auto; }
.header-icon-btn {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border: 1px solid transparent; border-radius: 6px;
  background: transparent; color: #52525b; cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.header-icon-btn:hover { background: #27272a; color: #a1a1aa; border-color: #3f3f46; }
.header-icon-btn.active { background: #27272a; color: #818cf8; border-color: rgba(129,140,248,0.3); }
.header-icon-btn:disabled { opacity: 0.3; cursor: default; }
.header-sep { width: 1px; height: 18px; background: #27272a; margin: 0 2px; }

/* ── Header dropdowns ── */
.header-dropdown { position: relative; }
.header-dropdown-menu {
  position: absolute; top: calc(100% + 4px); right: 0;
  background: #18181b; border: 1px solid #27272a; border-radius: 8px;
  padding: 4px; min-width: 168px; z-index: 60;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
}
.header-dropdown-item {
  display: flex; align-items: center; gap: 7px;
  width: 100%; padding: 6px 10px;
  background: none; border: none; border-radius: 5px;
  color: #a1a1aa; font-size: 12px; font-family: inherit;
  cursor: pointer; text-align: left; white-space: nowrap; box-sizing: border-box;
}
.header-dropdown-item:hover { background: #27272a; color: #e4e4e7; }
.header-dropdown-sep { height: 1px; background: #27272a; margin: 3px 4px; }

.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }

/* ── Settings popover ── */
.settings-backdrop {
  position: fixed; inset: 0; z-index: 49;
}
.settings-popover {
  position: absolute; top: 54px; right: 16px;
  background: #18181b; border: 1px solid #27272a; border-radius: 10px;
  padding: 14px 16px; width: 260px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.5);
  z-index: 60;
  display: flex; flex-direction: column; gap: 8px;
}
.settings-title {
  display: flex; align-items: center; gap: 7px;
  font-size: 11px; font-weight: 700; color: #71717a;
  text-transform: uppercase; letter-spacing: 0.06em;
}
.settings-field-label {
  font-size: 11px; font-weight: 600; color: #52525b;
  text-transform: uppercase; letter-spacing: 0.05em;
  margin-top: 4px;
}
.settings-optional { font-weight: 400; text-transform: none; letter-spacing: 0; color: #3f3f46; }
.settings-engine-toggle { display: flex; gap: 4px; }
.settings-engine-btn { flex: 1; padding: 5px 8px; background: #27272a; border: 1px solid #3f3f46; border-radius: 6px; color: #71717a; font-size: 12px; cursor: pointer; transition: all 0.12s; }
.settings-engine-btn:hover { border-color: #52525b; color: #d4d4d8; }
.settings-engine-btn.active { background: rgba(129,140,248,0.12); border-color: rgba(129,140,248,0.35); color: #c7d2fe; }
.settings-memory-row { display: flex; gap: 6px; }
.settings-memory-btn { display: flex; align-items: center; gap: 5px; padding: 5px 10px; background: #27272a; border: 1px solid #3f3f46; border-radius: 6px; color: #a1a1aa; font-size: 12px; cursor: pointer; text-decoration: none; transition: all 0.12s; }
.settings-memory-btn:hover { border-color: #52525b; color: #d4d4d8; }
.settings-memory-btn--danger:hover { border-color: rgba(239,68,68,0.4); color: #f87171; }
.settings-locale-list { display: flex; flex-direction: column; gap: 2px; }
.settings-locale-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 9px; border-radius: 6px; border: 1px solid transparent;
  background: transparent; color: #a1a1aa;
  font-size: 12px; font-family: inherit; cursor: pointer; text-align: left;
  transition: background 0.1s, border-color 0.1s;
}
.settings-locale-btn:hover { background: #27272a; }
.settings-locale-btn.active { background: rgba(129,140,248,0.1); border-color: rgba(129,140,248,0.2); color: #c7d2fe; }
.ref-check { margin-left: auto; color: #818cf8; }
.settings-select, .settings-input {
  width: 100%; box-sizing: border-box;
  background: #0f0f11; border: 1px solid #27272a; border-radius: 6px;
  color: #d4d4d8; font-size: 12px; font-family: inherit;
  padding: 5px 9px; outline: none; transition: border-color 0.15s;
}
.settings-select:focus, .settings-input:focus { border-color: #818cf8; }
.settings-select { cursor: pointer; }
.settings-hint { font-size: 11px; color: #3f3f46; line-height: 1.5; margin-top: 4px; }

.btn-new-key {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 13px; background: #27272a; border: 1px solid #3f3f46;
  border-radius: 6px; color: #d4d4d8; font-size: 12px; font-weight: 600;
  font-family: inherit; cursor: pointer; transition: background 0.12s, border-color 0.12s;
  flex-shrink: 0;
}
.btn-new-key:hover { background: #3f3f46; border-color: #52525b; }

/* ── Loading ── */
.loading {
  display: flex; align-items: center; justify-content: center;
  gap: 10px; flex: 1; color: #52525b; font-size: 13px;
}
.loading-dot {
  width: 6px; height: 6px; background: #3f3f46; border-radius: 50%;
  animation: pulse 1.4s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50%       { opacity: 1;   transform: scale(1); }
}

/* ── Overlays ── */
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.65);
  display: flex; align-items: center; justify-content: center;
  z-index: 100; backdrop-filter: blur(2px);
}

/* ── Shared dialog ── */
.dialog {
  background: #18181b; border: 1px solid #27272a; border-radius: 12px;
  padding: 22px 24px; width: 440px;
  display: flex; flex-direction: column; gap: 10px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03);
}
.dialog--wide { width: 680px; max-width: 96vw; }
.dialog-header { display: flex; align-items: center; gap: 10px; margin-bottom: 2px; }
.dlg-icon {
  width: 30px; height: 30px; border-radius: 7px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.dlg-icon--indigo { background: rgba(129,140,248,0.12); border: 1px solid rgba(129,140,248,0.2); color: #818cf8; }
.dlg-icon--yellow { background: rgba(251,191,36,0.12);  border: 1px solid rgba(251,191,36,0.2);  color: #fbbf24; }
.dialog-title { font-size: 14px; font-weight: 700; color: #e4e4e7; margin: 0; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.dlg-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 16px; border-radius: 6px; border: 1px solid #27272a;
  font-size: 12px; font-family: inherit; font-weight: 600; cursor: pointer;
  transition: background 0.12s;
}
.dlg-btn:disabled { opacity: 0.4; cursor: default; }
.dlg-btn--cancel  { background: #27272a; color: #a1a1aa; }
.dlg-btn--cancel:hover  { background: #3f3f46; }
.dlg-btn--confirm { background: rgba(129,140,248,0.15); color: #818cf8; border-color: rgba(129,140,248,0.25); }
.dlg-btn--confirm:not(:disabled):hover { background: rgba(129,140,248,0.25); }
.dlg-body-text { font-size: 12px; color: #71717a; line-height: 1.6; }
.dialog-error { font-size: 11px; color: #f87171; margin: 4px 0 0; }
.field-hint { font-weight: 400; color: #52525b; font-size: 10px; margin-left: 4px; }
.add-locale-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 4px; }

/* ── Shared field ── */
.field-label {
  font-size: 11px; font-weight: 600; color: #71717a;
  text-transform: uppercase; letter-spacing: 0.05em;
}
.field-label.mt { margin-top: 6px; }
.field-note { font-weight: 400; text-transform: none; letter-spacing: 0; color: #52525b; }
.field-input {
  width: 100%; box-sizing: border-box;
  background: #0f0f11; border: 1px solid #27272a; border-radius: 6px;
  color: #d4d4d8; font-size: 12px; font-family: inherit;
  padding: 6px 10px; outline: none; transition: border-color 0.15s;
}
.field-input:focus { border-color: #818cf8; }
.field-input::placeholder { color: #3f3f46; }
.field-select { cursor: pointer; }
.field-error { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #f87171; }
.locale-fields { display: flex; flex-direction: column; gap: 5px; }
.locale-field-row { display: flex; align-items: center; gap: 8px; }
.locale-field-lbl { font-size: 12px; color: #71717a; width: 110px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ── Quick Open ── */
.quick-open {
  background: #18181b; border: 1px solid #27272a; border-radius: 12px;
  width: 560px; max-width: 96vw; overflow: hidden;
  box-shadow: 0 24px 64px rgba(0,0,0,0.6);
}
.qo-search-wrap {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 16px; border-bottom: 1px solid #27272a;
}
.qo-icon { color: #52525b; flex-shrink: 0; }
.qo-input {
  flex: 1; background: transparent; border: none; outline: none;
  color: #e4e4e7; font-size: 14px; font-family: inherit;
}
.qo-input::placeholder { color: #3f3f46; }
.qo-hint { font-size: 10px; color: #3f3f46; white-space: nowrap; flex-shrink: 0; }
.qo-list { max-height: 380px; overflow-y: auto; padding: 4px; }
.qo-item {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 8px 12px; border-radius: 6px; border: none;
  background: transparent; color: #a1a1aa; font-size: 12px;
  font-family: 'SF Mono', 'Fira Code', monospace; cursor: pointer; text-align: left;
  transition: background 0.08s;
}
.qo-item--sel { background: #27272a; color: #e4e4e7; }
.qo-item--sel .qo-key-icon { color: #818cf8; }
.qo-key-icon { color: #3f3f46; flex-shrink: 0; }
.qo-key-text { flex: 1; }
.qo-empty { padding: 24px; text-align: center; color: #3f3f46; font-size: 13px; font-style: italic; }

/* ── Find & Replace ── */
.fr-row { display: flex; gap: 10px; }
.fr-field { display: flex; flex-direction: column; gap: 5px; flex: 1; }
.fr-field--narrow { flex: 0 0 160px; }
.fr-preview {
  border: 1px solid #27272a; border-radius: 8px; overflow: hidden;
  background: #111113;
}
.fr-preview-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; border-bottom: 1px solid #27272a; background: #18181b;
}
.fr-count { font-size: 11px; color: #52525b; }
.fr-preview-list { max-height: 220px; overflow-y: auto; }
.fr-empty { padding: 20px; text-align: center; color: #3f3f46; font-size: 12px; font-style: italic; }
.fr-match {
  display: flex; align-items: baseline; gap: 7px;
  padding: 5px 12px; border-bottom: 1px solid #1c1c1f; font-size: 12px; flex-wrap: wrap;
}
.fr-match:last-child { border-bottom: none; }
.fr-match-key { display: flex; align-items: center; gap: 4px; color: #818cf8; font-family: 'SF Mono','Fira Code',monospace; flex-shrink: 0; }
.fr-match-code { background: #1c1c1f; border: 1px solid #27272a; border-radius: 3px; padding: 0 5px; font-size: 10px; color: #52525b; flex-shrink: 0; font-family: monospace; }
.fr-match-old { color: #f87171; text-decoration: line-through; flex: 1; min-width: 0; word-break: break-word; }
.fr-arrow { color: #3f3f46; flex-shrink: 0; }
.fr-match-new { color: #4ade80; flex: 1; min-width: 0; word-break: break-word; }

/* ── Translate ── */
.translate-targets {
  display: flex; flex-direction: column; gap: 4px;
}
.translate-target-check {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; color: #a1a1aa; cursor: pointer;
  padding: 4px 6px; border-radius: 5px; transition: background 0.1s;
}
.translate-target-check:hover { background: #27272a; }
.translate-target-check input { accent-color: #818cf8; cursor: pointer; }
.translate-missing-count { margin-left: auto; font-size: 10px; color: #52525b; }
.translate-progress { display: flex; align-items: center; gap: 10px; margin: 4px 0; }
.translate-prog-bar {
  flex: 1; height: 5px; background: #27272a; border-radius: 3px; overflow: hidden;
}
.translate-prog-fill {
  height: 100%;
  background: linear-gradient(90deg, #818cf8, #a5b4fc);
  border-radius: 3px;
  transition: width 0.4s ease;
}
.translate-prog-txt { font-size: 11px; color: #818cf8; width: 32px; text-align: right; flex-shrink: 0; }
.translate-done {
  display: flex; align-items: center; gap: 8px;
  font-size: 14px; font-weight: 600; color: #4ade80;
  padding: 12px 0;
}
.translate-warn {
  display: flex; align-items: flex-start; gap: 6px;
  font-size: 12px; color: #f59e0b;
  background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2);
  border-radius: 6px; padding: 8px 10px; line-height: 1.5;
}

/* ── Shortcuts ── */
.shortcuts-dialog { max-width: 400px; }
.shortcuts-list { display: flex; flex-direction: column; gap: 2px; }
.shortcut-row {
  display: flex; align-items: center; gap: 12px;
  padding: 6px 8px; border-radius: 5px;
}
.shortcut-row:nth-child(even) { background: #111113; }
.kbd {
  display: inline-flex; align-items: center;
  background: #27272a; border: 1px solid #3f3f46; border-radius: 5px;
  padding: 2px 8px; font-size: 11px; font-family: 'SF Mono', 'Fira Code', monospace;
  color: #d4d4d8; white-space: nowrap; min-width: 80px; justify-content: center;
  flex-shrink: 0;
}
.shortcut-desc { font-size: 12px; color: #a1a1aa; }
</style>
