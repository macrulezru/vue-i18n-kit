import { defineConfig } from 'tsup'

export default defineConfig([
  // ── Main library (browser/universal) ───────────────────────────────────────
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ['vue', 'vue-i18n'],
    treeshake: true,
  },

  // ── Vite plugin (Node.js, optional peer dep) ────────────────────────────────
  {
    entry: { 'vite-plugin/index': 'src/vite-plugin/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: false,
    platform: 'node',
    external: ['vite'],
  },

  // ── CLI (Node.js executable, CJS only) ─────────────────────────────────────
  {
    entry: { 'cli/index': 'src/cli/index.ts' },
    format: ['cjs'],
    sourcemap: false,
    platform: 'node',
    banner: { js: '#!/usr/bin/env node' },
  },
])
