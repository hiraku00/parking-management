import type { Db } from '../db/client'
import { auditLogs } from '../db/schema'

/**
 * 操作の主体。audit_logs.actor にはこれを文字列化して保存する。
 * 参照: docs/design/05-auth-security.md, docs/design/04-data-model.md
 */
export type Actor =
  | { kind: 'owner'; email: string }
  | { kind: 'contractor'; id: string }
  | { kind: 'stripe' }
  | { kind: 'system' }

export function actorLabel(actor: Actor): string {
  switch (actor.kind) {
    case 'owner':
      return `owner:${actor.email}`
    case 'contractor':
      return `contractor:${actor.id}`
    case 'stripe':
      return 'stripe'
    case 'system':
      return 'system'
  }
}

export type AuditEntry = {
  actor: Actor
  action: string
  entityType: string
  entityId: string
  detail?: Record<string, unknown>
  /** Webhook等の重複実行を防ぐためのキー（例: `fulfill:${paymentId}`）。省略可。 */
  dedupeKey?: string
}

/**
 * 監査ログの挿入文を作る。他の書き込みと同じ `db.batch([...])` に含めて、
 * 操作とログ記録を同じトランザクションにする。単体では実行しない。
 */
export function auditLogInsert(db: Db, entry: AuditEntry) {
  return db.insert(auditLogs).values({
    actor: actorLabel(entry.actor),
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    detail: entry.detail,
    dedupeKey: entry.dedupeKey,
  })
}
