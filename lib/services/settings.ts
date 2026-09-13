import type { Db } from '../db/client'
import { settings } from '../db/schema'
import type { SettingsInput } from '../validation'
import { type Actor, auditLogInsert } from './audit'

export type Settings = typeof settings.$inferSelect

/** settings 行がまだ無いとき（初回起動直後）に返す既定値。 */
const DEFAULT_SETTINGS: Settings = {
  id: 1,
  businessName: '',
  businessAddress: '',
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
  paymentDueDay: null,
  updatedAt: new Date(0),
}

export async function getSettings(db: Db): Promise<Settings> {
  const row = await db.query.settings.findFirst()
  return row ?? DEFAULT_SETTINGS
}

/** 設定を保存する（1行のみ・upsert）。 */
export async function updateSettings(db: Db, input: SettingsInput, actor: Actor, now: Date): Promise<void> {
  const values = { id: 1 as const, ...input, updatedAt: now }
  await db.batch([
    db.insert(settings).values(values).onConflictDoUpdate({ target: settings.id, set: values }),
    auditLogInsert(db, {
      actor,
      action: 'settings.update',
      entityType: 'settings',
      entityId: '1',
      detail: { businessName: input.businessName },
    }),
  ])
}
