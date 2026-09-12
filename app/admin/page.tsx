import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { syncInvoices } from '@/lib/services/invoices'
import {
  getDashboardKpi,
  getPaymentMatrix,
  getPendingTransfers,
  type MatrixCellStatus,
} from '@/lib/services/queries'
import { formatMonthJa } from '@/lib/domain/time'
import { formatYen } from '@/lib/domain/money'
import Link from 'next/link'

const CELL_LABEL: Record<MatrixCellStatus, string> = {
  paid: '✅',
  partial: '◐',
  pending: '⏳',
  overdue: '⚠️',
  unpaid: '○',
  void: '免',
  not_applicable: '—',
}

const CELL_TITLE: Record<MatrixCellStatus, string> = {
  paid: '支払済み',
  partial: '一部入金',
  pending: '確認中',
  overdue: '滞納',
  unpaid: '未払い',
  void: '免除',
  not_applicable: '対象外',
}

export default async function AdminDashboardPage() {
  const db = getDb(appEnv().DB)
  const now = new Date()

  // 表示前に必ず最新化する（D10: syncInvoicesは画面表示のたびに呼ぶ冪等な関数）
  await syncInvoices(db, { contractorIds: 'all', now })

  const [kpi, pendingTransfers, matrix] = await Promise.all([
    getDashboardKpi(db, now),
    getPendingTransfers(db),
    getPaymentMatrix(db, now, 12),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">ダッシュボード</h1>
        <p className="text-sm text-slate-500">{formatMonthJa(kpi.month)}の状況</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="今月の請求額" value={formatYen(kpi.billedAmount)} />
        <KpiCard label="入金済み" value={formatYen(kpi.collectedAmount)} />
        <KpiCard
          label="未収"
          value={formatYen(kpi.outstandingAmount)}
          tone={kpi.outstandingAmount > 0 ? 'warn' : undefined}
        />
        <KpiCard
          label="滞納している人数"
          value={`${kpi.overdueContractorCount}名`}
          tone={kpi.overdueContractorCount > 0 ? 'danger' : undefined}
        />
      </div>

      {pendingTransfers.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-900">🔔 確認待ちの振込（{pendingTransfers.length}件）</h2>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {pendingTransfers.map((t) => (
              <li key={t.paymentId}>
                <Link href={`/admin/contractors/${t.contractorId}`} className="underline">
                  {t.contractorName}
                </Link>
                {' — '}
                {formatYen(t.amount)}（{t.payerName ?? '名義不明'} / {t.paidOn ?? '日付不明'}）
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-semibold text-slate-900">入金マトリクス（直近12か月）</h2>
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-medium text-slate-600">
                  契約者
                </th>
                {matrix.months.map((m) => (
                  <th key={m} className="px-2 py-2 text-center font-medium text-slate-600">
                    {m.slice(5)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row) => (
                <tr key={row.contractorId} className="border-b last:border-0">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-slate-900">
                    <Link href={`/admin/contractors/${row.contractorId}`} className="hover:underline">
                      {row.contractorName}
                    </Link>
                  </td>
                  {matrix.months.map((m) => {
                    const status = row.cells[m] ?? 'not_applicable'
                    return (
                      <td key={m} className="px-2 py-2 text-center" title={CELL_TITLE[status]}>
                        {CELL_LABEL[status]}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {matrix.rows.length === 0 && (
                <tr>
                  <td colSpan={matrix.months.length + 1} className="px-3 py-6 text-center text-slate-400">
                    契約者がまだ登録されていません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone?: 'warn' | 'danger' }) {
  const toneClass = tone === 'danger' ? 'text-red-600' : tone === 'warn' ? 'text-amber-600' : 'text-slate-900'
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  )
}
