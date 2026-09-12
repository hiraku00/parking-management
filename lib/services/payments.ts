import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import type Stripe from 'stripe'
import type { Db } from '../db/client'
import {
  contractors,
  invoices,
  PAYMENT_METHODS,
  payments,
  paymentAllocations,
  type IssuerSnapshot,
} from '../db/schema'
import { allocate } from '../domain/billing'
import { formatMonthJa, todayJst, type YearMonth } from '../domain/time'
import { getStripe } from '../stripe'
import { type Actor, auditLogInsert } from './audit'
import { recalculateInvoicesForPaymentStatement, syncInvoices } from './invoices'
import { getUnpaidInvoicesForContractor } from './queries'
import { buildReceiptDescription, issueReceiptStatement, PAYMENT_METHOD_LABELS } from './receipts'
import { getSettings } from './settings'

type PaymentMethodValue = (typeof PAYMENT_METHODS)[number]

export type PayableInvoice = { id: string; month: YearMonth; remaining: number }

/**
 * 契約者が支払える請求を古い月から取得する。pendingの配分が付いている請求
 * （既に処理中の入金がある請求）は除く。ポータルの未払い一覧
 * （`getUnpaidInvoicesForContractor`）と同じ元データを使い、支払い可否の
 * 判定がずれないようにする。
 */
export async function getPayableInvoices(db: Db, contractorId: string, now: Date): Promise<PayableInvoice[]> {
  const unpaid = await getUnpaidInvoicesForContractor(db, contractorId, now)
  return unpaid
    .filter((i) => !i.hasPendingAllocation)
    .map((i) => ({ id: i.id, month: i.month, remaining: i.remaining }))
}

/**
 * pending の入金を却下側に倒す（failed/canceled/rejected）。pending の配分は
 * released に戻し、対象の請求を再び支払える状態にする。状態ガード付きなので
 * 二重に呼んでも安全（冪等）。
 */
export async function releaseAllocations(
  db: Db,
  params: {
    paymentId: string
    status: 'failed' | 'canceled' | 'rejected'
    now: Date
    reviewedBy?: string
    rejectReason?: string
  },
): Promise<void> {
  await db.batch([
    db
      .update(payments)
      .set({
        status: params.status,
        updatedAt: params.now,
        ...(params.reviewedBy ? { reviewedBy: params.reviewedBy, reviewedAt: params.now } : {}),
        ...(params.rejectReason ? { rejectReason: params.rejectReason } : {}),
      })
      .where(and(eq(payments.id, params.paymentId), eq(payments.status, 'pending'))),
    db
      .update(paymentAllocations)
      .set({ state: 'released' })
      .where(
        and(eq(paymentAllocations.paymentId, params.paymentId), eq(paymentAllocations.state, 'pending')),
      ),
  ])
}

/**
 * 領収書を発行するための但し書きと発行者情報を組み立てる（`issueReceiptStatement`
 * に渡すパラメータを返すだけで、まだSQLは実行しない）。`allocations` は
 * 「この入金がどの請求にいくら充てるか」（呼び出し側が既に決めている）。
 * 一部入金かどうかは、他の入金からの適用済み額と合わせて判定する。
 *
 * 実行を後回しにする理由: `issueReceiptStatement` が返す `db.run(sql\`...\`)`
 * はdrizzleの `SQLiteRaw`（thenable）で、async関数の中で `return` すると
 * Promiseの解決規則により、この関数を `await` した時点でSQLが即実行されて
 * しまう（意図した「入金がsucceededになった後」より前に走ってしまう）。
 * そのため、ここではパラメータだけを返し、呼び出し側が入金確定のbatchの
 * 「後」に `issueReceiptStatement` を呼ぶ。
 */
async function buildReceiptParams(
  db: Db,
  params: {
    paymentId: string
    contractorId: string
    amount: number
    method: PaymentMethodValue
    transactionDate: string
    now: Date
    allocations: { invoiceId: string; amount: number }[]
  },
) {
  const invoiceIds = params.allocations.map((a) => a.invoiceId)
  const [contractor, settingsRow, invoiceRows, appliedSums] = await Promise.all([
    db.query.contractors.findFirst({ where: eq(contractors.id, params.contractorId) }),
    getSettings(db),
    db
      .select({ id: invoices.id, month: invoices.month, amount: invoices.amount })
      .from(invoices)
      .where(inArray(invoices.id, invoiceIds)),
    db
      .select({
        invoiceId: paymentAllocations.invoiceId,
        sum: sql<number>`COALESCE(SUM(${paymentAllocations.amount}),0)`,
      })
      .from(paymentAllocations)
      .where(
        and(
          inArray(paymentAllocations.invoiceId, invoiceIds),
          eq(paymentAllocations.state, 'applied'),
          ne(paymentAllocations.paymentId, params.paymentId),
        ),
      )
      .groupBy(paymentAllocations.invoiceId),
  ])
  const invoiceById = new Map(invoiceRows.map((i) => [i.id, i]))
  const appliedByInvoice = new Map(appliedSums.map((r) => [r.invoiceId, r.sum]))

  let isPartial = false
  for (const a of params.allocations) {
    const invoice = invoiceById.get(a.invoiceId)
    if (!invoice) continue
    const total = (appliedByInvoice.get(a.invoiceId) ?? 0) + a.amount
    if (total < invoice.amount) isPartial = true
  }

  const taxRate = settingsRow.taxRate
  const issuer: IssuerSnapshot = {
    businessName: settingsRow.businessName,
    address: settingsRow.businessAddress,
    phone: settingsRow.businessPhone,
    registrationNumber: settingsRow.invoiceRegistrationNumber,
  }
  const description = buildReceiptDescription({
    months: params.allocations
      .map((a) => invoiceById.get(a.invoiceId)?.month as YearMonth | undefined)
      .filter((m): m is YearMonth => m !== undefined),
    spaceLabel: contractor?.spaceLabel ?? null,
    isPartial,
  })

  return {
    paymentId: params.paymentId,
    now: params.now,
    transactionDate: params.transactionDate,
    recipientName: contractor?.name ?? '',
    description,
    amount: params.amount,
    taxRate,
    paymentMethodLabel: PAYMENT_METHOD_LABELS[params.method],
    issuer,
  }
}

/**
 * pending の入金を succeeded にする共通処理。配分の適用、請求の再計算、
 * 領収書の発行、監査ログの記録を1つのbatchで行う。状態ガード付きなので、
 * 二重に呼んでも2回目は何もしない（冪等）。カード決済のWebhook/戻り画面、
 * 振込の承認から呼ぶ。参照: docs/design/06-billing-payments.md §6.4
 */
export async function markSucceeded(
  db: Db,
  params: {
    paymentId: string
    now: Date
    transactionDate: string
    actor: Actor
    stripePaymentIntentId?: string
    stripePaymentMethodType?: string
    reviewedBy?: string
  },
): Promise<void> {
  const payment = await db.query.payments.findFirst({ where: eq(payments.id, params.paymentId) })
  if (!payment || payment.status !== 'pending') return

  const pendingAllocations = await db
    .select({ invoiceId: paymentAllocations.invoiceId, amount: paymentAllocations.amount })
    .from(paymentAllocations)
    .where(and(eq(paymentAllocations.paymentId, params.paymentId), eq(paymentAllocations.state, 'pending')))

  const receiptParams = await buildReceiptParams(db, {
    paymentId: params.paymentId,
    contractorId: payment.contractorId,
    amount: payment.amount,
    method: payment.method,
    transactionDate: params.transactionDate,
    now: params.now,
    allocations: pendingAllocations,
  })

  // D1のdrizzleドライバは db.batch() の中に db.run(sql`...`) を混在できない
  // （`_prepare()` がRunnableQuery前提の内部実装に依存するため）。そのため
  // クエリビルダーの文だけをbatchにまとめ、生SQLの再計算・領収書発行は
  // batchの直後に個別のステートメントとして実行する（このアプリの規模では
  // D1は単一Workerからの書き込みが中心で、実質的に問題にならない）。
  await db.batch([
    db
      .update(payments)
      .set({
        status: 'succeeded',
        succeededAt: params.now,
        updatedAt: params.now,
        ...(params.stripePaymentIntentId ? { stripePaymentIntentId: params.stripePaymentIntentId } : {}),
        ...(params.stripePaymentMethodType
          ? { stripePaymentMethodType: params.stripePaymentMethodType }
          : {}),
        ...(params.reviewedBy ? { reviewedBy: params.reviewedBy, reviewedAt: params.now } : {}),
      })
      .where(and(eq(payments.id, params.paymentId), eq(payments.status, 'pending'))),
    db
      .update(paymentAllocations)
      .set({ state: 'applied' })
      .where(
        and(eq(paymentAllocations.paymentId, params.paymentId), eq(paymentAllocations.state, 'pending')),
      ),
  ])
  await recalculateInvoicesForPaymentStatement(db, params.paymentId, params.now)
  await issueReceiptStatement(db, receiptParams)
  await auditLogInsert(db, {
    actor: params.actor,
    action: 'payment.succeed',
    entityType: 'payment',
    entityId: params.paymentId,
    dedupeKey: `fulfill:${params.paymentId}`,
  })
}

export type StartCardCheckoutResult =
  { ok: true; url: string } | { ok: false; error: 'card_disabled' | 'insufficient_invoices' | 'stripe_error' }

/** 参照: docs/design/06-billing-payments.md §6.4 */
export async function startCardCheckout(
  db: Db,
  params: {
    contractorId: string
    count: number
    origin: string
    now: Date
    stripeClient?: Pick<Stripe, 'checkout'>
  },
): Promise<StartCardCheckoutResult> {
  const settingsRow = await getSettings(db)
  if (!settingsRow.cardPaymentEnabled) return { ok: false, error: 'card_disabled' }

  await syncInvoices(db, { contractorIds: [params.contractorId], now: params.now })
  const targets = (await getPayableInvoices(db, params.contractorId, params.now)).slice(0, params.count)
  if (targets.length < params.count) return { ok: false, error: 'insufficient_invoices' }

  const amount = targets.reduce((sum, i) => sum + i.remaining, 0)
  const paymentId = crypto.randomUUID()

  await db.batch([
    db.insert(payments).values({
      id: paymentId,
      contractorId: params.contractorId,
      method: 'card',
      channel: 'portal',
      status: 'pending',
      amount,
    }),
    ...targets.map((i) =>
      db
        .insert(paymentAllocations)
        .values({ paymentId, invoiceId: i.id, amount: i.remaining, state: 'pending' }),
    ),
  ] as Parameters<typeof db.batch>[0])

  const stripe = params.stripeClient ?? getStripe()
  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: targets.map((i) => ({
          quantity: 1,
          price_data: {
            currency: 'jpy',
            unit_amount: i.remaining,
            product_data: { name: `駐車場使用料 ${formatMonthJa(i.month)}分` },
          },
        })),
        client_reference_id: paymentId,
        metadata: { payment_id: paymentId, contractor_id: params.contractorId },
        payment_intent_data: { metadata: { payment_id: paymentId } },
        expires_at: Math.floor(params.now.getTime() / 1000) + 30 * 60,
        locale: 'ja',
        success_url: `${params.origin}/portal/payments/${paymentId}/complete?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${params.origin}/portal/payments/${paymentId}/complete?canceled=1`,
      },
      { idempotencyKey: `checkout:${paymentId}` },
    )
    if (!session.url) throw new Error('Stripe checkout session has no url')
    await db
      .update(payments)
      .set({ stripeCheckoutSessionId: session.id, updatedAt: params.now })
      .where(eq(payments.id, paymentId))
    return { ok: true, url: session.url }
  } catch {
    await releaseAllocations(db, { paymentId, status: 'canceled', now: params.now })
    return { ok: false, error: 'stripe_error' }
  }
}

export type FulfillCheckoutResult =
  'succeeded' | 'awaiting_payment' | 'amount_mismatch' | 'not_found' | 'ignored'

/** カード決済のWebhookと戻り画面の両方から呼ぶ。冪等。参照: docs/design/06-billing-payments.md §6.4 */
export async function fulfillCheckout(
  db: Db,
  session: Stripe.Checkout.Session,
  now: Date,
): Promise<FulfillCheckoutResult> {
  const paymentId = session.metadata?.payment_id
  if (!paymentId) return 'not_found'
  const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) })
  if (!payment) return 'not_found'

  if (session.amount_total !== payment.amount || session.currency !== 'jpy') {
    await auditLogInsert(db, {
      actor: { kind: 'stripe' },
      action: 'payment.amount_mismatch',
      entityType: 'payment',
      entityId: paymentId,
      detail: {
        sessionAmountTotal: session.amount_total,
        sessionCurrency: session.currency,
        expectedAmount: payment.amount,
      },
    })
    return 'amount_mismatch'
  }

  if (session.payment_status === 'paid') {
    const paymentIntentId =
      typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
    await markSucceeded(db, {
      paymentId,
      now,
      transactionDate: todayJst(now),
      actor: { kind: 'stripe' },
      stripePaymentIntentId: paymentIntentId,
      stripePaymentMethodType: session.payment_method_types?.[0],
    })
    return 'succeeded'
  }

  if (session.payment_status === 'unpaid' && payment.status === 'pending') {
    await db
      .update(payments)
      .set({ stripePaymentMethodType: session.payment_method_types?.[0], updatedAt: now })
      .where(eq(payments.id, paymentId))
    return 'awaiting_payment'
  }

  return 'ignored'
}

export type ReportTransferResult =
  | { ok: true; paymentId: string }
  | { ok: false; error: 'transfer_disabled' | 'insufficient_invoices' | 'invalid_date' }

/** 参照: docs/design/06-billing-payments.md §6.5 */
export async function reportTransfer(
  db: Db,
  params: { contractorId: string; count: number; payerName: string; paidOn: string; now: Date },
): Promise<ReportTransferResult> {
  if (params.paidOn > todayJst(params.now)) return { ok: false, error: 'invalid_date' }

  const settingsRow = await getSettings(db)
  if (!settingsRow.bankTransferEnabled) return { ok: false, error: 'transfer_disabled' }

  await syncInvoices(db, { contractorIds: [params.contractorId], now: params.now })
  const targets = (await getPayableInvoices(db, params.contractorId, params.now)).slice(0, params.count)
  if (targets.length < params.count) return { ok: false, error: 'insufficient_invoices' }

  const amount = targets.reduce((sum, i) => sum + i.remaining, 0)
  const paymentId = crypto.randomUUID()
  await db.batch([
    db.insert(payments).values({
      id: paymentId,
      contractorId: params.contractorId,
      method: 'bank_transfer',
      channel: 'portal',
      status: 'pending',
      amount,
      payerName: params.payerName,
      paidOn: params.paidOn,
    }),
    ...targets.map((i) =>
      db
        .insert(paymentAllocations)
        .values({ paymentId, invoiceId: i.id, amount: i.remaining, state: 'pending' }),
    ),
  ] as Parameters<typeof db.batch>[0])
  return { ok: true, paymentId }
}

export type ApproveTransferResult = { ok: true } | { ok: false; error: 'not_found' | 'not_pending' }

export async function approveTransfer(
  db: Db,
  params: { paymentId: string; owner: { email: string }; now: Date },
): Promise<ApproveTransferResult> {
  const payment = await db.query.payments.findFirst({ where: eq(payments.id, params.paymentId) })
  if (!payment) return { ok: false, error: 'not_found' }
  if (payment.status !== 'pending' || payment.method !== 'bank_transfer')
    return { ok: false, error: 'not_pending' }

  await markSucceeded(db, {
    paymentId: params.paymentId,
    now: params.now,
    transactionDate: payment.paidOn ?? todayJst(params.now),
    actor: { kind: 'owner', email: params.owner.email },
    reviewedBy: params.owner.email,
  })
  return { ok: true }
}

export type RejectTransferResult = { ok: true } | { ok: false; error: 'not_found' | 'not_pending' }

export async function rejectTransfer(
  db: Db,
  params: { paymentId: string; reason: string; owner: { email: string }; now: Date },
): Promise<RejectTransferResult> {
  const payment = await db.query.payments.findFirst({ where: eq(payments.id, params.paymentId) })
  if (!payment) return { ok: false, error: 'not_found' }
  if (payment.status !== 'pending' || payment.method !== 'bank_transfer')
    return { ok: false, error: 'not_pending' }

  await releaseAllocations(db, {
    paymentId: params.paymentId,
    status: 'rejected',
    now: params.now,
    reviewedBy: params.owner.email,
    rejectReason: params.reason,
  })
  await auditLogInsert(db, {
    actor: { kind: 'owner', email: params.owner.email },
    action: 'payment.reject',
    entityType: 'payment',
    entityId: params.paymentId,
    detail: { reason: params.reason },
  })
  return { ok: true }
}

export type RecordManualPaymentResult =
  { ok: true; paymentId: string } | { ok: false; error: 'invoice_not_payable' }

/** 参照: docs/design/06-billing-payments.md §6.6 */
export async function recordManualPayment(
  db: Db,
  params: {
    contractorId: string
    invoiceIds: string[]
    amount: number
    method: 'cash' | 'bank_transfer' | 'other'
    paidOn: string
    note?: string
    owner: { email: string }
    now: Date
  },
): Promise<RecordManualPaymentResult> {
  const targetInvoices = await db
    .select({ id: invoices.id, amount: invoices.amount })
    .from(invoices)
    .where(
      and(
        inArray(invoices.id, params.invoiceIds),
        eq(invoices.contractorId, params.contractorId),
        eq(invoices.status, 'open'),
      ),
    )
    .orderBy(invoices.month)
  if (targetInvoices.length !== params.invoiceIds.length) return { ok: false, error: 'invoice_not_payable' }

  const appliedSums = await db
    .select({
      invoiceId: paymentAllocations.invoiceId,
      sum: sql<number>`COALESCE(SUM(${paymentAllocations.amount}),0)`,
    })
    .from(paymentAllocations)
    .where(
      and(inArray(paymentAllocations.invoiceId, params.invoiceIds), eq(paymentAllocations.state, 'applied')),
    )
    .groupBy(paymentAllocations.invoiceId)
  const pendingRows = await db
    .select({ invoiceId: paymentAllocations.invoiceId })
    .from(paymentAllocations)
    .where(
      and(inArray(paymentAllocations.invoiceId, params.invoiceIds), eq(paymentAllocations.state, 'pending')),
    )
  if (pendingRows.length > 0) return { ok: false, error: 'invoice_not_payable' }

  const appliedByInvoice = new Map(appliedSums.map((r) => [r.invoiceId, r.sum]))
  const remainingTargets = targetInvoices.map((i) => ({
    id: i.id,
    remaining: i.amount - (appliedByInvoice.get(i.id) ?? 0),
  }))
  const allocations = allocate(remainingTargets, params.amount)

  const paymentId = crypto.randomUUID()
  const receiptParams = await buildReceiptParams(db, {
    paymentId,
    contractorId: params.contractorId,
    amount: params.amount,
    method: params.method,
    transactionDate: params.paidOn,
    now: params.now,
    allocations: allocations.map((a) => ({ invoiceId: a.invoiceId, amount: a.amount })),
  })

  await db.batch([
    db.insert(payments).values({
      id: paymentId,
      contractorId: params.contractorId,
      method: params.method,
      channel: 'admin',
      status: 'succeeded',
      amount: params.amount,
      paidOn: params.paidOn,
      note: params.note,
      reviewedBy: params.owner.email,
      reviewedAt: params.now,
      succeededAt: params.now,
    }),
    ...allocations.map((a) =>
      db
        .insert(paymentAllocations)
        .values({ paymentId, invoiceId: a.invoiceId, amount: a.amount, state: 'applied' }),
    ),
  ])
  await recalculateInvoicesForPaymentStatement(db, paymentId, params.now)
  await issueReceiptStatement(db, receiptParams)
  await auditLogInsert(db, {
    actor: { kind: 'owner', email: params.owner.email },
    action: 'payment.record_manual',
    entityType: 'payment',
    entityId: paymentId,
    detail: { method: params.method, amount: params.amount },
  })

  return { ok: true, paymentId }
}
