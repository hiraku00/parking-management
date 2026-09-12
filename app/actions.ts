'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { issueContractorSessionCookie, clearContractorSessionCookie } from '@/lib/auth/contractor-session'
import { attemptContractorLogin } from '@/lib/services/contractor-auth'

export type LoginFormState = { error?: string }

const loginInputSchema = z.object({
  name: z.string().trim().min(1, 'お名前を入力してください'),
  phoneLast4: z
    .string()
    .trim()
    .regex(/^\d{4}$/, '電話番号の下4桁（数字4文字）を入力してください'),
})

// 「見つかりません」と「電話番号が違います」を区別すると、契約者名の存在が
// 推測できてしまうため、失敗時の文言は1種類だけにする（R6）。
const GENERIC_INVALID_MESSAGE =
  'お名前と電話番号の下4桁をご確認のうえ、もう一度お試しください。スペースは入力しないでください。'
const LOCKED_MESSAGE =
  '入力を複数回間違えたため、しばらくの間ログインできません。15分ほど時間をおいてお試しください。'
const RATE_LIMITED_MESSAGE = 'しばらく時間をおいてから、もう一度お試しください。'

export async function loginContractorAction(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const env = appEnv()
  const requestHeaders = await headers()

  // IP単位のレート制限（LOGIN_LIMITER: 60秒で10回）。氏名の正当性を見る前に
  // 弾くことで、総当たり試行そのものを絞る。
  const ip = requestHeaders.get('cf-connecting-ip') ?? 'unknown'
  const { success: withinRateLimit } = await env.LOGIN_LIMITER.limit({ key: `login:${ip}` })
  if (!withinRateLimit) return { error: RATE_LIMITED_MESSAGE }

  const validation = loginInputSchema.safeParse({
    name: formData.get('name'),
    phoneLast4: formData.get('phoneLast4'),
  })
  if (!validation.success) return { error: GENERIC_INVALID_MESSAGE }

  const db = getDb(env.DB)
  const result = await attemptContractorLogin(db, {
    name: validation.data.name,
    phoneLast4: validation.data.phoneLast4,
    now: new Date(),
  })

  if (!result.ok) {
    return { error: result.reason === 'locked' ? LOCKED_MESSAGE : GENERIC_INVALID_MESSAGE }
  }

  await issueContractorSessionCookie(result.contractorId, result.sessionVersion)
  redirect('/portal')
}

export async function logoutAction(): Promise<void> {
  await clearContractorSessionCookie()
  redirect('/')
}
