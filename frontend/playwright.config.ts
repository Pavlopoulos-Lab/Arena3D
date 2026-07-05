import { defineConfig, devices } from '@playwright/test'

// E2E runs against the dev server with the backend proxied on /api. Both must
// be up: the webServer block starts Vite; start the backend separately
// (cd backend && uv run uvicorn app.main:app --port 8000) or via docker-compose.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    // Bootstrap 5 drops its fade/collapse transitions under reduced-motion, so
    // tab panes/drawers open instantly — kills the tab-fade race that timed out
    // .check()/.uncheck() inside drawers on slow CI.
    reducedMotion: 'reduce',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
