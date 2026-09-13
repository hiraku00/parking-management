import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { requireContractor } from '@/lib/auth/contractor-session'
import { syncInvoices } from '@/lib/services/invoices'
import { Button } from '@/components/ui/button'
import { logoutAction } from '../actions'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const db = getDb(appEnv().DB)
  const contractor = await requireContractor(db)

  // 表示前に必ず最新化する（D10: syncInvoicesは画面表示のたびに呼ぶ冪等な関数）
  await syncInvoices(db, { contractorIds: [contractor.id], now: new Date() })

  return (
    <div className="min-h-screen bg-slate-50 text-lg">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">駐車場管理システム</h1>
            <p className="text-base text-muted-foreground">ようこそ、{contractor.name}さん</p>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm" className="min-h-12">
              ログアウト
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
    </div>
  )
}
