import Link from 'next/link'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { getPendingTransfers } from '@/lib/services/queries'
import { formatYen } from '@/lib/domain/money'
import { formatDateJa } from '@/lib/domain/time'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default async function AdminPaymentsPage() {
  const db = getDb(appEnv().DB)
  const pendingTransfers = await getPendingTransfers(db)

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">入金</h1>

      <Card>
        <CardHeader>
          <CardTitle>確認待ちの振込（{pendingTransfers.length}件）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-0">
          {pendingTransfers.length === 0 ? (
            <p className="p-4 text-muted-foreground">確認待ちの振込はありません。</p>
          ) : (
            <ul className="divide-y">
              {pendingTransfers.map((t) => (
                <li key={t.paymentId} className="flex items-center justify-between p-4">
                  <div>
                    <Link
                      href={`/admin/contractors/${t.contractorId}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {t.contractorName}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {formatYen(t.amount)} ・ {t.payerName ?? '名義不明'} ・ {t.paidOn ?? '日付不明'} ・
                      報告: {formatDateJa(t.createdAt)}
                    </p>
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/admin/payments/${t.paymentId}`}>確認する</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
