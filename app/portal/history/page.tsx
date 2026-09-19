import Link from 'next/link'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { requireContractor } from '@/lib/auth/contractor-session'
import { getPaymentHistoryForContractor } from '@/lib/services/queries'
import { formatMonthJa } from '@/lib/domain/time'
import { formatYen } from '@/lib/domain/money'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/portal/status-badge'

const METHOD_LABEL: Record<string, string> = {
  card: 'カード・スマホ決済',
  bank_transfer: '銀行振込',
  cash: '現金',
  other: 'その他',
}

/** 参照: docs/design/09-ux-improvements.md §9.4.1（ホームは直近3件のみ、ここで全件表示） */
export default async function PortalHistoryPage() {
  const db = getDb(appEnv().DB)
  const contractor = await requireContractor(db)
  const paymentHistory = await getPaymentHistoryForContractor(db, contractor.id)

  return (
    <div className="space-y-4">
      <div>
        <Link href="/portal" className="min-h-12 text-base text-muted-foreground hover:underline">
          ‹ ホームに戻る
        </Link>
      </div>
      <h1 className="text-lg font-bold text-slate-900">お支払いの履歴</h1>

      {paymentHistory.length === 0 ? (
        <p className="text-base text-muted-foreground">まだお支払いの履歴はありません。</p>
      ) : (
        <div className="space-y-3">
          {paymentHistory
            .filter((p) => p.status !== 'canceled' && p.status !== 'failed')
            .map((p) => (
              <Card key={p.id}>
                <div className="history-item">
                  <div>
                    <p className="text-base font-medium">{p.months.map(formatMonthJa).join('、') || '-'}</p>
                    <p className="text-base text-muted-foreground">
                      {formatYen(p.amount)} ・ {METHOD_LABEL[p.method]}
                    </p>
                    {p.status === 'rejected' && p.rejectReason && (
                      <p className="text-base text-destructive">理由: {p.rejectReason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {p.status === 'succeeded' && <Badge>支払済</Badge>}
                    {p.status === 'pending' && <StatusBadge kind="pending" />}
                    {p.status === 'rejected' && <StatusBadge kind="rejected" />}
                    {p.status === 'refunded' && <StatusBadge kind="refunded" />}
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
            ))}
        </div>
      )}
    </div>
  )
}
