import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { requireContractor } from '@/lib/auth/contractor-session'
import { payments, paymentAllocations, invoices } from '@/lib/db/schema'
import { formatMonthJa, type YearMonth } from '@/lib/domain/time'
import { formatYen } from '@/lib/domain/money'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

/**
 * 振込報告の完了画面。押した結果がその場で分かるようにする（U2）。
 * 参照: docs/design/09-ux-improvements.md §9.4.4
 */
export default async function TransferDonePage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params
  const db = getDb(appEnv().DB)
  const contractor = await requireContractor(db)

  const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) })
  if (!payment || payment.contractorId !== contractor.id || payment.method !== 'bank_transfer') notFound()

  const allocationRows = await db
    .select({ month: invoices.month })
    .from(paymentAllocations)
    .innerJoin(invoices, eq(invoices.id, paymentAllocations.invoiceId))
    .where(eq(paymentAllocations.paymentId, paymentId))

  const months = allocationRows.map((r) => r.month as YearMonth).sort()

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-2 p-8 text-center">
          <p className="text-2xl">✅</p>
          <p className="text-lg font-bold text-slate-900">ご連絡ありがとうございます</p>
          <p className="text-base text-slate-900">
            {months.map(formatMonthJa).join('と')}分 {formatYen(payment.amount)}
          </p>
          <p className="text-base text-muted-foreground">
            お振り込みを確認できたら、ホームに ✅ が付きます（通常1〜3日）。
          </p>
        </CardContent>
      </Card>
      <Button asChild size="lg" className="h-14 w-full text-lg font-bold">
        <Link href="/portal">ホームに戻る</Link>
      </Button>
    </div>
  )
}
