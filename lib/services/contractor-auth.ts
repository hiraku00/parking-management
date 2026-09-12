import { and, eq, isNull } from 'drizzle-orm'
import type { Db } from '../db/client'
import { contractors } from '../db/schema'
import { normalizeName } from '../domain/names'
import { generateLoginToken, hashLoginToken } from '../auth/login-token'
import { type Actor, auditLogInsert } from './audit'

const MAX_FAILED_ATTEMPTS = 5
const LOCK_DURATION_MS = 15 * 60 * 1000

export type ContractorLoginResult =
  { ok: true; contractorId: string; sessionVersion: number } | { ok: false; reason: 'invalid' | 'locked' }

/**
 * 予備ログイン（氏名＋電話番号下4桁）。契約者が見つからない場合と、電話番号が
 * 違う場合で、同じ 'invalid' を返す（R6: どちらかを区別すると、契約者名の
 * 存在が推測できてしまう）。5回連続で失敗すると15分ロックする。
 * 参照: docs/design/05-auth-security.md §5.3
 */
export async function attemptContractorLogin(
  db: Db,
  params: { name: string; phoneLast4: string; now: Date },
): Promise<ContractorLoginResult> {
  const loginKey = normalizeName(params.name)
  const contractor = await db.query.contractors.findFirst({
    where: and(eq(contractors.loginKey, loginKey), isNull(contractors.archivedAt)),
  })
  if (!contractor) return { ok: false, reason: 'invalid' }

  if (contractor.lockedUntil && contractor.lockedUntil.getTime() > params.now.getTime()) {
    return { ok: false, reason: 'locked' }
  }

  if (contractor.phoneLast4 !== params.phoneLast4) {
    // ロックが発生する経路（下）は毎回 failedLoginCount を0に戻すので、期限切れの
    // 古いロックが残っていても failedLoginCount は必ず0になっている。
    const failedCount = contractor.failedLoginCount + 1
    const shouldLock = failedCount >= MAX_FAILED_ATTEMPTS
    await db
      .update(contractors)
      .set({
        failedLoginCount: shouldLock ? 0 : failedCount,
        lockedUntil: shouldLock ? new Date(params.now.getTime() + LOCK_DURATION_MS) : null,
        updatedAt: params.now,
      })
      .where(eq(contractors.id, contractor.id))
    return { ok: false, reason: shouldLock ? 'locked' : 'invalid' }
  }

  await db
    .update(contractors)
    .set({ failedLoginCount: 0, lockedUntil: null, updatedAt: params.now })
    .where(eq(contractors.id, contractor.id))
  return { ok: true, contractorId: contractor.id, sessionVersion: contractor.sessionVersion }
}

export type QrLoginResult =
  { ok: true; contractorId: string; sessionVersion: number } | { ok: false; reason: 'invalid' }

/** `/l/[token]` から呼ぶ。トークンをハッシュ化して照合する。 */
export async function attemptQrLogin(db: Db, token: string): Promise<QrLoginResult> {
  const hash = await hashLoginToken(token)
  const contractor = await db.query.contractors.findFirst({
    where: and(eq(contractors.loginTokenHash, hash), isNull(contractors.archivedAt)),
  })
  if (!contractor) return { ok: false, reason: 'invalid' }
  return { ok: true, contractorId: contractor.id, sessionVersion: contractor.sessionVersion }
}

/**
 * ログインカードのQRを再発行する。旧トークンは（ハッシュが変わるので）
 * 即座に無効になり、session_versionも上げるので既存のログインも失効する。
 * 平文のトークンはこの戻り値だけで返し、DBにはハッシュしか保存しない。
 */
export async function reissueLoginToken(
  db: Db,
  contractorId: string,
  actor: Actor,
  now: Date,
): Promise<{ ok: true; token: string } | { ok: false; error: 'not_found' }> {
  const contractor = await db.query.contractors.findFirst({ where: eq(contractors.id, contractorId) })
  if (!contractor || contractor.archivedAt) return { ok: false, error: 'not_found' }

  const token = generateLoginToken()
  const tokenHash = await hashLoginToken(token)
  await db.batch([
    db
      .update(contractors)
      .set({
        loginTokenHash: tokenHash,
        loginTokenIssuedAt: now,
        sessionVersion: contractor.sessionVersion + 1,
        updatedAt: now,
      })
      .where(eq(contractors.id, contractorId)),
    auditLogInsert(db, {
      actor,
      action: 'contractor.reissue_login_token',
      entityType: 'contractor',
      entityId: contractorId,
      detail: {},
    }),
  ])
  return { ok: true, token }
}

/** 既存のログイン（Cookieセッション）をすべて失効させる。QRトークン自体はそのまま。 */
export async function invalidateContractorSessions(
  db: Db,
  contractorId: string,
  actor: Actor,
  now: Date,
): Promise<{ ok: true } | { ok: false; error: 'not_found' }> {
  const contractor = await db.query.contractors.findFirst({ where: eq(contractors.id, contractorId) })
  if (!contractor) return { ok: false, error: 'not_found' }

  await db.batch([
    db
      .update(contractors)
      .set({ sessionVersion: contractor.sessionVersion + 1, updatedAt: now })
      .where(eq(contractors.id, contractorId)),
    auditLogInsert(db, {
      actor,
      action: 'contractor.invalidate_sessions',
      entityType: 'contractor',
      entityId: contractorId,
      detail: {},
    }),
  ])
  return { ok: true }
}

/** 予備ログインのロックを手動で解除する。 */
export async function unlockContractor(
  db: Db,
  contractorId: string,
  actor: Actor,
  now: Date,
): Promise<{ ok: true } | { ok: false; error: 'not_found' }> {
  const contractor = await db.query.contractors.findFirst({ where: eq(contractors.id, contractorId) })
  if (!contractor) return { ok: false, error: 'not_found' }

  await db.batch([
    db
      .update(contractors)
      .set({ failedLoginCount: 0, lockedUntil: null, updatedAt: now })
      .where(eq(contractors.id, contractorId)),
    auditLogInsert(db, {
      actor,
      action: 'contractor.unlock',
      entityType: 'contractor',
      entityId: contractorId,
      detail: {},
    }),
  ])
  return { ok: true }
}
