import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'

export type Owner = { email: string }

/**
 * verifyOwnerRequest が実際に読む設定値。appEnv() の全量ではなく、この
 * サブセットだけを受け取れるようにして、テストから素の値を注入できるようにする。
 * `wrangler.jsonc` の `vars` はそこに書いた既定値がそのままリテラル型として
 * 生成される（例: `OWNER_EMAILS: "hiraku00@gmail.com"`）が、実際の値は
 * `.dev.vars` やデプロイ環境ごとに変わるため、ここでは string に広げておく。
 */
export type OwnerAuthConfig = {
  APP_ENV: string
  ACCESS_TEAM_DOMAIN: string
  ACCESS_AUD: string
  OWNER_EMAILS: string
  DEV_OWNER_EMAIL: string
}

let cachedJwks: JWTVerifyGetKey | undefined
let cachedTeamDomain: string | undefined

function jwksFor(teamDomain: string): JWTVerifyGetKey {
  if (!cachedJwks || cachedTeamDomain !== teamDomain) {
    cachedJwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`))
    cachedTeamDomain = teamDomain
  }
  return cachedJwks
}

function parseOwnerEmails(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

function readAssertion(headers: Headers): string | null {
  const header = headers.get('cf-access-jwt-assertion')
  if (header) return header.trim()
  const cookie = headers.get('cookie') ?? ''
  const match = /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(cookie)
  return match?.[1]?.trim() ?? null
}

/**
 * Cloudflare Access のJWTを検証し、許可されたオーナーのメールアドレスを返す。
 * `proxy.ts`（エッジでの一次防御）と `requireOwner()`（Server Action内での
 * 二次防御）の両方から呼ぶ。設定漏れ・トークン不正・許可外のメールは、
 * 理由を問わずすべて null（fail closed）。
 *
 * `options.config` / `options.getKey` は、テストから素の設定値と鍵の取得元
 * （`createLocalJWKSet` 等）を注入するためのフック。省略時は
 * `appEnv()` と `env.ACCESS_TEAM_DOMAIN` のJWKSエンドポイントを使う。
 * 参照: docs/design/05-auth-security.md §5.2
 */
export async function verifyOwnerRequest(
  headers: Headers,
  options: { getKey?: JWTVerifyGetKey; config?: OwnerAuthConfig } = {},
): Promise<Owner | null> {
  // config を明示的に注入しない実運用の呼び出し（proxy.ts, requireOwner()）でだけ
  // `cloudflare:workers` を読み込む。こうすると、このファイル自体はNode環境の
  // 単体テストからも import でき、鍵検証ロジックをMiniflare無しで確認できる。
  const env = options.config ?? (await import('../env')).appEnv()

  // 本番（APP_ENV=production）以外で DEV_OWNER_EMAIL が設定されていれば、
  // Access をバイパスしてそのメールをオーナーとして扱う（ローカル開発用）。
  if (env.APP_ENV !== 'production' && env.DEV_OWNER_EMAIL) {
    return { email: env.DEV_OWNER_EMAIL.toLowerCase() }
  }

  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null

  const token = readAssertion(headers)
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, options.getKey ?? jwksFor(env.ACCESS_TEAM_DOMAIN), {
      issuer: `https://${env.ACCESS_TEAM_DOMAIN}`,
      audience: env.ACCESS_AUD,
    })
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null
    if (!email) return null
    const allowed = parseOwnerEmails(env.OWNER_EMAILS)
    return allowed.includes(email) ? { email } : null
  } catch {
    return null
  }
}

/** requireOwner() がオーナーでないときに投げる。汎用の Error ではなく、この
 *  型で判定できるようにしておく（将来、専用のエラー画面に振り分ける場合用）。 */
export class ForbiddenError extends Error {
  constructor() {
    super('FORBIDDEN')
    this.name = 'ForbiddenError'
  }
}

/**
 * Server Action / Server Component の先頭で呼ぶ。`proxy.ts` がパスで
 * `/admin*` を守っていても、Server Action はアクションIDで直接呼び出せるため、
 * 個々のアクションでもこれを呼んで認可する（docs/design/05-auth-security.md §5.1）。
 */
export async function requireOwner(headers: Headers): Promise<Owner> {
  const owner = await verifyOwnerRequest(headers)
  if (!owner) throw new ForbiddenError()
  return owner
}
