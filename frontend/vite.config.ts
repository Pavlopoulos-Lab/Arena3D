import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    proxy: {
      // VITE_PROXY_TARGET set by docker-compose (backend service hostname)
      '/api': process.env.VITE_PROXY_TARGET ?? 'http://localhost:8000',
    },
  },
})
