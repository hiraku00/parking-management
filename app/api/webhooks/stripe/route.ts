import type Stripe from 'stripe'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { getStripe, webCrypto } from '@/lib/stripe'
import { fulfillCheckout, releaseAllocations } from '@/lib/services/payments'
import { stripeEvents } from '@/lib/db/schema'

/**
 * Stripe Webhook。DBエラー時は500を返し、Stripeの再送に任せる（各処理は
 * 冪等なので安全）。参照: docs/design/06-billing-payments.md §6.4
 */
export async function POST(req: Request) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''
  const env = appEnv()

  let event: Stripe.Event
  try {
    event = await getStripe().webhooks.constructEventAsync(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
      undefined,
      webCrypto,
    )
  } catch {
    return new Response(null, { status: 400 })
  }

  const db = getDb(env.DB)
  const now = new Date()

  await db.insert(stripeEvents).values({ id: event.id, type: event.type }).onConflictDoNothing()

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      await fulfillCheckout(db, event.data.object, now)
      break
    }
    case 'checkout.session.async_payment_failed': {
      const paymentId = event.data.object.metadata?.payment_id
      if (paymentId) await releaseAllocations(db, { paymentId, status: 'failed', now })
      break
    }
    case 'checkout.session.expired': {
      const paymentId = event.data.object.metadata?.payment_id
      if (paymentId) await releaseAllocations(db, { paymentId, status: 'canceled', now })
      break
    }
    default:
      break
  }

  return new Response(null, { status: 200 })
}
