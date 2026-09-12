import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { getSettings } from '@/lib/services/settings'

/** プライバシーポリシー。設定の事業者情報を表示する。
 *  参照: docs/design/01-requirements.md P-2, docs/design/05-auth-security.md §5.7 */
export default async function PrivacyPage() {
  const db = getDb(appEnv().DB)
  const settings = await getSettings(db)

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 text-slate-900">
      <h1 className="text-2xl font-bold">プライバシーポリシー</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">1. 取得する情報</h2>
        <p>
          {settings.businessName || '当駐車場'}
          （以下「当方」といいます）は、駐車場のご契約・お支払い管理のため、氏名、フリガナ、電話番号、区画、入金に関する情報を取得します。クレジットカード番号等の決済情報は当方では保存せず、決済代行会社（Stripe,
          Inc.）が管理します。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">2. 利用目的</h2>
        <p>
          取得した情報は、駐車場契約の管理、毎月の請求・入金確認、領収書の発行、契約者へのご連絡のためにのみ利用します。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">3. 第三者提供</h2>
        <p>
          カード決済の処理のため、決済に必要な範囲の情報を決済代行会社（Stripe,
          Inc.）に提供します。それ以外の目的で第三者に提供することはありません。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">4. 保存期間</h2>
        <p>契約期間中および契約終了後、法令上必要な期間（会計帳簿等の保存義務に基づく期間）保存します。</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">5. お問い合わせ先</h2>
        <p>
          {settings.businessName || '当駐車場'}
          {settings.businessPhone && <> （TEL: {settings.businessPhone}）</>}
        </p>
      </section>
    </div>
  )
}
