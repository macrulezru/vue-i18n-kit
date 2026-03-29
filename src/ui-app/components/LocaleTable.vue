<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import type { LocaleInfo, LocaleData, LocaleEntries } from '../api'

const props = defineProps<{
  keys: string[]
  locales: LocaleInfo[]
  localeData: LocaleData
  entries: LocaleEntries
}>()

const emit = defineEmits<{
  save: [code: string, key: string, value: string]
}>()

// ── Tree structure ────────────────────────────────────────────────────────────

interface ItemRow {
  type: 'item'
  key: string     // full key path, e.g. "greeting"
  label: string   // display name, e.g. "greeting"
  indent: boolean
}

interface GroupRow {
  type: 'group'
  name: string    // first segment, e.g. "buttons"
  children: ItemRow[]
}

type TableRow = GroupRow | ItemRow

const tableRows = computed<TableRow[]>(() => {
  const rows: TableRow[] = []
  const seenGroups = new Set<string>()

  for (const key of props.keys) {
    const dotIdx = key.indexOf('.')
    if (dotIdx === -1) {
      rows.push({ type: 'item', key, label: key, indent: false })
    } else {
      const prefix = key.slice(0, dotIdx)
      if (!seenGroups.has(prefix)) {
        seenGroups.add(prefix)
        const children = props.keys
          .filter(k => k.startsWith(prefix + '.'))
          .map(k => ({ type: 'item' as const, key: k, label: k.slice(prefix.length + 1), indent: true }))
        rows.push({ type: 'group', name: prefix, children })
      }
    }
  }

  return rows
})

// ── Collapse state ────────────────────────────────────────────────────────────

const collapsed = ref<Record<string, boolean>>({})

function toggleGroup(name: string) {
  collapsed.value = { ...collapsed.value, [name]: !collapsed.value[name] }
}

// ── Detail row (used in) ──────────────────────────────────────────────────────

const selectedKey = ref<string | null>(null)

function toggleKey(key: string) {
  selectedKey.value = selectedKey.value === key ? null : key
}

// ── Inline editing ────────────────────────────────────────────────────────────

const editingCell = ref<{ key: string; code: string } | null>(null)
const editingValue = ref('')
const editInputEl = ref<HTMLInputElement | null>(null)

function startEdit(key: string, code: string, currentValue: string) {
  editingCell.value = { key, code }
  editingValue.value = currentValue
  nextTick(() => editInputEl.value?.focus())
}

function cancelEdit() {
  editingCell.value = null
  editingValue.value = ''
}

function confirmEdit() {
  if (!editingCell.value) return
  emit('save', editingCell.value.code, editingCell.value.key, editingValue.value)
  editingCell.value = null
  editingValue.value = ''
}

function isEditing(key: string, code: string) {
  return editingCell.value?.key === key && editingCell.value?.code === code
}

// ── Locale display helpers ────────────────────────────────────────────────────

function localeName(locale: LocaleInfo): string {
  return (locale.meta?.display as string | undefined) ?? locale.code
}
function localeFlag(locale: LocaleInfo): string | undefined {
  return locale.meta?.flag as string | undefined
}
</script>

<template>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th class="col-key">Key</th>
          <th v-for="locale in locales" :key="locale.code">
            <div class="locale-header">
              <span v-if="localeFlag(locale)" class="locale-flag">{{ localeFlag(locale) }}</span>
              <span class="locale-name">{{ localeName(locale) }}</span>
              <span class="locale-code">{{ locale.code }}</span>
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-for="row in tableRows" :key="row.type === 'group' ? 'g:' + row.name : 'i:' + row.key">

          <!-- ── Group ──────────────────────────────────────────────────── -->
          <template v-if="row.type === 'group'">
            <tr class="group-row" @click="toggleGroup(row.name)">
              <td class="group-cell" :colspan="locales.length + 1">
                <span class="chevron" :class="{ open: !collapsed[row.name] }">▶</span>
                {{ row.name }}
                <span class="group-count">{{ row.children.length }}</span>
              </td>
            </tr>

            <template v-if="!collapsed[row.name]">
              <template v-for="child in row.children" :key="child.key">
                <tr class="data-row child-row" :class="{ 'is-open': selectedKey === child.key }">
                  <td class="key-cell indent" @click="toggleKey(child.key)">
                    <span class="chevron-key">▶</span>{{ child.label }}
                  </td>
                  <td
                    v-for="locale in locales"
                    :key="locale.code"
                    class="value-cell"
                    :class="{
                      missing: localeData[locale.code]?.[child.key] === undefined && !isEditing(child.key, locale.code),
                      editing: isEditing(child.key, locale.code),
                    }"
                  >
                    <div v-if="isEditing(child.key, locale.code)" class="edit-wrap">
                      <input
                        ref="editInputEl"
                        v-model="editingValue"
                        class="edit-input"
                        @keydown.enter="confirmEdit"
                        @keydown.esc="cancelEdit"
                      />
                      <button class="btn-confirm" title="Save" @click="confirmEdit">✓</button>
                      <button class="btn-cancel" title="Cancel" @click="cancelEdit">✕</button>
                    </div>
                    <span v-else class="value-text" @click="startEdit(child.key, locale.code, localeData[locale.code]?.[child.key] ?? '')">
                      {{ localeData[locale.code]?.[child.key] ?? '— missing —' }}
                    </span>
                  </td>
                </tr>

                <tr v-if="selectedKey === child.key" class="detail-row">
                  <td :colspan="locales.length + 1">
                    <div class="detail-inner">
                      <span class="detail-label">Used in</span>
                      <template v-if="entries[child.key]?.length">
                        <span v-for="file in entries[child.key]" :key="file" class="file-chip">📄 {{ file }}</span>
                      </template>
                      <span v-else class="no-usages">No usages found</span>
                    </div>
                  </td>
                </tr>
              </template>
            </template>
          </template>

          <!-- ── Standalone item ────────────────────────────────────────── -->
          <template v-else>
            <tr class="data-row" :class="{ 'is-open': selectedKey === row.key }">
              <td class="key-cell" @click="toggleKey(row.key)">
                <span class="chevron-key">▶</span>{{ row.label }}
              </td>
              <td
                v-for="locale in locales"
                :key="locale.code"
                class="value-cell"
                :class="{
                  missing: localeData[locale.code]?.[row.key] === undefined && !isEditing(row.key, locale.code),
                  editing: isEditing(row.key, locale.code),
                }"
              >
                <div v-if="isEditing(row.key, locale.code)" class="edit-wrap">
                  <input
                    ref="editInputEl"
                    v-model="editingValue"
                    class="edit-input"
                    @keydown.enter="confirmEdit"
                    @keydown.esc="cancelEdit"
                  />
                  <button class="btn-confirm" title="Save" @click="confirmEdit">✓</button>
                  <button class="btn-cancel" title="Cancel" @click="cancelEdit">✕</button>
                </div>
                <span v-else class="value-text" @click="startEdit(row.key, locale.code, localeData[locale.code]?.[row.key] ?? '')">
                  {{ localeData[locale.code]?.[row.key] ?? '— missing —' }}
                </span>
              </td>
            </tr>

            <tr v-if="selectedKey === row.key" class="detail-row">
              <td :colspan="locales.length + 1">
                <div class="detail-inner">
                  <span class="detail-label">Used in</span>
                  <template v-if="entries[row.key]?.length">
                    <span v-for="file in entries[row.key]" :key="file" class="file-chip">📄 {{ file }}</span>
                  </template>
                  <span v-else class="no-usages">No usages found</span>
                </div>
              </td>
            </tr>
          </template>

        </template>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-wrap { flex: 1; overflow: auto; }

table { width: 100%; border-collapse: collapse; }

thead th {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #18181b;
  border-bottom: 1px solid #27272a;
  padding: 10px 14px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: #71717a;
  white-space: nowrap;
}
th.col-key { width: 280px; min-width: 200px; color: #52525b; }

.locale-header { display: flex; align-items: center; gap: 6px; }
.locale-flag { font-size: 16px; }
.locale-name { font-size: 12px; color: #d4d4d8; font-weight: 600; }
.locale-code { font-size: 11px; color: #52525b; }

/* ── Group row ── */
tr.group-row {
  cursor: pointer;
  user-select: none;
}
tr.group-row:hover .group-cell {
  background: #1c1c1f;
}
.group-cell {
  padding: 6px 14px;
  background: #18181b;
  border-bottom: 1px solid #27272a;
  font-size: 11px;
  font-weight: 700;
  color: #52525b;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.group-count {
  margin-left: 6px;
  background: #27272a;
  color: #52525b;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
}

/* ── Chevrons ── */
.chevron {
  display: inline-block;
  margin-right: 6px;
  font-size: 9px;
  color: #3f3f46;
  transition: transform 0.15s;
}
.chevron.open { transform: rotate(90deg); color: #71717a; }

.chevron-key {
  display: inline-block;
  margin-right: 6px;
  font-size: 9px;
  color: #3f3f46;
  transition: transform 0.15s;
}
tr.is-open .chevron-key { transform: rotate(90deg); color: #818cf8; }

/* ── Data rows ── */
td {
  padding: 8px 14px;
  border-bottom: 1px solid #1c1c1f;
  vertical-align: middle;
  max-width: 360px;
}
tr.data-row:hover .key-cell,
tr.data-row:hover .value-cell:not(.editing) { background: #1c1c1f; }
tr.data-row.is-open .key-cell { background: #1c1c1f; border-bottom-color: transparent; }

td.key-cell {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  color: #818cf8;
  white-space: nowrap;
  user-select: none;
  cursor: pointer;
}
td.key-cell.indent { padding-left: 30px; color: #6366f1; }

/* ── Value cells ── */
td.value-cell { cursor: pointer; }
td.value-cell.editing { cursor: default; padding: 4px 8px; }
td.value-cell.missing .value-text { color: #52525b; font-style: italic; font-size: 12px; }

.value-text {
  display: block;
  min-height: 20px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid transparent;
  transition: background 0.1s, border-color 0.1s;
}
td.value-cell:not(.editing):hover .value-text {
  background: #27272a;
  border-color: #3f3f46;
}

/* ── Edit mode ── */
.edit-wrap { display: flex; align-items: center; gap: 4px; }
.edit-input {
  flex: 1;
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  color: #e4e4e7;
  font-size: 13px;
  font-family: inherit;
  padding: 4px 8px;
  outline: none;
  min-width: 0;
}
.edit-input:focus { border-color: #818cf8; }
.btn-confirm, .btn-cancel {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-confirm { background: rgba(74, 222, 128, 0.12); color: #4ade80; }
.btn-confirm:hover { background: rgba(74, 222, 128, 0.22); }
.btn-cancel { background: rgba(239, 68, 68, 0.12); color: #f87171; }
.btn-cancel:hover { background: rgba(239, 68, 68, 0.22); }

/* ── Detail row ── */
tr.detail-row td { padding: 0; border-bottom: 1px solid #27272a; background: #111113; cursor: default; }
.detail-inner { padding: 10px 14px 12px 30px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.detail-label { font-size: 11px; color: #3f3f46; width: 100%; margin-bottom: 2px; }
.file-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 5px;
  padding: 3px 9px;
  font-size: 11px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: #a1a1aa;
}
.no-usages { font-size: 12px; color: #3f3f46; font-style: italic; }
</style>
