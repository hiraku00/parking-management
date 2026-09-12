import { defineConfig } from 'vitest/config'

// D1・cloudflare:workers env に依存しない、素のロジックのユニットテストだけを
// Node環境で実行する。D1が必要なテストは vitest.workers.config.ts（Workers
// ランタイム上で実行、`npm run test:integration`）に置く。
export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.wrangler/**',
      'e2e/**',
      'lib/services/**',
      '**/*.integration.test.ts',
    ],
  },
})
