import { env } from 'cloudflare:test'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getDb, type Db } from '../db/client'
import { invoices, payments, paymentAllocations } from '../db/schema'
import { migrate, resetData } from '../../test/support/migrate'
import { insertAllocation, insertContractor, insertSettings } from '../../test/support/fixtures'
import { getDashboardKpi, getPaymentMatrix, getPendingTransfers } from './queries'

let db: Db
const now = new Date('2026-09-15T00:00:00.000Z') // currentMonth = 2026-09

beforeAll(async () => {
  await migrate(env.DB)
  db = getDb(env.DB)
})

beforeEach(async () => {
  await resetData(env.DB)
  await insertSettings(db)
})

describe('getDashboardKpi', () => {
  it('今月の請求・入金・未収・滞納者数を集計する', async () => {
    const contractorId = await insertContractor(db, { contractStartMonth: '2026-07' })
    const [augInvoice] = await db
      .insert(invoices)
      .values({ contractorId, month: '2026-08', amount: 3000, status: 'open' })
      .returning({ id: invoices.id })
    await db.insert(invoices).values({ contractorId, month: '2026-09', amount: 3000, status: 'open' })
    // 8月分は一部入金済み（1000円）
    await insertAllocation(db, { invoiceId: augInvoice.id, contractorId, amount: 1000, state: 'applied' })

    const kpi = await getDashboardKpi(db, now)
    expect(kpi.month).toBe('2026-09')
    expect(kpi.billedAmount).toBe(3000) // 今月分のみ
    expect(kpi.collectedAmount).toBe(0) // 今月分への入金は無い
    expect(kpi.outstandingAmount).toBe(3000)
    expect(kpi.overdueContractorCount).toBe(1) // 8月分が未収のまま残っている
  })
})

describe('getPendingTransfers', () => {
  it('承認待ちの銀行振込だけを返す（現金の確認待ちは対象外）', async () => {
    const contractorId = await insertContractor(db, { name: '振込太郎' })
    const [invoiceA, invoiceB] = await db
      .insert(invoices)
      .values([
        { contractorId, month: '2026-08', amount: 3000, status: 'open' },
        { contractorId, month: '2026-09', amount: 3000, status: 'open' },
      ])
      .returning({ id: invoices.id })

    await db.insert(payments).values({
      id: 'test-pay-transfer',
      contractorId,
      method: 'bank_transfer',
      channel: 'portal',
      status: 'pending',
      amount: 3000,
      payerName: 'フリコミ タロウ',
      paidOn: '2026-08-20',
    })
    await db
      .insert(paymentAllocations)
      .values({ paymentId: 'test-pay-transfer', invoiceId: invoiceA.id, amount: 3000, state: 'pending' })

    // 現金のpendingは集計対象外
    await insertAllocation(db, { invoiceId: invoiceB.id, contractorId, state: 'pending' })

    const list = await getPendingTransfers(db)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      paymentId: 'test-pay-transfer',
      contractorId,
      contractorName: '振込太郎',
      amount: 3000,
      payerName: 'フリコミ タロウ',
      paidOn: '2026-08-20',
    })
  })
})

describe('getPaymentMatrix', () => {
  it('請求の状態をセルに分類する', async () => {
    const contractorId = await insertContractor(db, { contractStartMonth: '2026-08' })
    const [aug] = await db
      .insert(invoices)
      .values({ contractorId, month: '2026-08', amount: 3000, status: 'open' })
      .returning({ id: invoices.id })
    await db.insert(invoices).values({ contractorId, month: '2026-09', amount: 3000, status: 'paid' })
    await insertAllocation(db, { invoiceId: aug.id, contractorId, amount: 1500, state: 'applied' })

    const matrix = await getPaymentMatrix(db, now, 3) // 2026-07, 08, 09
    expect(matrix.months).toEqual(['2026-07', '2026-08', '2026-09'])
    const row = matrix.rows.find((r) => r.contractorId === contractorId)
    expect(row?.cells['2026-07']).toBeUndefined() // 契約開始前 = 対象外
    expect(row?.cells['2026-08']).toBe('partial') // 一部入金
    expect(row?.cells['2026-09']).toBe('paid')
  })

  it('アーカイブ済みの契約者は行に含めない', async () => {
    await insertContractor(db, { archivedAt: new Date() })
    const matrix = await getPaymentMatrix(db, now, 1)
    expect(matrix.rows).toHaveLength(0)
  })
})
