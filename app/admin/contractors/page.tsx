import Link from 'next/link'
import { isNull } from 'drizzle-orm'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { contractors } from '@/lib/db/schema'
import { formatYen } from '@/lib/domain/money'

export default async function ContractorsPage() {
  const db = getDb(appEnv().DB)
  const rows = await db
    .select()
    .from(contractors)
    .where(isNull(contractors.archivedAt))
    .orderBy(contractors.name)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">契約者一覧</h1>
        <Link
          href="/admin/contractors/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          契約者を追加
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-slate-600">
              <th className="px-3 py-2 font-medium">氏名</th>
              <th className="px-3 py-2 font-medium">区画</th>
              <th className="px-3 py-2 font-medium">電話番号</th>
              <th className="px-3 py-2 font-medium">月額料金</th>
              <th className="px-3 py-2 font-medium">契約期間</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/contractors/${c.id}`}
                    className="font-medium text-indigo-700 hover:underline"
                  >
                    {c.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-slate-600">{c.spaceLabel ?? '-'}</td>
                <td className="px-3 py-2 text-slate-600">{c.phone}</td>
                <td className="px-3 py-2 text-slate-600">{formatYen(c.monthlyFee)}</td>
                <td className="px-3 py-2 text-slate-600">
                  {c.contractStartMonth} 〜 {c.contractEndMonth ?? '無期限'}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  契約者が見つかりません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
