# 5. 認証・認可・セキュリティ

## 5.1 パスごとの保護

| パス                                                     | 誰が     | 保護方法                                                                   |
| -------------------------------------------------------- | -------- | -------------------------------------------------------------------------- |
| `/`, `/login/*`, `/l/[token]`, `/legal/*`, `/api/health` | 誰でも   | –                                                                          |
| `/portal/*`                                              | 契約者   | `requireContractor()`（portal の layout と、全アクションの先頭）           |
| `/admin/*`                                               | オーナー | ①Access（エッジ） ②`proxy.ts` でJWTを検証 ③全アクションで `requireOwner()` |
| `/api/webhooks/stripe`                                   | Stripe   | 署名の検証（`constructEventAsync`）                                        |

> Server Action は、リクエスト先のパスに関係なくアクションIDで呼び出せます。そのため、**パスで守るだけでは不十分**です。認可は必ずアクションの中で行います（③）。lintのカスタムルールか、コードレビューのチェックリストで漏れを防ぎます。

## 5.2 オーナー: Cloudflare Access

### Access の設定

1. Zero Trust → Access → Applications → Self-hosted
2. Public hostname: `parking-management.hiraku00.workers.dev`、Path: `admin`（配下も対象になる）
3. Policy: Allow — Include: Emails `hiraku00@gmail.com`
4. Login method: One-time PIN（メールに届くコードでログイン）
5. Session duration: 24h
6. AUD タグを `ACCESS_AUD` に、team domain を `ACCESS_TEAM_DOMAIN` に設定する

### アプリ側（`lib/auth/owner.ts`）

```ts
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { appEnv } from '@/lib/env'

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined

export type Owner = { email: string }

/** proxy.ts と requireOwner() の両方から呼ぶ */
export async function verifyOwner(req: { headers: Headers }): Promise<Owner | null> {
  const env = appEnv()
  if (env.APP_ENV === 'development' && env.DEV_OWNER_EMAIL) return { email: env.DEV_OWNER_EMAIL }
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null // 設定漏れは拒否（fail closed）

  const token =
    req.headers.get('cf-access-jwt-assertion') ??
    /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(req.headers.get('cookie') ?? '')?.[1]
  if (!token) return null

  jwks ??= createRemoteJWKSet(new URL(`https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`))
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://${env.ACCESS_TEAM_DOMAIN}`,
      audience: env.ACCESS_AUD,
    })
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null
    return email && env.OWNER_EMAILS.includes(email) ? { email } : null
  } catch {
    return null
  }
}

export async function requireOwner(): Promise<Owner> {
  const owner = await verifyOwner({ headers: await headers() })
  if (!owner) forbidden() // next/navigation（vinext対応）
  return owner
}
```

- ログアウトは `/cdn-cgi/access/logout` へのリンクにする。
- 監査ログの actor は `owner:<email>` にする。

## 5.3 契約者

### ログイン方法

| 方法                            | 流れ                                                                                                                              | 対策                                                                                                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **QRログイン（主）**            | オーナーが管理画面でログインカード（QR＋URL）を印刷して渡す → 契約者がスマホで読む → `/l/<token>` → Cookieを発行して `/portal` へ | トークンは32バイトの乱数（base64url）。DBにはSHA-256のハッシュだけを保存する。再発行すると旧トークンは無効になり、`session_version` も上がる                                       |
| **氏名＋電話番号下4桁（予備）** | `/` のフォームで入力                                                                                                              | ①IP単位のレート制限（`LOGIN_LIMITER`: 60秒で10回） ②契約者単位のロック（5回連続で失敗すると15分ロック） ③失敗時の文言は1種類だけ ④氏名は `normalizeName()`（NFKC、空白除去）で照合 |

### セッション（`lib/auth/contractor-session.ts`）

- Cookie名 `ps_session`。`HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=180日`
- 中身は jose の HS256 JWT `{ sub: contractorId, sv: sessionVersion }`。`SESSION_SECRET` は32バイト以上。
- 検証では、署名と期限を確認したうえで、契約者を読み込み（portal の layout で読み込むので追加のコストは無い）、`archived_at IS NULL` かつ `sv === session_version` であることを確かめる。
- 失効させる方法: オーナーが「ログインを無効化」するか、QRを再発行する（`session_version + 1`）。契約をアーカイブしたときも失効する。

```ts
export async function requireContractor() {
  const c = await getCurrentContractor() // Cookie → JWT → DB → sv を照合
  if (!c) redirect('/?expired=1')
  return c
}
```

### 旧実装からの修正（R1）

Server Action の引数に契約者IDを取らない。主体は `requireContractor()` の戻り値だけ。請求IDなどの対象IDは、必ず「その契約者のものか」をservicesで確認する（例: `WHERE contractor_id = ?`）。

## 5.4 CSRF

- すべての非GETリクエスト（`/api/webhooks/stripe` 以外）で、`proxy.ts` が `Origin` のホストと `Host` が一致するかを確認する。一致しなければ403。
- Cookieは `SameSite=Lax`。
- vinext側にも保護があるかどうかに関係なく、この処理は入れる。

## 5.5 セキュリティヘッダー（`proxy.ts`）

| ヘッダー                                  | 値                                                                                                                                                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Strict-Transport-Security`               | `max-age=31536000; includeSubDomains`                                                                                                                                                                    |
| `X-Content-Type-Options`                  | `nosniff`                                                                                                                                                                                                |
| `Referrer-Policy`                         | `strict-origin-when-cross-origin`                                                                                                                                                                        |
| `X-Frame-Options` / CSP `frame-ancestors` | `DENY` / `'none'`                                                                                                                                                                                        |
| `Permissions-Policy`                      | `camera=(), microphone=(), geolocation=()`                                                                                                                                                               |
| `Content-Security-Policy`                 | `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; form-action 'self' https://checkout.stripe.com; frame-ancestors 'none'; base-uri 'self'` |

Stripe はリダイレクト方式なので Stripe.js は読み込みません。CSPはこれで足ります。`script-src` の nonce 化は、vinextの対応を確認してからの改善項目にします。HTMLレスポンスには `Cache-Control: no-store` を付けます（個人情報を含むため）。

## 5.6 秘密情報

| 名前                    | 置き場所                        | 生成方法                                                                                              |
| ----------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `SESSION_SECRET`        | wrangler secret / `.dev.vars`   | `openssl rand -base64 32`                                                                             |
| `STRIPE_SECRET_KEY`     | wrangler secret / `.dev.vars`   | Stripeダッシュボード（**制限付きキー**を推奨: Checkout Sessionsの書き込み、PaymentIntentsの読み取り） |
| `STRIPE_WEBHOOK_SECRET` | wrangler secret / `.dev.vars`   | Webhookエンドポイントの作成時（ローカルは `stripe listen` が出力する値）                              |
| `CLOUDFLARE_API_TOKEN`  | GitHub Environment `production` | Workersのデプロイ権限＋D1の編集権限だけ                                                               |

## 5.7 個人情報

- 保存するのは、氏名、フリガナ、電話番号、区画、入金情報だけ。カード情報は一切保存しない。
- 画面に表示する電話番号は、管理画面以外ではマスクする。
- ログ（`console.log`）に氏名や電話番号を出さない。IDだけを出す。
- プライバシーポリシーに、利用目的、第三者提供（Stripe）、保存期間を書く。
