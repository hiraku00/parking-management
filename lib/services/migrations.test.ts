import { env } from 'cloudflare:test'
import { beforeAll, describe, expect, it } from 'vitest'
import { applyMigrations } from '../../test/support/migrate'

/**
 * 本番には既に支払い・配分・領収書が入っている。`payments` を作り直すマイグレーション
 * （0002）が、空のテーブルでは通るのに、子テーブル（payment_allocations / receipts）に
 * 行がある本番では外部キー違反で失敗した（Deploy #30・#31）。そのため、旧スキーマに
 * データを入れてから残りのマイグレーションを当てる形で検証する。
 * 参照: docs/design/08-implementation-plan.md §8.3
 */
describe('マイグレーション 0002（payments / receipts の作り直し）', () => {
  beforeAll(async () => {
    // 0000, 0001 だけ当てた状態＝本番の現状
    await applyMigrations(env.DB, 0, 2)
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO contractors (id, name, login_key, phone, phone_last4, monthly_fee, contract_start_month, session_version, failed_login_count, created_at, updated_at)
         VALUES ('c1', '本番相当 太郎', 'honban', '09000000000', '0000', 3000, '2026-09', 1, 0, 1, 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO invoices (id, contractor_id, month, amount, status, created_at, updated_at)
         VALUES ('i1', 'c1', '2026-09', 3000, 'paid', 1, 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO payments (id, contractor_id, method, channel, status, amount, stripe_checkout_session_id, created_at, updated_at)
         VALUES ('p1', 'c1', 'card', 'portal', 'succeeded', 3000, 'cs_test_1', 1, 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO payment_allocations (payment_id, invoice_id, amount, state) VALUES ('p1', 'i1', 3000, 'applied')`,
      ),
      env.DB.prepare(
        `INSERT INTO receipts (id, receipt_no, payment_id, issued_at, transaction_date, recipient_name, description, amount, tax_rate, tax_amount, payment_method_label, issuer, created_at)
         VALUES ('r1', 1, 'p1', 1, '2026-09-13', '本番相当 太郎', '駐車場使用料', 3000, 10, 272, 'カード', '{}', 1)`,
      ),
    ])
  })

  it('子テーブルに行がある状態でも適用でき、データも外部キーも保たれる', async () => {
    await applyMigrations(env.DB, 2)

    const payment = await env.DB.prepare(
      `SELECT id, status, amount, refund_method FROM payments WHERE id = 'p1'`,
    ).first()
    expect(payment).toEqual({ id: 'p1', status: 'succeeded', amount: 3000, refund_method: null })

    const allocation = await env.DB.prepare(`SELECT payment_id, state FROM payment_allocations`).first()
    expect(allocation).toEqual({ payment_id: 'p1', state: 'applied' })

    const receipt = await env.DB.prepare(`SELECT id, kind, payment_id FROM receipts`).first()
    expect(receipt).toEqual({ id: 'r1', kind: 'receipt', payment_id: 'p1' })

    const violations = await env.DB.prepare(`PRAGMA foreign_key_check`).all()
    expect(violations.results).toEqual([])
  })

  it('作り直した後も、親（payments）を指す外部キーが効いている', async () => {
    await expect(
      env.DB.prepare(
        `INSERT INTO payment_allocations (payment_id, invoice_id, amount, state) VALUES ('no-such-payment', 'i1', 1, 'pending')`,
      ).run(),
    ).rejects.toThrow(/FOREIGN KEY/i)
  })

  it('作り直した後の索引と、新しい返金の列・制約が使える', async () => {
    const indexes = await env.DB.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name IN ('payments', 'receipts') AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    ).all<{ name: string }>()
    expect(indexes.results.map((r) => r.name)).toEqual([
      'payments_checkout_session_uq',
      'payments_contractor_created_idx',
      'payments_status_idx',
      'receipts_no_uq',
      'receipts_payment_kind_uq',
    ])

    await expect(
      env.DB.prepare(
        `UPDATE payments SET status = 'refunded', refund_method = 'bogus' WHERE id = 'p1'`,
      ).run(),
    ).rejects.toThrow(/CHECK/i)
    await env.DB.prepare(
      `UPDATE payments SET status = 'refunded', refund_method = 'card' WHERE id = 'p1'`,
    ).run()
  })
})
