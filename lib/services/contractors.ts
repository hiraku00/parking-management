import { and, eq, isNull } from 'drizzle-orm'
import type { Db } from '../db/client'
import { contractors } from '../db/schema'
import { normalizeName } from '../domain/names'
import type { ContractorInput } from '../validation'
import { type Actor, auditLogInsert } from './audit'
import { applyFeeChange, syncInvoices } from './invoices'

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('UNIQUE constraint failed')
}

export type CreateContractorResult =
  { ok: true; contractorId: string } | { ok: false; error: 'duplicate_name' }

/** 契約者を新規登録する。同名の在籍中の契約者がいれば拒否する
 *  （アーカイブ済みの人とは同名で登録できる。§4.3 の部分UNIQUEインデックス）。
 *  登録直後に、その契約者の請求を作る（syncInvoices）。 */
export async function createContractor(
  db: Db,
  input: ContractorInput,
  actor: Actor,
  now: Date,
): Promise<CreateContractorResult> {
  const loginKey = normalizeName(input.name)
  const duplicate = await db.query.contractors.findFirst({
    where: and(eq(contractors.loginKey, loginKey), isNull(contractors.archivedAt)),
  })
  if (duplicate) return { ok: false, error: 'duplicate_name' }

  const id = crypto.randomUUID()
  const phoneLast4 = input.phone.replace(/\D/g, '').slice(-4)

  try {
    await db.batch([
      db.insert(contractors).values({
        id,
        name: input.name,
        nameKana: input.nameKana,
        loginKey,
        phone: input.phone,
        phoneLast4,
        spaceLabel: input.spaceLabel,
        monthlyFee: input.monthlyFee,
        contractStartMonth: input.contractStartMonth,
        contractEndMonth: input.contractEndMonth,
        note: input.note,
      }),
      auditLogInsert(db, {
        actor,
        action: 'contractor.create',
        entityType: 'contractor',
        entityId: id,
        detail: { name: input.name, monthlyFee: input.monthlyFee },
      }),
    ])
  } catch (error) {
    if (isUniqueConstraintError(error)) return { ok: false, error: 'duplicate_name' }
    throw error
  }

  await syncInvoices(db, { contractorIds: [id], now })
  return { ok: true, contractorId: id }
}

export type UpdateContractorResult =
  { ok: true; feeChangeInvoicesUpdated: number } | { ok: false; error: 'not_found' | 'duplicate_name' }

/**
 * 契約者の基本情報を更新する。月額料金が変わっていれば `applyFeeChange` に委ねる
 * （配分の無い open な請求への反映オプション込み）。更新後、請求の状態は
 * `syncInvoices` で最新化する（契約期間を延ばした場合に対応するため）。
 */
export async function updateContractor(
  db: Db,
  contractorId: string,
  input: ContractorInput,
  applyFeeToOpenInvoices: boolean,
  actor: Actor,
  now: Date,
): Promise<UpdateContractorResult> {
  const existing = await db.query.contractors.findFirst({ where: eq(contractors.id, contractorId) })
  if (!existing || existing.archivedAt) return { ok: false, error: 'not_found' }

  const loginKey = normalizeName(input.name)
  if (loginKey !== existing.loginKey) {
    const duplicate = await db.query.contractors.findFirst({
      where: and(eq(contractors.loginKey, loginKey), isNull(contractors.archivedAt)),
    })
    if (duplicate && duplicate.id !== contractorId) return { ok: false, error: 'duplicate_name' }
  }

  const phoneLast4 = input.phone.replace(/\D/g, '').slice(-4)
  try {
    await db.batch([
      db
        .update(contractors)
        .set({
          name: input.name,
          nameKana: input.nameKana,
          loginKey,
          phone: input.phone,
          phoneLast4,
          spaceLabel: input.spaceLabel,
          contractStartMonth: input.contractStartMonth,
          contractEndMonth: input.contractEndMonth,
          note: input.note,
          updatedAt: now,
        })
        .where(eq(contractors.id, contractorId)),
      auditLogInsert(db, {
        actor,
        action: 'contractor.update',
        entityType: 'contractor',
        entityId: contractorId,
        detail: { name: input.name },
      }),
    ])
  } catch (error) {
    if (isUniqueConstraintError(error)) return { ok: false, error: 'duplicate_name' }
    throw error
  }

  let feeChangeInvoicesUpdated = 0
  if (input.monthlyFee !== existing.monthlyFee) {
    const result = await applyFeeChange(db, {
      contractorId,
      newFee: input.monthlyFee,
      applyToOpenInvoices: applyFeeToOpenInvoices,
      actor,
      now,
    })
    feeChangeInvoicesUpdated = result.invoicesUpdated
  }

  await syncInvoices(db, { contractorIds: [contractorId], now })
  return { ok: true, feeChangeInvoicesUpdated }
}

/** 契約を終了してアーカイブする。物理削除はしない（帳簿を保存するため）。
 *  session_version を上げておく（Phase 3 のQRログインを、後から確実に失効できるように）。 */
export async function archiveContractor(
  db: Db,
  contractorId: string,
  actor: Actor,
  now: Date,
): Promise<{ ok: true } | { ok: false; error: 'not_found' }> {
  const existing = await db.query.contractors.findFirst({ where: eq(contractors.id, contractorId) })
  if (!existing || existing.archivedAt) return { ok: false, error: 'not_found' }

  await db.batch([
    db
      .update(contractors)
      .set({ archivedAt: now, sessionVersion: existing.sessionVersion + 1, updatedAt: now })
      .where(eq(contractors.id, contractorId)),
    auditLogInsert(db, {
      actor,
      action: 'contractor.archive',
      entityType: 'contractor',
      entityId: contractorId,
      detail: {},
    }),
  ])
  return { ok: true }
}
