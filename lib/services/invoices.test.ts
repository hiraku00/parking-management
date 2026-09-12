import { env } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getDb, type Db } from '../db/client'
import { contractors, invoices } from '../db/schema'
import { migrate, resetData } from '../../test/support/migrate'
import { insertAllocation, insertContractor, insertSettings } from '../../test/support/fixtures'
import { applyFeeChange, shrinkContractPeriod, syncInvoices, voidInvoice } from './invoices'

let db: Db

// D1のストレージはテストファイル単位で分離されるが、同じファイル内の it() 間
// では共有されるため、スキーマ作成は最初に1回、データのリセットは毎回行う。
beforeAll(async () => {
  await migrate(env.DB)
  db = getDb(env.DB)
})

beforeEach(async () => {
  await resetData(env.DB)
})

describe('syncInvoices', () => {
  it('契約開始から当月+前払い月数までの請求を作る', async () => {
    await insertSettings(db, { invoiceLeadMonths: 1 })
    const contractorId = await insertContractor(db, {
      contractStartMonth: '2026-07',
      contractEndMonth: null,
      monthlyFee: 3000,
    })
    const now = new Date('2026-09-15T00:00:00.000Z')

    const result = await syncInvoices(db, { contractorIds: 'all', now })

    expect(result.invoicesCreated).toBe(4) // 07, 08, 09, 10（前払い1か月分）
    const rows = await db
      .select({ month: invoices.month, amount: invoices.amount, status: invoices.status })
      .from(invoices)
      .where(eq(invoices.contractorId, contractorId))
    expect(rows.map((r) => r.month).sort()).toEqual(['2026-07', '2026-08', '2026-09', '2026-10'])
    expect(rows.every((r) => r.amount === 3000 && r.status === 'open')).toBe(true)
  })

  it('冪等: 2回呼んでも重複せず、2回目は0件になる', async () => {
    await insertSettings(db, { invoiceLeadMonths: 0 })
    await insertContractor(db, { contractStartMonth: '2026-09' })
    const now = new Date('2026-09-15T00:00:00.000Z')

    const first = await syncInvoices(db, { contractorIds: 'all', now })
    const second = await syncInvoices(db, { contractorIds: 'all', now })

    expect(first.invoicesCreated).toBe(1)
    expect(second.invoicesCreated).toBe(0)
    const all = await db.select().from(invoices)
    expect(all).toHaveLength(1)
  })

  it('アーカイブ済みの契約者は対象にしない', async () => {
    await insertSettings(db)
    await insertContractor(db, { contractStartMonth: '2026-09', archivedAt: new Date('2026-08-01') })
    const result = await syncInvoices(db, { contractorIds: 'all', now: new Date('2026-09-15T00:00:00.000Z') })
    expect(result.invoicesCreated).toBe(0)
  })

  it('settings が無くても既定値（1か月前払い）で動く', async () => {
    const contractorId = await insertContractor(db, { contractStartMonth: '2026-09' })
    const result = await syncInvoices(db, {
      contractorIds: [contractorId],
      now: new Date('2026-09-15T00:00:00.000Z'),
    })
    expect(result.invoicesCreated).toBe(2) // 09, 10
  })
})

describe('voidInvoice', () => {
  async function createOpenInvoice(contractorId: string, month = '2026-09') {
    const [row] = await db
      .insert(invoices)
      .values({ contractorId, month, amount: 3000 })
      .returning({ id: invoices.id })
    return row.id
  }

  it('配分の無い open な請求は免除できる', async () => {
    const contractorId = await insertContractor(db)
    const invoiceId = await createOpenInvoice(contractorId)

    const result = await voidInvoice(db, {
      invoiceId,
      reason: 'テスト免除',
      actor: { kind: 'owner', email: 'owner@example.com' },
      now: new Date('2026-09-15T00:00:00.000Z'),
    })

    expect(result).toEqual({ ok: true })
    const row = await db.query.invoices.findFirst({ where: eq(invoices.id, invoiceId) })
    expect(row?.status).toBe('void')
    expect(row?.voidReason).toBe('テスト免除')
  })

  it('配分（pending）が付いている請求は免除できない', async () => {
    const contractorId = await insertContractor(db)
    const invoiceId = await createOpenInvoice(contractorId)
    await insertAllocation(db, { invoiceId, contractorId, state: 'pending' })

    const result = await voidInvoice(db, {
      invoiceId,
      reason: 'テスト',
      actor: { kind: 'owner', email: 'owner@example.com' },
      now: new Date(),
    })

    expect(result).toEqual({ ok: false, error: 'invoice_has_allocations' })
  })

  it('存在しない請求は invoice_not_found', async () => {
    const result = await voidInvoice(db, {
      invoiceId: 'not-exist',
      reason: 'テスト',
      actor: { kind: 'system' },
      now: new Date(),
    })
    expect(result).toEqual({ ok: false, error: 'invoice_not_found' })
  })

  it('既に void な請求は invoice_not_open', async () => {
    const contractorId = await insertContractor(db)
    const invoiceId = await createOpenInvoice(contractorId)
    await voidInvoice(db, {
      invoiceId,
      reason: '1回目',
      actor: { kind: 'system' },
      now: new Date(),
    })

    const second = await voidInvoice(db, {
      invoiceId,
      reason: '2回目',
      actor: { kind: 'system' },
      now: new Date(),
    })
    expect(second).toEqual({ ok: false, error: 'invoice_not_open' })
  })
})

describe('applyFeeChange', () => {
  it('契約者の月額料金を更新する', async () => {
    const contractorId = await insertContractor(db, { monthlyFee: 3000 })
    await applyFeeChange(db, {
      contractorId,
      newFee: 4000,
      applyToOpenInvoices: false,
      actor: { kind: 'owner', email: 'owner@example.com' },
      now: new Date(),
    })
    const row = await db.query.contractors.findFirst({ where: eq(contractors.id, contractorId) })
    expect(row?.monthlyFee).toBe(4000)
  })

  it('applyToOpenInvoices=false なら既存の請求額は変わらない', async () => {
    const contractorId = await insertContractor(db, { monthlyFee: 3000 })
    const [row] = await db
      .insert(invoices)
      .values({ contractorId, month: '2026-09', amount: 3000 })
      .returning({ id: invoices.id })

    await applyFeeChange(db, {
      contractorId,
      newFee: 4000,
      applyToOpenInvoices: false,
      actor: { kind: 'owner', email: 'owner@example.com' },
      now: new Date(),
    })

    const invoice = await db.query.invoices.findFirst({ where: eq(invoices.id, row.id) })
    expect(invoice?.amount).toBe(3000)
  })

  it('applyToOpenInvoices=true なら配分の無い open な請求の額も更新する', async () => {
    const contractorId = await insertContractor(db, { monthlyFee: 3000 })
    const [unallocated] = await db
      .insert(invoices)
      .values({ contractorId, month: '2026-09', amount: 3000 })
      .returning({ id: invoices.id })
    const [allocated] = await db
      .insert(invoices)
      .values({ contractorId, month: '2026-10', amount: 3000 })
      .returning({ id: invoices.id })
    await insertAllocation(db, { invoiceId: allocated.id, contractorId, state: 'pending' })

    const result = await applyFeeChange(db, {
      contractorId,
      newFee: 4000,
      applyToOpenInvoices: true,
      actor: { kind: 'owner', email: 'owner@example.com' },
      now: new Date(),
    })

    expect(result.invoicesUpdated).toBe(1)
    const unallocatedRow = await db.query.invoices.findFirst({ where: eq(invoices.id, unallocated.id) })
    const allocatedRow = await db.query.invoices.findFirst({ where: eq(invoices.id, allocated.id) })
    expect(unallocatedRow?.amount).toBe(4000) // 配分が無いので更新される
    expect(allocatedRow?.amount).toBe(3000) // 配分があるので変わらない
  })
})

describe('shrinkContractPeriod', () => {
  it('期間の外に出る、配分の無い open な請求をすべて免除する', async () => {
    const contractorId = await insertContractor(db, {
      contractStartMonth: '2026-07',
      contractEndMonth: null,
    })
    await db.insert(invoices).values([
      { contractorId, month: '2026-07', amount: 3000 },
      { contractorId, month: '2026-08', amount: 3000 },
      { contractorId, month: '2026-09', amount: 3000 },
    ])

    const result = await shrinkContractPeriod(db, {
      contractorId,
      newEndMonth: '2026-07',
      actor: { kind: 'owner', email: 'owner@example.com' },
      now: new Date('2026-09-15T00:00:00.000Z'),
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.voidedInvoiceIds).toHaveLength(2) // 08, 09

    const rows = await db
      .select({ month: invoices.month, status: invoices.status })
      .from(invoices)
      .where(eq(invoices.contractorId, contractorId))
    const byMonth = Object.fromEntries(rows.map((r) => [r.month, r.status]))
    expect(byMonth['2026-07']).toBe('open')
    expect(byMonth['2026-08']).toBe('void')
    expect(byMonth['2026-09']).toBe('void')

    const contractor = await db.query.contractors.findFirst({ where: eq(contractors.id, contractorId) })
    expect(contractor?.contractEndMonth).toBe('2026-07')
  })

  it('期間の外に配分の付いた請求が1件でもあれば、何も変更せずエラーを返す', async () => {
    const contractorId = await insertContractor(db, { contractStartMonth: '2026-07' })
    const [aug] = await db
      .insert(invoices)
      .values({ contractorId, month: '2026-08', amount: 3000 })
      .returning({ id: invoices.id })
    await db.insert(invoices).values({ contractorId, month: '2026-09', amount: 3000 })
    await insertAllocation(db, { invoiceId: aug.id, contractorId, state: 'applied' })

    const result = await shrinkContractPeriod(db, {
      contractorId,
      newEndMonth: '2026-07',
      actor: { kind: 'owner', email: 'owner@example.com' },
      now: new Date('2026-09-15T00:00:00.000Z'),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.blockingInvoiceIds).toEqual([aug.id])

    // 何も変わっていないことを確認する
    const contractor = await db.query.contractors.findFirst({ where: eq(contractors.id, contractorId) })
    expect(contractor?.contractEndMonth).toBeNull()
    const sepInvoice = await db.query.invoices.findFirst({
      where: eq(invoices.month, '2026-09'),
    })
    expect(sepInvoice?.status).toBe('open')
  })

  it('期間を延長する場合（対象の請求が無い）は、そのまま契約終了月だけ更新する', async () => {
    const contractorId = await insertContractor(db, {
      contractStartMonth: '2026-07',
      contractEndMonth: '2026-09',
    })
    const result = await shrinkContractPeriod(db, {
      contractorId,
      newEndMonth: '2027-03',
      actor: { kind: 'owner', email: 'owner@example.com' },
      now: new Date('2026-09-15T00:00:00.000Z'),
    })
    expect(result).toEqual({ ok: true, voidedInvoiceIds: [] })
    const contractor = await db.query.contractors.findFirst({ where: eq(contractors.id, contractorId) })
    expect(contractor?.contractEndMonth).toBe('2027-03')
  })
})
