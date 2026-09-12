import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { issueContractorSessionCookie } from '@/lib/auth/contractor-session'
import { attemptQrLogin } from '@/lib/services/contractor-auth'

/**
 * QRログイン。オーナーが印刷したログインカードのQRから遷移してくる。
 * 参照: docs/design/05-auth-security.md §5.3, docs/design/07-screens.md §7.2
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const db = getDb(appEnv().DB)

  const result = await attemptQrLogin(db, token)
  const redirectTo = result.ok ? '/portal' : '/?invalid=1'
  if (result.ok) {
    await issueContractorSessionCookie(result.contractorId, result.sessionVersion)
  }

  return Response.redirect(new URL(redirectTo, request.url), 303)
}
