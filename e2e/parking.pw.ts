import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * 主要な利用者フローのE2E。DEV_OWNER_EMAILでAccessをバイパスする
 * （scripts/ensure-dev-vars.mjs、または開発者自身の .dev.vars）。
 * 各テストは自分でデータを作るため、実行順やシードデータに依存しない。
 * 参照: docs/design/08-implementation-plan.md §8.1 Phase 5
 */

// vinext dev（Vite）は、テストで初めて訪れるルートの依存関係をその場で
// 事前バンドルするため、そのタイミングでHMRの自動リロードが発生し、
// ちょうどそのページを操作中だったテスト操作（クリック直後の遷移など）が
// 巻き込まれて失敗することがある。実際のテストが始まる前に主要なルートを
// 一通り訪れておき、依存関係の事前バンドルを済ませておく。
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage()
  for (const url of [
    '/',
    '/admin',
    '/admin/contractors/new',
    '/admin/payments',
    '/admin/audit',
    '/portal',
    '/portal/history',
    '/portal/pay',
    '/portal/pay/transfer',
    '/portal/pay/transfer/done/warmup',
  ]) {
    await page.goto(url)
  }
  await page.close()
})

function uniqueContractor() {
  const n = Date.now() % 100000
  return {
    name: `E2Eテスト太郎${n}`,
    phone: `090${String(n).padStart(8, '0')}`,
    phoneLast4: String(n).padStart(8, '0').slice(-4),
  }
}

async function registerContractor(
  page: Page,
  params: { name: string; phone: string; monthlyFee?: number },
): Promise<string> {
  await page.goto('/admin/contractors/new')
  await page.locator('input[name="name"]').fill(params.name)
  await page.locator('input[name="phone"]').fill(params.phone)
  await page.locator('input[name="monthlyFee"]').fill(String(params.monthlyFee ?? 3000))
  const thisMonth = new Date().toISOString().slice(0, 7)
  await page.locator('input[name="contractStartMonth"]').fill(thisMonth)
  await page.getByRole('button', { name: '登録する' }).click()
  await page.waitForURL(/\/admin\/contractors\/(?!new)[^/]+$/)
  return page.url().split('/').pop() as string
}

async function issueLoginUrl(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'ログインカードを発行して表示' }).click()
  await page.waitForURL(/\/login-card\?token=/)
  const urlText = await page.locator('p.font-mono').innerText()
  return urlText.trim()
}

test.describe('オーナー: 契約者登録と請求', () => {
  test('契約者を登録すると請求が作られ、ログインカードを表示できる', async ({ page }) => {
    const c = uniqueContractor()
    const contractorId = await registerContractor(page, c)
    expect(contractorId).toBeTruthy()

    await expect(page.getByRole('cell', { name: '¥3,000' }).first()).toBeVisible()
    await expect(page.getByText('未払い').first()).toBeVisible()

    const loginUrl = await issueLoginUrl(page)
    expect(loginUrl).toMatch(/\/l\//)
    await expect(page.locator('svg, img').first()).toBeVisible()
  })
})

test.describe('契約者: QRログイン→振込報告→承認→領収書', () => {
  test('振込を報告し、オーナーが承認すると領収書が表示される', async ({ page, browser }) => {
    const c = uniqueContractor()
    await registerContractor(page, c)
    const loginUrl = await issueLoginUrl(page)

    // 契約者は別のブラウザコンテキスト（Cookieが独立）でログインする
    const contractorContext = await browser.newContext()
    const contractorPage = await contractorContext.newPage()
    await contractorPage.goto(loginUrl)
    await expect(contractorPage).toHaveURL(/\/portal$/)
    await expect(contractorPage.getByText(`${c.name} 様`)).toBeVisible()

    await contractorPage.getByRole('link', { name: 'お支払いへ進む' }).click()
    await expect(contractorPage).toHaveURL(/\/portal\/pay$/)
    // 月数のSelect（shadcn/Radix）が隠しinputへ値を反映するまでの一瞬を待つ
    // （待たずに即操作すると、submit時にcountが未送信のまま検証エラーになることがある）。
    await contractorPage.waitForTimeout(300)
    await contractorPage.getByLabel('銀行振込').check()
    await expect(contractorPage.getByLabel('銀行振込')).toBeChecked()
    await contractorPage.getByRole('button', { name: 'この内容で進む' }).click()
    await expect(contractorPage).toHaveURL(/\/portal\/pay\/transfer/)
    // テスト用の契約者はフリガナ未設定のため、振込名義は初期値が空になる
    await contractorPage.getByLabel('振込名義').fill(c.name)
    await contractorPage.getByRole('button', { name: '振込を報告する' }).click()
    // 振込報告の完了画面（U2）に遷移し、押した結果がその場で分かる
    await expect(contractorPage).toHaveURL(/\/portal\/pay\/transfer\/done\//)
    await expect(contractorPage.getByText('ご連絡ありがとうございます')).toBeVisible()
    await expect(contractorPage.getByText('お振り込みを確認できたら、ホームに ✅ が付きます')).toBeVisible()
    await contractorPage.getByRole('link', { name: 'ホームに戻る' }).click()
    await expect(contractorPage).toHaveURL(/\/portal$/)

    // オーナーが承認する
    await page.goto('/admin/payments')
    await page.getByRole('link', { name: '確認する' }).first().click()
    await page.getByRole('button', { name: '承認する' }).click()
    await expect(page.getByText('完了')).toBeVisible()

    // 契約者に領収書が表示される
    await contractorPage.goto('/portal')
    await contractorPage.getByRole('link', { name: '📄 領収書' }).first().click()
    await expect(contractorPage.getByText('領収書')).toBeVisible()
    await expect(contractorPage.getByText(`${c.name} 様`)).toBeVisible()

    await contractorContext.close()
  })

  test('他人の振込完了画面は404になる', async ({ page, browser }) => {
    const a = uniqueContractor()
    await registerContractor(page, a)
    const loginUrlA = await issueLoginUrl(page)

    const contextA = await browser.newContext()
    const pageA = await contextA.newPage()
    await pageA.goto(loginUrlA)
    await pageA.getByRole('link', { name: 'お支払いへ進む' }).click()
    await pageA.waitForTimeout(300)
    await pageA.getByLabel('銀行振込').check()
    await pageA.getByRole('button', { name: 'この内容で進む' }).click()
    await pageA.getByLabel('振込名義').fill(a.name)
    await pageA.getByRole('button', { name: '振込を報告する' }).click()
    await expect(pageA).toHaveURL(/\/portal\/pay\/transfer\/done\//)
    const paymentUrlA = pageA.url()

    const b = uniqueContractor()
    await registerContractor(page, b)
    const loginUrlB = await issueLoginUrl(page)

    const contextB = await browser.newContext()
    const pageB = await contextB.newPage()
    await pageB.goto(loginUrlB)
    const response = await pageB.goto(paymentUrlA)
    expect(response?.status()).toBe(404)

    await contextA.close()
    await contextB.close()
  })

  test('契約者向け画面にアクセシビリティ違反が無い（375px幅）', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    const homeResults = await new AxeBuilder({ page }).analyze()
    expect(homeResults.violations).toEqual([])

    const c = uniqueContractor()
    await page.setViewportSize({ width: 1280, height: 800 })
    await registerContractor(page, c)
    const loginUrl = await issueLoginUrl(page)

    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(loginUrl)
    await expect(page).toHaveURL(/\/portal$/)
    const portalResults = await new AxeBuilder({ page }).analyze()
    expect(portalResults.violations).toEqual([])
  })
})

test.describe('契約者: 予備ログインのロック', () => {
  test('5回連続で失敗するとロックの文言が表示される', async ({ page }) => {
    const c = uniqueContractor()
    await registerContractor(page, c)

    await page.goto('/')
    for (let i = 0; i < 5; i++) {
      await page.locator('input[name="name"]').fill(c.name)
      await page.locator('input[name="phoneLast4"]').fill('0000')
      await page.getByRole('button', { name: 'ログインする' }).click()
      await expect(page.getByRole('button', { name: 'ログインする' })).toBeEnabled()
    }
    await expect(page.getByText('しばらくの間ログインできません')).toBeVisible()
  })
})

test.describe('オーナー: 現金の一部入金', () => {
  test('一部入金でマトリクスが「一部」になり、残額の入金で「済」になる', async ({ page }) => {
    const c = uniqueContractor()
    const contractorId = await registerContractor(page, { ...c, monthlyFee: 3000 })

    await page.getByRole('button', { name: '入金を記録' }).click()
    const firstCheckbox = page
      .locator('label', { hasText: '残額 ¥3,000' })
      .first()
      .locator('button[role="checkbox"]')
    await firstCheckbox.click()
    await expect(firstCheckbox).toHaveAttribute('aria-checked', 'true')
    await page.locator('input[name="amount"]').fill('1000')
    await page.getByRole('button', { name: '記録する' }).click()
    await expect(page.getByText('入金を記録しました')).toBeVisible()

    await page.goto('/admin')
    await expect(page.getByTitle('一部入金').first()).toBeVisible()

    await page.goto(`/admin/contractors/${contractorId}`)
    await page.getByRole('button', { name: '入金を記録' }).click()
    const secondCheckbox = page
      .locator('label', { hasText: '残額 ¥2,000' })
      .first()
      .locator('button[role="checkbox"]')
    await secondCheckbox.click()
    await expect(secondCheckbox).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('button', { name: '記録する' }).click()
    await expect(page.getByText('入金を記録しました')).toBeVisible()

    await page.goto('/admin')
    await expect(page.getByTitle('支払済み').first()).toBeVisible()
  })
})

test.describe('カード決済', () => {
  test.skip(
    !process.env.STRIPE_TEST_MODE,
    'STRIPE_TEST_MODE（実際のStripeテストキー）が無いため、このテストはCIではスキップする。' +
      '設計上、確定処理自体は統合テストでカバー済み（lib/services/payments.test.ts）。',
  )

  test('カードで支払うを選ぶとStripeのCheckoutページへ遷移する', async ({ page, browser }) => {
    const c = uniqueContractor()
    await registerContractor(page, c)
    const loginUrl = await issueLoginUrl(page)

    const contractorContext = await browser.newContext()
    const contractorPage = await contractorContext.newPage()
    await contractorPage.goto(loginUrl)
    await contractorPage.getByRole('link', { name: 'お支払いへ進む' }).click()
    await contractorPage.waitForTimeout(300)
    await contractorPage.getByLabel('クレジットカード等').check()
    await contractorPage.getByRole('button', { name: 'この内容で進む' }).click()
    await contractorPage.waitForURL(/checkout\.stripe\.com/)
    await contractorContext.close()
  })
})
