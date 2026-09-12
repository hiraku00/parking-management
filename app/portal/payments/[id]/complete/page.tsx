import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { requireContractor } from '@/lib/auth/contractor-session'
import { getStripe } from '@/lib/stripe'
import { fulfillCheckout } from '@/lib/services/payments'
import { payments } from '@/lib/db/schema'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

/**
 * Stripe Checkoutからの戻り画面。success_url / cancel_url の両方がここに戻る。
 * 参照: docs/design/06-billing-payments.md §6.4
 */
export default async function PaymentCompletePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ session_id?: string; canceled?: string }>
}) {
  const { id } = await params
  const { session_id: sessionId, canceled } = await searchParams
  const db = getDb(appEnv().DB)
  const contractor = await requireContractor(db)

  const payment = await db.query.payments.findFirst({ where: eq(payments.id, id) })
  if (!payment || payment.contractorId !== contractor.id) notFound()

  let message = '確認中です。しばらくお待ちください。'

  if (canceled === '1') {
    if (payment.status === 'pending' && payment.stripeCheckoutSessionId) {
      try {
        await getStripe().checkout.sessions.expire(payment.stripeCheckoutSessionId)
      } catch {
        // 既に期限切れ・完了済みの場合は無視する
      }
    }
    message = 'お支払いをキャンセルしました。'
  } else if (sessionId) {
    const session = await getStripe().checkout.sessions.retrieve(sessionId)
    const result = await fulfillCheckout(db, session, new Date())
    if (result === 'succeeded') message = 'お支払いが完了しました。ありがとうございます。'
    else if (result === 'awaiting_payment')
      message = 'お支払い方法の確認中です。完了まで少しお時間がかかる場合があります。'
    else if (result === 'amount_mismatch')
      message = '金額の確認でエラーが発生しました。お手数ですが管理者へご連絡ください。'
  } else if (payment.status === 'succeeded') {
    message = 'お支払いが完了しました。ありがとうございます。'
  } else if (payment.status === 'canceled' || payment.status === 'failed') {
    message = 'お支払いは完了しませんでした。'
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-8 text-center text-lg text-slate-900">{message}</CardContent>
      </Card>
      <Button asChild size="lg" className="h-14 w-full text-lg font-bold">
        <Link href="/portal">ポータルに戻る</Link>
      </Button>
    </div>
  )
}
