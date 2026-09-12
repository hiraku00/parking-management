import { and, desc, eq, gte, inArray, isNull, lt, lte } from 'drizzle-orm'
import type { Db } from '../db/client'
import {
  auditLogs,
  contractors,
  invoices,
  payments,
  paymentAllocations,
  receipts,
  type IssuerSnapshot,
} from '../db/schema'
import { addMonths, compareYearMonth, currentMonth, monthsBetween, type YearMonth } from '../domain/time'

/** 画面表示用の読み取り専用クエリ（書き込みは lib/services/* の各サービスで行う）。
 *  参照: docs/design/07-screens.md §7.4 */

export type DashboardKpi = {
  month: YearMonth
  billedAmount: number
  collectedAmount: number
  outstandingAmount: number
  overdueContractorCount: number
}

/** 今月（JST）の請求額・入金済み額・未収額と、滞納している契約者数を返す。 */
export async function getDashboardKpi(db: Db, now: Date): Promise<DashboardKpi> {
  const month = currentMonth(now)

  const currentMonthInvoices = await db
    .select({ id: invoices.id, amount: invoices.amount, status: invoices.status })
    .from(invoices)
    .where(and(eq(invoices.month, month), eq(invoices.status, 'open')))
  const paidThisMonth = await db
    .select({ amount: invoices.amount })
    .from(invoices)
    .where(and(eq(invoices.month, month), eq(invoices.status, 'paid')))

  const billedAmount =
    currentMonthInvoices.reduce((sum, i) => sum + i.amount, 0) +
    paidThisMonth.reduce((sum, i) => sum + i.amount, 0)

  const openInvoiceIds = currentMonthInvoices.map((i) => i.id)
  const appliedForOpen =
    openInvoiceIds.length > 0
      ? await db
          .select({ amount: paymentAllocations.amount })
          .from(paymentAllocations)
          .where(
            and(
              inArray(paymentAllocations.invoiceId, openInvoiceIds),
              eq(paymentAllocations.state, 'applied'),
            ),
          )
      : []
  const collectedAmount =
    paidThisMonth.reduce((sum, i) => sum + i.amount, 0) + appliedForOpen.reduce((sum, a) => sum + a.amount, 0)

  const overdueInvoices = await db
    .selectDistinct({ contractorId: invoices.contractorId })
    .from(invoices)
    .where(and(eq(invoices.status, 'open'), lte(invoices.month, addMonths(month, -1))))

  return {
    month,
    billedAmount,
    collectedAmount,
    outstandingAmount: billedAmount - collectedAmount,
    overdueContractorCount: overdueInvoices.length,
  }
}

export type PendingTransfer = {
  paymentId: string
  contractorId: string
  contractorName: string
  amount: number
  payerName: string | null
  paidOn: string | null
  createdAt: Date
}

/** 承認待ちの銀行振込報告の一覧（確認日の古い順）。 */
export async function getPendingTransfers(db: Db): Promise<PendingTransfer[]> {
  const rows = await db
    .select({
      paymentId: payments.id,
      contractorId: payments.contractorId,
      contractorName: contractors.name,
      amount: payments.amount,
      payerName: payments.payerName,
      paidOn: payments.paidOn,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .innerJoin(contractors, eq(contractors.id, payments.contractorId))
    .where(and(eq(payments.method, 'bank_transfer'), eq(payments.status, 'pending')))
    .orderBy(payments.createdAt)
  return rows
}

export type MatrixCellStatus =
  'paid' | 'partial' | 'pending' | 'overdue' | 'unpaid' | 'void' | 'not_applicable'

export type PaymentMatrix = {
  months: YearMonth[]
  rows: {
    contractorId: string
    contractorName: string
    cells: Partial<Record<YearMonth, MatrixCellStatus>>
  }[]
}

/** 直近 monthsBack か月分の入金マトリクス（行=在籍中の契約者、列=月）。
 *  呼び出し側で先に `syncInvoices(db, { contractorIds: 'all', now })` を
 *  呼んでおく前提（そうしないと、まだ作られていない今月分の請求が
 *  「対象外」に見えてしまう）。 */
export async function getPaymentMatrix(db: Db, now: Date, monthsBack = 12): Promise<PaymentMatrix> {
  const month = currentMonth(now)
  const months = monthsBetween(addMonths(month, -(monthsBack - 1)), month)

  const activeContractors = await db
    .select({ id: contractors.id, name: contractors.name })
    .from(contractors)
    .where(isNull(contractors.archivedAt))
    .orderBy(contractors.name)
  if (activeContractors.length === 0) return { months, rows: [] }

  const contractorIds = activeContractors.map((c) => c.id)
  const invoiceRows = await db
    .select({
      id: invoices.id,
      contractorId: invoices.contractorId,
      month: invoices.month,
      status: invoices.status,
      amount: invoices.amount,
    })
    .from(invoices)
    .where(
      and(
        inArray(invoices.contractorId, contractorIds),
        gte(invoices.month, months[0]),
        lte(invoices.month, months[months.length - 1]),
      ),
    )

  const invoiceIds = invoiceRows.map((i) => i.id)
  const allocationRows =
    invoiceIds.length > 0
      ? await db
          .select({
            invoiceId: paymentAllocations.invoiceId,
            amount: paymentAllocations.amount,
            state: paymentAllocations.state,
          })
          .from(paymentAllocations)
          .where(inArray(paymentAllocations.invoiceId, invoiceIds))
      : []

  const appliedByInvoice = new Map<string, number>()
  const pendingInvoiceIds = new Set<string>()
  for (const a of allocationRows) {
    if (a.state === 'applied')
      appliedByInvoice.set(a.invoiceId, (appliedByInvoice.get(a.invoiceId) ?? 0) + a.amount)
    if (a.state === 'pending') pendingInvoiceIds.add(a.invoiceId)
  }

  const cellsByContractor = new Map<string, Partial<Record<YearMonth, MatrixCellStatus>>>()
  for (const invoice of invoiceRows) {
    const cells = cellsByContractor.get(invoice.contractorId) ?? {}
    cells[invoice.month as YearMonth] = classifyCell(invoice, {
      appliedAmount: appliedByInvoice.get(invoice.id) ?? 0,
      hasPending: pendingInvoiceIds.has(invoice.id),
      currentMonth: month,
    })
    cellsByContractor.set(invoice.contractorId, cells)
  }

  const rows = activeContractors.map((c) => ({
    contractorId: c.id,
    contractorName: c.name,
    cells: cellsByContractor.get(c.id) ?? {},
  }))
  return { months, rows }
}

function classifyCell(
  invoice: { status: 'open' | 'paid' | 'void'; month: string },
  ctx: { appliedAmount: number; hasPending: boolean; currentMonth: YearMonth },
): MatrixCellStatus {
  if (invoice.status === 'void') return 'void'
  if (invoice.status === 'paid') return 'paid'
  if (ctx.hasPending) return 'pending'
  if (ctx.appliedAmount > 0) return 'partial'
  if (compareYearMonth(invoice.month as YearMonth, ctx.currentMonth) < 0) return 'overdue'
  return 'unpaid'
}

// ─── 契約者ポータル向け ─────────────────────────────────────────

export type PortalUnpaidInvoice = {
  id: string
  month: YearMonth
  amount: number
  remaining: number
  isOverdue: boolean
  hasPendingAllocation: boolean
}

/** 契約者本人の未払い請求（open）を、古い月から順に返す。 */
export async function getUnpaidInvoicesForContractor(
  db: Db,
  contractorId: string,
  now: Date,
): Promise<PortalUnpaidInvoice[]> {
  const month = currentMonth(now)
  const rows = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.contractorId, contractorId), eq(invoices.status, 'open')))
    .orderBy(invoices.month)
  if (rows.length === 0) return []

  const invoiceIds = rows.map((r) => r.id)
  const allocationRows = await db
    .select({
      invoiceId: paymentAllocations.invoiceId,
      amount: paymentAllocations.amount,
      state: paymentAllocations.state,
    })
    .from(paymentAllocations)
    .where(inArray(paymentAllocations.invoiceId, invoiceIds))

  const appliedByInvoice = new Map<string, number>()
  const pendingInvoiceIds = new Set<string>()
  for (const a of allocationRows) {
    if (a.state === 'applied')
      appliedByInvoice.set(a.invoiceId, (appliedByInvoice.get(a.invoiceId) ?? 0) + a.amount)
    if (a.state === 'pending') pendingInvoiceIds.add(a.invoiceId)
  }

  return rows.map((r) => ({
    id: r.id,
    month: r.month as YearMonth,
    amount: r.amount,
    remaining: r.amount - (appliedByInvoice.get(r.id) ?? 0),
    isOverdue: compareYearMonth(r.month as YearMonth, month) < 0,
    hasPendingAllocation: pendingInvoiceIds.has(r.id),
  }))
}

export type PortalPaymentHistoryItem = {
  id: string
  createdAt: Date
  amount: number
  status: (typeof payments.$inferSelect)['status']
  method: (typeof payments.$inferSelect)['method']
  rejectReason: string | null
  months: YearMonth[]
  hasReceipt: boolean
}

/** 契約者本人の入金履歴（新しい順）。1件の入金が複数月にまたがる場合、
 *  対象月をまとめて返す。 */
export async function getPaymentHistoryForContractor(
  db: Db,
  contractorId: string,
): Promise<PortalPaymentHistoryItem[]> {
  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.contractorId, contractorId))
    .orderBy(desc(payments.createdAt))
  if (paymentRows.length === 0) return []

  const paymentIds = paymentRows.map((p) => p.id)
  const allocationRows = await db
    .select({ paymentId: paymentAllocations.paymentId, invoiceId: paymentAllocations.invoiceId })
    .from(paymentAllocations)
    .where(inArray(paymentAllocations.paymentId, paymentIds))

  const invoiceIds = [...new Set(allocationRows.map((a) => a.invoiceId))]
  const invoiceRows =
    invoiceIds.length > 0
      ? await db
          .select({ id: invoices.id, month: invoices.month })
          .from(invoices)
          .where(inArray(invoices.id, invoiceIds))
      : []
  const monthByInvoice = new Map(invoiceRows.map((i) => [i.id, i.month as YearMonth]))

  const monthsByPayment = new Map<string, YearMonth[]>()
  for (const a of allocationRows) {
    const month = monthByInvoice.get(a.invoiceId)
    if (!month) continue
    const list = monthsByPayment.get(a.paymentId) ?? []
    list.push(month)
    monthsByPayment.set(a.paymentId, list)
  }

  const receiptRows = await db
    .select({ paymentId: receipts.paymentId })
    .from(receipts)
    .where(inArray(receipts.paymentId, paymentIds))
  const paymentsWithReceipt = new Set(receiptRows.map((r) => r.paymentId))

  return paymentRows.map((p) => ({
    id: p.id,
    createdAt: p.createdAt,
    amount: p.amount,
    status: p.status,
    method: p.method,
    rejectReason: p.rejectReason,
    months: (monthsByPayment.get(p.id) ?? []).sort(),
    hasReceipt: paymentsWithReceipt.has(p.id),
  }))
}

export type ReceiptView = {
  contractorId: string
  receiptNo: number
  issuedAt: Date
  transactionDate: string
  recipientName: string
  description: string
  amount: number
  taxRate: number
  taxAmount: number
  paymentMethodLabel: string
  issuer: IssuerSnapshot
}

/** 契約者ポータル・管理画面の両方の領収書表示から使う（所有者チェックは呼び出し側で行う）。 */
export async function getReceiptForPayment(db: Db, paymentId: string): Promise<ReceiptView | null> {
  const receipt = await db.query.receipts.findFirst({ where: eq(receipts.paymentId, paymentId) })
  if (!receipt) return null
  const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) })
  if (!payment) return null

  return {
    contractorId: payment.contractorId,
    receiptNo: receipt.receiptNo,
    issuedAt: receipt.issuedAt,
    transactionDate: receipt.transactionDate,
    recipientName: receipt.recipientName,
    description: receipt.description,
    amount: receipt.amount,
    taxRate: receipt.taxRate,
    taxAmount: receipt.taxAmount,
    paymentMethodLabel: receipt.paymentMethodLabel,
    issuer: receipt.issuer,
  }
}

export type AuditLogEntry = {
  id: string
  actor: string
  action: string
  entityType: string
  entityId: string
  detail: Record<string, unknown> | null
  createdAt: Date
}

export type AuditLogPage = {
  entries: AuditLogEntry[]
  hasMore: boolean
}

const AUDIT_PAGE_SIZE = 50

/**
 * 監査ログを新しい順に返す（簡易なページング。`before` にそのページ最後の
 * `createdAt` を渡すと続きを取得できる）。参照: docs/design/07-screens.md §7.2
 */
export async function getAuditLogs(db: Db, params: { before?: Date } = {}): Promise<AuditLogPage> {
  const rows = await db
    .select()
    .from(auditLogs)
    .where(params.before ? lt(auditLogs.createdAt, params.before) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(AUDIT_PAGE_SIZE + 1)

  const hasMore = rows.length > AUDIT_PAGE_SIZE
  const page = hasMore ? rows.slice(0, AUDIT_PAGE_SIZE) : rows
  return {
    entries: page.map((r) => ({
      id: r.id,
      actor: r.actor,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      detail: r.detail,
      createdAt: r.createdAt,
    })),
    hasMore,
  }
}
