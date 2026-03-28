import { describe, it, expect } from 'vitest'
import { isLocaleDefinition, extractMessages, extractMeta } from '../src/utils/localeEntry'
import type { LocaleMessages } from '../src/types'

const messages: LocaleMessages = { greeting: 'Hello' }
const loader = () => Promise.resolve(messages)

describe('isLocaleDefinition', () => {
  it('returns false for a plain messages object', () => {
    expect(isLocaleDefinition(messages)).toBe(false)
  })

  it('returns false for a loader function', () => {
    expect(isLocaleDefinition(loader)).toBe(false)
  })

  it('returns true when meta is present', () => {
    expect(isLocaleDefinition({ messages, meta: { display: 'English' } })).toBe(true)
  })

  it('returns true when messages is a function (loader inside definition)', () => {
    expect(isLocaleDefinition({ messages: loader })).toBe(true)
  })

  it('returns false for a messages object with a "messages" translation key (string value)', () => {
    // A translation key named "messages" with a string value must NOT be
    // misidentified as a LocaleDefinition
    expect(isLocaleDefinition({ messages: 'Your messages' })).toBe(false)
  })

  it('returns false for a messages object with a nested "messages" object but no meta', () => {
    // Nested object under "messages" key without "meta" → plain messages
    expect(isLocaleDefinition({ messages: { empty: 'No messages' } })).toBe(false)
  })

  it('returns true for a definition with both messages object and meta', () => {
    expect(isLocaleDefinition({ messages, meta: { display: 'English' } })).toBe(true)
  })
})

describe('extractMessages', () => {
  it('returns the object itself for plain LocaleMessages', () => {
    expect(extractMessages(messages)).toBe(messages)
  })

  it('returns the function itself for a loader', () => {
    expect(extractMessages(loader)).toBe(loader)
  })

  it('returns entry.messages for a LocaleDefinition with loader', () => {
    expect(extractMessages({ messages: loader })).toBe(loader)
  })

  it('returns entry.messages for a LocaleDefinition with pre-loaded object', () => {
    expect(extractMessages({ messages, meta: { display: 'English' } })).toBe(messages)
  })
})

describe('extractMeta', () => {
  it('returns undefined for a plain messages object', () => {
    expect(extractMeta(messages)).toBeUndefined()
  })

  it('returns undefined for a loader function', () => {
    expect(extractMeta(loader)).toBeUndefined()
  })

  it('returns undefined when meta is absent in a LocaleDefinition', () => {
    expect(extractMeta({ messages: loader })).toBeUndefined()
  })

  it('returns the meta object from a LocaleDefinition', () => {
    const meta = { display: 'English', flag: '🇬🇧', author: 'Danil' }
    expect(extractMeta({ messages, meta })).toEqual(meta)
  })
})
