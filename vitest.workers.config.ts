import { fileURLToPath } from 'node:url'
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
  // Route Handlerは `@/lib/...` のようなtsconfigのpathエイリアスを使うため、
  // このテストランナー（vite）にも同じエイリアスを教える。
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  plugins: [
    cloudflareTest({
      main: './test/support/worker-stub.ts',
      miniflare: {
        compatibilityDate: '2026-09-01',
        compatibilityFlags: ['nodejs_compat'],
        d1Databases: { DB: 'parking-test' },
        // Stripe Webhookの署名検証テスト用（実際のAPIキーではなく、
        // ローカルで署名の作成・検証だけを行うためのダミー値）。
        bindings: { STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: 'whsec_test_dummy' },
      },
    }),
  ],
})
