import { ref, watch, onServerPrefetch } from 'vue'
import type { Ref } from 'vue'
import { useI18nKitState } from '../state'
import { loadOneNamespace } from '../plugin'

export interface UseNamespaceReturn {
  /** True while the namespace is being fetched */
  isLoading: Ref<boolean>
  /** True once the namespace has been successfully loaded */
  isLoaded: Ref<boolean>
}

/**
 * Lazily loads one or more namespaces for the currently active locale,
 * and re-loads them whenever the active locale changes.
 *
 * **Usage in a component or route-level layout:**
 * ```ts
 * // Load a single namespace
 * const { isLoading } = useNamespace('auth')
 *
 * // Load multiple namespaces at once
 * const { isLoading } = useNamespace(['auth', 'forms'])
 * ```
 *
 * **Usage in a router guard (outside setup):**
 * ```ts
 * router.beforeEach(async (to) => {
 *   const ns = to.meta.namespaces as string[] | undefined
 *   if (ns) await Promise.all(ns.map(n => i18nPlugin.service.loadNamespace(n)))
 * })
 * ```
 *
 * Returns `{ isLoading, isLoaded }` refs that reflect the load state.
 * The namespace keys are available in `t()` as soon as `isLoaded` is true.
 */
export function useNamespace(ns: string | string[]): UseNamespaceReturn {
  const namespaces = Array.isArray(ns) ? ns : [ns]
  const state = useI18nKitState()
  const isLoading = ref(false)
  const isLoaded = ref(false)

  async function load(lang: string) {
    isLoading.value = true
    isLoaded.value = false
    try {
      await Promise.all(namespaces.map(n => loadOneNamespace(state, lang, n)))
      isLoaded.value = true
    } finally {
      isLoading.value = false
    }
  }

  // Load for the current locale, then re-load on every locale switch
  watch(
    () => state.i18n.global.locale.value as string,
    (lang) => { void load(lang) },
    { immediate: true },
  )

  // SSR support
  onServerPrefetch(() => load(state.i18n.global.locale.value as string))

  return { isLoading, isLoaded }
}
