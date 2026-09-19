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
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-[rgb(238_240_245_/_94%)] backdrop-blur-md print:hidden">
        <div className="app-shell !py-0">
          <div className="flex flex-wrap items-center gap-y-2 py-3 sm:flex-nowrap">
            <Link href="/admin" className="order-1 text-lg font-bold text-slate-900">
              駐車場管理
            </Link>
            <div className="order-2 ml-auto flex items-center gap-4 sm:order-3 sm:ml-0">
              {owner && <span className="hidden text-sm text-muted-foreground sm:inline">{owner.email}</span>}
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/logout">ログアウト</Link>
              </Button>
            </div>
          </div>
          <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto pb-2 sm:order-2">
            <Link
              href="/admin"
              className="shrink-0 rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-[var(--blue-soft)] hover:text-[var(--blue-strong)]"
            >
              ダッシュボード
            </Link>
            <Link
              href="/admin/contractors"
              className="shrink-0 rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-[var(--blue-soft)] hover:text-[var(--blue-strong)]"
            >
              契約者一覧
            </Link>
            <Link
              href="/admin/payments"
              className="shrink-0 rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-[var(--blue-soft)] hover:text-[var(--blue-strong)]"
            >
              入金
              {pendingTransferCount > 0 && (
                <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-[var(--danger)] text-xs font-bold text-white">
                  {pendingTransferCount}
                </span>
              )}
            </Link>
            <Link
              href="/admin/settings"
              className="shrink-0 rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-[var(--blue-soft)] hover:text-[var(--blue-strong)]"
            >
              設定
            </Link>
            <Link
              href="/admin/audit"
              className="shrink-0 rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-[var(--blue-soft)] hover:text-[var(--blue-strong)]"
            >
              操作履歴
            </Link>
          </nav>
        </div>
      </header>
      <main className="app-shell">{children}</main>
      <Toaster position="top-center" />
    </div>
  )
}
