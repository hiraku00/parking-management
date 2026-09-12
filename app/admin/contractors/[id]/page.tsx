import { notFound } from 'next/navigation'
import { and, eq, inArray } from 'drizzle-orm'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { contractors, invoices, paymentAllocations } from '@/lib/db/schema'
import { formatYen } from '@/lib/domain/money'
import { formatMonthJa, type YearMonth } from '@/lib/domain/time'
import { ContractorForm } from '../contractor-form'
import { updateContractorAction } from '../actions'
import { VoidInvoiceForm } from './void-invoice-form'
import { ArchiveButton } from './archive-button'

const STATUS_LABEL: Record<string, string> = { open: '未払い', paid: '支払済み', void: '免除' }

export default async function ContractorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb(appEnv().DB)

  const contractor = await db.query.contractors.findFirst({ where: eq(contractors.id, id) })
  if (!contractor) notFound()

  const invoiceRows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.contractorId, id))
    .orderBy(invoices.month)

  const invoiceIds = invoiceRows.map((i) => i.id)
  const allocationRows =
    invoiceIds.length > 0
      ? await db
          .select()
          .from(paymentAllocations)
          .where(
            and(inArray(paymentAllocations.invoiceId, invoiceIds), eq(paymentAllocations.state, 'applied')),
          )
      : []
  const appliedByInvoice = new Map<string, number>()
  for (const a of allocationRows) {
    appliedByInvoice.set(a.invoiceId, (appliedByInvoice.get(a.invoiceId) ?? 0) + a.amount)
  }

  const boundUpdateAction = updateContractorAction.bind(null, id)

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{contractor.name}</h1>
        {contractor.archivedAt && (
          <span className="mt-1 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
            契約終了済み
          </span>
        )}
      </div>

      {!contractor.archivedAt && (
        <section className="space-y-3">
          <h2 className="font-semibold text-slate-900">基本情報</h2>
          <div className="rounded-lg border bg-white p-6">
            <ContractorForm
              action={boundUpdateAction}
              showFeeChangeOption
              initialValues={{
                name: contractor.name,
                nameKana: contractor.nameKana ?? '',
                phone: contractor.phone,
                spaceLabel: contractor.spaceLabel ?? '',
                monthlyFee: contractor.monthlyFee,
                contractStartMonth: contractor.contractStartMonth,
                contractEndMonth: contractor.contractEndMonth ?? '',
                note: contractor.note ?? '',
              }}
            />
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold text-slate-900">請求</h2>
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-slate-600">
                <th className="px-3 py-2 font-medium">対象月</th>
                <th className="px-3 py-2 font-medium">金額</th>
                <th className="px-3 py-2 font-medium">入金済み額</th>
                <th className="px-3 py-2 font-medium">状態</th>
                <th className="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {invoiceRows.map((inv) => (
                <tr key={inv.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{formatMonthJa(inv.month as YearMonth)}</td>
                  <td className="px-3 py-2">{formatYen(inv.amount)}</td>
                  <td className="px-3 py-2">{formatYen(appliedByInvoice.get(inv.id) ?? 0)}</td>
                  <td className="px-3 py-2">{STATUS_LABEL[inv.status]}</td>
                  <td className="px-3 py-2">
                    {inv.status === 'open' && (
                      <VoidInvoiceForm invoiceId={inv.id} contractorId={id} month={inv.month} />
                    )}
                  </td>
                </tr>
              ))}
              {invoiceRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                    請求がまだありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {!contractor.archivedAt && (
        <section className="border-t pt-6">
          <ArchiveButton contractorId={id} contractorName={contractor.name} />
        </section>
      )}
    </div>
  )
}
