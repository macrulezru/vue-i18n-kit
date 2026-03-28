import { vi } from 'vitest'

// happy-dom v15 provides localStorage but without `.clear()`.
// Stub the global with a full in-memory implementation.
const createLocalStorageMock = () => {
  let store: Record<string, string> = {}
  return {
    getItem(key: string): string | null {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null
    },
    setItem(key: string, value: string): void {
      store[key] = value
    },
    removeItem(key: string): void {
      delete store[key]
    },
    clear(): void {
      store = {}
    },
    key(index: number): string | null {
      return Object.keys(store)[index] ?? null
    },
    get length(): number {
      return Object.keys(store).length
    },
  }
}

vi.stubGlobal('localStorage', createLocalStorageMock())
