import { describe, it, expect } from 'vitest'
import { wrapTranslationCalls } from '../src/vite-plugin/index'

const DEFAULT_FNS = ['t', 'tm', '$t']

function sfc(template: string): string {
  return `<template>\n${template}\n</template>\n<script setup>\nconst t = (k: string) => k\n</script>`
}

function extractTemplate(result: string): string {
  const m = result.match(/<template>([\s\S]*?)<\/template>/)
  return m ? m[1].trim() : ''
}

describe('wrapTranslationCalls', () => {
  it('returns undefined when no template block', () => {
    expect(wrapTranslationCalls('<script>const x = 1</script>', DEFAULT_FNS)).toBeUndefined()
  })

  it('returns undefined when no matching calls', () => {
    const src = sfc('<p>Hello</p>')
    expect(wrapTranslationCalls(src, DEFAULT_FNS)).toBeUndefined()
  })

  it('wraps a simple t() call', () => {
    const src = sfc("<p>{{ t('nav.home') }}</p>")
    const result = wrapTranslationCalls(src, DEFAULT_FNS)!
    expect(result).toBeDefined()
    expect(extractTemplate(result)).toBe(
      `<p><I18nInspect i18n-key="nav.home">{{ t('nav.home') }}</I18nInspect></p>`,
    )
  })

  it('wraps a tm() call', () => {
    const src = sfc("<p>{{ tm('items.count') }}</p>")
    const result = wrapTranslationCalls(src, DEFAULT_FNS)!
    expect(extractTemplate(result)).toBe(
      `<p><I18nInspect i18n-key="items.count">{{ tm('items.count') }}</I18nInspect></p>`,
    )
  })

  it('wraps a $t() call', () => {
    const src = sfc("<p>{{ $t('greeting') }}</p>")
    const result = wrapTranslationCalls(src, DEFAULT_FNS)!
    expect(extractTemplate(result)).toBe(
      `<p><I18nInspect i18n-key="greeting">{{ $t('greeting') }}</I18nInspect></p>`,
    )
  })

  it('wraps call with extra arguments (object arg)', () => {
    const src = sfc("<p>{{ t('items.count', { n: count }) }}</p>")
    const result = wrapTranslationCalls(src, DEFAULT_FNS)!
    expect(extractTemplate(result)).toBe(
      `<p><I18nInspect i18n-key="items.count">{{ t('items.count', { n: count }) }}</I18nInspect></p>`,
    )
  })

  it('wraps double-quoted key', () => {
    const src = sfc('<p>{{ t("nav.home") }}</p>')
    const result = wrapTranslationCalls(src, DEFAULT_FNS)!
    expect(extractTemplate(result)).toContain('i18n-key="nav.home"')
  })

  it('wraps multiple calls in one template', () => {
    const src = sfc("<p>{{ t('nav.home') }}</p><span>{{ tm('title') }}</span>")
    const result = wrapTranslationCalls(src, DEFAULT_FNS)!
    expect(extractTemplate(result)).toContain('i18n-key="nav.home"')
    expect(extractTemplate(result)).toContain('i18n-key="title"')
  })

  it('skips dynamic key (variable, not literal)', () => {
    const src = sfc('<p>{{ t(dynamicKey) }}</p>')
    expect(wrapTranslationCalls(src, DEFAULT_FNS)).toBeUndefined()
  })

  it('skips template literal with ${} (dynamic)', () => {
    const src = sfc('<p>{{ t(`key-${suffix}`) }}</p>')
    expect(wrapTranslationCalls(src, DEFAULT_FNS)).toBeUndefined()
  })

  it('does not double-wrap already wrapped calls', () => {
    const src = sfc(`<p><I18nInspect i18n-key="nav.home">{{ t('nav.home') }}</I18nInspect></p>`)
    expect(wrapTranslationCalls(src, DEFAULT_FNS)).toBeUndefined()
  })

  it('skips attribute bindings', () => {
    const src = sfc(`<input :placeholder="t('search.placeholder')" />`)
    expect(wrapTranslationCalls(src, DEFAULT_FNS)).toBeUndefined()
  })

  it('wraps key with special characters that are safe in HTML attributes', () => {
    const src = sfc("<p>{{ t('section.some-key_v2') }}</p>")
    const result = wrapTranslationCalls(src, DEFAULT_FNS)!
    expect(extractTemplate(result)).toContain('i18n-key="section.some-key_v2"')
  })

  it('respects custom wrapFunctions', () => {
    const src = sfc("<p>{{ translate('nav.home') }}</p>")
    const result = wrapTranslationCalls(src, ['translate'])!
    expect(result).toBeDefined()
    expect(extractTemplate(result)).toContain('i18n-key="nav.home"')
  })

  it('does not wrap non-listed function names', () => {
    const src = sfc("<p>{{ format('nav.home') }}</p>")
    expect(wrapTranslationCalls(src, DEFAULT_FNS)).toBeUndefined()
  })
})
