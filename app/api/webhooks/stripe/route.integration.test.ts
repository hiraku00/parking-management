import { env } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getDb, type Db } from '../../../../lib/db/client'
import { invoices, payments, paymentAllocations, receipts, stripeEvents } from '../../../../lib/db/schema'
import { getStripe } from '../../../../lib/stripe'
import { migrate, resetData } from '../../../../test/support/migrate'
import { insertContractor, insertSettings } from '../../../../test/support/fixtures'
import { POST } from './route'

let db: Db

beforeAll(async () => {
  await migrate(env.DB)
  db = getDb(env.DB)
})

beforeEach(async () => {
  await resetData(env.DB)
})

async function createPendingCardPayment(amount = 3000) {
  await insertSettings(db)
  const contractorId = await insertContractor(db)
  const [invoice] = await db
    .insert(invoices)
    .values({ contractorId, month: '2026-09', amount })
    .returning({ id: invoices.id })
  const [payment] = await db
    .insert(payments)
    .values({ contractorId, method: 'card', channel: 'portal', status: 'pending', amount })
    .returning({ id: payments.id })
  await db
    .insert(paymentAllocations)
    .values({ paymentId: payment.id, invoiceId: invoice.id, amount, state: 'pending' })
  return { contractorId, invoiceId: invoice.id, paymentId: payment.id }
}

async function signedRequest(type: string, dataObject: Record<string, unknown>) {
  const payload = JSON.stringify({ id: `evt_${crypto.randomUUID()}`, type, data: { object: dataObject } })
  const header = await getStripe().webhooks.generateTestHeaderStringAsync({
    payload,
    secret: 'whsec_test_dummy',
  })
  return new Request('https://example.com/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': header },
    body: payload,
  })
}

describe('POST /api/webhooks/stripe', () => {
  it('署名が不正なら400を返す', async () => {
    const payload = JSON.stringify({
      id: 'evt_bad',
      type: 'checkout.session.completed',
      data: { object: {} },
    })
    const request = new Request('https://example.com/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'invalid' },
      body: payload,
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('checkout.session.completed で入金を完了させる', async () => {
    const { paymentId, invoiceId } = await createPendingCardPayment(3000)

    const request = await signedRequest('checkout.session.completed', {
      id: 'cs_test_1',
      amount_total: 3000,
      currency: 'jpy',
      payment_status: 'paid',
      payment_intent: 'pi_test_1',
      payment_method_types: ['card'],
      metadata: { payment_id: paymentId },
    })
    const response = await POST(request)

    expect(response.status).toBe(200)
    const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) })
    expect(payment?.status).toBe('succeeded')
    const invoice = await db.query.invoices.findFirst({ where: eq(invoices.id, invoiceId) })
    expect(invoice?.status).toBe('paid')
    const receipt = await db.query.receipts.findFirst({ where: eq(receipts.paymentId, paymentId) })
    expect(receipt).toBeDefined()
  })

  it('checkout.session.expired で入金をcanceledにし配分を解放する', async () => {
    const { paymentId, invoiceId } = await createPendingCardPayment(3000)

    const request = await signedRequest('checkout.session.expired', {
      id: 'cs_test_2',
      metadata: { payment_id: paymentId },
    })
    const response = await POST(request)

    expect(response.status).toBe(200)
    const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) })
    expect(payment?.status).toBe('canceled')
    const allocationRows = await db
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.invoiceId, invoiceId))
    expect(allocationRows[0].state).toBe('released')
  })

  it('checkout.session.async_payment_failed で入金をfailedにし配分を解放する', async () => {
    const { paymentId, invoiceId } = await createPendingCardPayment(3000)

    const request = await signedRequest('checkout.session.async_payment_failed', {
      id: 'cs_test_3',
      metadata: { payment_id: paymentId },
    })
    const response = await POST(request)

    expect(response.status).toBe(200)
    const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) })
    expect(payment?.status).toBe('failed')
    const allocationRows = await db
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.invoiceId, invoiceId))
    expect(allocationRows[0].state).toBe('released')
  })

  it('同じイベントを2回受け取っても2回目は同じ結果のまま（stripe_eventsに記録、処理は冪等）', async () => {
    const { paymentId } = await createPendingCardPayment(3000)
    const payload = JSON.stringify({
      id: 'evt_dup_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_4',
          amount_total: 3000,
          currency: 'jpy',
          payment_status: 'paid',
          payment_intent: 'pi_test_4',
          payment_method_types: ['card'],
          metadata: { payment_id: paymentId },
        },
      },
    })
    const header = await getStripe().webhooks.generateTestHeaderStringAsync({
      payload,
      secret: 'whsec_test_dummy',
    })
    const makeRequest = () =>
      new Request('https://example.com/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': header },
        body: payload,
      })

    await POST(makeRequest())
    await POST(makeRequest())

    const eventRows = await db.select().from(stripeEvents).where(eq(stripeEvents.id, 'evt_dup_1'))
    expect(eventRows).toHaveLength(1)
    const receiptRows = await db.select().from(receipts).where(eq(receipts.paymentId, paymentId))
    expect(receiptRows).toHaveLength(1)
  })

  it('その他のイベント種別は200を返して無視する', async () => {
    const request = await signedRequest('customer.created', { id: 'cus_test_1' })
    const response = await POST(request)
    expect(response.status).toBe(200)
  })
})
