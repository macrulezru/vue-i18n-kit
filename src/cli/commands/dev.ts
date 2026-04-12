import { spawn } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ChildProcess } from 'node:child_process'

export interface DevOptions {
  /** Port for the vue-i18n-kit UI server. @default 4173 */
  uiPort: number
  /**
   * Override the app dev command instead of auto-detecting from package.json.
   * @example 'nuxt dev'
   */
  appCmd: string | undefined
  /** Project root directory. @default process.cwd() */
  cwd: string
}

// ── Package manager detection ─────────────────────────────────────────────────

function detectPackageManager(cwd: string): 'npm' | 'pnpm' | 'yarn' {
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(cwd, 'yarn.lock'))) return 'yarn'
  return 'npm'
}

/**
 * Returns the shell command to run the project's `scripts.dev`.
 * Reads the package manager from lockfile to use the correct runner.
 */
function resolveAppCmd(override: string | undefined, cwd: string): string | undefined {
  if (override) return override

  const pkgPath = join(cwd, 'package.json')
  if (!existsSync(pkgPath)) return undefined

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
      scripts?: Record<string, string>
    }
    if (!pkg.scripts?.dev) return undefined

    const pm = detectPackageManager(cwd)
    return pm === 'yarn' ? 'yarn dev' : `${pm} run dev`
  } catch {
    return undefined
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Starts the application's dev server and the vue-i18n-kit UI server in
 * parallel. Passes `I18N_KIT_UI_URL` as an environment variable so that
 * `vueI18nDevPlugin` can pick up the UI URL automatically — no need to
 * hardcode it in `vite.config.ts`.
 */
export function runDev(options: DevOptions): void {
  const { uiPort, cwd } = options
  const uiUrl = `http://localhost:${uiPort}`

  const appCmd = resolveAppCmd(options.appCmd, cwd)
  if (!appCmd) {
    console.error('[vue-i18n-kit] Could not detect an app dev command.')
    console.error('  Expected:  package.json → scripts.dev')
    console.error('  Override:  --app-cmd "nuxt dev"  or  --app-cmd "vite"')
    process.exit(1)
  }

  console.log('[vue-i18n-kit] Starting dev environment')
  console.log(`  App:  ${appCmd}`)
  console.log(`  UI:   vue-i18n-kit ui --port ${uiPort}  →  ${uiUrl}`)
  console.log()

  // Expose UI URL so vueI18nDevPlugin can read it without explicit config
  const env: NodeJS.ProcessEnv = { ...process.env, I18N_KIT_UI_URL: uiUrl }

  // ── Launch app (Vite / Nuxt / custom) ───────────────────────────────────────
  const appProc: ChildProcess = spawn(appCmd, [], {
    cwd,
    env,
    stdio: 'inherit',
    shell: true,  // required so npm/pnpm scripts resolve on both Unix and Windows
  })

  // ── Launch i18n UI server via the same CLI binary ───────────────────────────
  const selfBin = process.argv[1]
  const uiProc: ChildProcess = spawn(
    process.execPath,
    [selfBin, 'ui', '--port', String(uiPort)],
    { cwd, env, stdio: 'inherit' },
  )

  // ── Graceful shutdown ───────────────────────────────────────────────────────

  let exiting = false

  function exit(code: number): void {
    if (exiting) return
    exiting = true
    try { appProc.kill() } catch { /* already terminated */ }
    try { uiProc.kill() } catch { /* already terminated */ }
    process.exit(code)
  }

  // Ctrl+C / SIGTERM — kill both children then exit
  process.on('SIGINT',  () => exit(0))
  process.on('SIGTERM', () => exit(0))

  // If either child exits on its own, shut down the other
  appProc.on('exit', (code) => { if (!exiting) exit(code ?? 0) })
  uiProc.on('exit',  (code) => { if (!exiting) exit(code ?? 0) })
}
