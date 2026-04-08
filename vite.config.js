const { defineConfig } = require('vite')
const { resolve } = require('path')

module.exports = defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        admin: resolve(process.cwd(), 'admin.html'),
      },
    },
  },
})