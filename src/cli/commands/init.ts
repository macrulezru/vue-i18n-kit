import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const EXAMPLE_MESSAGES = {
  buttons: {
    submit: 'Submit',
    cancel: 'Cancel',
  },
  greeting: 'Hello, {name}!',
  items: '{count} item | {count} items',
}

export interface InitOptions {
  dir: string
  locales: string[]
}

export function runInit(options: InitOptions): void {
  const { dir, locales } = options
  const cwd = process.cwd()

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
    console.log(`✓ Created ${relative(cwd, dir)}/`)
  }

  let createdAny = false
  for (const locale of locales) {
    const filePath = join(dir, `${locale}.json`)
    if (existsSync(filePath)) {
      console.log(`  Skipped (already exists): ${relative(cwd, filePath)}`)
      continue
    }
    writeFileSync(filePath, JSON.stringify(EXAMPLE_MESSAGES, null, 2) + '\n', 'utf-8')
    console.log(`✓ Created ${relative(cwd, filePath)}`)
    createdAny = true
  }

  if (!createdAny) return

  const localeImports = locales
    .map((l) => `      ${l}: () => import('./${relative(cwd, dir)}/${l}.json'),`)
    .join('\n')

  console.log(`
Next step — register the plugin in your main.ts:

  import { createVueI18nPlugin } from 'vue-i18n-kit'

  app.use(createVueI18nPlugin({
    defaultLocale: '${locales[0]}',
    fallbackLocale: '${locales[0]}',
    locales: {
${localeImports}
    },
    persistLocale: true,
  }))
`)
}
