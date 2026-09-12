import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { getSettings } from '@/lib/services/settings'

const ROWS = (settings: Awaited<ReturnType<typeof getSettings>>) => [
  { label: '販売事業者', value: settings.businessName || '未設定' },
  { label: '所在地', value: settings.businessAddress || '未設定' },
  { label: '連絡先', value: settings.businessPhone || '未設定' },
  {
    label: '販売価格',
    value: '契約者ごとの月額駐車場使用料（契約時にご案内した金額）',
  },
  { label: 'お支払い方法', value: 'クレジットカード（Stripe）、銀行振込、現金' },
  { label: 'お支払い時期', value: '毎月、当月分または翌月分を前払いでお支払いいただきます。' },
  { label: 'サービス提供時期', value: 'お支払い確認後、契約期間中ご利用いただけます。' },
  {
    label: 'キャンセル・返金について',
    value:
      '月極駐車場契約の解約は契約者よりお申し出ください。既にお支払い済みの期間の日割り返金は原則として行いません。',
  },
]

/** 特定商取引法に基づく表記。設定の事業者情報を表示する。参照: docs/design/01-requirements.md P-1 */
export default async function TokushohoPage() {
  const db = getDb(appEnv().DB)
  const settings = await getSettings(db)

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-bold text-slate-900">特定商取引法に基づく表記</h1>
      <dl className="divide-y rounded-lg border bg-white">
        {ROWS(settings).map((row) => (
          <div key={row.label} className="grid grid-cols-1 gap-1 p-4 sm:grid-cols-3 sm:gap-4">
            <dt className="font-medium text-slate-700">{row.label}</dt>
            <dd className="text-slate-900 sm:col-span-2">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
