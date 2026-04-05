import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: number
  message: string
  type: ToastType
}

// Module-level singleton — shared across all components
const items = ref<ToastItem[]>([])
let _id = 0

export function useToast() {
  function show(message: string, type: ToastType = 'success', duration = 2500) {
    const id = _id++
    items.value.push({ id, message, type })
    setTimeout(() => dismiss(id), duration)
  }
  function dismiss(id: number) {
    items.value = items.value.filter(t => t.id !== id)
  }
  return { items, show, dismiss }
}
