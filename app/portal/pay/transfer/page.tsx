import { redirect } from 'next/navigation'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { requireContractor } from '@/lib/auth/contractor-session'
import { getUnpaidInvoicesForContractor } from '@/lib/services/queries'
import { getSettings } from '@/lib/services/settings'
import { todayJst } from '@/lib/domain/time'
import { formatYen } from '@/lib/domain/money'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TransferForm } from './transfer-form'

export default async function TransferPage({ searchParams }: { searchParams: Promise<{ count?: string }> }) {
  const { count: countParam } = await searchParams
  const count = Number(countParam ?? '1')

  const db = getDb(appEnv().DB)
  const contractor = await requireContractor(db)
  const settings = await getSettings(db)

  const unpaid = (await getUnpaidInvoicesForContractor(db, contractor.id, new Date())).filter(
    (i) => !i.hasPendingAllocation,
  )
  const targets = unpaid.slice(0, count)
  if (!Number.isInteger(count) || count < 1 || targets.length < count || !settings.bankTransferEnabled) {
    redirect('/portal/pay')
  }

  const amount = targets.reduce((sum, i) => sum + i.remaining, 0)
  const today = todayJst(new Date())

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>振込先</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-base text-slate-900">
          <p>
            {settings.bankName} {settings.bankBranch}
          </p>
          <p>
            {settings.bankAccountType} {settings.bankAccountNumber}
          </p>
          <p>{settings.bankAccountHolderKana}</p>
          <p className="pt-3 text-2xl font-bold">お振込金額 {formatYen(amount)}</p>
        </CardContent>
      </Card>

      <TransferForm
        count={count}
        defaultPayerName={contractor.nameKana ?? ''}
        defaultPaidOn={today}
        maxDate={today}
      />
    </div>
  )
}
