/**
 * Workers Secrets（`wrangler secret put` で設定し、`wrangler.jsonc` の
 * `vars` には書かない値）の型を、`wrangler types` が生成する `Env` に
 * 追加する。
 *
 * これらを `vars` にプレースホルダーとして書かない理由: `vars` と同名の
 * secret を設定した場合にどちらが実行時に優先されるかはCloudflareの
 * ドキュメントで明言されておらず、空文字列の `vars` が本番の実際の
 * secret を上書きしてしまう可能性を排除できないため（署名鍵が空文字列に
 * なるのは、契約者セッションが誰でも偽造できることを意味する）。
 *
 * 代わりに、このファイルでグローバルな `Env` インターフェースに直接
 * マージする。`.dev.vars` の有無に関わらず（CI には無い）常に型が
 * 存在する。値そのものは実行時に `wrangler secret put` /
 * `.dev.vars` から注入される（この宣言は型だけで、値は持たない）。
 *
 * 参照: docs/design/05-auth-security.md §5.6
 */
interface Env {
  /** 契約者セッションJWTの署名鍵（HS256、32バイト以上）。openssl rand -base64 32 で生成する。 */
  SESSION_SECRET: string
}

// `cloudflare:workers` の `env`（lib/env.ts が使う）は `Cloudflare.Env` の方を
// 参照しているため、こちらにも同じ宣言をマージする。
declare namespace Cloudflare {
  interface Env {
    SESSION_SECRET: string
  }
}
