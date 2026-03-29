import { createApp, defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createVueI18nPlugin } from '../src/plugin'
import type { I18nPluginOptions } from '../src/types'

export const ruMessages = {
  buttons: { submit: 'Отправить', cancel: 'Отмена' },
  greeting: 'Привет, {name}!',
  items: '{count, plural, one {# товар} few {# товара} many {# товаров} other {# товаров}}',
}

export const enMessages = {
  buttons: { submit: 'Submit', cancel: 'Cancel' },
  greeting: 'Hello, {name}!',
  items: '{count, plural, one {# item} other {# items}}',
}

export const defaultOptions: I18nPluginOptions = {
  defaultLocale: 'ru',
  fallbackLocale: 'en',
  locales: {
    ru: ruMessages,
    en: enMessages,
  },
}

/** Installs the plugin into a real Vue app and returns the app instance. */
export function createTestApp(options: I18nPluginOptions = defaultOptions) {
  const app = createApp({ render: () => h('div') })
  app.use(createVueI18nPlugin(options))
  return app
}

/** Mounts a component with the i18n plugin pre-installed. */
export function mountWithI18n<T>(
  composable: () => T,
  options: I18nPluginOptions = defaultOptions,
): { result: T } {
  const plugin = createVueI18nPlugin(options)

  let result!: T
  const TestComponent = defineComponent({
    setup() {
      result = composable()
      return {}
    },
    render: () => h('div'),
  })

  mount(TestComponent, {
    global: { plugins: [plugin] },
  })

  return { result }
}
