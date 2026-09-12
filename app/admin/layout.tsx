import { headers } from 'next/headers'
import Link from 'next/link'
import { verifyOwnerRequest } from '@/lib/auth/owner'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'

// proxy.ts が /admin* を守っているが、ここでもオーナーのメールを表示用に
// 取得する（未ログインならこの時点で proxy が既に403にしているはずなので、
// null になることは基本無い）。
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const owner = await verifyOwnerRequest(await headers())

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <nav className="flex items-center gap-6">
            <Link href="/admin" className="text-lg font-semibold text-slate-900">
              駐車場管理
            </Link>
            <Link
              href="/admin/contractors"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              契約者一覧
            </Link>
            <Link href="/admin/settings" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              設定
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            {owner && <span className="text-sm text-muted-foreground">{owner.email}</span>}
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
