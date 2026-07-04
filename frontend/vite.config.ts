import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    proxy: {
      // VITE_PROXY_TARGET set by docker-compose (backend service hostname)
      '/api': process.env.VITE_PROXY_TARGET ?? 'http://localhost:8000',
    },
  },
  // Vitest owns src/*.test.ts; the e2e/ Playwright specs run via
  // `npm run test:e2e` and must not be collected here (they import
  // @playwright/test, which conflicts with Vitest's runner).
  test: {
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
