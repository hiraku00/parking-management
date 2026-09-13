import Link from 'next/link'
import { redirect } from 'next/navigation'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { requireContractor } from '@/lib/auth/contractor-session'
import { getLastUsedPaymentMethod, getUnpaidInvoicesForContractor } from '@/lib/services/queries'
import { getSettings } from '@/lib/services/settings'
import { formatMonthJa } from '@/lib/domain/time'
import { formatYen } from '@/lib/domain/money'
import { MethodForm } from './method-form'

/**
 * お支払い ステップ2/2: 支払い方法を選ぶ。参照: docs/design/09-ux-improvements.md §9.4.3
 */
export default async function PayMethodPage({ searchParams }: { searchParams: Promise<{ count?: string }> }) {
  const { count: countParam } = await searchParams
  const count = Number(countParam ?? '')

  const db = getDb(appEnv().DB)
  const contractor = await requireContractor(db)
  const settings = await getSettings(db)

  if (!settings.cardPaymentEnabled && !settings.bankTransferEnabled) {
    redirect('/portal/pay')
  }

  const unpaid = (await getUnpaidInvoicesForContractor(db, contractor.id, new Date())).filter(
    (i) => !i.hasPendingAllocation,
  )
  if (!Number.isInteger(count) || count < 1 || count > unpaid.length) {
    redirect('/portal/pay')
  }

  const targets = unpaid.slice(0, count)
  const amount = targets.reduce((sum, i) => sum + i.remaining, 0)
  const monthsLabel = targets.map((i) => formatMonthJa(i.month)).join('と')

  const lastMethod = await getLastUsedPaymentMethod(db, contractor.id)
  const defaultMethod: 'card' | 'bank_transfer' =
    lastMethod === 'bank_transfer' && settings.bankTransferEnabled
      ? 'bank_transfer'
      : settings.cardPaymentEnabled
        ? 'card'
        : 'bank_transfer'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href={`/portal/pay?count=${count}`} className="min-h-12 text-base text-primary hover:underline">
          ‹ 戻る
        </Link>
        <p className="text-base text-muted-foreground">ステップ 2/2</p>
      </div>

      <div className="space-y-1">
        <p className="text-lg font-bold text-slate-900">{monthsLabel}分</p>
        <p className="text-2xl font-bold text-slate-900">{formatYen(amount)}</p>
      </div>

      <p className="text-base font-medium text-slate-900">お支払い方法を選んでください</p>

      <MethodForm
        count={count}
        cardEnabled={settings.cardPaymentEnabled}
        bankTransferEnabled={settings.bankTransferEnabled}
        defaultMethod={defaultMethod}
      />
    </div>
  )
}
