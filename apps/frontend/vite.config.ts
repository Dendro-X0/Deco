import path from 'path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPkg = JSON.parse(
  readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8'),
) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  define: {
    __DECO_APP_VERSION__: JSON.stringify(rootPkg.version),
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
