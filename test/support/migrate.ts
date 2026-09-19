// migrations/*.sql を、D1（vitest-pluginが用意するテスト用インスタンス）へ
// 順番に流し込む。drizzle-kitが挿入する `--> statement-breakpoint` で分割し、
// 1ファイルごとに1文ずつ prepare して batch で流す。
import migration0000 from '../../migrations/0000_init.sql?raw'
import migration0001 from '../../migrations/0001_flat_dakota_north.sql?raw'
import migration0002 from '../../migrations/0002_curvy_wallow.sql?raw'

// migrations/*.sql が増えたら、番号順にここへ追加する
// （wrangler d1 migrations apply と同じ適用順を、テストでも再現するため）。
const MIGRATIONS = [migration0000, migration0001, migration0002]

const TABLES_IN_FK_SAFE_DELETE_ORDER = [
  'payment_allocations',
  'receipts',
  'stripe_events',
  'audit_logs',
  'payments',
  'invoices',
  'contractors',
  'settings',
]

function statements(sql: string): string[] {
  return sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** テストファイルの最初に1回だけ呼ぶ。D1のストレージはテストファイル単位で
 *  分離されるが、同じファイル内の複数の it() の間では共有されるため、
 *  スキーマの作成は1回だけにし、行の削除は resetData() で行う。 */
export async function migrate(db: D1Database): Promise<void> {
  for (const sql of MIGRATIONS) {
    const stmts = statements(sql)
    await db.batch(stmts.map((s) => db.prepare(s)) as [D1PreparedStatement, ...D1PreparedStatement[]])
  }
}

/** 同じファイル内の各テストの前に呼び、前のテストのデータを空にする。
 *  外部キー制約に違反しない順（子→親）で削除する。 */
export async function resetData(db: D1Database): Promise<void> {
  const deletes = TABLES_IN_FK_SAFE_DELETE_ORDER.map((table) => db.prepare(`DELETE FROM ${table}`))
  await db.batch(deletes as [D1PreparedStatement, ...D1PreparedStatement[]])
}
