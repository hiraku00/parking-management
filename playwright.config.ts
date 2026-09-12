import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.pw.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // vinext dev（Vite）は単一プロセスの開発サーバーのため、複数ワーカーから
  // 同時にリクエストすると、依存関係の事前バンドルやHMRの再読み込みが
  // 操作中のページを巻き込み、ナビゲーションが失敗することがある。
  // テスト数もまだ少ないため、常に直列実行にする。
  workers: 1,
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
    // `.dev.vars` が無い環境（CI）では、E2E専用の非機密なダミー値を生成する
    // （scripts/ensure-dev-vars.mjs。既存の `.dev.vars` があれば何もしない）。
    command: 'node scripts/ensure-dev-vars.mjs && npm run db:migrate:local && npm run dev -- --port 3210',
    url: 'http://localhost:3210',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
