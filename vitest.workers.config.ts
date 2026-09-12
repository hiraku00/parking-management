import { cloudflareTest } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

// lib/services/* と Route Handler は Workers ランタイム（Miniflare）上でしか
// 検証できない（D1、外部キー、CHECK制約、cloudflare:workers env を実際に使うため）。
// 実アプリの main（vinext/server/fetch-handler）はパッケージのエクスポートで
// あり、vitest-pluginはこれをプロジェクト相対パスとして解決しようとして失敗
// するため、ここでは何もしないダミーのWorkerを main に使う（テストは env 経由
// でDBに触るだけで、実際にHTTPリクエストを受けるわけではない）。
// 参照: docs/design/08-implementation-plan.md Phase 1「統合テストの基盤」
export default defineConfig({
  test: {
    include: ['lib/services/**/*.test.ts', 'app/api/**/*.integration.test.ts'],
  },
  plugins: [
    cloudflareTest({
      main: './test/support/worker-stub.ts',
      miniflare: {
        compatibilityDate: '2026-09-01',
        compatibilityFlags: ['nodejs_compat'],
        d1Databases: { DB: 'parking-test' },
      },
    }),
  ],
})
