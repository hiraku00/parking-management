import { env } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type Stripe from 'stripe'
import { getDb, type Db } from '../db/client'
import { invoices, payments, paymentAllocations, receipts } from '../db/schema'
import { migrate, resetData } from '../../test/support/migrate'
import { insertContractor, insertSettings } from '../../test/support/fixtures'
import {
  approveTransfer,
  cancelCardCheckout,
  fulfillCheckout,
  recordManualPayment,
  rejectTransfer,
  reportTransfer,
  resumeCardCheckout,
  startCardCheckout,
} from './payments'

let db: Db

beforeAll(async () => {
  await migrate(env.DB)
  db = getDb(env.DB)
})

beforeEach(async () => {
  await resetData(env.DB)
})

async function createOpenInvoice(contractorId: string, month: string, amount = 3000) {
  const [row] = await db
    .insert(invoices)
    .values({ contractorId, month, amount })
    .returning({ id: invoices.id })
  return row.id
}

function fakeStripeClient(sessionId = 'cs_test_123'): Pick<Stripe, 'checkout'> {
  return {
    checkout: {
      sessions: {
        create: async () =>
          ({ id: sessionId, url: `https://checkout.stripe.com/${sessionId}` }) as Stripe.Checkout.Session,
      },
    },
  } as unknown as Pick<Stripe, 'checkout'>
}

function fakeSession(
  overrides: Partial<Stripe.Checkout.Session> & { metadata: { payment_id: string } },
): Stripe.Checkout.Session {
  return {
    id: 'cs_test_123',
    amount_total: 3000,
    currency: 'jpy',
    payment_status: 'paid',
    payment_intent: 'pi_test_123',
    payment_method_types: ['card'],
    ...overrides,
  } as Stripe.Checkout.Session
}

describe('startCardCheckout', () => {
  it('支払える請求をpendingで確保し、Stripeのcheckoutセッションを作る', async () => {
    await insertSettings(db, { cardPaymentEnabled: true, invoiceLeadMonths: 0 })
    const contractorId = await insertContractor(db, { contractStartMonth: '2026-09' })
    await createOpenInvoice(contractorId, '2026-09', 3000)
    await createOpenInvoice(contractorId, '2026-10', 3000)

    const result = await startCardCheckout(db, {
      contractorId,
      count: 2,
      origin: 'https://example.com',
      now: new Date('2026-09-15T00:00:00.000Z'),
      stripeClient: fakeStripeClient(),
    })

    expect(result.ok).toBe(true)
    const paymentRows = await db.select().from(payments).where(eq(payments.contractorId, contractorId))
    expect(paymentRows).toHaveLength(1)
    expect(paymentRows[0].amount).toBe(6000)
    expect(paymentRows[0].status).toBe('pending')
    expect(paymentRows[0].stripeCheckoutSessionId).toBe('cs_test_123')

    const allocationRows = await db
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentId, paymentRows[0].id))
    expect(allocationRows).toHaveLength(2)
    expect(allocationRows.every((a) => a.state === 'pending')).toBe(true)
  })

  it('カード決済が無効な設定なら card_disabled', async () => {
    await insertSettings(db, { cardPaymentEnabled: false, invoiceLeadMonths: 0 })
    const contractorId = await insertContractor(db, { contractStartMonth: '2026-09' })
    await createOpenInvoice(contractorId, '2026-09')

    const result = await startCardCheckout(db, {
      contractorId,
      count: 1,
      origin: 'https://example.com',
      now: new Date('2026-09-15T00:00:00.000Z'),
      stripeClient: fakeStripeClient(),
    })

    expect(result).toEqual({ ok: false, error: 'card_disabled' })
  })

  it('支払える請求が指定数より少なければ insufficient_invoices（何も作らない）', async () => {
    await insertSettings(db, { cardPaymentEnabled: true, invoiceLeadMonths: 0 })
    const contractorId = await insertContractor(db, { contractStartMonth: '2026-09' })
    await createOpenInvoice(contractorId, '2026-09')

    const result = await startCardCheckout(db, {
      contractorId,
      count: 2,
      origin: 'https://example.com',
      now: new Date('2026-09-15T00:00:00.000Z'),
      stripeClient: fakeStripeClient(),
    })

    expect(result).toEqual({ ok: false, error: 'insufficient_invoices' })
    const paymentRows = await db.select().from(payments)
    expect(paymentRows).toHaveLength(0)
  })

  it('二重にpendingの配分がある請求は対象にならない（DB制約による二重決済防止）', async () => {
    await insertSettings(db, { cardPaymentEnabled: true, invoiceLeadMonths: 0 })
    const contractorId = await insertContractor(db, { contractStartMonth: '2026-09' })
    await createOpenInvoice(contractorId, '2026-09')

    const first = await startCardCheckout(db, {
      contractorId,
      count: 1,
      origin: 'https://example.com',
      now: new Date('2026-09-15T00:00:00.000Z'),
      stripeClient: fakeStripeClient('cs_1'),
    })
    expect(first.ok).toBe(true)

    const second = await startCardCheckout(db, {
      contractorId,
      count: 1,
      origin: 'https://example.com',
      now: new Date('2026-09-15T00:00:00.000Z'),
      stripeClient: fakeStripeClient('cs_2'),
    })
    expect(second).toEqual({ ok: false, error: 'insufficient_invoices' })
  })

  it('Stripe呼び出しが失敗したら入金をcanceledにし、配分を解放する', async () => {
    await insertSettings(db, { cardPaymentEnabled: true, invoiceLeadMonths: 0 })
    const contractorId = await insertContractor(db, { contractStartMonth: '2026-09' })
    const invoiceId = await createOpenInvoice(contractorId, '2026-09')

    const failingStripe: Pick<Stripe, 'checkout'> = {
      checkout: {
        sessions: {
          create: async () => {
            throw new Error('stripe down')
          },
        },
      },
    } as unknown as Pick<Stripe, 'checkout'>

    const result = await startCardCheckout(db, {
      contractorId,
      count: 1,
      origin: 'https://example.com',
      now: new Date('2026-09-15T00:00:00.000Z'),
      stripeClient: failingStripe,
    })

    expect(result).toEqual({ ok: false, error: 'stripe_error' })
    const paymentRows = await db.select().from(payments).where(eq(payments.contractorId, contractorId))
    expect(paymentRows[0].status).toBe('canceled')
    const allocationRows = await db
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.invoiceId, invoiceId))
    expect(allocationRows[0].state).toBe('released')
  })
})

describe('fulfillCheckout', () => {
  async function setupPendingCardPayment(amount = 3000) {
    await insertSettings(db)
    const contractorId = await insertContractor(db)
    const invoiceId = await createOpenInvoice(contractorId, '2026-09', amount)
    const [payment] = await db
      .insert(payments)
      .values({ contractorId, method: 'card', channel: 'portal', status: 'pending', amount })
      .returning({ id: payments.id })
    await db.insert(paymentAllocations).values({ paymentId: payment.id, invoiceId, amount, state: 'pending' })
    return { contractorId, invoiceId, paymentId: payment.id }
  }

  it('paid のセッションで入金を成功にし、請求をpaidにし、領収書を発行する', async () => {
    const { paymentId, invoiceId } = await setupPendingCardPayment(3000)

    const result = await fulfillCheckout(
      db,
      fakeSession({ metadata: { payment_id: paymentId }, amount_total: 3000 }),
      new Date('2026-09-15T00:00:00.000Z'),
    )

    expect(result).toBe('succeeded')
    const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) })
    expect(payment?.status).toBe('succeeded')
    const invoice = await db.query.invoices.findFirst({ where: eq(invoices.id, invoiceId) })
    expect(invoice?.status).toBe('paid')
    const receipt = await db.query.receipts.findFirst({ where: eq(receipts.paymentId, paymentId) })
    expect(receipt?.receiptNo).toBe(1)
    expect(receipt?.amount).toBe(3000)
  })

  it('2回呼んでも1回しか処理しない（冪等）: 入金1件・配分1件・領収書1枚のまま', async () => {
    const { paymentId } = await setupPendingCardPayment(3000)
    const session = fakeSession({ metadata: { payment_id: paymentId }, amount_total: 3000 })

    await fulfillCheckout(db, session, new Date('2026-09-15T00:00:00.000Z'))
    await fulfillCheckout(db, session, new Date('2026-09-15T00:00:00.000Z'))

    const receiptRows = await db.select().from(receipts).where(eq(receipts.paymentId, paymentId))
    expect(receiptRows).toHaveLength(1)
    const allocationRows = await db
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentId, paymentId))
    expect(allocationRows).toHaveLength(1)
    expect(allocationRows[0].state).toBe('applied')
  })

  it('金額が一致しないセッションは処理せず amount_mismatch を返す', async () => {
    const { paymentId } = await setupPendingCardPayment(3000)

    const result = await fulfillCheckout(
      db,
      fakeSession({ metadata: { payment_id: paymentId }, amount_total: 9999 }),
      new Date('2026-09-15T00:00:00.000Z'),
    )

    expect(result).toBe('amount_mismatch')
    const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) })
    expect(payment?.status).toBe('pending')
  })

  it('unpaid（コンビニ払い等）は pending のまま決済手段だけ記録する', async () => {
    const { paymentId } = await setupPendingCardPayment(3000)

    const result = await fulfillCheckout(
      db,
      fakeSession({
        metadata: { payment_id: paymentId },
        amount_total: 3000,
        payment_status: 'unpaid',
        payment_method_types: ['konbini'],
      }),
      new Date('2026-09-15T00:00:00.000Z'),
    )

    expect(result).toBe('awaiting_payment')
    const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) })
    expect(payment?.status).toBe('pending')
    expect(payment?.stripePaymentMethodType).toBe('konbini')
  })

  it('存在しない支払いIDは not_found', async () => {
    const result = await fulfillCheckout(
      db,
      fakeSession({ metadata: { payment_id: 'not-exist' } }),
      new Date('2026-09-15T00:00:00.000Z'),
    )
    expect(result).toBe('not_found')
  })
})

describe('resumeCardCheckout / cancelCardCheckout', () => {
  async function setupPendingCardPayment(sessionId = 'cs_test_123', amount = 3000) {
    await insertSettings(db, { cardPaymentEnabled: true })
    const contractorId = await insertContractor(db)
    const invoiceId = await createOpenInvoice(contractorId, '2026-09', amount)
    const [payment] = await db
      .insert(payments)
      .values({
        contractorId,
        method: 'card',
        channel: 'portal',
        status: 'pending',
        amount,
        stripeCheckoutSessionId: sessionId,
      })
      .returning({ id: payments.id })
    await db.insert(paymentAllocations).values({ paymentId: payment.id, invoiceId, amount, state: 'pending' })
    return { contractorId, invoiceId, paymentId: payment.id }
  }

  function fakeCheckoutClient(
    session: Partial<Stripe.Checkout.Session>,
    opts: { expire?: () => Promise<void> } = {},
  ): Pick<Stripe, 'checkout'> {
    return {
      checkout: {
        sessions: {
          retrieve: async () => session as Stripe.Checkout.Session,
          expire: opts.expire ?? (async () => {}),
        },
      },
    } as unknown as Pick<Stripe, 'checkout'>
  }

  it('resume: セッションがまだopenならそのURLへredirectする', async () => {
    const { paymentId, contractorId } = await setupPendingCardPayment()

    const result = await resumeCardCheckout(db, {
      paymentId,
      contractorId,
      now: new Date('2026-09-15T00:00:00.000Z'),
      stripeClient: fakeCheckoutClient({ status: 'open', url: 'https://checkout.stripe.com/cs_test_123' }),
    })

    expect(result).toEqual({ kind: 'redirect', url: 'https://checkout.stripe.com/cs_test_123' })
    const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) })
    expect(payment?.status).toBe('pending')
  })

  it('resume: セッションが既にcompleteなら確定処理をしてcompletedを返す', async () => {
    const { paymentId, contractorId } = await setupPendingCardPayment()

    const result = await resumeCardCheckout(db, {
      paymentId,
      contractorId,
      now: new Date('2026-09-15T00:00:00.000Z'),
      stripeClient: fakeCheckoutClient({
        status: 'complete',
        payment_status: 'paid',
        amount_total: 3000,
        currency: 'jpy',
        metadata: { payment_id: paymentId },
        payment_intent: 'pi_test_123',
        payment_method_types: ['card'],
      }),
    })

    expect(result).toEqual({ kind: 'completed', paymentId })
    const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) })
    expect(payment?.status).toBe('succeeded')
  })

  it('resume: セッションが期限切れなら配分を解放してexpiredを返す', async () => {
    const { paymentId, contractorId, invoiceId } = await setupPendingCardPayment()

    const result = await resumeCardCheckout(db, {
      paymentId,
      contractorId,
      now: new Date('2026-09-15T00:00:00.000Z'),
      stripeClient: fakeCheckoutClient({ status: 'expired' }),
    })

    expect(result).toEqual({ kind: 'expired' })
    const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) })
    expect(payment?.status).toBe('canceled')
    const allocationRows = await db
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.invoiceId, invoiceId))
    expect(allocationRows[0].state).toBe('released')
  })

  it('resume: 他人の入金を指定すると not_found', async () => {
    const { paymentId } = await setupPendingCardPayment()
    const otherContractorId = await insertContractor(db)

    const result = await resumeCardCheckout(db, {
      paymentId,
      contractorId: otherContractorId,
      now: new Date('2026-09-15T00:00:00.000Z'),
      stripeClient: fakeCheckoutClient({ status: 'open', url: 'https://checkout.stripe.com/x' }),
    })

    expect(result).toEqual({ kind: 'not_found' })
  })

  it('cancel: Stripeのセッションを期限切れにし、配分を解放する', async () => {
    const { paymentId, contractorId, invoiceId } = await setupPendingCardPayment()
    let expired = false

    const result = await cancelCardCheckout(db, {
      paymentId,
      contractorId,
      now: new Date('2026-09-15T00:00:00.000Z'),
      stripeClient: fakeCheckoutClient(
        { status: 'open' },
        {
          expire: async () => {
            expired = true
          },
        },
      ),
    })

    expect(result).toEqual({ ok: true })
    expect(expired).toBe(true)
    const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) })
    expect(payment?.status).toBe('canceled')
    const allocationRows = await db
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.invoiceId, invoiceId))
    expect(allocationRows[0].state).toBe('released')
  })

  it('cancel: 取り消した後、同じ月をもう一度支払える', async () => {
    const { paymentId, contractorId } = await setupPendingCardPayment()

    await cancelCardCheckout(db, {
      paymentId,
      contractorId,
      now: new Date('2026-09-15T00:00:00.000Z'),
      stripeClient: fakeCheckoutClient({ status: 'open' }),
    })

    const result = await startCardCheckout(db, {
      contractorId,
      count: 1,
      origin: 'https://example.com',
      now: new Date('2026-09-15T00:00:00.000Z'),
      stripeClient: fakeStripeClient('cs_retry'),
    })
    expect(result.ok).toBe(true)
  })

  it('cancel: 他人の入金を指定すると not_found', async () => {
    const { paymentId } = await setupPendingCardPayment()
    const otherContractorId = await insertContractor(db)

    const result = await cancelCardCheckout(db, {
      paymentId,
      contractorId: otherContractorId,
      now: new Date('2026-09-15T00:00:00.000Z'),
      stripeClient: fakeCheckoutClient({ status: 'open' }),
    })

    expect(result).toEqual({ ok: false, error: 'not_found' })
  })
})

describe('reportTransfer / approveTransfer / rejectTransfer', () => {
  it('振込を報告し、承認すると入金が完了して領収書が発行される', async () => {
    await insertSettings(db, { bankTransferEnabled: true, invoiceLeadMonths: 0 })
    const contractorId = await insertContractor(db, { contractStartMonth: '2026-09' })
    const invoiceId = await createOpenInvoice(contractorId, '2026-09', 3000)

    const reported = await reportTransfer(db, {
      contractorId,
      count: 1,
      payerName: 'タナカ タロウ',
      paidOn: '2026-09-10',
      now: new Date('2026-09-15T00:00:00.000Z'),
    })
    expect(reported.ok).toBe(true)
    if (!reported.ok) return

    const approved = await approveTransfer(db, {
      paymentId: reported.paymentId,
      owner: { email: 'owner@example.com' },
      now: new Date('2026-09-16T00:00:00.000Z'),
    })
    expect(approved).toEqual({ ok: true })

    const payment = await db.query.payments.findFirst({ where: eq(payments.id, reported.paymentId) })
    expect(payment?.status).toBe('succeeded')
    expect(payment?.reviewedBy).toBe('owner@example.com')
    const invoice = await db.query.invoices.findFirst({ where: eq(invoices.id, invoiceId) })
    expect(invoice?.status).toBe('paid')
    const receipt = await db.query.receipts.findFirst({ where: eq(receipts.paymentId, reported.paymentId) })
    expect(receipt?.transactionDate).toBe('2026-09-10')
  })

  it('未来日の振込日は invalid_date', async () => {
    await insertSettings(db, { bankTransferEnabled: true, invoiceLeadMonths: 0 })
    const contractorId = await insertContractor(db, { contractStartMonth: '2026-09' })
    await createOpenInvoice(contractorId, '2026-09')

    const result = await reportTransfer(db, {
      contractorId,
      count: 1,
      payerName: 'テスト',
      paidOn: '2999-01-01',
      now: new Date('2026-09-15T00:00:00.000Z'),
    })
    expect(result).toEqual({ ok: false, error: 'invalid_date' })
  })

  it('却下すると入金はrejectedになり、配分は解放されて再び支払える', async () => {
    await insertSettings(db, { bankTransferEnabled: true, invoiceLeadMonths: 0 })
    const contractorId = await insertContractor(db, { contractStartMonth: '2026-09' })
    const invoiceId = await createOpenInvoice(contractorId, '2026-09', 3000)

    const reported = await reportTransfer(db, {
      contractorId,
      count: 1,
      payerName: 'タナカ タロウ',
      paidOn: '2026-09-10',
      now: new Date('2026-09-15T00:00:00.000Z'),
    })
    if (!reported.ok) throw new Error('unexpected')

    const rejected = await rejectTransfer(db, {
      paymentId: reported.paymentId,
      reason: '入金が確認できません',
      owner: { email: 'owner@example.com' },
      now: new Date('2026-09-16T00:00:00.000Z'),
    })
    expect(rejected).toEqual({ ok: true })

    const payment = await db.query.payments.findFirst({ where: eq(payments.id, reported.paymentId) })
    expect(payment?.status).toBe('rejected')
    expect(payment?.rejectReason).toBe('入金が確認できません')
    const allocationRows = await db
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.invoiceId, invoiceId))
    expect(allocationRows[0].state).toBe('released')

    // 再び支払える（新しい振込を報告できる）
    const secondReport = await reportTransfer(db, {
      contractorId,
      count: 1,
      payerName: 'タナカ タロウ',
      paidOn: '2026-09-17',
      now: new Date('2026-09-17T00:00:00.000Z'),
    })
    expect(secondReport.ok).toBe(true)
  })
})

describe('recordManualPayment', () => {
  it('現金の入金を記録し、請求をpaidにして領収書を発行する', async () => {
    await insertSettings(db)
    const contractorId = await insertContractor(db)
    const invoiceId = await createOpenInvoice(contractorId, '2026-09', 3000)

    const result = await recordManualPayment(db, {
      contractorId,
      invoiceIds: [invoiceId],
      amount: 3000,
      method: 'cash',
      paidOn: '2026-09-15',
      owner: { email: 'owner@example.com' },
      now: new Date('2026-09-15T00:00:00.000Z'),
    })

    expect(result.ok).toBe(true)
    const invoice = await db.query.invoices.findFirst({ where: eq(invoices.id, invoiceId) })
    expect(invoice?.status).toBe('paid')
    if (!result.ok) return
    const receipt = await db.query.receipts.findFirst({ where: eq(receipts.paymentId, result.paymentId) })
    expect(receipt?.paymentMethodLabel).toBe('現金')
  })

  it('入力額が請求額に満たない場合は一部入金になり、請求はopenのまま', async () => {
    await insertSettings(db)
    const contractorId = await insertContractor(db)
    const invoiceId = await createOpenInvoice(contractorId, '2026-09', 3000)

    const result = await recordManualPayment(db, {
      contractorId,
      invoiceIds: [invoiceId],
      amount: 1000,
      method: 'cash',
      paidOn: '2026-09-15',
      owner: { email: 'owner@example.com' },
      now: new Date('2026-09-15T00:00:00.000Z'),
    })

    expect(result.ok).toBe(true)
    const invoice = await db.query.invoices.findFirst({ where: eq(invoices.id, invoiceId) })
    expect(invoice?.status).toBe('open')
    if (!result.ok) return
    const receipt = await db.query.receipts.findFirst({ where: eq(receipts.paymentId, result.paymentId) })
    expect(receipt?.description).toContain('（一部）')
  })

  it('pendingの配分がある請求は対象にできない', async () => {
    await insertSettings(db)
    const contractorId = await insertContractor(db)
    const invoiceId = await createOpenInvoice(contractorId, '2026-09', 3000)
    await db.insert(payments).values({
      id: 'p-pending',
      contractorId,
      method: 'card',
      channel: 'portal',
      status: 'pending',
      amount: 3000,
    })
    await db
      .insert(paymentAllocations)
      .values({ paymentId: 'p-pending', invoiceId, amount: 3000, state: 'pending' })

    const result = await recordManualPayment(db, {
      contractorId,
      invoiceIds: [invoiceId],
      amount: 3000,
      method: 'cash',
      paidOn: '2026-09-15',
      owner: { email: 'owner@example.com' },
      now: new Date('2026-09-15T00:00:00.000Z'),
    })

    expect(result).toEqual({ ok: false, error: 'invoice_not_payable' })
  })
})
