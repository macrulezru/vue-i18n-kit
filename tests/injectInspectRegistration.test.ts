import { describe, it, expect } from 'vitest'
import { injectInspectRegistration } from '../src/vite-plugin/index'

describe('injectInspectRegistration', () => {
  it('returns undefined when code has no createApp', () => {
    expect(injectInspectRegistration(`import { ref } from 'vue'`)).toBeUndefined()
  })

  it('returns undefined when createApp is not imported from vue', () => {
    expect(injectInspectRegistration(`import { createApp } from './utils'`)).toBeUndefined()
  })

  it('wraps createApp import from vue', () => {
    const code = `import { createApp } from 'vue'\ncreateApp(App).mount('#app')`
    const result = injectInspectRegistration(code)!
    expect(result).toBeDefined()
    expect(result).toContain(`createApp as __ik_createApp`)
    expect(result).toContain(`const createApp = (...args) =>`)
    expect(result).toContain(`__ik_createApp(...args)`)
    expect(result).toContain(`__I18N_KIT_INSPECT_COMPONENT__`)
    expect(result).toContain(`__I18N_KIT_INSPECT_DIRECTIVE__`)
    expect(result).toContain(`app.component('I18nInspect'`)
    expect(result).toContain(`app.directive('i18n-inspect'`)
  })

  it('handles multi-import (createApp with other named exports)', () => {
    const code = `import { createApp, ref, reactive } from 'vue'\ncreateApp(App)`
    const result = injectInspectRegistration(code)!
    expect(result).toBeDefined()
    expect(result).toContain(`ref, reactive`)
    expect(result).toContain(`createApp as __ik_createApp`)
    expect(result).not.toContain(`ref as __ik_createApp`)
  })

  it('handles createApp at the end of import list', () => {
    const code = `import { ref, createApp } from 'vue'\ncreateApp(App)`
    const result = injectInspectRegistration(code)!
    expect(result).toBeDefined()
    expect(result).toContain(`createApp as __ik_createApp`)
    expect(result).toContain(`ref,`)
  })

  it('is idempotent — does not double-wrap', () => {
    const code = `import { createApp } from 'vue'\ncreateApp(App).mount('#app')`
    const once = injectInspectRegistration(code)!
    expect(once).toBeDefined()
    const twice = injectInspectRegistration(once)
    expect(twice).toBeUndefined()
  })

  it('preserves the rest of the file unchanged', () => {
    const code = `import { createApp } from 'vue'\nimport App from './App.vue'\ncreateApp(App).mount('#app')`
    const result = injectInspectRegistration(code)!
    expect(result).toContain(`import App from './App.vue'`)
    expect(result).toContain(`createApp(App).mount('#app')`)
  })

  it('works with double-quote vue import', () => {
    const code = `import { createApp } from "vue"\ncreateApp(App)`
    const result = injectInspectRegistration(code)
    expect(result).toBeDefined()
    expect(result).toContain('__ik_createApp')
  })
})
