import { redirect } from 'next/navigation'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { requireContractor } from '@/lib/auth/contractor-session'
import { getUnpaidInvoicesForContractor } from '@/lib/services/queries'
import { getSettings } from '@/lib/services/settings'
import { todayJst } from '@/lib/domain/time'
import { formatYen } from '@/lib/domain/money'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CopyButton } from '@/components/portal/copy-button'
import { TransferForm } from './transfer-form'

export default async function TransferPage({ searchParams }: { searchParams: Promise<{ count?: string }> }) {
  const { count: countParam } = await searchParams
  const count = Number(countParam ?? '1')

  const db = getDb(appEnv().DB)
  const contractor = await requireContractor(db)
  const settings = await getSettings(db)

  const unpaid = (
    await getUnpaidInvoicesForContractor(db, contractor.id, new Date(), settings.paymentDueDay)
  ).filter((i) => !i.hasPendingAllocation)
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
        <CardContent className="space-y-3 text-base text-slate-900">
          <div className="flex items-center justify-between gap-3">
            <p>
              {settings.bankName} {settings.bankBranch}
            </p>
            <CopyButton value={`${settings.bankName ?? ''} ${settings.bankBranch ?? ''}`.trim()} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p>
              {settings.bankAccountType} {settings.bankAccountNumber}
            </p>
            <CopyButton value={settings.bankAccountNumber ?? ''} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p>{settings.bankAccountHolderKana}</p>
            <CopyButton value={settings.bankAccountHolderKana ?? ''} />
          </div>
          <div className="flex items-center justify-between gap-3 border-t pt-3">
            <p className="text-2xl font-bold">お振込金額 {formatYen(amount)}</p>
            <CopyButton value={String(amount)} />
          </div>
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
