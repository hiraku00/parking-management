import Link from 'next/link'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { getSettings } from '@/lib/services/settings'
import { LoginForm } from './login-form'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ invalid?: string; expired?: string }>
}) {
  const { invalid, expired } = await searchParams
  const db = getDb(appEnv().DB)
  const settings = await getSettings(db)
  const title = settings.businessName ? `${settings.businessName} お支払いページ` : '駐車場 お支払いページ'

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">🅿️ {title}</h1>
        </div>

        {invalid && (
          <div className="rounded-md bg-destructive/10 p-4 text-base leading-relaxed text-destructive">
            QRコードが無効です。お手数ですが、駐車場の管理者にご連絡ください。
          </div>
        )}
        {expired && !invalid && (
          <div className="rounded-md bg-amber-50 p-4 text-base leading-relaxed text-amber-900">
            ログインの有効期限が切れました。もう一度ログインしてください。
          </div>
        )}

        <LoginForm />

        <p className="text-center text-sm leading-relaxed text-muted-foreground">
          QRコードをお持ちの方は、スマホのカメラで読み取るだけでログインできます
        </p>

        <div className="text-right">
          <Link href="/admin" className="text-sm text-muted-foreground hover:underline">
            管理者の方 ›
          </Link>
        </div>

        <div className="flex justify-center gap-4 text-xs text-muted-foreground">
          <Link href="/legal/tokushoho" className="hover:underline">
            特定商取引法に基づく表記
          </Link>
          <Link href="/legal/privacy" className="hover:underline">
            プライバシーポリシー
          </Link>
        </div>
      </div>
    </main>
  )
}
