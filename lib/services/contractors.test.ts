import { env } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getDb, type Db } from '../db/client'
import { contractors, invoices } from '../db/schema'
import { migrate, resetData } from '../../test/support/migrate'
import { insertSettings } from '../../test/support/fixtures'
import { archiveContractor, createContractor, updateContractor } from './contractors'
import type { ContractorInput } from '../validation'

let db: Db
const actor = { kind: 'owner' as const, email: 'owner@example.com' }
const now = new Date('2026-09-15T00:00:00.000Z')

function baseInput(overrides: Partial<ContractorInput> = {}): ContractorInput {
  return {
    name: '田中太郎',
    nameKana: null,
    phone: '09012340001',
    spaceLabel: null,
    monthlyFee: 3000,
    contractStartMonth: '2026-09',
    contractEndMonth: null,
    note: null,
    ...overrides,
  }
}

beforeAll(async () => {
  await migrate(env.DB)
  db = getDb(env.DB)
})

beforeEach(async () => {
  await resetData(env.DB)
  await insertSettings(db, { invoiceLeadMonths: 0 })
})

describe('createContractor', () => {
  it('契約者を作成し、あわせて請求も作る', async () => {
    const result = await createContractor(db, baseInput(), actor, now)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const row = await db.query.contractors.findFirst({ where: eq(contractors.id, result.contractorId) })
    expect(row?.name).toBe('田中太郎')
    expect(row?.loginKey).toBe('田中太郎')

    const created = await db.select().from(invoices).where(eq(invoices.contractorId, result.contractorId))
    expect(created).toHaveLength(1)
    expect(created[0].month).toBe('2026-09')
  })

  it('在籍中の同名契約者がいれば拒否する', async () => {
    await createContractor(db, baseInput(), actor, now)
    const result = await createContractor(db, baseInput({ phone: '09099998888' }), actor, now)
    expect(result).toEqual({ ok: false, error: 'duplicate_name' })
  })

  it('全角/半角の表記ゆれがあっても同名とみなす', async () => {
    await createContractor(db, baseInput({ name: '田中　太郎' }), actor, now) // 全角スペース
    const result = await createContractor(db, baseInput({ name: '田中 太郎' }), actor, now) // 半角スペース
    expect(result).toEqual({ ok: false, error: 'duplicate_name' })
  })
})

describe('updateContractor', () => {
  it('基本情報を更新できる', async () => {
    const created = await createContractor(db, baseInput(), actor, now)
    if (!created.ok) throw new Error('setup failed')

    const result = await updateContractor(
      db,
      created.contractorId,
      baseInput({ spaceLabel: 'A-1' }),
      false,
      actor,
      now,
    )
    expect(result.ok).toBe(true)

    const row = await db.query.contractors.findFirst({ where: eq(contractors.id, created.contractorId) })
    expect(row?.spaceLabel).toBe('A-1')
  })

  it('月額料金を変更し、applyToOpenInvoices=trueなら未確定の請求額も更新する', async () => {
    const created = await createContractor(db, baseInput({ monthlyFee: 3000 }), actor, now)
    if (!created.ok) throw new Error('setup failed')

    const result = await updateContractor(
      db,
      created.contractorId,
      baseInput({ monthlyFee: 4000 }),
      true,
      actor,
      now,
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.feeChangeInvoicesUpdated).toBe(1)

    const row = await db.query.contractors.findFirst({ where: eq(contractors.id, created.contractorId) })
    expect(row?.monthlyFee).toBe(4000)
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.contractorId, created.contractorId),
    })
    expect(invoice?.amount).toBe(4000)
  })

  it('存在しない契約者は not_found', async () => {
    const result = await updateContractor(db, 'not-exist', baseInput(), false, actor, now)
    expect(result).toEqual({ ok: false, error: 'not_found' })
  })
})

describe('archiveContractor', () => {
  it('契約を終了してアーカイブし、session_versionを上げる', async () => {
    const created = await createContractor(db, baseInput(), actor, now)
    if (!created.ok) throw new Error('setup failed')

    const result = await archiveContractor(db, created.contractorId, actor, now)
    expect(result).toEqual({ ok: true })

    const row = await db.query.contractors.findFirst({ where: eq(contractors.id, created.contractorId) })
    expect(row?.archivedAt).not.toBeNull()
    expect(row?.sessionVersion).toBe(2)
  })

  it('アーカイブ後は同名で再登録できる', async () => {
    const created = await createContractor(db, baseInput(), actor, now)
    if (!created.ok) throw new Error('setup failed')
    await archiveContractor(db, created.contractorId, actor, now)

    const result = await createContractor(db, baseInput({ phone: '09011112222' }), actor, now)
    expect(result.ok).toBe(true)
  })
})
