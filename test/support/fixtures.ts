import type { Db } from '../../lib/db/client'
import { contractors, payments, paymentAllocations, settings } from '../../lib/db/schema'

let seq = 0
function uniqueSuffix() {
  seq += 1
  return String(seq).padStart(4, '0')
}

export async function insertSettings(db: Db, overrides: Partial<typeof settings.$inferInsert> = {}) {
  await db.insert(settings).values({ id: 1, invoiceLeadMonths: 1, ...overrides })
}

export async function insertContractor(
  db: Db,
  overrides: Partial<typeof contractors.$inferInsert> = {},
): Promise<string> {
  const id = overrides.id ?? `contractor-${uniqueSuffix()}`
  await db.insert(contractors).values({
    id,
    name: `テスト契約者${uniqueSuffix()}`,
    loginKey: `testcontractor${uniqueSuffix()}`,
    phone: '09000000000',
    phoneLast4: '0000',
    monthlyFee: 3000,
    contractStartMonth: '2026-01',
    contractEndMonth: null,
    ...overrides,
  })
  return id
}

/** 指定した invoice に、状態 state の配分を1件付ける（テスト用の入金1件をあわせて作る）。 */
export async function insertAllocation(
  db: Db,
  params: {
    invoiceId: string
    contractorId: string
    amount?: number
    state?: 'pending' | 'applied' | 'released'
  },
): Promise<void> {
  const paymentId = `payment-${uniqueSuffix()}`
  const amount = params.amount ?? 1000
  await db.insert(payments).values({
    id: paymentId,
    contractorId: params.contractorId,
    method: 'cash',
    channel: 'admin',
    status: params.state === 'applied' ? 'succeeded' : 'pending',
    amount,
  })
  await db.insert(paymentAllocations).values({
    paymentId,
    invoiceId: params.invoiceId,
    amount,
    state: params.state ?? 'pending',
  })
}
