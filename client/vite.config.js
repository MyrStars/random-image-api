import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/admin/',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3100',
      '/admin/api': 'http://localhost:3100',
    },
  },
  build: {
    outDir: 'dist',
  },
})
