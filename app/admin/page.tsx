import Link from 'next/link'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { syncInvoices } from '@/lib/services/invoices'
import { getDashboardKpi, getPaymentMatrix, getPendingTransfers } from '@/lib/services/queries'
import { getSettings } from '@/lib/services/settings'
import { formatMonthJa } from '@/lib/domain/time'
import { formatYen } from '@/lib/domain/money'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { matrixStatus, MATRIX_STATUS_ORDER } from '@/lib/design/status'

const MATRIX_MONTH_OPTIONS = [3, 6, 12] as const
type MatrixMonths = (typeof MATRIX_MONTH_OPTIONS)[number]

function parseMatrixMonths(value: string | undefined): MatrixMonths {
  const n = Number(value)
  return (MATRIX_MONTH_OPTIONS as readonly number[]).includes(n) ? (n as MatrixMonths) : 12
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ months?: string }>
}) {
  const { months: monthsParam } = await searchParams
  const matrixMonths = parseMatrixMonths(monthsParam)

  const db = getDb(appEnv().DB)
  const now = new Date()

  // 表示前に必ず最新化する（D10: syncInvoicesは画面表示のたびに呼ぶ冪等な関数）
  await syncInvoices(db, { contractorIds: 'all', now })

  const settings = await getSettings(db)
  const [kpi, pendingTransfers, matrix] = await Promise.all([
    getDashboardKpi(db, now, settings.paymentDueDay),
    getPendingTransfers(db),
    getPaymentMatrix(db, now, settings.paymentDueDay, matrixMonths),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">ダッシュボード</h1>
        <p className="text-sm text-muted-foreground">{formatMonthJa(kpi.month)}の状況</p>
      </div>

      <div className="kpi-grid">
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
        <Card>
          <CardHeader>
            <CardTitle>🔔 要対応: 確認待ちの振込（{pendingTransfers.length}件）</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <ul className="space-y-1 text-sm">
              {pendingTransfers.map((t) => (
                <li key={t.paymentId} className="flex items-center justify-between gap-3 py-1">
                  <span>
                    <Link
                      href={`/admin/contractors/${t.contractorId}`}
                      className="font-medium hover:underline"
                    >
                      {t.contractorName}
                    </Link>
                    <span className="text-muted-foreground">
                      {' '}
                      — {formatYen(t.amount)}（{t.payerName ?? '名義不明'} / {t.paidOn ?? '日付不明'}）
                    </span>
                  </span>
                  <Link
                    href={`/admin/payments/${t.paymentId}`}
                    className="btn btn--primary"
                    style={{ minHeight: 34, padding: '0 12px', fontSize: 13 }}
                  >
                    確認する
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-slate-900">入金マトリクス（直近{matrixMonths}か月）</h2>
          <div className="period-control">
            {MATRIX_MONTH_OPTIONS.map((m) => (
              <Link key={m} href={`/admin?months=${m}`} className={m === matrixMonths ? 'active' : ''}>
                {m}か月
              </Link>
            ))}
          </div>
        </div>
        <div className="matrix-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th className="matrix-name">契約者</th>
                {matrix.months.map((m) => (
                  <th key={m}>{m.slice(5)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row) => (
                <tr key={row.contractorId}>
                  <td className="matrix-name">
                    <Link href={`/admin/contractors/${row.contractorId}`} className="hover:underline">
                      {row.contractorName}
                    </Link>
                  </td>
                  {matrix.months.map((m) => {
                    const status = row.cells[m] ?? 'not_applicable'
                    const s = matrixStatus(status)
                    const Icon = s.icon
                    return (
                      <td key={m}>
                        <Link
                          href={`/admin/contractors/${row.contractorId}`}
                          className={`matrix-cell matrix-cell--${s.tone}`}
                          aria-label={`${row.contractorName} ${m.slice(5)}月 ${s.label}`}
                          title={s.label}
                        >
                          <Icon />
                        </Link>
                      </td>
                    )
                  })}
                </tr>
              ))}
              {matrix.rows.length === 0 && (
                <tr>
                  <td
                    colSpan={matrix.months.length + 1}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    契約者がまだ登録されていません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="matrix-legend">
          {MATRIX_STATUS_ORDER.map((kind) => {
            const s = matrixStatus(kind)
            const Icon = s.icon
            return (
              <span key={kind} className={`matrix-legend-item tone-${s.tone}`}>
                <Icon />
                {s.label}
              </span>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone?: 'warn' | 'danger' }) {
  return (
    <div className={`kpi${tone === 'danger' ? ' kpi--alert' : ''}`}>
      <p className="label">{label}</p>
      <strong className={tone === 'danger' ? 'tone-danger' : tone === 'warn' ? 'tone-warn' : ''}>
        {value}
      </strong>
    </div>
  )
}
