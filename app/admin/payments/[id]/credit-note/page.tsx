import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db/client'
import { appEnv } from '@/lib/env'
import { getReceiptForPayment } from '@/lib/services/queries'
import { Receipt } from '@/components/receipt/Receipt'
import { PrintButton } from '@/components/receipt/print-button'

/** 返金した入金の適格返還請求書。参照: docs/design/12-review-followups.md §12.2 */
export default async function AdminCreditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb(appEnv().DB)

  const receipt = await getReceiptForPayment(db, id, 'credit_note')
  if (!receipt) notFound()

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <PrintButton />
      </div>
      <Receipt {...receipt} />
    </div>
  )
}
