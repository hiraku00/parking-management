import Link from 'next/link'
import { redirect } from 'next/navigation'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { requireContractor } from '@/lib/auth/contractor-session'
import { getUnpaidInvoicesForContractor } from '@/lib/services/queries'
import { getSettings } from '@/lib/services/settings'
import { formatMonthRangeJa } from '@/lib/domain/time'
import { formatYen } from '@/lib/domain/money'
import { Button } from '@/components/ui/button'
import { DotIcon } from '@/components/ui/icons'
import { PrepaySelector } from './prepay-selector'

/**
 * お支払い ステップ1/2: どの月の分を払うか選ぶ。method="get" で次のステップへ
 * 送るため、クライアントの状態を持たず、ブラウザの［戻る］で選択が消えない。
 * 参照: docs/design/09-ux-improvements.md §9.4.2
 */
export default async function PayPage({ searchParams }: { searchParams: Promise<{ count?: string }> }) {
  const { count: countParam } = await searchParams
  const db = getDb(appEnv().DB)
  const contractor = await requireContractor(db)
  const settings = await getSettings(db)

  const unpaid = (
    await getUnpaidInvoicesForContractor(db, contractor.id, new Date(), settings.paymentDueDay)
  ).filter((i) => !i.hasPendingAllocation)

  if (unpaid.length === 0) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-base text-slate-700">お支払いが必要な月はありません。</p>
        <Link href="/portal" className="min-h-12 text-base text-primary hover:underline">
          ‹ 戻る
        </Link>
      </div>
    )
  }

  if (unpaid.length === 1) {
    redirect('/portal/pay/method?count=1')
  }

  // 未払い分（滞納・当月分）は選ばせず、常にまとめて1件として払う。
  // 先払い分（まだ支払期日が来ていない将来の月）だけを、任意で追加できる
  // 選択肢にする。「未払い分は一括、先払い分は期間を選択」という方針により、
  // 滞納が何か月あっても選択肢が増殖しない（07-screens.md §7.1「1画面に主な
  // 操作は1つ」）。
  const neededCount = unpaid.filter((i) => i.timing !== 'future').length || 1
  const owedTargets = unpaid.slice(0, neededCount)
  const owedAmount = owedTargets.reduce((sum, i) => sum + i.remaining, 0)
  const owedMonthsLabel = formatMonthRangeJa(owedTargets.map((i) => i.month))
  const prepayOptions = unpaid.length - neededCount

  const requestedCount = Number(countParam ?? '')
  const defaultCount =
    Number.isInteger(requestedCount) && requestedCount >= neededCount && requestedCount <= unpaid.length
      ? requestedCount
      : neededCount

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/portal" className="min-h-12 text-base text-primary hover:underline">
          ‹ 戻る
        </Link>
        <p className="text-base text-muted-foreground">ステップ 1/2</p>
      </div>

      {prepayOptions <= 0 ? (
        <>
          <p className="text-lg font-bold text-slate-900">お支払いいただく金額</p>
          <div className="state-hero" style={{ padding: '22px 20px', gap: 6 }}>
            <span className="status-pill status-pill--info">
              <DotIcon className="ico" />
              未払い分
            </span>
            <p className="text-lg font-bold text-slate-900">{owedMonthsLabel}分</p>
            <p className="amount">{formatYen(owedAmount)}</p>
          </div>
          <form action="/portal/pay/method" method="get">
            <input type="hidden" name="count" value={neededCount} />
            <Button type="submit" size="lg" className="h-14 w-full text-lg font-bold">
              次へ
            </Button>
          </form>
        </>
      ) : (
        <PrepaySelector
          neededCount={neededCount}
          owedAmount={owedAmount}
          owedMonthsLabel={owedMonthsLabel}
          extraInvoices={unpaid.slice(neededCount).map((i) => ({ month: i.month, remaining: i.remaining }))}
          defaultCount={defaultCount}
        />
      )}
    </div>
  )
}
