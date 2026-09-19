import { redirect } from 'next/navigation'
import Link from 'next/link'
import { appEnv } from '@/lib/env'
import { Button } from '@/components/ui/button'

/**
 * ログアウトの入口をアプリ内の1ルートに集約する。`/cdn-cgi/access/logout` への
 * 直リンクは本番（Accessの背後）でしか機能せず、ローカル開発では404になる
 * （ローカルはAccessが無く、`DEV_OWNER_EMAIL` でオーナー認証をバイパスしている
 * ため、そもそもログアウトすべきセッションが無い）。
 * 参照: docs/design/12-review-followups.md §12.3
 */
export default function AdminLogoutPage() {
  if (appEnv().APP_ENV === 'production') {
    redirect('/cdn-cgi/access/logout')
  }

  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <p className="text-lg font-bold text-slate-900">開発環境ではログアウトできません</p>
      <p className="text-base text-muted-foreground">
        開発環境の管理者ログインは固定です（DEV_OWNER_EMAIL）。本番環境では、この操作で Cloudflare
        Accessのログアウトに遷移します。
      </p>
      <Button asChild variant="outline">
        <Link href="/admin">ダッシュボードに戻る</Link>
      </Button>
    </div>
  )
}
