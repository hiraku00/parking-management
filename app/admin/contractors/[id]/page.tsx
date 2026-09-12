import { notFound } from 'next/navigation'
import { and, eq, inArray } from 'drizzle-orm'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { contractors, invoices, paymentAllocations } from '@/lib/db/schema'
import { formatYen } from '@/lib/domain/money'
import { formatDateJa, formatMonthJa, type YearMonth } from '@/lib/domain/time'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ContractorForm } from '../contractor-form'
import { updateContractorAction } from '../actions'
import { VoidInvoiceForm } from './void-invoice-form'
import { ArchiveButton } from './archive-button'
import { LoginSection } from './login-section'

const STATUS_LABEL: Record<string, string> = { open: '未払い', paid: '支払済み', void: '免除' }
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  open: 'outline',
  paid: 'default',
  void: 'secondary',
}

export default async function ContractorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb(appEnv().DB)

  const contractor = await db.query.contractors.findFirst({ where: eq(contractors.id, id) })
  if (!contractor) notFound()
  const now = new Date()

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
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">{contractor.name}</h1>
        {contractor.archivedAt && <Badge variant="secondary">契約終了済み</Badge>}
      </div>

      {!contractor.archivedAt && (
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>請求</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>対象月</TableHead>
                <TableHead>金額</TableHead>
                <TableHead>入金済み額</TableHead>
                <TableHead>状態</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoiceRows.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{formatMonthJa(inv.month as YearMonth)}</TableCell>
                  <TableCell>{formatYen(inv.amount)}</TableCell>
                  <TableCell>{formatYen(appliedByInvoice.get(inv.id) ?? 0)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    {inv.status === 'open' && (
                      <VoidInvoiceForm
                        invoiceId={inv.id}
                        contractorId={id}
                        month={formatMonthJa(inv.month as YearMonth)}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {invoiceRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    請求がまだありません。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!contractor.archivedAt && (
        <Card>
          <CardHeader>
            <CardTitle>ログイン</CardTitle>
          </CardHeader>
          <CardContent>
            <LoginSection
              contractorId={id}
              loginTokenIssuedAtLabel={
                contractor.loginTokenIssuedAt ? formatDateJa(contractor.loginTokenIssuedAt) : null
              }
              isLocked={Boolean(contractor.lockedUntil && contractor.lockedUntil.getTime() > now.getTime())}
              lockedUntilLabel={contractor.lockedUntil ? formatDateJa(contractor.lockedUntil) : null}
            />
          </CardContent>
        </Card>
      )}

      {!contractor.archivedAt && (
        <section className="border-t pt-6">
          <ArchiveButton contractorId={id} contractorName={contractor.name} />
        </section>
      )}
    </div>
  )
}
