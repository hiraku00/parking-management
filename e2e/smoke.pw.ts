import { expect, test } from '@playwright/test'

// Phase 0: 骨組みだけの生存確認。実際の画面のE2EはPhase 5で追加する
// （docs/design/08-implementation-plan.md §8.1 Phase 5）。
test('トップページが表示される', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.status()).toBe(200)
  await expect(page).toHaveTitle('駐車場管理システム')
})

test('ヘルスチェックAPIが200を返す', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({ status: 'ok' })
})
