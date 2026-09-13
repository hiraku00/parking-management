import Link from 'next/link'
import { notFound } from 'next/navigation'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { requireContractor } from '@/lib/auth/contractor-session'
import { getReceiptForPayment } from '@/lib/services/queries'
import { Receipt } from '@/components/receipt/Receipt'
import { PrintButton } from '@/components/receipt/print-button'

/** 参照: docs/design/09-ux-improvements.md §9.4.7（同じタブで開き、上部に戻る導線を出す） */
export default async function PortalReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb(appEnv().DB)
  const contractor = await requireContractor(db)

  const receipt = await getReceiptForPayment(db, id)
  if (!receipt || receipt.contractorId !== contractor.id) notFound()

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <Link href="/portal" className="min-h-12 text-base text-primary hover:underline">
          ‹ ホームに戻る
        </Link>
      </div>
      <div className="space-y-2 print:hidden">
        <PrintButton />
        <p className="text-base text-muted-foreground">
          PDFで残すときは、印刷の画面で「PDFとして保存」を選んでください。
        </p>
      </div>
      <Receipt {...receipt} />
    </div>
  )
}
