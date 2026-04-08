import { defineConfig } from 'vite'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        admin: resolve(root, 'admin.html'),
      },
    },
  },
})