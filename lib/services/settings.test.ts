import { env } from 'cloudflare:test'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getDb, type Db } from '../db/client'
import { migrate, resetData } from '../../test/support/migrate'
import { getSettings, updateSettings } from './settings'
import type { SettingsInput } from '../validation'

let db: Db
const actor = { kind: 'owner' as const, email: 'owner@example.com' }
const now = new Date('2026-09-15T00:00:00.000Z')

function baseInput(overrides: Partial<SettingsInput> = {}): SettingsInput {
  return {
    businessName: '駐車場 管理太郎',
    businessAddress: '東京都千代田区1-1',
    businessPhone: null,
    invoiceRegistrationNumber: null,
    taxRate: 10,
    bankName: null,
    bankBranch: null,
    bankAccountType: null,
    bankAccountNumber: null,
    bankAccountHolderKana: null,
    cardPaymentEnabled: true,
    bankTransferEnabled: true,
    invoiceLeadMonths: 1,
    ...overrides,
  }
}

beforeAll(async () => {
  await migrate(env.DB)
  db = getDb(env.DB)
})

beforeEach(async () => {
  await resetData(env.DB)
})

describe('getSettings', () => {
  it('行が無ければ既定値を返す', async () => {
    const settings = await getSettings(db)
    expect(settings.businessName).toBe('')
    expect(settings.invoiceLeadMonths).toBe(1)
  })
})

describe('updateSettings', () => {
  it('初回は作成、2回目以降は上書きする（upsert）', async () => {
    await updateSettings(db, baseInput(), actor, now)
    let settings = await getSettings(db)
    expect(settings.businessName).toBe('駐車場 管理太郎')

    await updateSettings(db, baseInput({ businessName: '別の屋号' }), actor, now)
    settings = await getSettings(db)
    expect(settings.businessName).toBe('別の屋号')
  })
})
