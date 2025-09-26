// @ts-check
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 0,
  use: {
    headless: true,
    baseURL: 'http://localhost:3002',
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npm run dev:3002',
    url: 'http://localhost:3002',
    reuseExistingServer: true,
    timeout: 120_000
  }
})
