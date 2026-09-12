import { NextResponse, type NextRequest } from 'next/server'
import { verifyOwnerRequest } from './lib/auth/owner'

/**
 * すべてのリクエストに対する一次防御。
 * 1. CSRF: 非GETリクエスト（Stripe Webhookを除く）は Origin と Host が
 *    一致しなければ拒否する。
 * 2. /admin* は Cloudflare Access の検証をここでも行う（エッジのAccess設定
 *    が漏れていた場合や、Server Actionがパス外から呼ばれた場合の防御）。
 * 3. すべてのレスポンスにセキュリティヘッダーを付与する。
 * 参照: docs/design/05-auth-security.md §5.1, §5.4, §5.5
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  if (isUnsafeMethod(request.method) && pathname !== '/api/webhooks/stripe') {
    const csrfError = checkOrigin(request)
    if (csrfError) return withSecurityHeaders(csrfError)
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const owner = await verifyOwnerRequest(request.headers)
    if (!owner) {
      return withSecurityHeaders(new NextResponse('Forbidden', { status: 403 }))
    }
  }

  return withSecurityHeaders(NextResponse.next())
}

function isUnsafeMethod(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
}

/** Origin ヘッダーのホストが、このリクエストの Host と一致するかを確認する。
 *  一致しなければ拒否レスポンスを、問題なければ null を返す。 */
function checkOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin')
  // Server Actionからの正当なリクエストは常にOriginを送るブラウザ経由なので、
  // 非GETなのにOriginが無いものは拒否する。
  if (!origin) return new NextResponse('Forbidden', { status: 403 })

  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    return new NextResponse('Forbidden', { status: 403 })
  }

  if (originHost !== request.headers.get('host')) {
    return new NextResponse('Forbidden', { status: 403 })
  }
  return null
}

function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "form-action 'self' https://checkout.stripe.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
    ].join('; '),
  )
  // 個人データ・金額を含む画面のため、ブラウザ/中間キャッシュに保存させない。
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}
