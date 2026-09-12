/**
 * リクエストのHeadersから、絶対URLを組み立てるためのoriginを求める。
 * Cloudflareの本番環境は常に `x-forwarded-proto` を付けるが、ローカルの
 * `vinext dev` はこのヘッダーを付けないため、host名から推測する
 * （旧実装で `NEXT_PUBLIC_BASE_URL` の設定漏れにより決済後にlocalhostへ
 * 飛んでいた不具合の再発防止。docs/design/02-review-findings.md R28）。
 */
export function originFromHeaders(headers: Headers): string {
  const host = headers.get('host') ?? 'localhost'
  const forwardedProto = headers.get('x-forwarded-proto')
  const proto = forwardedProto ?? (isLocalHost(host) ? 'http' : 'https')
  return `${proto}://${host}`
}

function isLocalHost(host: string): boolean {
  const hostname = host.split(':')[0]
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}
