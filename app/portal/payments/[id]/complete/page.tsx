import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { requireContractor } from '@/lib/auth/contractor-session'
import { getStripe } from '@/lib/stripe'
import { fulfillCheckout, cancelCardCheckout } from '@/lib/services/payments'
import { getSettings } from '@/lib/services/settings'
import { payments, invoices, paymentAllocations } from '@/lib/db/schema'
import { formatMonthJa, type YearMonth } from '@/lib/domain/time'
import { formatYen } from '@/lib/domain/money'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AutoRefresh } from '@/components/portal/auto-refresh'

type Outcome = 'succeeded' | 'pending' | 'canceled' | 'amount_mismatch'

/**
 * Stripe Checkoutからの戻り画面。success_url / cancel_url の両方がここに戻る。
 * card_in_progress からの「お支払いを確認する」（session_id/canceled 無し）でも開く。
 * 参照: docs/design/09-ux-improvements.md §9.4.5
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

  let outcome: Outcome
  if (canceled === '1' && payment.status === 'pending') {
    await cancelCardCheckout(db, { paymentId: id, contractorId: contractor.id, now: new Date() })
    outcome = 'canceled'
  } else if (sessionId && payment.status === 'pending') {
    const session = await getStripe().checkout.sessions.retrieve(sessionId)
    const result = await fulfillCheckout(db, session, new Date())
    outcome =
      result === 'succeeded' ? 'succeeded' : result === 'amount_mismatch' ? 'amount_mismatch' : 'pending'
  } else if (payment.status === 'succeeded') {
    outcome = 'succeeded'
  } else if (payment.status === 'canceled' || payment.status === 'failed') {
    outcome = 'canceled'
  } else {
    outcome = 'pending'
  }

  if (outcome === 'succeeded') {
    const allocationRows = await db
      .select({ month: invoices.month })
      .from(paymentAllocations)
      .innerJoin(invoices, eq(invoices.id, paymentAllocations.invoiceId))
      .where(eq(paymentAllocations.paymentId, id))
    const months = allocationRows.map((r) => r.month as YearMonth).sort()

    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-2 p-8 text-center">
            <p className="text-2xl">✅</p>
            <p className="text-lg font-bold text-slate-900">お支払いが完了しました</p>
            <p className="text-base text-slate-900">
              {months.map(formatMonthJa).join('と')}分 {formatYen(payment.amount)}
            </p>
          </CardContent>
        </Card>
        <Button asChild size="lg" className="h-14 w-full text-lg font-bold">
          <Link href={`/portal/payments/${id}/receipt`}>領収書を見る</Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-12 w-full text-base">
          <Link href="/portal">ホームに戻る</Link>
        </Button>
      </div>
    )
  }

  if (outcome === 'canceled') {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-2 p-8 text-center">
            <p className="text-lg font-bold text-slate-900">お支払いを中止しました</p>
            <p className="text-base font-bold text-slate-900">料金はかかっていません</p>
          </CardContent>
        </Card>
        <Button asChild size="lg" className="h-14 w-full text-lg font-bold">
          <Link href="/portal">ホームに戻る</Link>
        </Button>
      </div>
    )
  }

  if (outcome === 'amount_mismatch') {
    const settings = await getSettings(db)
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-2 p-8 text-center">
            <p className="text-base text-slate-900">
              金額の確認でエラーが発生しました。お手数ですが管理者へご連絡ください
              {settings.businessPhone ? `（${settings.businessPhone}）` : ''}。
            </p>
          </CardContent>
        </Card>
        <Button asChild size="lg" className="h-14 w-full text-lg font-bold">
          <Link href="/portal">ホームに戻る</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-2 p-8 text-center">
          <p className="text-2xl">⏳</p>
          <p className="text-lg font-bold text-slate-900">お支払いを確認しています</p>
          <p className="text-base text-muted-foreground">このままお待ちください。</p>
        </CardContent>
      </Card>
      <AutoRefresh />
    </div>
  )
}
