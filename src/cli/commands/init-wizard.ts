import {
  intro, outro, text, select, confirm,
  spinner as createSpinner, note, cancel, isCancel, log,
} from '@clack/prompts'
import { existsSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve, dirname } from 'node:path'
import { discoverLocales, updateConfig, findProjectConfig, type DiscoveredLocale } from './auto-config.js'
import {
  readConfig, writeConfig, backupFile,
  buildLegacyLocalesConfig, CONFIG_FILENAME,
} from '../../config/index.js'
import type { I18nKitConfig, LocaleConfig, LocaleMeta } from '../../config/schema.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the absolute path to the app entry file, or null if not found. */
function findMainEntryFile(cwd: string): string | null {
  const candidates = [
    'src/main.ts', 'src/main.js', 'src/main.mts',
    'main.ts', 'main.js',
    'src/index.ts', 'src/index.js',
  ]
  for (const c of candidates) {
    const abs = resolve(cwd, c)
    if (existsSync(abs)) return abs
  }
  return null
}

/** Generates the app.use(createVueI18nPlugin({...})) snippet. */
function buildPluginSnippet(locales: LocaleConfig[], _localesDir: string): string {
  const defaultLocale = locales[0]?.code ?? 'en'
  const entries = locales.map(l => {
    const importPath = `./${l.path.replace(/\\/g, '/')}`
    const metaEntries = Object.entries(l.meta ?? {})
    const metaStr = metaEntries.length > 0
      ? `\n      meta: { ${metaEntries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')} },`
      : ''
    return `    ${l.code}: {\n      messages: () => import('${importPath}'),${metaStr}\n    },`
  }).join('\n')

  return [
    `import { createVueI18nPlugin } from 'vue-i18n-kit'`,
    ``,
    `// In main.ts — after createApp(App), before app.mount('#app'):`,
    `app.use(createVueI18nPlugin({`,
    `  defaultLocale: '${defaultLocale}',`,
    `  fallbackLocale: '${defaultLocale}',`,
    `  locales: {`,
    entries,
    `  },`,
    `  persistLocale: true,`,
    `}))`,
  ].join('\n')
}

function abortIfCancel(value: unknown): asserts value is string | boolean {
  if (isCancel(value)) {
    cancel('Setup cancelled.')
    process.exit(0)
  }
}

function now(): string {
  return new Date().toISOString()
}

function ensureDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true })
}

/** Converts LocaleConfig[] to the DiscoveredLocale[] format used by updateConfig. */
function toDiscoveredLocales(cwd: string, locales: LocaleConfig[]): DiscoveredLocale[] {
  return locales.map(l => ({
    code: l.code,
    relativePath: l.path.replace(/\\/g, '/'),
    absolutePath: resolve(cwd, l.path),
    meta: l.meta as Record<string, unknown> | undefined,
  }))
}

/** Returns a one-line summary string for a locale config entry. */
function localeSummaryLine(l: LocaleConfig): string {
  const flag = l.meta.flag ? `${l.meta.flag}  ` : ''
  return `  ${flag}${l.code}  →  ${l.meta.display}  (${l.path})`
}

// ── Prompts ───────────────────────────────────────────────────────────────────

/**
 * Collects locale codes + metadata for all locales.
 * Pre-fills defaults from existingLocales (update flow) or discovered (auto-scan).
 */
async function promptLocales(
  defaults: { code: string; display: string; flag: string }[],
): Promise<Array<{ code: string; display: string; flag: string }>> {
  const defaultCodes = defaults.map(d => d.code).join(', ')

  const codesRaw = await text({
    message: 'Locale codes (comma-separated, e.g.  en, ru, de)',
    placeholder: 'en, ru',
    initialValue: defaultCodes || '',
    validate: v => {
      const codes = (v ?? '').split(',').map(s => s.trim()).filter(Boolean)
      if (codes.length === 0) return 'Enter at least one locale code.'
      const invalid = codes.find(c => !/^[a-zA-Z]{2,3}(?:-[a-zA-Z]{2,4})?$/.test(c))
      if (invalid) return `"${invalid}" is not a valid locale code (e.g. en, zh-CN).`
    },
  })
  abortIfCancel(codesRaw)

  const codes = (codesRaw as string).split(',').map(s => s.trim()).filter(Boolean)
  const result: Array<{ code: string; display: string; flag: string }> = []

  for (const code of codes) {
    const existing = defaults.find(d => d.code === code)

    const display = await text({
      message: `Display name for "${code}"`,
      placeholder: code,
      initialValue: existing?.display || code,
      validate: v => (v ?? '').trim() === '' ? 'Display name is required.' : undefined,
    })
    abortIfCancel(display)

    const flag = await text({
      message: `Flag emoji for "${code}"  (optional, press Enter to skip)`,
      initialValue: existing?.flag ?? '',
    })
    abortIfCancel(flag)

    result.push({ code, display: (display as string).trim(), flag: (flag as string).trim() })
  }

  return result
}

/**
 * Asks what to do with a locale JSON file that already exists.
 * Returns 'keep' | 'overwrite' | 'copy'.
 */
async function promptExistingFile(
  code: string,
  filePath: string,
  allCodes: string[],
): Promise<{ action: 'keep' | 'overwrite' | 'copy'; copyFrom?: string }> {
  const options: Array<{ value: string; label: string }> = [
    { value: 'keep', label: 'Keep existing file' },
    { value: 'overwrite', label: 'Overwrite with empty {}' },
  ]
  const otherCodes = allCodes.filter(c => c !== code)
  if (otherCodes.length > 0) {
    options.push({ value: 'copy', label: `Copy structure from another locale` })
  }

  const action = await select({
    message: `${filePath} already exists — what should we do?`,
    options,
  })
  abortIfCancel(action)

  if (action === 'copy') {
    const copyFrom = await select({
      message: `Copy structure from which locale?`,
      options: otherCodes.map(c => ({ value: c, label: c })),
    })
    abortIfCancel(copyFrom)
    return { action: 'copy', copyFrom: copyFrom as string }
  }

  return { action: action as 'keep' | 'overwrite' }
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export async function runInitWizard(cwd: string): Promise<void> {
  intro('vue-i18n-kit — Locale Setup')

  // ── 1. Check for existing config ─────────────────────────────────────────────
  const existingConfig = readConfig(cwd)

  if (existingConfig) {
    log.info(`Found existing ${CONFIG_FILENAME}:`)
    for (const l of existingConfig.locales) {
      log.message(localeSummaryLine(l))
    }

    const action = await select({
      message: 'What would you like to do?',
      options: [
        { value: 'use',    label: 'Use existing config — open the editor' },
        { value: 'update', label: 'Update settings (pre-filled with current values)' },
        { value: 'reinit', label: 'Reinitialize from scratch' },
      ],
    })
    abortIfCancel(action)

    if (action === 'use') {
      outro('Config is up to date. Run  vue-i18n-kit ui  to open the editor.')
      return
    }

    if (action === 'update') {
      await runWizardFlow(cwd, existingConfig)
      return
    }

    // reinit — fall through with no defaults
    await runWizardFlow(cwd, null)
    return
  }

  // ── 2. No existing config — try auto-scan for defaults ───────────────────────
  let scannedDefaults: { code: string; display: string; flag: string }[] = []

  const sp = createSpinner()
  sp.start('Scanning project for createVueI18nPlugin…')
  try {
    const discovered = discoverLocales(cwd)
    if (discovered.length > 0) {
      scannedDefaults = discovered.map(d => ({
        code: d.code,
        display: (d.meta?.display as string | undefined) ?? d.code,
        flag: (d.meta?.flag as string | undefined) ?? '',
      }))
      sp.stop(`Detected ${discovered.length} locale(s): ${discovered.map(d => d.code).join(', ')}`)
    } else {
      sp.stop('No existing locale setup detected — starting fresh.')
    }
  } catch {
    sp.stop('Scan failed — starting fresh.')
  }

  await runWizardFlow(cwd, null, scannedDefaults)
}

// ── Wizard flow (shared by new setup and update) ──────────────────────────────

async function runWizardFlow(
  cwd: string,
  existing: I18nKitConfig | null,
  scannedDefaults: { code: string; display: string; flag: string }[] = [],
): Promise<void> {
  const prefilledLocales = existing
    ? existing.locales.map(l => ({
        code: l.code,
        display: l.meta.display,
        flag: l.meta.flag ?? '',
      }))
    : scannedDefaults

  // ── Step 1: Locales + metadata ────────────────────────────────────────────────
  const localeInputs = await promptLocales(prefilledLocales)

  // ── Step 2: Directory paths ───────────────────────────────────────────────────
  const defaultLocalesDir = existing?.localesDir
    ?? (scannedDefaults.length > 0
        ? (discoverLocales(cwd)[0]?.relativePath.split('/').slice(0, -1).join('/').replace(/\/[^/]+$/, '') || 'src/locales')
        : 'src/locales')

  const localesDir = await text({
    message: 'Locales directory (relative to project root)',
    placeholder: 'src/locales',
    defaultValue: existing?.localesDir ?? (scannedDefaults.length > 0 ? defaultLocalesDir : 'src/locales'),
  })
  abortIfCancel(localesDir)

  const toolkitDir = await text({
    message: 'Toolkit directory for generated files (relative to project root)',
    placeholder: 'i18n-tools',
    defaultValue: existing?.toolkitDir ?? 'i18n-tools',
  })
  abortIfCancel(toolkitDir)

  // ── Step 3: Integration ───────────────────────────────────────────────────────
  const projectConfig = findProjectConfig(cwd)
  let addPlugin = false

  if (projectConfig) {
    const kindLabel = projectConfig.kind === 'nuxt' ? 'nuxt.config.ts' : 'vite.config.ts'
    const alreadyHasPlugin = readFileSync(projectConfig.path, 'utf-8').includes('vueI18nMapPlugin(')

    if (alreadyHasPlugin) {
      log.info(`${kindLabel} already contains vueI18nMapPlugin — it will be updated.`)
      addPlugin = true
    } else {
      const integrate = await confirm({
        message: `Detected ${kindLabel}. Add vueI18nMapPlugin automatically?`,
        initialValue: true,
      })
      abortIfCancel(integrate)
      addPlugin = integrate as boolean
    }
  }

  // ── Step 4: Build the new config object ───────────────────────────────────────
  const localesDirStr = (localesDir as string).trim()
  const toolkitDirStr = (toolkitDir as string).trim()

  const newLocales: LocaleConfig[] = localeInputs.map(({ code, display, flag }) => {
    const oldEntry = existing?.locales.find(l => l.code === code)
    const path = `${localesDirStr}/${code}.json`
    const meta: LocaleMeta = { display, ...(flag ? { flag } : {}) }
    return {
      code,
      path,
      meta,
      createdAt: oldEntry?.createdAt ?? now(),
      updatedAt: now(),
    }
  })

  const newConfig: I18nKitConfig = {
    version: 1,
    localesDir: localesDirStr,
    toolkitDir: toolkitDirStr,
    locales: newLocales,
    integrations: {
      ...(projectConfig?.kind === 'vite' ? { viteConfigPath: relative(cwd, projectConfig.path).replace(/\\/g, '/') } : {}),
      ...(projectConfig?.kind === 'nuxt' ? { nuxtConfigPath: relative(cwd, projectConfig.path).replace(/\\/g, '/') } : {}),
      pluginAdded: addPlugin,
      lastUpdated: now(),
    },
    scanner: existing?.scanner ?? {
      include: ['src/**/*.{vue,ts,js}'],
      exclude: ['node_modules/**', '**/*.test.{ts,js}', '**/*.spec.{ts,js}'],
    },
  }

  // ── Step 5: Handle existing locale JSON files ─────────────────────────────────
  type FileAction = { action: 'keep' | 'overwrite' | 'copy' | 'create'; copyFrom?: string }
  const fileActions = new Map<string, FileAction>()

  for (const locale of newLocales) {
    const absPath = resolve(cwd, locale.path)
    if (existsSync(absPath)) {
      const decision = await promptExistingFile(locale.code, locale.path, newLocales.map(l => l.code))
      fileActions.set(locale.code, decision)
    } else {
      fileActions.set(locale.code, { action: 'create' })
    }
  }

  // ── Step 5b: main.ts plugin setup ────────────────────────────────────────────
  const mainEntryFile = findMainEntryFile(cwd)
  const mainEntryLabel = mainEntryFile
    ? relative(cwd, mainEntryFile).replace(/\\/g, '/')
    : 'main.ts'
  const mainAlreadySetup = mainEntryFile
    ? readFileSync(mainEntryFile, 'utf-8').includes('createVueI18nPlugin')
    : false

  let showMainSnippet = false
  if (!mainAlreadySetup) {
    const doMain = await confirm({
      message: mainEntryFile
        ? `${mainEntryLabel} does not have createVueI18nPlugin yet — show the setup snippet?`
        : `No entry file detected — show the app.use() snippet to add manually?`,
      initialValue: true,
    })
    abortIfCancel(doMain)
    showMainSnippet = doMain as boolean
  }

  // ── Step 6: Write everything ──────────────────────────────────────────────────
  const sp = createSpinner()
  sp.start('Writing files…')

  const written: string[] = []
  const skipped: string[] = []

  try {
    // i18n-kit.config.json
    const configPath = join(cwd, CONFIG_FILENAME)
    if (existsSync(configPath)) backupFile(configPath)
    writeConfig(cwd, newConfig)
    written.push(CONFIG_FILENAME)

    // toolkit dir + locales.config.json (legacy compat for ui server)
    const toolkitAbs = resolve(cwd, toolkitDirStr)
    ensureDir(toolkitAbs)
    const legacyConfigPath = join(toolkitAbs, 'locales.config.json')
    if (existsSync(legacyConfigPath)) backupFile(legacyConfigPath)
    writeFileSync(legacyConfigPath, JSON.stringify(buildLegacyLocalesConfig(cwd, newConfig), null, 2) + '\n', 'utf-8')
    written.push(`${toolkitDirStr}/locales.config.json`)

    // locales dir
    ensureDir(resolve(cwd, localesDirStr))

    // locale JSON files
    for (const locale of newLocales) {
      const absPath = resolve(cwd, locale.path)
      const decision = fileActions.get(locale.code)!

      if (decision.action === 'keep') {
        skipped.push(locale.path)
        continue
      }
      if (decision.action === 'overwrite' || decision.action === 'create') {
        ensureDir(dirname(absPath))
        writeFileSync(absPath, '{}\n', 'utf-8')
        written.push(locale.path)
        continue
      }
      if (decision.action === 'copy' && decision.copyFrom) {
        const srcLocale = newLocales.find(l => l.code === decision.copyFrom)
        if (srcLocale) {
          const srcPath = resolve(cwd, srcLocale.path)
          ensureDir(dirname(absPath))
          if (existsSync(srcPath)) {
            const src = readFileSync(srcPath, 'utf-8')
            writeFileSync(absPath, src, 'utf-8')
          } else {
            writeFileSync(absPath, '{}\n', 'utf-8')
          }
          written.push(locale.path)
        }
      }
    }

    // vite / nuxt config
    if (addPlugin && projectConfig) {
      backupFile(projectConfig.path)
      updateConfig(projectConfig.path, projectConfig.kind, toDiscoveredLocales(cwd, newLocales))
      written.push(relative(cwd, projectConfig.path).replace(/\\/g, '/'))
    }

    sp.stop('Done.')
  } catch (err) {
    sp.stop('Write failed.')
    log.error(String(err))
    process.exit(1)
  }

  // ── Step 7: Summary ───────────────────────────────────────────────────────────
  const writtenList = written.map(f => `  ✓  ${f}`).join('\n')
  const skippedList = skipped.length > 0 ? '\n\nSkipped (kept existing):\n' + skipped.map(f => `  –  ${f}`).join('\n') : ''
  note(writtenList + skippedList, 'Files written')

  if (showMainSnippet) {
    note(buildPluginSnippet(newLocales, localesDirStr), `Add to ${mainEntryLabel}`)
  }

  outro(
    `Setup complete!\n\n` +
    `  Add to package.json:\n` +
    `    "i18n:ui": "vue-i18n-kit ui"\n\n` +
    `  Then run:\n` +
    `    npm run i18n:ui`,
  )
}
