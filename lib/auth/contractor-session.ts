import { jwtVerify, SignJWT } from 'jose'
import { eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { contractors } from '../db/schema'

export const SESSION_COOKIE_NAME = 'ps_session'
const MAX_AGE_SECONDS = 180 * 24 * 60 * 60 // 180日

export type ContractorSessionClaims = { sub: string; sv: number }

function getKey(secret: string) {
  return new TextEncoder().encode(secret)
}

/**
 * 契約者セッションJWTを発行する（純関数。SESSION_SECRETを引数で受け取るので
 * Node環境でも単体テストできる）。中身は `{ sub: contractorId, sv:
 * sessionVersion }` だけ。参照: docs/design/05-auth-security.md §5.3
 */
export async function signContractorSession(
  secret: string,
  contractorId: string,
  sessionVersion: number,
): Promise<string> {
  return await new SignJWT({ sv: sessionVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(contractorId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getKey(secret))
}

/** 署名と期限だけを見る。DBとの突き合わせ（archived_at, session_version）は呼び出し側で行う。 */
export async function verifyContractorSession(
  secret: string,
  token: string,
): Promise<ContractorSessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getKey(secret))
    if (typeof payload.sub !== 'string' || typeof payload.sv !== 'number') return null
    return { sub: payload.sub, sv: payload.sv }
  } catch {
    return null
  }
}

// 以降は `next/headers`（フレームワークがリクエストごとに用意する非同期
// コンテキスト）に依存する関数。上の純関数と違い、実際のリクエストの外
// （プレーンなNode環境の単体テスト）からは呼び出せない。`next/headers` /
// `../env`（cloudflare:workers）への依存は動的importにして、このファイル
// 自体はNode環境からもimportできるようにしてある
// （lib/auth/contractor-session.test.ts が署名・検証だけを確認する）。

/** Cookieを発行する（Server Action / Route Handlerから呼ぶ）。 */
export async function issueContractorSessionCookie(
  contractorId: string,
  sessionVersion: number,
): Promise<void> {
  const { appEnv } = await import('../env')
  const { cookies } = await import('next/headers')
  const env = appEnv()
  const token = await signContractorSession(env.SESSION_SECRET, contractorId, sessionVersion)
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.APP_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
}

export async function clearContractorSessionCookie(): Promise<void> {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

export type CurrentContractor = typeof contractors.$inferSelect

/**
 * Cookie → JWT検証 → DB照合（archived_at IS NULL かつ session_version一致）
 * まで行う。ログインしていない・失効している場合は null。
 */
export async function getCurrentContractor(db: Db): Promise<CurrentContractor | null> {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null

  const { appEnv } = await import('../env')
  const claims = await verifyContractorSession(appEnv().SESSION_SECRET, token)
  if (!claims) return null

  const contractor = await db.query.contractors.findFirst({ where: eq(contractors.id, claims.sub) })
  if (!contractor || contractor.archivedAt || contractor.sessionVersion !== claims.sv) return null
  return contractor
}

/** portal の layout やServer Actionの先頭で呼ぶ。未ログインなら `/` へ戻す。 */
export async function requireContractor(db: Db): Promise<CurrentContractor> {
  const contractor = await getCurrentContractor(db)
  if (contractor) return contractor
  const { redirect } = await import('next/navigation')
  redirect('/?expired=1')
  // redirect() は常に例外を投げて戻らない（Next.js/vinextの仕様）。
  // 動的importの戻り値は `never` として型解析されないため、TSのための到達不能コード。
  throw new Error('unreachable')
}
