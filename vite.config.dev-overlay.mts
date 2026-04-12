/**
 * Vite build config for the dev-overlay browser bundle.
 *
 * Compiles `src/vite-plugin/dev-overlay/` (Vue SFCs + TypeScript) into a
 * single ESM file at `dist/vite-plugin/dev-overlay/index.js`.
 * `vue` is kept external — the user's app already has it as a dependency.
 *
 * CSS from `<style>` blocks is extracted and then re-injected into the JS
 * bundle by `injectCss()`, keeping the output as a single file with no
 * separate `.css` asset.
 */
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(__dirname, 'dist/vite-plugin/dev-overlay')

/**
 * Post-build plugin: reads the extracted `style.css`, prepends a self-executing
 * style-injection snippet to `index.js`, then deletes `style.css`.
 * Using `closeBundle` (after files are written) is more reliable than
 * `generateBundle` (bundle manipulation) across Vite versions.
 */
function injectCss(): Plugin {
  return {
    name: 'vue-i18n-kit:inject-css',
    closeBundle() {
      const cssPath = resolve(outDir, 'style.css')
      const jsPath  = resolve(outDir, 'index.js')

      if (!existsSync(cssPath) || !existsSync(jsPath)) return

      const css = readFileSync(cssPath, 'utf-8').trim()
      if (!css) return

      const snippet =
        `;(function(){` +
        `var s=document.createElement('style');` +
        `s.setAttribute('data-vue-i18n-kit','');` +
        `s.textContent=${JSON.stringify(css)};` +
        `document.head.appendChild(s)` +
        `}());\n`

      const js = readFileSync(jsPath, 'utf-8')
      writeFileSync(jsPath, snippet + js, 'utf-8')
      unlinkSync(cssPath)
    },
  }
}

export default defineConfig({
  plugins: [vue(), injectCss()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/vite-plugin/dev-overlay/index.ts'),
      formats: ['es'],
      // Explicit .js extension — required so the plugin can locate the file
      // via join(__dirname, 'dev-overlay', 'index.js')
      fileName: () => 'index.js',
    },
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      external: ['vue'],
    },
    minify: false,
    cssCodeSplit: false,
    sourcemap: false,
  },
})
