/**
 * QRログイン用トークン。32バイトの乱数を base64url で発行し、DBには
 * SHA-256のハッシュだけを保存する（プレーンな値はレスポンスとして
 * 一度返すだけで、どこにも永続化しない）。
 * 参照: docs/design/05-auth-security.md §5.3
 */

const TOKEN_BYTES = 32

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** ログインカードに載せる、契約者に渡す方のトークン。 */
export function generateLoginToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES))
  return toBase64Url(bytes)
}

/** DBに保存する方のハッシュ。トークンからは戻せない。 */
export async function hashLoginToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return toBase64Url(new Uint8Array(digest))
}
