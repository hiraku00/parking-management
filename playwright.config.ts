import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.pw.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3210',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Phase 3以降、`/` 自体が settings テーブルを読むため、初回起動前に
    // ローカルD1へmigrationを適用しておく必要がある（未適用だと
    // "no such table" でレンダリングに失敗し、起動待ちがタイムアウトする）。
    // 適用済みのmigrationはwrangler側でスキップされるため、毎回実行しても安全。
    command: 'npm run db:migrate:local && npm run dev -- --port 3210',
    url: 'http://localhost:3210',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
