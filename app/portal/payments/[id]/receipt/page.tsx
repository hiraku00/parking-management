import { notFound } from 'next/navigation'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { requireContractor } from '@/lib/auth/contractor-session'
import { getReceiptForPayment } from '@/lib/services/queries'
import { Receipt } from '@/components/receipt/Receipt'
import { PrintButton } from '@/components/receipt/print-button'

export default async function PortalReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb(appEnv().DB)
  const contractor = await requireContractor(db)

  const receipt = await getReceiptForPayment(db, id)
  if (!receipt || receipt.contractorId !== contractor.id) notFound()

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <PrintButton />
      </div>
      <Receipt {...receipt} />
    </div>
  )
}
