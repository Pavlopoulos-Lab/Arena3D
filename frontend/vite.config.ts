import { defineConfig } from 'vite'

export default defineConfig({
  // Sub-path deployment fix: Vite emits root-absolute asset URLs (e.g.
  // "/assets/x.js") by default, which 404 when the app is reverse-proxied
  // under a path prefix (e.g. Apache's ProxyPass /arena3/ -> this server).
  // Set via env so the prefix isn't baked into the repo per-deployment.
  base: process.env.VITE_BASE_PATH ?? '/',
  server: {
    // Vite's dev-server Host-header check (anti DNS-rebinding) rejects any
    // request whose Host doesn't match localhost/an IP/an allowed entry.
    // Deployments reverse-proxying a real domain to this dev server need
    // their hostname listed here — set via env so it's not baked into the
    // repo. Comma-separated (e.g. "example.org,example.org:8080").
    allowedHosts: process.env.VITE_ALLOWED_HOSTS
      ? process.env.VITE_ALLOWED_HOSTS.split(',').map((h) => h.trim())
      : undefined,
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
