import Link from 'next/link'
import { isNull } from 'drizzle-orm'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { contractors } from '@/lib/db/schema'
import { formatYen } from '@/lib/domain/money'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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
        <Button asChild>
          <Link href="/admin/contractors/new">契約者を追加</Link>
        </Button>
      </div>

      <div className="rounded-[var(--radius-card)] border border-white/90 bg-[var(--surface)] shadow-[var(--shadow-card)]">
        <Table className="data-table">
          <TableHeader>
            <TableRow>
              <TableHead>氏名</TableHead>
              <TableHead>区画</TableHead>
              <TableHead>電話番号</TableHead>
              <TableHead>月額料金</TableHead>
              <TableHead>契約期間</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell data-label="氏名" data-span-all>
                  <Link
                    href={`/admin/contractors/${c.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell data-label="区画" className="text-muted-foreground">
                  {c.spaceLabel ?? '-'}
                </TableCell>
                <TableCell data-label="電話番号" className="text-muted-foreground">
                  {c.phone}
                </TableCell>
                <TableCell data-label="月額料金" className="text-muted-foreground">
                  {formatYen(c.monthlyFee)}
                </TableCell>
                <TableCell data-label="契約期間" data-span-all className="text-muted-foreground">
                  {c.contractStartMonth} 〜 {c.contractEndMonth ?? '無期限'}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  契約者が見つかりません。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
