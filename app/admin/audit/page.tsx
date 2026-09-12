import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { getAuditLogs } from '@/lib/services/queries'
import { formatDateJa } from '@/lib/domain/time'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const ACTION_LABEL: Record<string, string> = {
  'contractor.create': '契約者を登録',
  'contractor.update': '契約者を更新',
  'contractor.fee_change': '月額料金を変更',
  'contractor.archive': '契約者をアーカイブ',
  'contractor.shrink_contract_period': '契約期間を変更',
  'contractor.reissue_login_token': 'ログインカードを再発行',
  'contractor.invalidate_sessions': 'ログインを無効化',
  'contractor.unlock': 'ロックを解除',
  'invoice.void': '請求を免除',
  'payment.succeed': '入金を確定',
  'payment.reject': '振込を却下',
  'payment.record_manual': '入金を手動記録',
  'payment.amount_mismatch': '金額不一致（要確認）',
  'settings.update': '設定を更新',
}

/** 参照: docs/design/07-screens.md（`/admin/audit` 操作履歴） */
export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  const { before } = await searchParams
  const db = getDb(appEnv().DB)
  const { entries, hasMore } = await getAuditLogs(db, {
    before: before ? new Date(Number(before)) : undefined,
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">操作履歴</h1>

      <Card>
        <CardHeader>
          <CardTitle>監査ログ（新しい順）</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日時</TableHead>
                <TableHead>操作</TableHead>
                <TableHead>対象</TableHead>
                <TableHead>実行者</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">{formatDateJa(e.createdAt)}</TableCell>
                  <TableCell>{ACTION_LABEL[e.action] ?? e.action}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.entityType}:{e.entityId}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.actor}</TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    記録がまだありません。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {hasMore && entries.length > 0 && (
        <div className="text-center">
          <a
            href={`/admin/audit?before=${entries[entries.length - 1].createdAt.getTime()}`}
            className="text-sm text-primary hover:underline"
          >
            さらに読み込む
          </a>
        </div>
      )}
    </div>
  )
}
