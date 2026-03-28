import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { usePluralize } from '../src/composables/usePluralize'
import { useLocale } from '../src/composables/useLocale'
import { _resetState } from '../src/state'
import { mountWithI18n, ruMessages, enMessages } from './helpers'

beforeEach(() => {
  _resetState()
  localStorage.clear()
})

// ---------------------------------------------------------------------------
// pluralizeIcu — русский язык
// ---------------------------------------------------------------------------

describe('pluralizeIcu — русский (one / few / many)', () => {
  const template =
    '{points} {points, plural, one {рубль} few {рубля} many {рублей} other {рублей}}'

  it('one: 1 рубль', () => {
    const { result } = mountWithI18n(() => usePluralize(), {
      defaultLocale: 'ru',
      locales: { ru: ruMessages },
    })
    expect(result.pluralizeIcu({ points: 1 }, template)).toBe('1 рубль')
  })

  it('few: 3 рубля', () => {
    const { result } = mountWithI18n(() => usePluralize(), {
      defaultLocale: 'ru',
      locales: { ru: ruMessages },
    })
    expect(result.pluralizeIcu({ points: 3 }, template)).toBe('3 рубля')
  })

  it('many: 5 рублей', () => {
    const { result } = mountWithI18n(() => usePluralize(), {
      defaultLocale: 'ru',
      locales: { ru: ruMessages },
    })
    expect(result.pluralizeIcu({ points: 5 }, template)).toBe('5 рублей')
  })

  it('many: 11 рублей (исключение — подростковое число)', () => {
    const { result } = mountWithI18n(() => usePluralize(), {
      defaultLocale: 'ru',
      locales: { ru: ruMessages },
    })
    expect(result.pluralizeIcu({ points: 11 }, template)).toBe('11 рублей')
  })

  it('one: 21 рубль', () => {
    const { result } = mountWithI18n(() => usePluralize(), {
      defaultLocale: 'ru',
      locales: { ru: ruMessages },
    })
    expect(result.pluralizeIcu({ points: 21 }, template)).toBe('21 рубль')
  })

  it('few: 22 рубля', () => {
    const { result } = mountWithI18n(() => usePluralize(), {
      defaultLocale: 'ru',
      locales: { ru: ruMessages },
    })
    expect(result.pluralizeIcu({ points: 22 }, template)).toBe('22 рубля')
  })

  it('many: 0 рублей', () => {
    const { result } = mountWithI18n(() => usePluralize(), {
      defaultLocale: 'ru',
      locales: { ru: ruMessages },
    })
    expect(result.pluralizeIcu({ points: 0 }, template)).toBe('0 рублей')
  })
})

// ---------------------------------------------------------------------------
// pluralizeIcu — английский язык
// ---------------------------------------------------------------------------

describe('pluralizeIcu — английский (one / other)', () => {
  const template = '{count, plural, one {# item} other {# items}}'

  it('one: 1 item', () => {
    const { result } = mountWithI18n(() => usePluralize(), {
      defaultLocale: 'en',
      locales: { en: enMessages },
    })
    expect(result.pluralizeIcu({ count: 1 }, template)).toBe('1 item')
  })

  it('other: 0 items', () => {
    const { result } = mountWithI18n(() => usePluralize(), {
      defaultLocale: 'en',
      locales: { en: enMessages },
    })
    expect(result.pluralizeIcu({ count: 0 }, template)).toBe('0 items')
  })

  it('other: 5 items', () => {
    const { result } = mountWithI18n(() => usePluralize(), {
      defaultLocale: 'en',
      locales: { en: enMessages },
    })
    expect(result.pluralizeIcu({ count: 5 }, template)).toBe('5 items')
  })

  it('other: 100 items', () => {
    const { result } = mountWithI18n(() => usePluralize(), {
      defaultLocale: 'en',
      locales: { en: enMessages },
    })
    expect(result.pluralizeIcu({ count: 100 }, template)).toBe('100 items')
  })
})

// ---------------------------------------------------------------------------
// pluralizeIcu — замена # и интерполяция переменных
// ---------------------------------------------------------------------------

describe('pluralizeIcu — # и переменные', () => {
  it('# заменяется числом внутри формы', () => {
    const { result } = mountWithI18n(() => usePluralize(), {
      defaultLocale: 'en',
      locales: { en: enMessages },
    })
    expect(
      result.pluralizeIcu({ n: 7 }, '{n, plural, one {# result} other {# results}}'),
    ).toBe('7 results')
  })

  it('{varName} снаружи plural-конструкции заменяется значением', () => {
    const { result } = mountWithI18n(() => usePluralize(), {
      defaultLocale: 'ru',
      locales: { ru: ruMessages },
    })
    expect(
      result.pluralizeIcu(
        { points: 42 },
        '{points} {points, plural, one {рубль} few {рубля} many {рублей} other {рублей}}',
      ),
    ).toBe('42 рубля')
  })

  it('несколько переменных: строка + число', () => {
    const { result } = mountWithI18n(() => usePluralize(), {
      defaultLocale: 'ru',
      locales: { ru: ruMessages },
    })
    expect(
      result.pluralizeIcu(
        { user: 'Даня', score: 21 },
        '{user} набрал {score} {score, plural, one {балл} few {балла} many {баллов} other {баллов}}',
      ),
    ).toBe('Даня набрал 21 балл')
  })

  it('несколько plural-конструкций в одном шаблоне', () => {
    const { result } = mountWithI18n(() => usePluralize(), {
      defaultLocale: 'ru',
      locales: { ru: ruMessages },
    })
    expect(
      result.pluralizeIcu(
        { files: 2, errors: 5 },
        '{files, plural, one {# файл} few {# файла} many {# файлов} other {# файлов}} ' +
          '({errors, plural, one {# ошибка} few {# ошибки} many {# ошибок} other {# ошибок}})',
      ),
    ).toBe('2 файла (5 ошибок)')
  })
})

// ---------------------------------------------------------------------------
// pluralizeIcu — граничные случаи
// ---------------------------------------------------------------------------

describe('pluralizeIcu — граничные случаи', () => {
  it('неизвестная переменная остаётся как {varName}', () => {
    const { result } = mountWithI18n(() => usePluralize(), {
      defaultLocale: 'en',
      locales: { en: enMessages },
    })
    expect(result.pluralizeIcu({}, 'Hello {name}')).toBe('Hello {name}')
  })

  it('шаблон без plural-конструкций — обычная интерполяция', () => {
    const { result } = mountWithI18n(() => usePluralize(), {
      defaultLocale: 'en',
      locales: { en: enMessages },
    })
    expect(result.pluralizeIcu({ name: 'Alice', age: 30 }, 'Hello {name}, age {age}')).toBe(
      'Hello Alice, age 30',
    )
  })

  it('fallback на other когда форма для категории отсутствует', () => {
    const { result } = mountWithI18n(() => usePluralize(), {
      defaultLocale: 'ru',
      locales: { ru: ruMessages },
    })
    expect(result.pluralizeIcu({ n: 1 }, '{n, plural, other {штук}}')).toBe('штук')
  })
})

// ---------------------------------------------------------------------------
// pluralCategory
// ---------------------------------------------------------------------------

describe('pluralCategory', () => {
  it('returns "one" for 1 in English', () => {
    const { result } = mountWithI18n(() => usePluralize(), {
      defaultLocale: 'en',
      locales: { en: enMessages },
    })
    expect(result.pluralCategory(1)).toBe('one')
  })

  it('returns "other" for 5 in English', () => {
    const { result } = mountWithI18n(() => usePluralize(), {
      defaultLocale: 'en',
      locales: { en: enMessages },
    })
    expect(result.pluralCategory(5)).toBe('other')
  })

  it('returns "one" for 1 in Russian', () => {
    const { result } = mountWithI18n(() => usePluralize(), {
      defaultLocale: 'ru',
      locales: { ru: ruMessages },
    })
    expect(result.pluralCategory(1)).toBe('one')
  })

  it('returns "few" for 3 in Russian', () => {
    const { result } = mountWithI18n(() => usePluralize(), {
      defaultLocale: 'ru',
      locales: { ru: ruMessages },
    })
    expect(result.pluralCategory(3)).toBe('few')
  })

  it('returns "many" for 5 in Russian', () => {
    const { result } = mountWithI18n(() => usePluralize(), {
      defaultLocale: 'ru',
      locales: { ru: ruMessages },
    })
    expect(result.pluralCategory(5)).toBe('many')
  })
})

// ---------------------------------------------------------------------------
// Реактивность на смену локали
// ---------------------------------------------------------------------------

describe('pluralizeIcu — реактивность при смене локали', () => {
  it('переключается на правила новой локали после setLocale', async () => {
    let pluralizeResult!: ReturnType<typeof usePluralize>
    let localeResult!: ReturnType<typeof useLocale>

    const { result } = mountWithI18n(
      () => {
        pluralizeResult = usePluralize()
        localeResult = useLocale()
        return { pluralizeIcu: pluralizeResult.pluralizeIcu, setLocale: localeResult.setLocale }
      },
      {
        defaultLocale: 'en',
        locales: { en: enMessages, ru: ruMessages },
      },
    )

    const enTemplate = '{n, plural, one {# item} other {# items}}'
    const ruTemplate =
      '{n} {n, plural, one {товар} few {товара} many {товаров} other {товаров}}'

    // English: 5 → other
    expect(result.pluralizeIcu({ n: 5 }, enTemplate)).toBe('5 items')

    await result.setLocale('ru')
    await nextTick()

    // Russian: 1 → one
    expect(pluralizeResult.pluralizeIcu({ n: 1 }, ruTemplate)).toBe('1 товар')
    // Russian: 5 → many
    expect(pluralizeResult.pluralizeIcu({ n: 5 }, ruTemplate)).toBe('5 товаров')
  })
})
