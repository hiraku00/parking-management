'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { requireContractor } from '@/lib/auth/contractor-session'
import { originFromHeaders } from '@/lib/http/origin'
import { startCardCheckout, reportTransfer } from '@/lib/services/payments'
import { payMonthCountSchema, reportTransferSchema } from '@/lib/validation'

export type PayFormState = { error?: string }

const CARD_ERROR_MESSAGE: Record<string, string> = {
  card_disabled: '現在カード決済はご利用いただけません。',
  insufficient_invoices: '指定した月数分のお支払い対象がありません。',
  stripe_error: '決済の開始に失敗しました。しばらくしてからもう一度お試しください。',
}

/** 支払う月数と方法を選ぶ画面から呼ぶ。カードならStripeへredirect、振込なら次の画面へ進む。 */
export async function startPaymentAction(
  _prevState: PayFormState,
  formData: FormData,
): Promise<PayFormState> {
  const db = getDb(appEnv().DB)
  const contractor = await requireContractor(db)

  const validation = payMonthCountSchema.safeParse({ count: formData.get('count') })
  if (!validation.success)
    return { error: validation.error.issues[0]?.message ?? '入力内容を確認してください' }

  if (formData.get('method') === 'bank_transfer') {
    redirect(`/portal/pay/transfer?count=${validation.data.count}`)
  }

  const origin = originFromHeaders(await headers())
  const result = await startCardCheckout(db, {
    contractorId: contractor.id,
    count: validation.data.count,
    origin,
    now: new Date(),
  })
  if (!result.ok) return { error: CARD_ERROR_MESSAGE[result.error] }
  redirect(result.url)
}

export type ReportTransferFormState = { error?: string }

const TRANSFER_ERROR_MESSAGE: Record<string, string> = {
  transfer_disabled: '現在銀行振込はご利用いただけません。',
  insufficient_invoices: '指定した月数分のお支払い対象がありません。',
  invalid_date: '振込日には今日以前の日付を入力してください。',
}

/** 振込金額の確認画面から、振込名義と振込日を報告する。 */
export async function reportTransferAction(
  _prevState: ReportTransferFormState,
  formData: FormData,
): Promise<ReportTransferFormState> {
  const db = getDb(appEnv().DB)
  const contractor = await requireContractor(db)

  const validation = reportTransferSchema.safeParse({
    count: formData.get('count'),
    payerName: formData.get('payerName'),
    paidOn: formData.get('paidOn'),
  })
  if (!validation.success)
    return { error: validation.error.issues[0]?.message ?? '入力内容を確認してください' }

  const result = await reportTransfer(db, {
    contractorId: contractor.id,
    count: validation.data.count,
    payerName: validation.data.payerName,
    paidOn: validation.data.paidOn,
    now: new Date(),
  })
  if (!result.ok) return { error: TRANSFER_ERROR_MESSAGE[result.error] }
  redirect(`/portal/pay/transfer/done/${result.paymentId}`)
}
