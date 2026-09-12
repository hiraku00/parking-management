import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db/client'
import { appEnv } from '@/lib/env'
import { getReceiptForPayment } from '@/lib/services/queries'
import { Receipt } from '@/components/receipt/Receipt'
import { PrintButton } from '@/components/receipt/print-button'

export default async function AdminReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb(appEnv().DB)

  const receipt = await getReceiptForPayment(db, id)
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
