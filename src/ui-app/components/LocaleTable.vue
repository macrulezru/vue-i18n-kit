<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import Icon from './Icon.vue'
import Checkbox from './Checkbox.vue'
import { usePersisted } from '../composables/usePersisted'
import type { LocaleInfo, LocaleData, LocaleEntries, I18nKitRules, MemorySuggestion } from '../api'
import { fetchMemorySuggestions, saveMemoryEntry } from '../api'

const props = defineProps<{
  keys: string[]
  locales: LocaleInfo[]
  localeData: LocaleData
  entries: LocaleEntries
  referenceLocale: string
  notes: Record<string, string>
  modifiedLocales: string[]
  projectCwd?: string
  ideScheme?: string
  externalSearch?: string
  duplicateKeys?: string[]
  phantomKeys?: string[]
  lockedKeys?: string[]
  staleKeys?: string[]
  rules?: I18nKitRules
  memoryEnabled?: boolean
  namespacesMode?: boolean
}>()

const emit = defineEmits<{
  save:              [code: string, key: string, value: string]
  deleteKey:         [key: string]
  deleteKeys:        [keys: string[]]
  renameKey:         [oldKey: string, newKey: string]
  duplicateKey:      [key: string, newKey: string]
  saveNote:          [key: string, note: string]
  createKeyInGroup:  [prefix: string]
  renameGroup:       [oldPrefix: string, newPrefix: string]
  markReviewed:      [keys: string[]]
}>()

// ── Persisted state ───────────────────────────────────────────────────────────

const density = usePersisted<'compact' | 'default' | 'relaxed'>('i18nkit:density', 'default')

// ── Namespace mode ────────────────────────────────────────────────────────────

const activeNamespace = ref<string | null>(null)

const topNamespaces = computed(() => {
  const seen = new Set<string>()
  for (const key of props.keys) {
    const dot = key.indexOf('.')
    if (dot > 0) seen.add(key.slice(0, dot))
  }
  return [...seen].sort()
})

// ── Toolbar ───────────────────────────────────────────────────────────────────

const search = ref('')
const filter  = ref<'all' | 'missing' | 'complete' | 'unused' | 'phantom' | 'stale'>('all')

// External search override (e.g. from namespace click in Dashboard)
watch(() => props.externalSearch, val => { if (val != null) search.value = val }, { immediate: true })

// ── Collapse ──────────────────────────────────────────────────────────────────

const collapsed = ref<Record<string, boolean>>({})
function toggleGroup(prefix: string) { collapsed.value = { ...collapsed.value, [prefix]: !collapsed.value[prefix] } }
function collapseAll() {
  collapsed.value = Object.fromEntries(collectAllPrefixes(filteredKeys.value).map(p => [p, true]))
}
function expandAll() { collapsed.value = {} }

// ── Validation ────────────────────────────────────────────────────────────────

function extractPlaceholders(str: string): string[] {
  return [...str.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort()
}
function extractHtmlTags(str: string): string[] {
  return [...str.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g)].map(m => m[0]).sort()
}

function hasPlaceholderMismatch(key: string, code: string): boolean {
  if (code === props.referenceLocale) return false
  const value = props.localeData[code]?.[key]; const refVal = props.localeData[props.referenceLocale]?.[key]
  if (!value || !refVal) return false
  return JSON.stringify(extractPlaceholders(refVal)) !== JSON.stringify(extractPlaceholders(value))
}
function hasTagMismatch(key: string, code: string): boolean {
  if (code === props.referenceLocale) return false
  const value = props.localeData[code]?.[key]; const refVal = props.localeData[props.referenceLocale]?.[key]
  if (!value || !refVal) return false
  const refTags = extractHtmlTags(refVal); if (!refTags.length) return false
  return JSON.stringify(refTags) !== JSON.stringify(extractHtmlTags(value))
}
function getIcuError(value: string): string | null {
  if (!value) return null
  const opens = (value.match(/\{/g) ?? []).length; const closes = (value.match(/\}/g) ?? []).length
  if (opens !== closes) return 'Unbalanced braces'
  if (/\{[^}]+,\s*(plural|select)/.test(value) && !value.includes('other {')) return 'Missing "other" case'
  return null
}
function lengthRatio(key: string, code: string): number {
  if (code === props.referenceLocale) return 1
  const value = props.localeData[code]?.[key]; const refVal = props.localeData[props.referenceLocale]?.[key]
  if (!value || !refVal || !refVal.length) return 1
  return value.length / refVal.length
}

function isMissing(key: string, code: string): boolean { return props.localeData[code]?.[key] === undefined }
function isEmpty(key: string, code: string): boolean    { return props.localeData[code]?.[key] === '' }

// ── Row building (recursive tree) ────────────────────────────────────────────

interface RenderGroup {
  type: 'group'
  prefix: string    // full dotted path, e.g. 'auth.form'
  name: string      // last segment, e.g. 'form'
  depth: number
  keyCount: number  // total descendant key count
  isEmpty?: boolean // virtual group — no real keys yet
}
interface RenderItem {
  type: 'item'
  key: string
  label: string   // last segment
  depth: number
}
type RenderRow = RenderGroup | RenderItem

// Virtual groups: exist in UI only, no keys yet (cleared on reload)
const virtualGroups = ref<string[]>([])

// Build flat render list respecting collapsed state (recursive)
function buildRenderRows(keys: string[], prefix: string, depth: number): RenderRow[] {
  const rows: RenderRow[] = []
  const seenGroups = new Set<string>()

  for (const key of keys) {
    const relative = prefix ? key.slice(prefix.length + 1) : key
    const dot = relative.indexOf('.')
    if (dot === -1) {
      rows.push({ type: 'item', key, label: relative, depth })
    } else {
      const seg = relative.slice(0, dot)
      const fullPrefix = prefix ? `${prefix}.${seg}` : seg
      if (!seenGroups.has(fullPrefix)) {
        seenGroups.add(fullPrefix)
        const childKeys = keys.filter(k => k.startsWith(fullPrefix + '.'))
        rows.push({ type: 'group', prefix: fullPrefix, name: seg, depth, keyCount: childKeys.length })
        if (!collapsed.value[fullPrefix]) {
          rows.push(...buildRenderRows(childKeys, fullPrefix, depth + 1))
        }
      }
    }
  }

  // Inject virtual groups at this level (those whose parent prefix matches)
  for (const vg of virtualGroups.value) {
    if (seenGroups.has(vg)) continue
    const parentOfVg = vg.includes('.') ? vg.slice(0, vg.lastIndexOf('.')) : ''
    if (parentOfVg !== prefix) continue
    // Only show if no real keys exist under this prefix
    if (keys.some(k => k.startsWith(vg + '.'))) continue
    seenGroups.add(vg)
    const name = vg.slice(vg.lastIndexOf('.') + 1)
    rows.push({ type: 'group', prefix: vg, name, depth, keyCount: 0, isEmpty: true })
    // Show empty group body only when not collapsed
    if (!collapsed.value[vg]) {
      // nothing to recurse — no keys
    }
  }

  return rows
}

function keyPassesFilters(key: string): boolean {
  // Namespace filter
  if (activeNamespace.value) {
    const ns = activeNamespace.value
    if (key !== ns && !key.startsWith(ns + '.')) return false
  }
  const q = search.value.toLowerCase()
  if (q) {
    const inKey    = key.toLowerCase().includes(q)
    const inValues = props.locales.some(l => (props.localeData[l.code]?.[key] ?? '').toLowerCase().includes(q))
    const inNote   = (props.notes[key] ?? '').toLowerCase().includes(q)
    if (!inKey && !inValues && !inNote) return false
  }
  if (filter.value === 'unused'   && props.entries[key]?.length) return false
  if (filter.value === 'phantom'  && !props.phantomKeys?.includes(key)) return false
  if (filter.value === 'stale'    && !props.staleKeys?.includes(key)) return false
  if (filter.value === 'missing'  && !props.locales.some(l => !props.localeData[l.code]?.[key])) return false
  if (filter.value === 'complete' && props.locales.some(l => !props.localeData[l.code]?.[key]))  return false
  return true
}

const filteredKeys = computed(() => props.keys.filter(keyPassesFilters))
const renderRows   = computed<RenderRow[]>(() => buildRenderRows(filteredKeys.value, '', 0))
const matchCount   = computed(() => filteredKeys.value.length)
const flatItems    = computed(() =>
  renderRows.value.filter(r => r.type === 'item').map(r => (r as RenderItem).key)
)

// Collect ALL group prefixes regardless of collapsed state (for collapse-all)
function collectAllPrefixes(keys: string[], prefix = ''): string[] {
  const result: string[] = []
  const seen = new Set<string>()
  for (const key of keys) {
    const rel = prefix ? key.slice(prefix.length + 1) : key
    const dot = rel.indexOf('.')
    if (dot !== -1) {
      const seg = rel.slice(0, dot)
      const full = prefix ? `${prefix}.${seg}` : seg
      if (!seen.has(full)) {
        seen.add(full)
        result.push(full)
        result.push(...collectAllPrefixes(keys.filter(k => k.startsWith(full + '.')), full))
      }
    }
  }
  return result
}

// ── Batch select ──────────────────────────────────────────────────────────────

const selectedKeys = ref<Set<string>>(new Set())
function toggleSelect(key: string) {
  const s = new Set(selectedKeys.value)
  if (s.has(key)) s.delete(key); else s.add(key)
  selectedKeys.value = s
}
function toggleSelectAll() {
  if (selectedKeys.value.size === filteredKeys.value.length) selectedKeys.value = new Set()
  else selectedKeys.value = new Set(filteredKeys.value)
}
function clearSelection() { selectedKeys.value = new Set() }

const allVisibleSelected = computed(() =>
  filteredKeys.value.length > 0 && filteredKeys.value.every(k => selectedKeys.value.has(k))
)
const someVisibleSelected = computed(() =>
  filteredKeys.value.some(k => selectedKeys.value.has(k))
)

function bulkDelete() {
  emit('deleteKeys', [...selectedKeys.value])
  selectedKeys.value = new Set()
}

// ── Keyboard navigation ───────────────────────────────────────────────────────

const tableWrapEl = ref<HTMLElement | null>(null)
const kbRow = ref(-1)
const kbCol = ref(0)

function handleTableKeydown(e: KeyboardEvent) {
  if (editingCell.value) return
  if (e.key === 'ArrowDown')  { e.preventDefault(); kbRow.value = Math.min(kbRow.value + 1, flatItems.value.length - 1) }
  else if (e.key === 'ArrowUp')   { e.preventDefault(); kbRow.value = Math.max(kbRow.value - 1, 0) }
  else if (e.key === 'ArrowRight') { e.preventDefault(); kbCol.value = Math.min(kbCol.value + 1, props.locales.length) }
  else if (e.key === 'ArrowLeft')  { e.preventDefault(); kbCol.value = Math.max(kbCol.value - 1, 0) }
  else if (e.key === 'Enter' && kbRow.value >= 0) {
    e.preventDefault()
    const key = flatItems.value[kbRow.value]
    if (kbCol.value === 0) toggleKey(key)
    else { const l = props.locales[kbCol.value - 1]; if (l) startEdit(key, l.code, props.localeData[l.code]?.[key] ?? '') }
  }
  else if (e.key === 'Escape') { kbRow.value = -1; kbCol.value = 0 }
  else if (e.key === ' ' && kbRow.value >= 0) { e.preventDefault(); toggleSelect(flatItems.value[kbRow.value]) }
}
function isFocusedCell(key: string, col: number) { return flatItems.value[kbRow.value] === key && kbCol.value === col }

// ── Detail row ────────────────────────────────────────────────────────────────

const selectedKey = ref<string | null>(null)
function toggleKey(key: string) { selectedKey.value = selectedKey.value === key ? null : key }

// ── Inline editing ────────────────────────────────────────────────────────────

const editingCell  = ref<{ key: string; code: string; originalValue: string } | null>(null)
const editingValue = ref('')
const editInputEl  = ref<HTMLTextAreaElement | HTMLTextAreaElement[] | null>(null)

// ── Translation memory ────────────────────────────────────────────────────────
const memorySuggestions = ref<MemorySuggestion[]>([])
const memoryLoading     = ref(false)

async function loadMemorySuggestions(key: string, code: string) {
  if (!props.memoryEnabled || code === props.referenceLocale) { memorySuggestions.value = []; return }
  const refValue = props.localeData[props.referenceLocale]?.[key]
  if (!refValue) { memorySuggestions.value = []; return }
  memoryLoading.value = true
  try { memorySuggestions.value = await fetchMemorySuggestions(refValue, props.referenceLocale, code) }
  catch { memorySuggestions.value = [] }
  finally { memoryLoading.value = false }
}

function applyMemorySuggestion(target: string) {
  editingValue.value = target
  const el = getEditEl()
  if (el) { el.focus(); autoResize(el) }
}

function autoResize(el: HTMLTextAreaElement) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 200) + 'px' }

function getEditEl(): HTMLTextAreaElement | null {
  const v = editInputEl.value
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function startEdit(key: string, code: string, currentValue: string) {
  editingCell.value = { key, code, originalValue: currentValue }
  editingValue.value = currentValue
  memorySuggestions.value = []
  loadMemorySuggestions(key, code)
  nextTick(() => { const el = getEditEl(); if (el) { el.focus(); autoResize(el) } })
}
function cancelEdit() { editingCell.value = null; editingValue.value = ''; memorySuggestions.value = [] }
function confirmEdit() {
  if (!editingCell.value) return
  const { code, key } = editingCell.value
  const newValue = editingValue.value
  emit('save', code, key, newValue)

  // Save to translation memory if the value changed and it's a translation locale
  if (props.memoryEnabled && code !== props.referenceLocale && newValue && newValue !== editingCell.value.originalValue) {
    const refValue = props.localeData[props.referenceLocale]?.[key]
    if (refValue) {
      saveMemoryEntry({ source: refValue, sourceLocale: props.referenceLocale, target: newValue, targetLocale: code, key })
        .catch(() => { /* fire and forget */ })
    }
  }

  editingCell.value = null; editingValue.value = ''; memorySuggestions.value = []
}
function onEditKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
  else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmEdit() }
}
function isEditing(key: string, code: string) { return editingCell.value?.key === key && editingCell.value?.code === code }

// ── Copy from reference ───────────────────────────────────────────────────────

function copyFromRef(key: string, code: string) {
  const refVal = props.localeData[props.referenceLocale]?.[key] ?? ''
  startEdit(key, code, refVal)
}

// ── Unified ICU preview (interpolation + plural) ──────────────────────────────

const previewValues = ref<Record<string, string>>({})

type PreviewVar = { name: string; type: 'plural' | 'text' }

/** Collect all variables in a key: plural vars (numeric) + simple {var} vars (text) */
function allPreviewVars(key: string): PreviewVar[] {
  const allVals = props.locales.map(l => props.localeData[l.code]?.[key] ?? '').join(' ')
  const pluralNames = new Set<string>()
  const textNames   = new Set<string>()
  let m: RegExpExecArray | null

  const pluralRe = /\{(\w+)\s*,\s*plural\s*,/g
  while ((m = pluralRe.exec(allVals)) !== null) pluralNames.add(m[1])

  const textRe = /\{(\w+)\}/g
  while ((m = textRe.exec(allVals)) !== null) {
    if (!pluralNames.has(m[1])) textNames.add(m[1])
  }

  return [
    ...[...pluralNames].map(name => ({ name, type: 'plural' as const })),
    ...[...textNames].map(name => ({ name, type: 'text' as const })),
  ]
}

/** Render a locale string: resolve all {var, plural,...} blocks, then replace {var} */
function renderIcuFull(str: string, key: string, localeCode: string): string {
  if (!str) return '—'
  let result = str

  // find all plural variable names present in this string
  const pluralVarRe = /\{(\w+)\s*,\s*plural\s*,/g
  let m: RegExpExecArray | null
  const pluralVarList: string[] = []
  while ((m = pluralVarRe.exec(result)) !== null) {
    if (!pluralVarList.includes(m[1])) pluralVarList.push(m[1])
  }

  for (const varName of pluralVarList) {
    // find block start
    const startRe = new RegExp(`\\{\\s*${varName}\\s*,\\s*plural\\s*,`)
    const mStart = startRe.exec(result)
    if (!mStart) continue

    // walk forward counting braces to find block end
    let pos = mStart.index + mStart[0].length
    let depth = 1
    while (pos < result.length && depth > 0) {
      if (result[pos] === '{') depth++
      else if (result[pos] === '}') depth--
      pos++
    }

    const block  = result.slice(mStart.index, pos)
    const cases  = parseIcuCases(block, varName) ?? {}
    const count  = parseInt(previewValues.value[`${key}:${varName}`] ?? '1', 10) || 0

    let resolved: string
    if ((`=${count}`) in cases) {
      resolved = cases[`=${count}`]
    } else {
      let cat = 'other'
      try { cat = new Intl.PluralRules(localeCode).select(count) } catch { /* noop */ }
      resolved = cases[cat] ?? cases['other'] ?? block
    }
    resolved = resolved.replace(/#/g, String(count))
    result = result.slice(0, mStart.index) + resolved + result.slice(pos)
  }

  // replace remaining simple {var} placeholders
  result = result.replace(/\{(\w+)\}/g, (_, varName) =>
    previewValues.value[`${key}:${varName}`] ?? `{${varName}}`
  )

  return result
}

/** Parse ICU plural cases from a string using brace counting (handles nested braces) */
function parseIcuCases(str: string, varName: string): Record<string, string> | null {
  const startRe = new RegExp(`\\{\\s*${varName}\\s*,\\s*plural\\s*,\\s*`)
  const m = startRe.exec(str)
  if (!m) return null

  let pos = m.index + m[0].length
  const cases: Record<string, string> = {}

  while (pos < str.length) {
    // skip whitespace
    while (pos < str.length && /\s/.test(str[pos])) pos++
    if (pos >= str.length || str[pos] === '}') break

    // read case name: "one", "other", "few", "=0" etc.
    const nameStart = pos
    while (pos < str.length && str[pos] !== '{' && str[pos] !== '}') pos++
    const caseName = str.slice(nameStart, pos).trim()
    if (!caseName || str[pos] !== '{') break

    // read body counting nested braces
    pos++ // skip opening {
    let depth = 1
    const bodyStart = pos
    while (pos < str.length && depth > 0) {
      if (str[pos] === '{') depth++
      else if (str[pos] === '}') depth--
      pos++
    }
    cases[caseName] = str.slice(bodyStart, pos - 1)
  }

  return Object.keys(cases).length ? cases : null
}

// ── Jump to key ───────────────────────────────────────────────────────────────

function jumpToKey(key: string) {
  const dot = key.indexOf('.')
  if (dot !== -1) collapsed.value = { ...collapsed.value, [key.slice(0, dot)]: false }
  nextTick(() => {
    const idx = flatItems.value.indexOf(key)
    if (idx !== -1) { kbRow.value = idx; kbCol.value = 0; selectedKey.value = key }
    const el = tableWrapEl.value?.querySelector(`[data-key="${CSS.escape(key)}"]`) as HTMLElement | null
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}
defineExpose({ jumpToKey, startEdit })

// ── Copy locale JSON ──────────────────────────────────────────────────────────

const copiedLocale = ref<string | null>(null)
async function copyLocaleJson(code: string) {
  const nested: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(props.localeData[code] ?? {})) {
    const parts = k.split('.'); let cur = nested
    for (let i = 0; i < parts.length - 1; i++) { if (typeof cur[parts[i]] !== 'object') cur[parts[i]] = {}; cur = cur[parts[i]] as Record<string, unknown> }
    cur[parts[parts.length - 1]] = v
  }
  await navigator.clipboard.writeText(JSON.stringify(nested, null, 2))
  copiedLocale.value = code; setTimeout(() => { copiedLocale.value = null }, 1500)
}

// ── Rename / Duplicate / Delete / Note ───────────────────────────────────────

const renamingKey = ref<string | null>(null); const renameTarget = ref(''); const renameError = ref('')
function openRename(key: string) { renamingKey.value = key; renameTarget.value = key; renameError.value = '' }
function closeRename() { renamingKey.value = null }
function submitRename() {
  const nk = renameTarget.value.trim()
  if (!nk || nk === renamingKey.value) { closeRename(); return }
  if (!/^[a-zA-Z0-9_][\w.]*$/.test(nk)) { renameError.value = 'Invalid key format.'; return }
  if (props.keys.includes(nk)) { renameError.value = `Key "${nk}" already exists.`; return }
  emit('renameKey', renamingKey.value!, nk); closeRename()
}

const duplicatingKey = ref<string | null>(null); const duplicateTarget = ref(''); const duplicateError = ref('')
function openDuplicate(key: string) { duplicatingKey.value = key; duplicateTarget.value = key + '_copy'; duplicateError.value = '' }
function closeDuplicate() { duplicatingKey.value = null }
function submitDuplicate() {
  const nk = duplicateTarget.value.trim()
  if (!nk) { closeDuplicate(); return }
  if (!/^[a-zA-Z0-9_][\w.]*$/.test(nk)) { duplicateError.value = 'Invalid key format.'; return }
  if (props.keys.includes(nk)) { duplicateError.value = `Key "${nk}" already exists.`; return }
  emit('duplicateKey', duplicatingKey.value!, nk); closeDuplicate()
}

const pendingDelete = ref<string | null>(null)
function requestDelete(key: string) { pendingDelete.value = key }
function cancelDelete() { pendingDelete.value = null }
function confirmDelete() { if (pendingDelete.value) emit('deleteKey', pendingDelete.value); pendingDelete.value = null }

// ── Group operations ──────────────────────────────────────────────────────────

const renamingGroup   = ref<string | null>(null)
const renameGroupTarget = ref('')
const renameGroupError  = ref('')

function openRenameGroup(prefix: string) {
  renamingGroup.value   = prefix
  renameGroupTarget.value = prefix
  renameGroupError.value  = ''
}
function closeRenameGroup() { renamingGroup.value = null }
function submitRenameGroup() {
  const np = renameGroupTarget.value.trim()
  if (!np || np === renamingGroup.value) { closeRenameGroup(); return }
  if (!/^[a-zA-Z0-9_]\w*$/.test(np)) { renameGroupError.value = 'Only letters, numbers, underscores.'; return }
  const conflict = props.keys.some(k => k.startsWith(np + '.') && !k.startsWith(renamingGroup.value! + '.'))
  if (conflict) { renameGroupError.value = `Namespace "${np}" already exists.`; return }
  emit('renameGroup', renamingGroup.value!, np)
  closeRenameGroup()
}

const pendingDeleteGroup = ref<string | null>(null)
function groupChildren(prefix: string): string[] {
  return props.keys.filter(k => k.startsWith(prefix + '.'))
}
function requestDeleteGroup(prefix: string) {
  // Virtual (empty) group — remove immediately, no confirmation needed
  if (virtualGroups.value.includes(prefix) && !groupChildren(prefix).length) {
    virtualGroups.value = virtualGroups.value.filter(g => g !== prefix)
    return
  }
  pendingDeleteGroup.value = prefix
}
function cancelDeleteGroup() { pendingDeleteGroup.value = null }
function confirmDeleteGroup() {
  if (pendingDeleteGroup.value) {
    emit('deleteKeys', groupChildren(pendingDeleteGroup.value))
    // Also clean up virtual state if it was a mixed group
    virtualGroups.value = virtualGroups.value.filter(g => !g.startsWith(pendingDeleteGroup.value! + '.') && g !== pendingDeleteGroup.value)
  }
  pendingDeleteGroup.value = null
}

const editingNoteKey = ref<string | null>(null); const editingNoteValue = ref('')
function openNote(key: string) { editingNoteKey.value = key; editingNoteValue.value = props.notes[key] ?? '' }
function closeNote() { editingNoteKey.value = null }
function submitNote() { emit('saveNote', editingNoteKey.value!, editingNoteValue.value.trim()); closeNote() }

// ── New group dialog ──────────────────────────────────────────────────────────

const showNewGroup   = ref(false)
const newGroupParent = ref('')
const newGroupName   = ref('')
const newGroupError  = ref('')

const newGroupFullPrefix = computed(() =>
  [newGroupParent.value, newGroupName.value.trim()].filter(Boolean).join('.')
)

function openNewGroup(parentPrefix = '') {
  newGroupParent.value = parentPrefix
  newGroupName.value   = ''
  newGroupError.value  = ''
  showNewGroup.value   = true
}
function closeNewGroup() { showNewGroup.value = false }
function submitNewGroup() {
  const seg = newGroupName.value.trim()
  if (!seg) { newGroupError.value = 'Enter a group name.'; return }
  if (!/^[a-zA-Z0-9_]\w*$/.test(seg)) { newGroupError.value = 'Only letters, numbers, underscores.'; return }
  const full = newGroupFullPrefix.value
  if (virtualGroups.value.includes(full) || props.keys.some(k => k.startsWith(full + '.'))) {
    newGroupError.value = `Group "${full}" already exists.`; return
  }
  virtualGroups.value = [...virtualGroups.value, full]
  closeNewGroup()
}

// ── Locked key check ──────────────────────────────────────────────────────────

function isLocked(key: string): boolean {
  const patterns = props.lockedKeys
  if (!patterns?.length) return false
  return patterns.some(p => {
    if (p === key) return true
    if (p.endsWith('.*')) { const pfx = p.slice(0, -2); return key === pfx || key.startsWith(pfx + '.') }
    if (p.endsWith('.**')) return key.startsWith(p.slice(0, -3) + '.')
    if (p === '**' || p === '*') return true
    if (p.includes('*')) { try { return new RegExp('^' + p.replace(/\./g, '\\.').replace(/\*/g, '[^.]*') + '$').test(key) } catch { return false } }
    return false
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function localeName(l: LocaleInfo) { return (l.meta?.display as string | undefined) ?? l.code }
function localeFlag(l: LocaleInfo) { return l.meta?.flag as string | undefined }

function cellClass(key: string, code: string) {
  const rules    = props.rules
  const lenFactor = rules?.lengthWarningFactor ?? 2.5
  const editing  = isEditing(key, code)
  const missing  = !editing && isMissing(key, code)
  const empty    = !editing && !missing && isEmpty(key, code)
  const mismatch = !editing && !missing && !empty && hasPlaceholderMismatch(key, code)
  const tagWarn  = !editing && !missing && !empty && (rules?.warnOnHtmlTags !== false) && hasTagMismatch(key, code)
  const icuErr   = !editing && !missing && !empty && (rules?.warnOnIcuErrors !== false) && !!getIcuError(props.localeData[code]?.[key] ?? '')
  const lenWarn  = lenFactor > 0 && !editing && !missing && !empty && lengthRatio(key, code) > lenFactor
  const minLen   = rules?.minValueLength ?? 0
  const tooShort = minLen > 0 && !editing && !missing && !empty && (props.localeData[code]?.[key]?.length ?? 0) < minLen
  const unused   = !props.entries[key]?.length
  const isDup    = (rules?.warnOnDuplicateValues !== false) && (props.duplicateKeys?.includes(key) ?? false)
  return { missing, empty, editing, mismatch, 'tag-warn': tagWarn, 'icu-err': icuErr, 'len-warn': lenWarn || tooShort, 'key-unused': unused && !missing, 'is-dup': isDup && !missing && !empty }
}

function cellWarningIcon(key: string, code: string): string | null {
  const rules = props.rules
  const lenFactor = rules?.lengthWarningFactor ?? 2.5
  if (isMissing(key, code) || isEmpty(key, code)) return null
  if (hasPlaceholderMismatch(key, code) || ((rules?.warnOnHtmlTags !== false) && hasTagMismatch(key, code))) return 'warning'
  if ((rules?.warnOnIcuErrors !== false) && getIcuError(props.localeData[code]?.[key] ?? '')) return 'alertTriangle'
  if (lenFactor > 0 && lengthRatio(key, code) > lenFactor) return 'info'
  return null
}
function cellWarningTitle(key: string, code: string): string | undefined {
  const rules = props.rules
  const lenFactor = rules?.lengthWarningFactor ?? 2.5
  if (hasPlaceholderMismatch(key, code)) return 'Placeholder mismatch vs reference'
  if ((rules?.warnOnHtmlTags !== false) && hasTagMismatch(key, code)) return 'HTML tag mismatch vs reference'
  const icu = (rules?.warnOnIcuErrors !== false) && getIcuError(props.localeData[code]?.[key] ?? ''); if (icu) return `ICU error: ${icu}`
  if (lenFactor > 0 && lengthRatio(key, code) > lenFactor) return `${Math.round(lengthRatio(key, code) * 10) / 10}× longer than reference`
  return undefined
}

function fileUrl(file: string): string {
  const abs = props.projectCwd ? `${props.projectCwd}/${file}`.replace(/\\/g, '/') : file
  switch (props.ideScheme) {
    case 'cursor':    return `cursor://file/${abs}`
    case 'webstorm':  return `webstorm://open?file=${encodeURIComponent(abs)}`
    case 'phpstorm':  return `phpstorm://open?file=${encodeURIComponent(abs)}`
    case 'idea':      return `idea://open?file=${encodeURIComponent(abs)}`
    default:          return `vscode://file/${abs}`
  }
}
</script>

<template>
  <!-- ── Batch toolbar ─────────────────────────────────────────────────────── -->
  <div v-if="selectedKeys.size > 0" class="bulk-bar">
    <Icon name="check" :size="12" class="bulk-check-icon" />
    <span class="bulk-count">{{ selectedKeys.size }} selected</span>
    <button class="bulk-btn bulk-btn--danger" @click="bulkDelete">
      <Icon name="trash" :size="12" />Delete {{ selectedKeys.size }}
    </button>
    <button class="bulk-btn" @click="clearSelection">
      <Icon name="close" :size="11" />Deselect
    </button>
  </div>

  <!-- ── Toolbar ──────────────────────────────────────────────────────────── -->
  <div class="toolbar">
    <div class="search-wrap">
      <Icon name="search" :size="13" class="search-icon" />
      <input v-model="search" class="search-input" placeholder="Search keys, values, notes…" />
      <button v-if="search" class="clear-btn" @click="search = ''"><Icon name="close" :size="10" /></button>
    </div>

    <div class="filter-group">
      <button v-for="opt in (['all','missing','complete'] as const)" :key="opt"
        class="filter-btn" :class="{ active: filter === opt }" @click="filter = opt">
        <span class="filter-dot" :class="'dot--' + opt" />{{ opt }}
      </button>
      <button class="filter-btn filter-btn--unused" :class="{ active: filter === 'unused' }" @click="filter = filter === 'unused' ? 'all' : 'unused'">
        <Icon name="zap" :size="11" />unused
      </button>
      <button v-if="phantomKeys?.length" class="filter-btn filter-btn--phantom" :class="{ active: filter === 'phantom' }" @click="filter = filter === 'phantom' ? 'all' : 'phantom'">
        <Icon name="warning" :size="11" />phantom
        <span class="filter-count">{{ phantomKeys.length }}</span>
      </button>
      <button v-if="staleKeys?.length" class="filter-btn filter-btn--stale" :class="{ active: filter === 'stale' }" @click="filter = filter === 'stale' ? 'all' : 'stale'">
        <Icon name="clock" :size="11" />outdated
        <span class="filter-count filter-count--stale">{{ staleKeys.length }}</span>
      </button>
    </div>

    <div class="toolbar-sep" />

    <button class="toolbar-icon-btn" title="Expand all"  @click="expandAll"><Icon name="chevronDown" :size="13" /></button>
    <button class="toolbar-icon-btn" title="Collapse all" @click="collapseAll"><Icon name="chevronRight" :size="13" /></button>

    <div class="toolbar-sep" />

    <button class="toolbar-new-group-btn" title="New group / namespace" @click="openNewGroup()">
      <Icon name="layers" :size="12" />New group
    </button>

    <div class="toolbar-sep" />

    <div class="density-group">
      <button v-for="d in (['compact','default','relaxed'] as const)" :key="d"
        class="density-btn" :class="{ active: density === d }" :title="d" @click="density = d">
        <span class="density-bar" /><span class="density-bar" /><span v-if="d !== 'compact'" class="density-bar" />
      </button>
    </div>

    <span class="result-count">
      <span class="result-match">{{ matchCount }}</span><span class="result-sep">/</span>{{ keys.length }}
    </span>
  </div>

  <!-- ── Namespace filter bar (only in namespace mode) ──────────────────── -->
  <div v-if="namespacesMode && topNamespaces.length > 1" class="ns-bar">
    <button class="ns-pill" :class="{ 'ns-pill--active': !activeNamespace }" @click="activeNamespace = null">
      All
    </button>
    <button v-for="ns in topNamespaces" :key="ns"
      class="ns-pill" :class="{ 'ns-pill--active': activeNamespace === ns }" @click="activeNamespace = ns">
      {{ ns }}
    </button>
  </div>

  <!-- ── Table ────────────────────────────────────────────────────────────── -->
  <div ref="tableWrapEl" class="table-wrap" :class="'density-' + density" tabindex="0" @keydown="handleTableKeydown">
    <div v-if="filteredKeys.length === 0" class="empty">
      <Icon name="filter" :size="18" class="empty-icon" /><span>No keys match the current filters.</span>
    </div>

    <table v-else>
      <thead>
        <tr>
          <th class="col-select">
            <Checkbox :model-value="allVisibleSelected" :indeterminate="someVisibleSelected && !allVisibleSelected" @update:model-value="toggleSelectAll" />
          </th>
          <th class="col-key"><div class="th-inner"><Icon name="key" :size="11" />Key</div></th>
          <th v-for="locale in locales" :key="locale.code">
            <div class="locale-header">
              <span v-if="localeFlag(locale)" class="locale-flag">{{ localeFlag(locale) }}</span>
              <Icon v-else name="globe" :size="13" class="locale-flag-icon" />
              <span class="locale-name">{{ localeName(locale) }}</span>
              <span class="locale-code" :class="{ 'locale-code--modified': modifiedLocales.includes(locale.code) }">
                <Icon v-if="modifiedLocales.includes(locale.code)" name="gitBranch" :size="9" />{{ locale.code }}
              </span>
              <button class="copy-json-btn" :title="`Copy ${locale.code} as JSON`" @click="copyLocaleJson(locale.code)">
                <Icon :name="copiedLocale === locale.code ? 'check' : 'copy'" :size="11" />
              </button>
              <span v-if="locale.code === referenceLocale" class="ref-badge">ref</span>
            </div>
          </th>
        </tr>
      </thead>

      <tbody>
        <template v-for="row in renderRows" :key="row.type === 'group' ? 'g:' + row.prefix : 'i:' + row.key">

          <!-- ── Group row ── -->
          <tr v-if="row.type === 'group'" class="group-row" @click="toggleGroup(row.prefix)">
            <td class="group-select-cell"></td>
            <td class="group-cell" :colspan="locales.length + 1">
              <div class="group-cell-inner" :style="{ paddingLeft: (row.depth * 16) + 'px' }">
                <Icon :name="collapsed[row.prefix] ? 'chevronRight' : 'chevronDown'" :size="11" class="chevron-icon" />
                <Icon name="layers" :size="11" class="group-ns-icon" />
                <span class="group-name-text">{{ row.name }}</span>
                <span v-if="row.isEmpty" class="group-empty-badge">empty</span>
                <span v-else class="group-count">{{ row.keyCount }}</span>
                <div class="group-actions" @click.stop>
                  <button class="btn-action btn-action--group" title="Add nested group"
                    @click.stop="openNewGroup(row.prefix)">
                    <Icon name="layers" :size="11" />
                  </button>
                  <button class="btn-action btn-action--group" title="Add key to this group"
                    @click.stop="emit('createKeyInGroup', row.prefix)">
                    <Icon name="plus" :size="11" />
                  </button>
                  <button class="btn-action btn-action--group" title="Rename group"
                    @click.stop="openRenameGroup(row.prefix)">
                    <Icon name="edit" :size="11" />
                  </button>
                  <button class="btn-action btn-action--group btn-action--danger" title="Delete group and all its keys"
                    @click.stop="requestDeleteGroup(row.prefix)">
                    <Icon name="trash" :size="11" />
                  </button>
                </div>
              </div>
            </td>
          </tr>

          <!-- ── Item row ── -->
          <template v-else>
            <tr class="data-row"
              :class="{ 'is-open': selectedKey === row.key, 'kb-focused': flatItems[kbRow] === row.key, 'row-selected': selectedKeys.has(row.key) }">
              <td class="col-select" @click.stop>
                <Checkbox :model-value="selectedKeys.has(row.key)" @update:model-value="toggleSelect(row.key)" />
              </td>
              <td class="key-cell" :class="{ 'kb-focus-cell': isFocusedCell(row.key, 0) }" :data-key="row.key" @click="toggleKey(row.key)">
                <div class="key-cell-inner" :style="{ paddingLeft: (row.depth * 16) + 'px' }">
                  <Icon :name="selectedKey === row.key ? 'chevronDown' : 'chevronRight'" :size="10" class="chevron-key-icon" />
                  <Icon name="key" :size="10" class="key-icon" />
                  <span class="key-label">{{ row.label }}</span>
                  <Icon v-if="isLocked(row.key)" name="lock" :size="9" class="key-lock-icon" title="Locked by base dictionary" />
                  <span v-if="phantomKeys?.includes(row.key)" class="badge-phantom" title="Used in code but missing from all locale files"><Icon name="warning" :size="8" />phantom</span>
                  <span v-if="staleKeys?.includes(row.key)" class="badge-stale" title="Reference value changed — needs review"><Icon name="clock" :size="8" />outdated</span>
                  <span v-if="notes[row.key]" class="note-indicator" :title="notes[row.key]"><Icon name="note" :size="9" /></span>
                  <span v-if="duplicateKeys?.includes(row.key)" class="badge-dup" title="Same value in all locales"><Icon name="shuffle" :size="8" />dup</span>
                  <span v-if="!phantomKeys?.includes(row.key) && !entries[row.key]?.length" class="badge-unused"><Icon name="zap" :size="8" />unused</span>
                  <div class="key-actions" @click.stop>
                    <template v-if="!phantomKeys?.includes(row.key)">
                      <button class="btn-action" title="Rename" :disabled="isLocked(row.key)" @click.stop="openRename(row.key)"><Icon name="edit" :size="11" /></button>
                      <button class="btn-action" title="Duplicate" @click.stop="openDuplicate(row.key)"><Icon name="copy" :size="11" /></button>
                    </template>
                    <button class="btn-action" :title="notes[row.key] ? 'Edit note' : 'Add note'" @click.stop="openNote(row.key)">
                      <Icon name="note" :size="11" :style="{ color: notes[row.key] ? '#818cf8' : undefined }" />
                    </button>
                    <button v-if="!phantomKeys?.includes(row.key)" class="btn-action btn-action--danger" title="Delete" :disabled="isLocked(row.key)" @click.stop="requestDelete(row.key)"><Icon name="trash" :size="11" /></button>
                  </div>
                </div>
              </td>
              <td v-for="(locale, colIdx) in locales" :key="locale.code"
                class="value-cell" :class="[cellClass(row.key, locale.code), { 'kb-focus-cell': isFocusedCell(row.key, colIdx + 1), 'value-cell--locked': isLocked(row.key) }]">
                <div v-if="isEditing(row.key, locale.code)" class="edit-wrap">
                  <textarea ref="editInputEl" v-model="editingValue" class="edit-input" rows="1"
                    @input="autoResize($event.target as HTMLTextAreaElement)" @keydown="onEditKeydown" />
                  <!-- Memory suggestions -->
                  <div v-if="memorySuggestions.length" class="memory-suggestions">
                    <span class="memory-label"><Icon name="wand" :size="9" />Memory</span>
                    <button v-for="s in memorySuggestions" :key="s.target"
                      class="memory-chip" :title="`${Math.round(s.similarity * 100)}% match · key: ${s.key}`"
                      @click.stop="applyMemorySuggestion(s.target)">
                      <span class="memory-pct">{{ Math.round(s.similarity * 100) }}%</span>
                      <span class="memory-text">{{ s.target }}</span>
                    </button>
                  </div>
                  <div class="edit-btns">
                    <button class="btn-confirm" title="Save (Enter)" @click="confirmEdit"><Icon name="check" :size="12" /></button>
                    <button class="btn-cancel"  title="Cancel (Esc)" @click="cancelEdit"><Icon name="close" :size="11" /></button>
                  </div>
                </div>
                <span v-else class="value-text" :title="isLocked(row.key) ? 'Key locked by base dictionary' : cellWarningTitle(row.key, locale.code)"
                  @click="isLocked(row.key) ? undefined : startEdit(row.key, locale.code, localeData[locale.code]?.[row.key] ?? '')">
                  <template v-if="isMissing(row.key, locale.code)">
                    <span class="cell-missing">— missing —</span>
                    <button v-if="!isLocked(row.key) && locale.code !== referenceLocale && localeData[referenceLocale]?.[row.key]"
                      class="copy-ref-btn" title="Copy from reference locale" @click.stop="copyFromRef(row.key, locale.code)">
                      <Icon name="copy" :size="9" />ref
                    </button>
                  </template>
                  <span v-else-if="isEmpty(row.key, locale.code)" class="cell-empty">— empty —</span>
                  <template v-else>
                    {{ localeData[locale.code]?.[row.key] }}
                    <Icon v-if="isLocked(row.key)" name="lock" :size="10" class="lock-icon" />
                    <Icon v-else-if="cellWarningIcon(row.key, locale.code)" :name="cellWarningIcon(row.key, locale.code)!" :size="11" class="warn-icon" />
                  </template>
                </span>
              </td>
            </tr>
            <!-- Detail row -->
            <tr v-if="selectedKey === row.key" class="detail-row">
              <td :colspan="locales.length + 2">
                <div class="detail-inner" :style="{ paddingLeft: (14 + row.depth * 16) + 'px' }">
                  <div class="detail-section">
                    <span class="detail-label"><Icon name="eye" :size="11" />Used in</span>
                    <template v-if="entries[row.key]?.length">
                      <a v-for="file in entries[row.key]" :key="file" class="file-chip" :href="fileUrl(file)" target="_blank">
                        <Icon name="code" :size="11" />{{ file }}
                      </a>
                    </template>
                    <span v-else class="no-usages"><Icon name="info" :size="11" />No usages found</span>
                  </div>
                  <div v-if="notes[row.key]" class="detail-section detail-section--note">
                    <span class="detail-label"><Icon name="note" :size="11" />Note</span>
                    <span class="detail-note-text">{{ notes[row.key] }}</span>
                  </div>
                  <!-- ── Unified preview (interpolation + plural) ───────── -->
                  <div v-if="allPreviewVars(row.key).length" class="detail-section detail-section--interp">
                    <span class="detail-label"><Icon name="wand" :size="11" />Preview</span>
                    <div class="interp-inputs">
                      <div v-for="v in allPreviewVars(row.key)" :key="v.name" class="interp-field">
                        <span class="interp-var" :class="{ 'interp-var--plural': v.type === 'plural' }">
                          <span v-if="v.type === 'plural'" class="interp-plural-badge">#</span>&#123;{{ v.name }}&#125;
                        </span>
                        <input
                          v-model="previewValues[`${row.key}:${v.name}`]"
                          class="interp-input"
                          :type="v.type === 'plural' ? 'number' : 'text'"
                          :placeholder="v.type === 'plural' ? '1' : v.name"
                          min="0"
                        />
                      </div>
                    </div>
                    <div class="interp-previews">
                      <div v-for="locale in locales" :key="locale.code" class="interp-preview-row">
                        <span class="interp-code">{{ locale.meta?.flag ?? '' }} {{ locale.code }}</span>
                        <span class="interp-result">{{ renderIcuFull(localeData[locale.code]?.[row.key] ?? '', row.key, locale.code) }}</span>
                      </div>
                    </div>
                  </div>
                  <!-- ── Stale review ───────────────────────────────────── -->
                  <div v-if="staleKeys?.includes(row.key)" class="detail-section detail-section--stale">
                    <span class="detail-stale-msg"><Icon name="clock" :size="11" />Reference value changed — other locales may be outdated</span>
                    <button class="btn-mark-reviewed" @click="emit('markReviewed', [row.key])">
                      <Icon name="check" :size="11" />Mark as reviewed
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </template>

        </template>
      </tbody>
    </table>
  </div>

  <!-- ── Dialogs ──────────────────────────────────────────────────────────── -->
  <Teleport to="body">
    <div v-if="pendingDelete" class="dialog-overlay" @click.self="cancelDelete">
      <div class="dialog">
        <div class="dialog-header"><div class="dlg-icon dlg-icon--red"><Icon name="trash" :size="14" /></div><p class="dialog-title">Delete key?</p></div>
        <p class="dialog-key"><Icon name="key" :size="11" />{{ pendingDelete }}</p>
        <p class="dialog-note">Removes key from all locale files. Cannot be undone.</p>
        <div class="dialog-actions">
          <button class="dlg-btn dlg-btn--cancel" @click="cancelDelete"><Icon name="close" :size="11" />Cancel</button>
          <button class="dlg-btn dlg-btn--danger"  @click="confirmDelete"><Icon name="trash" :size="11" />Delete</button>
        </div>
      </div>
    </div>

    <div v-if="renamingKey" class="dialog-overlay" @click.self="closeRename">
      <div class="dialog">
        <div class="dialog-header"><div class="dlg-icon dlg-icon--indigo"><Icon name="edit" :size="14" /></div><p class="dialog-title">Rename key</p></div>
        <p class="dialog-key"><Icon name="key" :size="11" />{{ renamingKey }}</p>
        <label class="field-label">New key path</label>
        <input v-model="renameTarget" class="field-input" @keydown.enter="submitRename" @keydown.esc="closeRename" />
        <p v-if="renameError" class="field-error"><Icon name="warning" :size="11" />{{ renameError }}</p>
        <div class="dialog-actions">
          <button class="dlg-btn dlg-btn--cancel"  @click="closeRename"><Icon name="close" :size="11" />Cancel</button>
          <button class="dlg-btn dlg-btn--confirm" @click="submitRename"><Icon name="check" :size="11" />Rename</button>
        </div>
      </div>
    </div>

    <div v-if="duplicatingKey" class="dialog-overlay" @click.self="closeDuplicate">
      <div class="dialog">
        <div class="dialog-header"><div class="dlg-icon dlg-icon--indigo"><Icon name="copy" :size="14" /></div><p class="dialog-title">Duplicate key</p></div>
        <p class="dialog-key"><Icon name="key" :size="11" />{{ duplicatingKey }}</p>
        <label class="field-label">New key path</label>
        <input v-model="duplicateTarget" class="field-input" @keydown.enter="submitDuplicate" @keydown.esc="closeDuplicate" />
        <p v-if="duplicateError" class="field-error"><Icon name="warning" :size="11" />{{ duplicateError }}</p>
        <div class="dialog-actions">
          <button class="dlg-btn dlg-btn--cancel"  @click="closeDuplicate"><Icon name="close" :size="11" />Cancel</button>
          <button class="dlg-btn dlg-btn--confirm" @click="submitDuplicate"><Icon name="copy" :size="11" />Duplicate</button>
        </div>
      </div>
    </div>

    <div v-if="editingNoteKey" class="dialog-overlay" @click.self="closeNote">
      <div class="dialog">
        <div class="dialog-header"><div class="dlg-icon dlg-icon--indigo"><Icon name="note" :size="14" /></div><p class="dialog-title">Key note</p></div>
        <p class="dialog-key"><Icon name="key" :size="11" />{{ editingNoteKey }}</p>
        <label class="field-label">Note <span class="field-note">(visible to all editors)</span></label>
        <textarea v-model="editingNoteValue" class="field-input field-textarea" rows="3" placeholder="Context, format hints, constraints…" @keydown.esc="closeNote" />
        <div class="dialog-actions">
          <button class="dlg-btn dlg-btn--cancel"  @click="closeNote"><Icon name="close" :size="11" />Cancel</button>
          <button class="dlg-btn dlg-btn--confirm" @click="submitNote"><Icon name="check" :size="11" />Save note</button>
        </div>
      </div>
    </div>

    <!-- New group -->
    <div v-if="showNewGroup" class="dialog-overlay" @click.self="closeNewGroup">
      <div class="dialog">
        <div class="dialog-header">
          <div class="dlg-icon dlg-icon--indigo"><Icon name="layers" :size="14" /></div>
          <p class="dialog-title">
            {{ newGroupParent ? `New group inside "${newGroupParent}"` : 'New group' }}
          </p>
        </div>
        <p class="dialog-note">
          The group will appear immediately. Add keys to it using the <strong>+</strong> button.
          Empty groups are not saved to disk — they disappear on reload.
        </p>

        <label class="field-label">
          {{ newGroupParent ? `Subgroup name (inside "${newGroupParent}")` : 'Group name' }}
        </label>
        <input
          v-model="newGroupName"
          class="field-input"
          :placeholder="newGroupParent ? 'subgroup' : 'auth'"
          autofocus
          @input="newGroupError = ''"
          @keydown.enter="submitNewGroup"
          @keydown.esc="closeNewGroup"
        />

        <p v-if="newGroupError" class="field-error"><Icon name="warning" :size="11" />{{ newGroupError }}</p>

        <div v-if="newGroupFullPrefix" class="field-hint">
          <Icon name="layers" :size="10" />
          Group path: <strong>{{ newGroupFullPrefix }}</strong>
        </div>

        <div class="dialog-actions">
          <button class="dlg-btn dlg-btn--cancel" @click="closeNewGroup"><Icon name="close" :size="11" />Cancel</button>
          <button class="dlg-btn dlg-btn--confirm" @click="submitNewGroup"><Icon name="layers" :size="11" />Create group</button>
        </div>
      </div>
    </div>

    <!-- Rename group -->
    <div v-if="renamingGroup" class="dialog-overlay" @click.self="closeRenameGroup">
      <div class="dialog">
        <div class="dialog-header">
          <div class="dlg-icon dlg-icon--indigo"><Icon name="edit" :size="14" /></div>
          <p class="dialog-title">Rename namespace</p>
        </div>
        <p class="dialog-key"><Icon name="layers" :size="11" />{{ renamingGroup }}</p>
        <p class="dialog-note">Renames the prefix for all <strong>{{ groupChildren(renamingGroup).length }}</strong> keys in this group.</p>
        <label class="field-label">New namespace name</label>
        <input v-model="renameGroupTarget" class="field-input" @keydown.enter="submitRenameGroup" @keydown.esc="closeRenameGroup" />
        <p v-if="renameGroupError" class="field-error"><Icon name="warning" :size="11" />{{ renameGroupError }}</p>
        <div class="dialog-actions">
          <button class="dlg-btn dlg-btn--cancel"  @click="closeRenameGroup"><Icon name="close" :size="11" />Cancel</button>
          <button class="dlg-btn dlg-btn--confirm" @click="submitRenameGroup"><Icon name="check" :size="11" />Rename</button>
        </div>
      </div>
    </div>

    <!-- Delete group -->
    <div v-if="pendingDeleteGroup" class="dialog-overlay" @click.self="cancelDeleteGroup">
      <div class="dialog">
        <div class="dialog-header">
          <div class="dlg-icon dlg-icon--red"><Icon name="trash" :size="14" /></div>
          <p class="dialog-title">Delete namespace?</p>
        </div>
        <p class="dialog-key"><Icon name="layers" :size="11" />{{ pendingDeleteGroup }}</p>
        <p class="dialog-note">
          Deletes all <strong>{{ groupChildren(pendingDeleteGroup).length }}</strong> keys in this namespace from every locale file. Cannot be undone.
        </p>
        <div class="dialog-actions">
          <button class="dlg-btn dlg-btn--cancel" @click="cancelDeleteGroup"><Icon name="close" :size="11" />Cancel</button>
          <button class="dlg-btn dlg-btn--danger"  @click="confirmDeleteGroup"><Icon name="trash" :size="11" />Delete all</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* ── Bulk bar ── */
.bulk-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 14px; background: rgba(129,140,248,0.08); border-bottom: 1px solid rgba(129,140,248,0.2);
  flex-shrink: 0;
}
.bulk-check-icon { color: #818cf8; }
.bulk-count { font-size: 12px; font-weight: 600; color: #818cf8; flex: 1; }
.bulk-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 4px 12px; border-radius: 5px; border: 1px solid #27272a;
  font-size: 11px; font-weight: 600; font-family: inherit; cursor: pointer;
  background: #27272a; color: #a1a1aa; transition: background 0.12s;
}
.bulk-btn:hover { background: #3f3f46; }
.bulk-btn--danger { background: rgba(239,68,68,0.12); color: #f87171; border-color: rgba(239,68,68,0.2); }
.bulk-btn--danger:hover { background: rgba(239,68,68,0.2); }

/* ── Toolbar ── */
.toolbar {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px; background: #18181b; border-bottom: 1px solid #27272a; flex-shrink: 0; flex-wrap: wrap;
}
.search-wrap { position: relative; display: flex; align-items: center; flex: 0 0 240px; }
.search-icon { position: absolute; left: 9px; color: #52525b; pointer-events: none; }
.search-input {
  width: 100%; padding: 5px 26px 5px 28px; background: #0f0f11;
  border: 1px solid #27272a; border-radius: 6px; color: #d4d4d8; font-size: 12px; font-family: inherit; outline: none; transition: border-color 0.15s;
}
.search-input:focus { border-color: #818cf8; box-shadow: 0 0 0 2px rgba(129,140,248,0.08); }
.search-input::placeholder { color: #3f3f46; }
.clear-btn {
  position: absolute; right: 6px; display: flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; background: #27272a; border: none; border-radius: 3px; color: #71717a; cursor: pointer; padding: 0;
}
.clear-btn:hover { background: #3f3f46; color: #a1a1aa; }
.filter-group { display: flex; gap: 2px; }
.filter-btn {
  display: flex; align-items: center; gap: 5px; padding: 4px 9px;
  background: transparent; border: 1px solid #27272a; border-radius: 5px;
  color: #52525b; font-size: 11px; font-weight: 600; font-family: inherit; cursor: pointer; white-space: nowrap;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.filter-btn:hover { color: #a1a1aa; border-color: #3f3f46; }
.filter-btn.active { background: #27272a; color: #e4e4e7; border-color: #3f3f46; }
.filter-btn--unused.active { color: #fbbf24; border-color: rgba(251,191,36,0.25); background: rgba(251,191,36,0.07); }
.filter-btn--phantom.active { color: #f87171; border-color: rgba(248,113,113,0.25); background: rgba(248,113,113,0.07); }
.filter-btn--stale.active { color: #fb923c; border-color: rgba(251,146,60,0.25); background: rgba(251,146,60,0.07); }
.filter-count { background: rgba(248,113,113,0.15); color: #f87171; font-size: 9px; padding: 0 4px; border-radius: 4px; }
.filter-count--stale { background: rgba(251,146,60,0.15); color: #fb923c; }
.filter-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.dot--all { background: #3f3f46; } .dot--missing { background: #fb923c; } .dot--complete { background: #4ade80; }
.filter-btn.active .dot--all { background: #71717a; }
.toolbar-sep { width: 1px; height: 16px; background: #27272a; flex-shrink: 0; }
.toolbar-icon-btn {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; background: transparent; border: 1px solid #27272a; border-radius: 5px;
  color: #52525b; cursor: pointer; transition: background 0.12s, color 0.12s;
}
.toolbar-icon-btn:hover { background: #27272a; color: #a1a1aa; }
.density-group { display: flex; gap: 2px; }
.density-btn {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 2px; width: 24px; height: 24px; background: transparent; border: 1px solid #27272a; border-radius: 4px; cursor: pointer; padding: 4px;
}
.density-btn.active { background: #27272a; border-color: #3f3f46; }
.density-bar { width: 12px; height: 1.5px; background: #3f3f46; border-radius: 1px; }
.density-btn.active .density-bar { background: #71717a; }
.toolbar-new-group-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: 5px; border: 1px solid rgba(129,140,248,0.25);
  background: rgba(129,140,248,0.08); color: #818cf8;
  font-size: 11px; font-weight: 600; font-family: inherit; cursor: pointer; white-space: nowrap;
  transition: background 0.12s, border-color 0.12s;
}
.toolbar-new-group-btn:hover { background: rgba(129,140,248,0.16); border-color: rgba(129,140,248,0.4); }

.result-count { margin-left: auto; font-size: 11px; color: #3f3f46; white-space: nowrap; }
.result-match { color: #52525b; font-weight: 600; }
.result-sep { color: #27272a; margin: 0 2px; }

/* ── Table ── */
.table-wrap { flex: 1; overflow: auto; outline: none; }
.empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 60px 20px; color: #3f3f46; font-size: 13px; font-style: italic; }
.empty-icon { color: #27272a; }
table { width: 100%; border-collapse: collapse; }
thead th {
  position: sticky; top: 0; z-index: 10; background: #18181b;
  border-bottom: 1px solid #27272a; padding: 9px 12px;
  text-align: left; font-size: 12px; font-weight: 600; color: #71717a; white-space: nowrap;
}
th.col-select { width: 32px; min-width: 32px; padding: 9px 6px; }
th.col-key { width: 260px; min-width: 160px; }
.th-inner { display: flex; align-items: center; gap: 6px; color: #52525b; }
.locale-header { display: flex; align-items: center; gap: 6px; }
.locale-flag { font-size: 14px; line-height: 1; }
.locale-flag-icon { color: #52525b; }
.locale-name { font-size: 12px; color: #d4d4d8; font-weight: 600; }
.locale-code {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 10px; color: #3f3f46; background: #111113; border: 1px solid #1c1c1f;
  border-radius: 3px; padding: 1px 5px; font-family: 'SF Mono','Fira Code',monospace;
}
.locale-code--modified { color: #fbbf24; border-color: rgba(251,191,36,0.2); background: rgba(251,191,36,0.05); }
.copy-json-btn { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border: none; background: transparent; color: #3f3f46; cursor: pointer; border-radius: 3px; transition: color 0.12s, background 0.12s; }
.copy-json-btn:hover { color: #71717a; background: #27272a; }
.ref-badge { font-size: 9px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #818cf8; background: rgba(129,140,248,0.1); border: 1px solid rgba(129,140,248,0.2); border-radius: 3px; padding: 1px 4px; }

/* ── Checkbox ── */
.col-select { padding: 0 6px; text-align: center; }
.group-select-cell { padding: 0; }

/* ── Group rows ── */
tr.group-row { cursor: pointer; user-select: none; }
tr.group-row:hover .group-cell { background: #1c1c1f; }
.group-cell { padding: 5px 14px; background: #18181b; border-bottom: 1px solid #27272a; }
.group-cell-inner { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #52525b; letter-spacing: 0.05em; text-transform: uppercase; }
.chevron-icon { color: #3f3f46; transition: color 0.12s; }
tr.group-row:hover .chevron-icon { color: #71717a; }
.group-ns-icon { color: #3f3f46; }
.group-count { background: #27272a; color: #52525b; font-size: 10px; padding: 1px 6px; border-radius: 8px; font-weight: 400; letter-spacing: 0; text-transform: none; }
.group-empty-badge { background: rgba(251,191,36,0.08); color: #92400e; border: 1px solid rgba(251,191,36,0.2); font-size: 9px; font-weight: 600; padding: 1px 6px; border-radius: 8px; letter-spacing: 0.04em; text-transform: uppercase; }

/* ── Key cells ── */
td { border-bottom: 1px solid #1c1c1f; vertical-align: middle; max-width: 360px; }
td.key-cell, td.value-cell { padding: 7px 12px; }
.density-compact td.key-cell, .density-compact td.value-cell { padding: 3px 12px; }
.density-relaxed td.key-cell, .density-relaxed td.value-cell { padding: 12px; }

tr.data-row:hover .key-cell, tr.data-row:hover .value-cell:not(.editing) { background: #1c1c1f; }
tr.data-row.is-open .key-cell { background: #1c1c1f; border-bottom-color: transparent; }
tr.data-row.row-selected td { background: rgba(129,140,248,0.05); }
tr.data-row.row-selected:hover td.key-cell,
tr.data-row.row-selected:hover td.value-cell { background: rgba(129,140,248,0.09); }

.key-cell-inner { display: flex; align-items: center; gap: 5px; min-width: 0; }
.key-label { flex-shrink: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chevron-key-icon { color: #3f3f46; transition: color 0.12s; flex-shrink: 0; }
tr.is-open .chevron-key-icon { color: #818cf8; }
.key-icon { color: #3f3f46; flex-shrink: 0; }

td.key-cell { font-family: 'SF Mono','Fira Code',monospace; font-size: 12px; color: #818cf8; white-space: nowrap; user-select: none; cursor: pointer; }
td.key-cell.indent { padding-left: 26px; color: #6366f1; }

/* Inline key action buttons — hidden, appear on row hover */
.key-actions {
  display: flex; align-items: center; gap: 1px;
  margin-left: auto; flex-shrink: 0;
  opacity: 0; transition: opacity 0.12s;
}
tr.data-row:hover .key-actions { opacity: 1; }

/* Group action buttons */
.group-name-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.group-actions {
  display: flex; align-items: center; gap: 1px;
  margin-left: auto; flex-shrink: 0;
  opacity: 0; transition: opacity 0.12s;
}
tr.group-row:hover .group-actions { opacity: 1; }
.btn-action--group { color: #3f3f46; }
.btn-action--group:hover { background: #27272a; color: #a1a1aa; border-color: #3f3f46; }
td.kb-focus-cell { box-shadow: inset 0 0 0 1px rgba(129,140,248,0.4); }

.note-indicator { display: inline-flex; align-items: center; color: #818cf8; opacity: 0.7; flex-shrink: 0; }
.badge-unused {
  display: inline-flex; align-items: center; gap: 3px; font-size: 9px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
  color: #3f3f46; background: #111113; border: 1px solid #1c1c1f; border-radius: 3px; padding: 1px 5px; flex-shrink: 0;
}
.badge-dup {
  display: inline-flex; align-items: center; gap: 3px; font-size: 9px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
  color: #a78bfa; background: rgba(167,139,250,0.08); border: 1px solid rgba(167,139,250,0.2); border-radius: 3px; padding: 1px 5px; flex-shrink: 0;
}

/* ── Value cells ── */
td.value-cell { cursor: pointer; }
td.value-cell.editing { cursor: default; padding: 3px 6px; }
td.value-cell.mismatch, td.value-cell.tag-warn { background: rgba(251,191,36,0.03); }
td.value-cell.icu-err { background: rgba(239,68,68,0.03); }
td.value-cell.value-cell--locked { cursor: default; background: rgba(63,63,70,0.2); }
td.value-cell.value-cell--locked .value-text { color: #52525b; }

.value-text {
  display: inline-flex; align-items: baseline; gap: 5px; min-height: 20px;
  padding: 2px 5px; border-radius: 4px; border: 1px solid transparent;
  transition: background 0.1s, border-color 0.1s; font-size: 13px; line-height: 1.4; word-break: break-word; max-width: 100%;
}
td.value-cell:not(.editing):hover .value-text { background: #27272a; border-color: #3f3f46; }
.cell-missing { color: #3f3f46; font-style: italic; font-size: 12px; }
.cell-empty   { color: #b45309; font-style: italic; font-size: 12px; }

.copy-ref-btn {
  display: inline-flex; align-items: center; gap: 3px;
  margin-left: 4px; padding: 1px 6px;
  background: rgba(129,140,248,0.1); border: 1px solid rgba(129,140,248,0.2); border-radius: 3px;
  color: #818cf8; font-size: 9px; font-weight: 600; cursor: pointer; white-space: nowrap;
  transition: background 0.1s;
}
.copy-ref-btn:hover { background: rgba(129,140,248,0.2); }

.warn-icon { flex-shrink: 0; }
td.value-cell.mismatch .warn-icon, td.value-cell.tag-warn .warn-icon { color: #fbbf24; }
td.value-cell.icu-err .warn-icon  { color: #f87171; }
td.value-cell.len-warn .warn-icon { color: #a78bfa; }
td.value-cell.len-warn .value-text { color: #a78bfa; }
td.value-cell.mismatch .value-text, td.value-cell.tag-warn .value-text { color: #fbbf24; }
td.value-cell.icu-err .value-text  { color: #f87171; }
td.value-cell.is-dup .value-text   { color: #a78bfa; }

.lock-icon { color: #52525b; flex-shrink: 0; }
.key-lock-icon { color: #52525b; flex-shrink: 0; }

/* ── Stale (outdated) ── */
.badge-stale   { display: inline-flex; align-items: center; gap: 3px; font-size: 9px; font-weight: 600; color: #fb923c; background: rgba(251,146,60,0.12); border: 1px solid rgba(251,146,60,0.2); border-radius: 4px; padding: 0 4px; line-height: 16px; flex-shrink: 0; }
.badge-phantom { display: inline-flex; align-items: center; gap: 3px; font-size: 9px; font-weight: 600; color: #f87171; background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.25); border-radius: 4px; padding: 0 4px; line-height: 16px; flex-shrink: 0; }
.detail-section--stale { border-top: 1px solid #1c1c1f; padding-top: 8px; gap: 8px; }
.detail-stale-msg { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #fb923c; }
.btn-mark-reviewed { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; font-size: 11px; background: rgba(251,146,60,0.1); border: 1px solid rgba(251,146,60,0.25); color: #fb923c; border-radius: 5px; cursor: pointer; transition: background 0.15s; }
.btn-mark-reviewed:hover { background: rgba(251,146,60,0.2); }

/* ── Edit ── */
.edit-wrap { display: flex; align-items: flex-start; gap: 4px; }
.edit-input {
  flex: 1; background: #27272a; border: 1px solid #3f3f46; border-radius: 4px;
  color: #e4e4e7; font-size: 13px; font-family: inherit; padding: 4px 8px; outline: none; resize: none; overflow: hidden; min-width: 0; line-height: 1.4; transition: border-color 0.15s;
}
.edit-input:focus { border-color: #818cf8; }
.edit-btns { display: flex; flex-direction: row; gap: 2px; flex-shrink: 0; align-items: center; }
.btn-confirm, .btn-cancel { width: 24px; height: 24px; border: none; border-radius: 3px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.btn-confirm { background: rgba(74,222,128,0.12); color: #4ade80; }
.btn-confirm:hover { background: rgba(74,222,128,0.22); }
.btn-cancel  { background: rgba(239,68,68,0.12); color: #f87171; }
.btn-cancel:hover  { background: rgba(239,68,68,0.22); }

/* ── Action buttons ── */
.btn-action {
  width: 22px; height: 22px; border: 1px solid transparent; border-radius: 3px;
  background: transparent; color: #52525b; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  transition: background 0.12s, color 0.12s, border-color 0.12s; flex-shrink: 0;
}
.btn-action:hover { background: #27272a; color: #a1a1aa; border-color: #3f3f46; }
.btn-action--danger:hover { background: rgba(239,68,68,0.12); color: #f87171; border-color: rgba(239,68,68,0.2); }

/* ── Detail row ── */
tr.detail-row td { padding: 0; border-bottom: 1px solid #27272a; background: #0f0f11; cursor: default; }
.detail-inner { padding: 10px 14px 12px 26px; display: flex; flex-direction: column; gap: 10px; }
.detail-section { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.detail-section--note, .detail-section--interp, .detail-section--plural { border-top: 1px solid #1c1c1f; padding-top: 8px; }
.plural-table-wrap { overflow-x: auto; }
.plural-table { border-collapse: collapse; font-size: 11px; width: 100%; }
.plural-th { padding: 3px 10px; text-align: left; font-size: 10px; font-weight: 600; color: #52525b; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #27272a; white-space: nowrap; }
.plural-th--count { color: #3f3f46; width: 32px; }
.plural-tr:nth-child(even) .plural-td { background: #111113; }
.plural-td { padding: 4px 10px; color: #a1a1aa; border-bottom: 1px solid #1c1c1f; }
.plural-td--count { font-family: 'SF Mono','Fira Code',monospace; color: #818cf8; font-size: 10px; text-align: center; }
.detail-label { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #3f3f46; width: 100%; margin-bottom: 2px; }
.file-chip {
  display: inline-flex; align-items: center; gap: 5px;
  background: #18181b; border: 1px solid #27272a; border-radius: 5px;
  padding: 3px 9px; font-size: 11px; font-family: 'SF Mono','Fira Code',monospace; color: #71717a; text-decoration: none;
  transition: border-color 0.12s, color 0.12s;
}
.file-chip:hover { border-color: #818cf8; color: #a5b4fc; }
.no-usages { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: #3f3f46; font-style: italic; }
.detail-note-text { font-size: 12px; color: #a1a1aa; line-height: 1.5; }

/* ── Interpolation preview ── */
.interp-inputs { display: flex; flex-wrap: wrap; gap: 8px; width: 100%; margin-bottom: 8px; }
.interp-field { display: flex; align-items: center; gap: 6px; }
.interp-var { font-family: 'SF Mono','Fira Code',monospace; font-size: 11px; color: #818cf8; background: rgba(129,140,248,0.1); border: 1px solid rgba(129,140,248,0.2); border-radius: 4px; padding: 2px 6px; white-space: nowrap; }
.interp-var--plural { color: #fb923c; background: rgba(251,146,60,0.1); border-color: rgba(251,146,60,0.25); }
.interp-plural-badge { font-size: 9px; font-weight: 700; color: #fb923c; opacity: 0.7; margin-right: 2px; }
.interp-input { background: #18181b; border: 1px solid #27272a; border-radius: 4px; color: #d4d4d8; font-size: 12px; font-family: inherit; padding: 3px 8px; outline: none; width: 120px; transition: border-color 0.12s; }
.interp-input:focus { border-color: #818cf8; }
.interp-previews { display: flex; flex-direction: column; gap: 4px; width: 100%; }
.interp-preview-row { display: flex; align-items: baseline; gap: 10px; }
.interp-code { font-family: 'SF Mono','Fira Code',monospace; font-size: 10px; color: #52525b; background: #1c1c1f; border: 1px solid #27272a; border-radius: 3px; padding: 1px 5px; flex-shrink: 0; }
.interp-result { font-size: 13px; color: #e4e4e7; line-height: 1.4; }

/* ── Dialogs ── */
.dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.65); display: flex; align-items: center; justify-content: center; z-index: 200; backdrop-filter: blur(2px); }
.dialog { background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 20px 24px; min-width: 340px; max-width: 480px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 24px 64px rgba(0,0,0,0.5); }
.dialog-header { display: flex; align-items: center; gap: 10px; }
.dlg-icon { width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.dlg-icon--red    { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #f87171; }
.dlg-icon--indigo { background: rgba(129,140,248,0.1); border: 1px solid rgba(129,140,248,0.2); color: #818cf8; }
.dialog-title { font-size: 14px; font-weight: 700; color: #e4e4e7; margin: 0; }
.dialog-key { display: flex; align-items: center; gap: 7px; font-family: 'SF Mono','Fira Code',monospace; font-size: 12px; color: #818cf8; background: #0f0f11; border: 1px solid #27272a; border-radius: 6px; padding: 6px 10px; margin: 0; word-break: break-all; }
.dialog-note { font-size: 12px; color: #71717a; margin: 0; line-height: 1.6; }
.field-hint {
  display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
  font-size: 11px; color: #52525b; background: #111113;
  border: 1px solid #27272a; border-radius: 5px; padding: 5px 9px;
}
.field-hint strong { color: #818cf8; font-weight: 600; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.dlg-btn { display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 6px; border: 1px solid #27272a; font-size: 12px; font-family: inherit; font-weight: 600; cursor: pointer; transition: background 0.12s; }
.dlg-btn--cancel  { background: #27272a; color: #a1a1aa; }
.dlg-btn--cancel:hover  { background: #3f3f46; }
.dlg-btn--confirm { background: rgba(129,140,248,0.15); color: #818cf8; border-color: rgba(129,140,248,0.25); }
.dlg-btn--confirm:hover { background: rgba(129,140,248,0.25); }
.dlg-btn--danger  { background: rgba(239,68,68,0.15); color: #f87171; border-color: rgba(239,68,68,0.25); }
.dlg-btn--danger:hover  { background: rgba(239,68,68,0.25); }
.field-label { font-size: 11px; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em; }
.field-note  { font-weight: 400; text-transform: none; letter-spacing: 0; color: #52525b; }
.field-input { width: 100%; box-sizing: border-box; background: #0f0f11; border: 1px solid #27272a; border-radius: 6px; color: #d4d4d8; font-size: 12px; font-family: inherit; padding: 6px 10px; outline: none; transition: border-color 0.15s; }
.field-input:focus { border-color: #818cf8; }
.field-textarea { resize: vertical; min-height: 64px; font-family: inherit; }
.field-error { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #f87171; }

/* ── Namespace filter bar ── */
.ns-bar { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 12px; border-bottom: 1px solid #1f1f23; background: #101012; }
.ns-pill { font-size: 11px; font-weight: 500; color: #71717a; background: #18181b; border: 1px solid #27272a; border-radius: 20px; padding: 3px 10px; cursor: pointer; transition: color 0.12s, background 0.12s, border-color 0.12s; }
.ns-pill:hover { color: #a1a1aa; border-color: #3f3f46; }
.ns-pill--active { color: #818cf8; background: rgba(129,140,248,0.1); border-color: rgba(129,140,248,0.3); }

/* ── Translation memory suggestions ── */
.memory-suggestions { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; padding: 4px 0 2px; }
.memory-label { display: flex; align-items: center; gap: 4px; font-size: 10px; color: #52525b; flex-shrink: 0; }
.memory-chip { display: flex; align-items: center; gap: 4px; background: #1c1c1f; border: 1px solid #27272a; border-radius: 4px; padding: 2px 7px; cursor: pointer; max-width: 240px; transition: border-color 0.1s; }
.memory-chip:hover { border-color: #818cf8; }
.memory-pct { font-size: 9px; font-weight: 700; color: #818cf8; flex-shrink: 0; }
.memory-text { font-size: 11px; color: #d4d4d8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
