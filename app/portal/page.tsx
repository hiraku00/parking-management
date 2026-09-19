import Link from 'next/link'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { requireContractor } from '@/lib/auth/contractor-session'
import {
  getLatestRejectedTransfer,
  getPaymentHistoryForContractor,
  getPendingCardPayment,
  getUnpaidInvoicesForContractor,
} from '@/lib/services/queries'
import { deriveHomeState } from '@/lib/domain/portal-home'
import { resumeCardCheckoutAction, cancelCardCheckoutAction } from './actions'
import { getSettings } from '@/lib/services/settings'
import {
  currentMonth,
  formatDueDateJa,
  formatMonthJa,
  formatMonthRangeJa,
  type YearMonth,
} from '@/lib/domain/time'
import { formatYen } from '@/lib/domain/money'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/portal/status-badge'
import { AddToHomeBanner } from '@/components/portal/add-to-home-banner'

const METHOD_LABEL: Record<string, string> = {
  card: 'カード・スマホ決済',
  bank_transfer: '銀行振込',
  cash: '現金',
  other: 'その他',
}

function monthsLabel(months: YearMonth[]): string {
  return formatMonthRangeJa(months)
}

export default async function PortalHomePage() {
  const db = getDb(appEnv().DB)
  const contractor = await requireContractor(db)
  const now = new Date()

  const settings = await getSettings(db)
  const [unpaidInvoices, pendingCardPayment, latestRejected, paymentHistory] = await Promise.all([
    getUnpaidInvoicesForContractor(db, contractor.id, now, settings.paymentDueDay),
    getPendingCardPayment(db, contractor.id),
    getLatestRejectedTransfer(db, contractor.id),
    getPaymentHistoryForContractor(db, contractor.id),
  ])

  const state = deriveHomeState({
    invoices: unpaidInvoices.map((i) => ({
      id: i.id,
      month: i.month,
      remaining: i.remaining,
      timing: i.timing,
      pending: i.hasPendingAllocation,
    })),
    pendingCardPayment,
    latestRejected,
  })

  const succeededHistory = paymentHistory.filter((p) => p.status === 'succeeded').slice(0, 3)

  // 「支払いが必要」を優先して主表示にするため、確認中の月があってもderiveHomeStateの
  // 主状態には出ない。見落とされないよう、needs_payment/rejected のときは補足として出す
  // （docs/design/09-ux-improvements.md §9.4.1 のモックアップ「⏳ 確認中があれば、補足として1行」）。
  const alsoPendingMonths = unpaidInvoices.filter((i) => i.hasPendingAllocation).map((i) => i.month)

  return (
    <div className="space-y-6">
      <AddToHomeBanner />

      <Card>
        <CardContent className="space-y-1 p-4">
          <p className="text-lg font-bold text-slate-900">
            {contractor.name} 様
            {contractor.spaceLabel && <span className="ml-2 font-normal">区画 {contractor.spaceLabel}</span>}
          </p>
          <p className="text-base text-muted-foreground">月額 {formatYen(contractor.monthlyFee)}</p>
        </CardContent>
      </Card>

      <div
        className={`state-hero${state.kind === 'needs_payment' && state.overdue ? ' state-hero--overdue' : ''}`}
      >
        {state.kind === 'card_in_progress' && (
          <>
            <StatusBadge kind="inProgress" />
            <p className="text-lg font-bold text-slate-900">
              {monthsLabel(state.months)}分 <span className="amount">{formatYen(state.amount)}</span>
            </p>
            <div className="actions">
              <form action={resumeCardCheckoutAction.bind(null, state.paymentId)}>
                <Button type="submit" size="lg" className="btn--block">
                  お支払いを続ける
                </Button>
              </form>
              <form action={cancelCardCheckoutAction.bind(null, state.paymentId)}>
                <Button type="submit" variant="outline" size="lg" className="h-12 w-full text-base">
                  やめる
                </Button>
              </form>
            </div>
            <p className="field-note">30分たつと自動で取り消されます。</p>
          </>
        )}

        {state.kind === 'rejected' && (
          <>
            <StatusBadge kind="rejected" />
            <p className="text-lg font-bold text-slate-900">{monthsLabel(state.months)}分の振込</p>
            {state.reason && <p className="text-base">理由: {state.reason}</p>}
            <div className="actions">
              <Button asChild size="lg" className="btn--block">
                <Link href="/portal/pay">もう一度お支払いする</Link>
              </Button>
            </div>
          </>
        )}

        {state.kind === 'needs_payment' && (
          <>
            <StatusBadge kind={state.overdue ? 'overdue' : 'needsPayment'} />
            <p className="text-lg font-bold text-slate-900">{monthsLabel(state.months)}分</p>
            <p className="amount">{formatYen(state.amount)}</p>
            {!state.overdue && (
              <p className="due">
                {formatDueDateJa(currentMonth(now), settings.paymentDueDay)}までにお支払いください
              </p>
            )}
            <div className="actions">
              <Button asChild size="lg" className="btn--block">
                <Link href="/portal/pay">お支払いへ進む</Link>
              </Button>
            </div>
          </>
        )}

        {state.kind === 'waiting_confirmation' && (
          <>
            <StatusBadge kind="pending" />
            <p className="text-lg font-bold text-slate-900">{monthsLabel(state.months)}分</p>
            <p className="field-note">確認できたら、ここに ✅ が付きます（通常1〜3日）。</p>
          </>
        )}

        {state.kind === 'all_paid' && (
          <>
            <StatusBadge kind="paid" />
            {state.nextMonth && (
              <div className="actions">
                <Button asChild variant="outline" size="lg" className="h-12 w-full text-base">
                  <Link href="/portal/pay">
                    {formatMonthJa(state.nextMonth.month)}分を先に払う（{formatYen(state.nextMonth.amount)}）
                  </Link>
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {(state.kind === 'needs_payment' || state.kind === 'rejected') && alsoPendingMonths.length > 0 && (
        <p className="field-note flex items-center gap-2">
          <StatusBadge kind="pending" /> {monthsLabel(alsoPendingMonths)}分の振込を確認しています
        </p>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">お支払いの履歴</h2>
          <Link href="/portal/history" className="min-h-12 text-base text-primary hover:underline">
            すべて見る ›
          </Link>
        </div>
        {succeededHistory.length === 0 ? (
          <p className="text-base text-muted-foreground">まだお支払いの履歴はありません。</p>
        ) : (
          succeededHistory.map((p) => (
            <Card key={p.id}>
              <div className="history-item">
                <div>
                  <p className="text-base font-medium">{p.months.map(formatMonthJa).join('、') || '-'}</p>
                  <p className="text-base text-muted-foreground">
                    {formatYen(p.amount)} ・ {METHOD_LABEL[p.method]}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge>支払済</Badge>
                  {p.hasReceipt && (
                    <Link
                      href={`/portal/payments/${p.id}/receipt`}
                      className="min-h-12 text-base text-primary hover:underline"
                    >
                      📄 領収書
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
