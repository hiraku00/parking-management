import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { renderSVG } from 'uqr'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { contractors } from '@/lib/db/schema'
import { getSettings } from '@/lib/services/settings'
import { originFromHeaders } from '@/lib/http/origin'
import { Button } from '@/components/ui/button'
import { PrintButton } from './print-button'

/**
 * 印刷用のログインカード。トークンはこの場限りで、DBにはハッシュしか
 * 保存しないため、契約者詳細の「再発行」でこのページへredirectする
 * （tokenクエリに載せる）ことでしか表示できない。GETでの再表示・
 * ブックマークではトークンを再現できない（意図的：GETに副作用を持たせない）。
 * 参照: docs/design/07-screens.md §7.4「印刷用」
 */
export default async function LoginCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { id } = await params
  const { token } = await searchParams
  const db = getDb(appEnv().DB)

  const contractor = await db.query.contractors.findFirst({ where: eq(contractors.id, id) })
  if (!contractor) notFound()

  if (!token) {
    return (
      <div className="mx-auto max-w-sm space-y-4 p-8 text-center">
        <p className="text-base text-slate-700">
          表示できるログインカードがありません。契約者詳細画面から「ログインカードを発行」してください。
        </p>
        <Button asChild variant="outline">
          <Link href={`/admin/contractors/${id}`}>契約者詳細へ戻る</Link>
        </Button>
      </div>
    )
  }

  const settings = await getSettings(db)
  const origin = originFromHeaders(await headers())
  const loginUrl = `${origin}/l/${token}`
  const qrSvg = renderSVG(loginUrl, { border: 1 })

  return (
    <div className="mx-auto max-w-sm space-y-4 p-6 print:p-0">
      <div className="print:hidden">
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/contractors/${id}`}>‹ 契約者詳細へ戻る</Link>
        </Button>
      </div>

      <div className="space-y-3 rounded-lg border-2 border-slate-300 p-6 text-center print:border-black">
        <p className="text-sm font-medium text-slate-600">{settings.businessName || '駐車場'}</p>
        <p className="text-xl font-bold text-slate-900">{contractor.name} 様</p>
        {/* uqrが生成した自前のSVG（外部入力ではない） */}
        <div className="mx-auto w-48" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <p className="text-sm font-bold text-slate-900">スマホのカメラで読み取ってください</p>
        <p className="break-all font-mono text-xs text-slate-400">{loginUrl}</p>
        {settings.businessPhone && (
          <p className="text-xs text-slate-500">お問い合わせ: {settings.businessPhone}</p>
        )}
      </div>

      <div className="print:hidden">
        <PrintButton />
      </div>
    </div>
  )
}
