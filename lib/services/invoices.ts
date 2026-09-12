import { and, eq, gt, inArray, isNull, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { billableMonths } from '../domain/billing'
import { currentMonth, type YearMonth } from '../domain/time'
import type { Db } from '../db/client'
import { contractors, invoices, paymentAllocations } from '../db/schema'
import { type Actor, auditLogInsert } from './audit'

export type SyncInvoicesResult = { invoicesCreated: number }

/**
 * 対象の契約者について、請求すべき月の請求（open）が無ければ作る。
 * 既存の請求はそのまま（ON CONFLICT DO NOTHING）なので、何度呼んでも安全（冪等）。
 * Cronは使わず、契約の変更時と画面表示時に呼ぶ。
 * 参照: docs/design/06-billing-payments.md §6.2, docs/design/08-implementation-plan.md D10
 */
export async function syncInvoices(
  db: Db,
  params: { contractorIds: string[] | 'all'; now: Date },
): Promise<SyncInvoicesResult> {
  const settingsRow = await db.query.settings.findFirst()
  const invoiceLeadMonths = settingsRow?.invoiceLeadMonths ?? 1

  const targetContractors = await db
    .select({
      id: contractors.id,
      monthlyFee: contractors.monthlyFee,
      contractStartMonth: contractors.contractStartMonth,
      contractEndMonth: contractors.contractEndMonth,
    })
    .from(contractors)
    .where(
      params.contractorIds === 'all'
        ? isNull(contractors.archivedAt)
        : and(isNull(contractors.archivedAt), inArray(contractors.id, params.contractorIds)),
    )

  const thisMonth = currentMonth(params.now)
  const rows: { contractorId: string; month: YearMonth; amount: number }[] = []
  for (const c of targetContractors) {
    const months = billableMonths({
      contractStartMonth: c.contractStartMonth as YearMonth,
      contractEndMonth: c.contractEndMonth as YearMonth | null,
      currentMonth: thisMonth,
      invoiceLeadMonths,
    })
    for (const month of months) {
      rows.push({ contractorId: c.id, month, amount: c.monthlyFee })
    }
  }

  if (rows.length === 0) return { invoicesCreated: 0 }

  const statements = rows.map((r) =>
    db
      .insert(invoices)
      .values({ contractorId: r.contractorId, month: r.month, amount: r.amount })
      .onConflictDoNothing(),
  )
  const results = await db.batch(
    statements as [(typeof statements)[number], ...(typeof statements)[number][]],
  )

  const invoicesCreated = results.reduce(
    (sum: number, r) => sum + ((r as unknown as { meta?: { changes?: number } }).meta?.changes ?? 0),
    0,
  )
  return { invoicesCreated }
}

export type VoidInvoiceError = 'invoice_not_found' | 'invoice_not_open' | 'invoice_has_allocations'
export type VoidInvoiceResult = { ok: true } | { ok: false; error: VoidInvoiceError }

/** 請求を免除する。配分（pending/applied、どちらか一方でも）が付いている請求は免除できない。 */
export async function voidInvoice(
  db: Db,
  params: { invoiceId: string; reason: string; actor: Actor; now: Date },
): Promise<VoidInvoiceResult> {
  const invoice = await db.query.invoices.findFirst({ where: eq(invoices.id, params.invoiceId) })
  if (!invoice) return { ok: false, error: 'invoice_not_found' }
  if (invoice.status !== 'open') return { ok: false, error: 'invoice_not_open' }

  const hasAllocation = await hasAnyAllocation(db, [params.invoiceId])
  if (hasAllocation.has(params.invoiceId)) return { ok: false, error: 'invoice_has_allocations' }

  await db.batch([
    db
      .update(invoices)
      .set({ status: 'void', voidedAt: params.now, voidReason: params.reason, updatedAt: params.now })
      .where(eq(invoices.id, params.invoiceId)),
    auditLogInsert(db, {
      actor: params.actor,
      action: 'invoice.void',
      entityType: 'invoice',
      entityId: params.invoiceId,
      detail: { reason: params.reason },
    }),
  ])
  return { ok: true }
}

export type ApplyFeeChangeResult = { invoicesUpdated: number }

/**
 * 契約者の月額料金を変更する。applyToOpenInvoices を指定すると、配分の付いていない
 * open の請求の金額も、新しい料金に合わせて更新する（監査ログに変更前後を残す）。
 */
export async function applyFeeChange(
  db: Db,
  params: {
    contractorId: string
    newFee: number
    applyToOpenInvoices: boolean
    actor: Actor
    now: Date
  },
): Promise<ApplyFeeChangeResult> {
  const contractor = await db.query.contractors.findFirst({
    where: eq(contractors.id, params.contractorId),
  })
  const oldFee = contractor?.monthlyFee ?? null

  const statements: BatchItem<'sqlite'>[] = [
    db
      .update(contractors)
      .set({ monthlyFee: params.newFee, updatedAt: params.now })
      .where(eq(contractors.id, params.contractorId)),
  ]

  let invoiceUpdateIndex = -1
  if (params.applyToOpenInvoices) {
    invoiceUpdateIndex = statements.length
    statements.push(
      db
        .update(invoices)
        .set({ amount: params.newFee, updatedAt: params.now })
        .where(
          and(
            eq(invoices.contractorId, params.contractorId),
            eq(invoices.status, 'open'),
            sql`NOT EXISTS (SELECT 1 FROM payment_allocations WHERE payment_allocations.invoice_id = ${invoices.id})`,
          ),
        ),
    )
  }

  statements.push(
    auditLogInsert(db, {
      actor: params.actor,
      action: 'contractor.fee_change',
      entityType: 'contractor',
      entityId: params.contractorId,
      detail: { oldFee, newFee: params.newFee, applyToOpenInvoices: params.applyToOpenInvoices },
    }),
  )

  const results = await db.batch(
    statements as [(typeof statements)[number], ...(typeof statements)[number][]],
  )
  const invoicesUpdated =
    invoiceUpdateIndex >= 0
      ? ((results[invoiceUpdateIndex] as unknown as { meta?: { changes?: number } }).meta?.changes ?? 0)
      : 0

  return { invoicesUpdated }
}

export type ShrinkContractPeriodResult =
  | { ok: true; voidedInvoiceIds: string[] }
  | { ok: false; error: 'has_allocated_invoices'; blockingInvoiceIds: string[] }

/**
 * 契約終了月を早める。新しい期間の外になる open の請求のうち、配分の付いていない
 * ものはすべて免除する。1件でも配分が付いていれば、何も変更せずエラーを返す。
 */
export async function shrinkContractPeriod(
  db: Db,
  params: { contractorId: string; newEndMonth: YearMonth; actor: Actor; now: Date },
): Promise<ShrinkContractPeriodResult> {
  const outOfPeriodInvoices = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.contractorId, params.contractorId),
        eq(invoices.status, 'open'),
        gt(invoices.month, params.newEndMonth),
      ),
    )
  const invoiceIds = outOfPeriodInvoices.map((i) => i.id)
  if (invoiceIds.length === 0) {
    await db.batch([
      db
        .update(contractors)
        .set({ contractEndMonth: params.newEndMonth, updatedAt: params.now })
        .where(eq(contractors.id, params.contractorId)),
      auditLogInsert(db, {
        actor: params.actor,
        action: 'contractor.shrink_contract_period',
        entityType: 'contractor',
        entityId: params.contractorId,
        detail: { newEndMonth: params.newEndMonth, voidedInvoiceIds: [] },
      }),
    ])
    return { ok: true, voidedInvoiceIds: [] }
  }

  const allocated = await hasAnyAllocation(db, invoiceIds)
  const blockingInvoiceIds = invoiceIds.filter((id) => allocated.has(id))
  if (blockingInvoiceIds.length > 0) {
    return { ok: false, error: 'has_allocated_invoices', blockingInvoiceIds }
  }

  const reason = '契約期間の変更'
  await db.batch([
    db
      .update(contractors)
      .set({ contractEndMonth: params.newEndMonth, updatedAt: params.now })
      .where(eq(contractors.id, params.contractorId)),
    db
      .update(invoices)
      .set({ status: 'void', voidedAt: params.now, voidReason: reason, updatedAt: params.now })
      .where(inArray(invoices.id, invoiceIds)),
    auditLogInsert(db, {
      actor: params.actor,
      action: 'contractor.shrink_contract_period',
      entityType: 'contractor',
      entityId: params.contractorId,
      detail: { newEndMonth: params.newEndMonth, voidedInvoiceIds: invoiceIds },
    }),
  ])
  return { ok: true, voidedInvoiceIds: invoiceIds }
}

/** 渡した invoiceId のうち、状態を問わず何らかの配分（pending/applied/released）が
 *  1件でも存在するものの集合を返す。 */
async function hasAnyAllocation(db: Db, invoiceIds: string[]): Promise<Set<string>> {
  if (invoiceIds.length === 0) return new Set()
  const rows = await db
    .selectDistinct({ invoiceId: paymentAllocations.invoiceId })
    .from(paymentAllocations)
    .where(inArray(paymentAllocations.invoiceId, invoiceIds))
  return new Set(rows.map((r) => r.invoiceId))
}
