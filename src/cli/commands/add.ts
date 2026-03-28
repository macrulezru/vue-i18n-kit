import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

export interface AddOptions {
  dir: string
  from?: string
  empty: boolean
}

function clearValues(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      result[k] = clearValues(v as Record<string, unknown>)
    } else {
      result[k] = ''
    }
  }
  return result
}

export function runAdd(locale: string, options: AddOptions): void {
  const { dir, empty } = options
  const cwd = process.cwd()

  if (!existsSync(dir)) {
    console.error(`✗ Directory not found: ${dir}`)
    console.error('  Run `vue-i18n-kit init` first.')
    process.exit(1)
  }

  const jsonFiles = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()

  if (jsonFiles.length === 0) {
    console.error(`✗ No locale files found in ${dir}`)
    console.error('  Run `vue-i18n-kit init` first.')
    process.exit(1)
  }

  const sourceFile = options.from ? `${options.from}.json` : jsonFiles[0]
  const sourcePath = join(dir, sourceFile)

  if (!existsSync(sourcePath)) {
    console.error(`✗ Source locale file not found: ${relative(cwd, sourcePath)}`)
    console.error(`  Available: ${jsonFiles.join(', ')}`)
    process.exit(1)
  }

  const outPath = join(dir, `${locale}.json`)
  if (existsSync(outPath)) {
    console.error(`✗ File already exists: ${relative(cwd, outPath)}`)
    console.error('  Remove it manually or choose a different locale code.')
    process.exit(1)
  }

  const sourceMessages = JSON.parse(readFileSync(sourcePath, 'utf-8')) as Record<string, unknown>
  const newMessages = empty ? clearValues(sourceMessages) : sourceMessages

  writeFileSync(outPath, JSON.stringify(newMessages, null, 2) + '\n', 'utf-8')

  const srcLabel = relative(cwd, sourcePath)
  const outLabel = relative(cwd, outPath)
  console.log(`✓ Created ${outLabel} (from ${srcLabel}${empty ? ', empty values' : ''})`)

  if (!empty) {
    console.log('  Tip: values are copied from the source locale as placeholders.')
    console.log('       Run with --empty to create empty strings instead.')
  }
}
