import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  root: 'src/ui-app',
  plugins: [vue()],
  build: {
    outDir: fileURLToPath(new URL('./dist/ui-server/public', import.meta.url)),
    emptyOutDir: true,
  },
})
