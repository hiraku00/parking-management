import Link from 'next/link'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { requireContractor } from '@/lib/auth/contractor-session'
import { getUnpaidInvoicesForContractor } from '@/lib/services/queries'
import { getSettings } from '@/lib/services/settings'
import { formatMonthJa } from '@/lib/domain/time'
import { PayForm } from './pay-form'

export default async function PayPage() {
  const db = getDb(appEnv().DB)
  const contractor = await requireContractor(db)
  const settings = await getSettings(db)

  const unpaid = (await getUnpaidInvoicesForContractor(db, contractor.id, new Date())).filter(
    (i) => !i.hasPendingAllocation,
  )

  if (unpaid.length === 0) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-base text-slate-700">お支払いが必要な月はありません。</p>
        <Link href="/portal" className="text-primary hover:underline">
          ‹ 戻る
        </Link>
      </div>
    )
  }

  return (
    <PayForm
      invoices={unpaid.map((i) => ({ month: formatMonthJa(i.month), remaining: i.remaining }))}
      cardEnabled={settings.cardPaymentEnabled}
      bankTransferEnabled={settings.bankTransferEnabled}
    />
  )
}
