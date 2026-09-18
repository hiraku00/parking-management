import { headers } from 'next/headers'
import Link from 'next/link'
import { verifyOwnerRequest } from '@/lib/auth/owner'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { getPendingTransfers } from '@/lib/services/queries'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'

// proxy.ts が /admin* を守っているが、ここでもオーナーのメールを表示用に
// 取得する（未ログインならこの時点で proxy が既に403にしているはずなので、
// null になることは基本無い）。
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const owner = await verifyOwnerRequest(await headers())
  const db = getDb(appEnv().DB)
  const pendingTransferCount = (await getPendingTransfers(db)).length

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-y-3 px-4 py-3 sm:flex-nowrap sm:px-6">
          <Link href="/admin" className="order-1 text-lg font-semibold text-slate-900">
            駐車場管理
          </Link>
          <nav className="order-3 flex w-full items-center gap-6 overflow-x-auto sm:order-2 sm:w-auto sm:flex-1 sm:justify-center sm:overflow-visible">
            <Link href="/admin" className="shrink-0 text-sm font-medium text-slate-600 hover:text-slate-900">
              ダッシュボード
            </Link>
            <Link
              href="/admin/contractors"
              className="shrink-0 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              契約者一覧
            </Link>
            <Link
              href="/admin/payments"
              className="shrink-0 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              入金
              {pendingTransferCount > 0 && (
                <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-white">
                  {pendingTransferCount}
                </span>
              )}
            </Link>
            <Link
              href="/admin/settings"
              className="shrink-0 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              設定
            </Link>
            <Link
              href="/admin/audit"
              className="shrink-0 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              操作履歴
            </Link>
          </nav>
          <div className="order-2 ml-auto flex items-center gap-4 sm:order-3 sm:ml-0">
            {owner && <span className="hidden text-sm text-muted-foreground sm:inline">{owner.email}</span>}
            <Button asChild variant="outline" size="sm">
              <a href="/cdn-cgi/access/logout">ログアウト</a>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      <Toaster position="top-center" />
    </div>
  )
}
