import Link from 'next/link'
import { redirect } from 'next/navigation'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { requireContractor } from '@/lib/auth/contractor-session'
import { getUnpaidInvoicesForContractor } from '@/lib/services/queries'
import { formatMonthJa } from '@/lib/domain/time'
import { formatYen } from '@/lib/domain/money'
import { Button } from '@/components/ui/button'

/**
 * お支払い ステップ1/2: どの月の分を払うか選ぶ。method="get" で次のステップへ
 * 送るため、クライアントの状態を持たず、ブラウザの［戻る］で選択が消えない。
 * 参照: docs/design/09-ux-improvements.md §9.4.2
 */
export default async function PayPage({ searchParams }: { searchParams: Promise<{ count?: string }> }) {
  const { count: countParam } = await searchParams
  const db = getDb(appEnv().DB)
  const contractor = await requireContractor(db)

  const unpaid = (await getUnpaidInvoicesForContractor(db, contractor.id, new Date())).filter(
    (i) => !i.hasPendingAllocation,
  )

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

  const neededCount = unpaid.filter((i) => i.timing !== 'future').length || 1
  const requestedCount = Number(countParam ?? '')
  const defaultCount =
    Number.isInteger(requestedCount) && requestedCount >= 1 && requestedCount <= unpaid.length
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

      <p className="text-lg font-bold text-slate-900">どの月の分をお支払いしますか？</p>

      <form action="/portal/pay/method" method="get" className="space-y-5">
        <fieldset className="space-y-3">
          <legend className="sr-only">お支払いの範囲</legend>
          {unpaid.map((_, index) => {
            const count = index + 1
            const targets = unpaid.slice(0, count)
            const amount = targets.reduce((sum, i) => sum + i.remaining, 0)
            const monthsLabel = targets.map((i) => formatMonthJa(i.month)).join('と')
            const note =
              count === neededCount
                ? 'お支払いが必要な分'
                : count > neededCount
                  ? `${formatMonthJa(unpaid[count - 1].month)}も一緒に払う`
                  : null

            return (
              <label
                key={count}
                className="block min-h-16 rounded-md border p-4 has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="count"
                      value={count}
                      defaultChecked={count === defaultCount}
                      className="size-5 accent-primary"
                    />
                    <span className="text-lg font-bold text-slate-900">{monthsLabel}分</span>
                  </span>
                  <span className="text-lg font-bold text-slate-900">{formatYen(amount)}</span>
                </span>
                {note && <span className="mt-1 block pl-8 text-base text-muted-foreground">{note}</span>}
              </label>
            )
          })}
        </fieldset>

        <Button type="submit" size="lg" className="h-14 w-full text-lg font-bold">
          次へ
        </Button>
      </form>
    </div>
  )
}
