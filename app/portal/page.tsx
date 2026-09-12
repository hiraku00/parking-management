import Link from 'next/link'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { requireContractor } from '@/lib/auth/contractor-session'
import { getPaymentHistoryForContractor, getUnpaidInvoicesForContractor } from '@/lib/services/queries'
import { formatMonthJa } from '@/lib/domain/time'
import { formatYen } from '@/lib/domain/money'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const METHOD_LABEL: Record<string, string> = {
  card: 'クレジットカード',
  bank_transfer: '銀行振込',
  cash: '現金',
  other: 'その他',
}

export default async function PortalHomePage() {
  const db = getDb(appEnv().DB)
  const contractor = await requireContractor(db)

  const [unpaidInvoices, paymentHistory] = await Promise.all([
    getUnpaidInvoicesForContractor(db, contractor.id, new Date()),
    getPaymentHistoryForContractor(db, contractor.id),
  ])

  const pendingHistory = paymentHistory.filter((p) => p.status === 'pending')
  const rejectedHistory = paymentHistory.filter((p) => p.status === 'rejected')
  const totalUnpaid = unpaidInvoices.reduce((sum, i) => sum + i.remaining, 0)

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-1 p-4">
          <p className="text-base">
            {contractor.name} 様
            {contractor.spaceLabel && <span className="ml-2">区画 {contractor.spaceLabel}</span>}
          </p>
          <p className="text-sm text-muted-foreground">月額 {formatYen(contractor.monthlyFee)}</p>
        </CardContent>
      </Card>

      {pendingHistory.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 text-amber-900">
            <p className="font-bold">⏳ 確認中のお支払いがあります</p>
            <ul className="mt-1 space-y-0.5 text-sm">
              {pendingHistory.map((p) => (
                <li key={p.id}>
                  {p.months.map(formatMonthJa).join('、') || '対象月確認中'}分（{formatYen(p.amount)}）
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {rejectedHistory.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-destructive">
            <p className="font-bold">❌ 振込が確認できませんでした</p>
            <ul className="mt-1 space-y-1 text-sm">
              {rejectedHistory.map((p) => (
                <li key={p.id}>
                  {p.months.map(formatMonthJa).join('、')}分
                  {p.rejectReason && <span className="block text-xs">理由: {p.rejectReason}</span>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4 p-4">
          <h2 className="text-lg font-bold text-slate-900">お支払い</h2>
          {unpaidInvoices.length === 0 ? (
            <p className="text-base text-muted-foreground">✅ お支払いが必要な月はありません</p>
          ) : (
            <>
              <ul className="space-y-2">
                {unpaidInvoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between rounded-md border p-3 text-base"
                  >
                    <span className="flex items-center gap-2">
                      {inv.isOverdue && <span aria-hidden>⚠️</span>}
                      {formatMonthJa(inv.month)}
                    </span>
                    <span className="font-semibold">{formatYen(inv.remaining)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t pt-4">
                <span className="text-base font-bold">合計 {formatYen(totalUnpaid)}</span>
                <Button asChild size="lg" className="h-14 px-8 text-lg font-bold">
                  <Link href="/portal/pay">お支払いへ進む</Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900">お支払いの履歴</h2>
        {paymentHistory.length === 0 ? (
          <p className="text-base text-muted-foreground">まだお支払いの履歴はありません。</p>
        ) : (
          paymentHistory
            .filter((p) => p.status === 'succeeded')
            .map((p) => (
              <Card key={p.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-base font-medium">{p.months.map(formatMonthJa).join('、') || '-'}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatYen(p.amount)} ・ {METHOD_LABEL[p.method]}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge>支払済</Badge>
                    {p.hasReceipt && (
                      <Link
                        href={`/portal/payments/${p.id}/receipt`}
                        target="_blank"
                        className="text-sm text-primary hover:underline"
                      >
                        📄 領収書
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
        )}
      </div>
    </div>
  )
}
