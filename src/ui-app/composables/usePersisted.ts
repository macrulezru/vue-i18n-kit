import { ref, watch, type Ref } from 'vue'

export function usePersisted<T>(key: string, defaultValue: T): Ref<T> {
  let initial: T
  try {
    const stored = localStorage.getItem(key)
    initial = stored !== null ? (JSON.parse(stored) as T) : defaultValue
  } catch {
    initial = defaultValue
  }
  const value = ref<T>(initial) as Ref<T>
  watch(value, v => {
    try { localStorage.setItem(key, JSON.stringify(v)) } catch {}
  }, { deep: true })
  return value
}
