import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { contractors, invoices, payments, paymentAllocations, receipts } from '@/lib/db/schema'
import { formatYen } from '@/lib/domain/money'
import { formatDateJa, formatMonthJa, type YearMonth } from '@/lib/domain/time'
import { PAYMENT_METHOD_LABELS } from '@/lib/services/receipts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ApproveRejectForm } from './approve-reject-form'

const STATUS_LABEL: Record<string, string> = {
  pending: '確認待ち',
  succeeded: '完了',
  failed: '失敗',
  canceled: 'キャンセル',
  rejected: '却下',
}

export default async function AdminPaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb(appEnv().DB)

  const payment = await db.query.payments.findFirst({ where: eq(payments.id, id) })
  if (!payment) notFound()
  const contractor = await db.query.contractors.findFirst({ where: eq(contractors.id, payment.contractorId) })

  const allocationRows = await db
    .select({
      invoiceId: paymentAllocations.invoiceId,
      amount: paymentAllocations.amount,
      month: invoices.month,
    })
    .from(paymentAllocations)
    .innerJoin(invoices, eq(invoices.id, paymentAllocations.invoiceId))
    .where(eq(paymentAllocations.paymentId, id))
    .orderBy(invoices.month)

  const receipt = await db.query.receipts.findFirst({ where: eq(receipts.paymentId, id) })

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin/payments" className="text-sm text-muted-foreground hover:underline">
          ‹ 入金一覧へ戻る
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">
          {contractor ? (
            <Link href={`/admin/contractors/${contractor.id}`} className="hover:underline">
              {contractor.name}
            </Link>
          ) : (
            '（契約者不明）'
          )}
        </h1>
        <Badge>{STATUS_LABEL[payment.status]}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>入金内容</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-base text-slate-900">
          <p>金額: {formatYen(payment.amount)}</p>
          <p>方法: {PAYMENT_METHOD_LABELS[payment.method]}</p>
          {payment.payerName && <p>振込名義: {payment.payerName}</p>}
          {payment.paidOn && <p>振込日: {payment.paidOn}</p>}
          <p>対象月: {allocationRows.map((a) => formatMonthJa(a.month as YearMonth)).join('、') || '-'}</p>
          <p className="text-sm text-muted-foreground">報告日時: {formatDateJa(payment.createdAt)}</p>
          {payment.rejectReason && <p className="text-destructive">却下理由: {payment.rejectReason}</p>}
          {receipt && (
            <p>
              <Link href={`/admin/payments/${id}/receipt`} className="text-primary hover:underline">
                📄 領収書を表示
              </Link>
            </p>
          )}
        </CardContent>
      </Card>

      {payment.status === 'pending' && payment.method === 'bank_transfer' && (
        <ApproveRejectForm paymentId={id} />
      )}
    </div>
  )
}
