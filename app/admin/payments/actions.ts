'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { requireOwner } from '@/lib/auth/owner'
import { approveTransfer, rejectTransfer, recordManualPayment, refundPayment } from '@/lib/services/payments'
import {
  approveTransferSchema,
  recordManualPaymentSchema,
  refundPaymentSchema,
  rejectTransferSchema,
} from '@/lib/validation'

export type PaymentActionState = { error?: string }

export async function approveTransferAction(
  _prevState: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const owner = await requireOwner(await headers())
  const validation = approveTransferSchema.safeParse({ paymentId: formData.get('paymentId') })
  if (!validation.success) return { error: '入力内容を確認してください' }

  const db = getDb(appEnv().DB)
  const result = await approveTransfer(db, { paymentId: validation.data.paymentId, owner, now: new Date() })
  if (!result.ok) return { error: '既に処理済みか、対象の入金が見つかりません。' }

  revalidatePath('/admin')
  revalidatePath('/admin/payments')
  revalidatePath(`/admin/payments/${validation.data.paymentId}`)
  return {}
}

export async function rejectTransferAction(
  _prevState: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const owner = await requireOwner(await headers())
  const validation = rejectTransferSchema.safeParse({
    paymentId: formData.get('paymentId'),
    reason: formData.get('reason'),
  })
  if (!validation.success)
    return { error: validation.error.issues[0]?.message ?? '入力内容を確認してください' }

  const db = getDb(appEnv().DB)
  const result = await rejectTransfer(db, { ...validation.data, owner, now: new Date() })
  if (!result.ok) return { error: '既に処理済みか、対象の入金が見つかりません。' }

  revalidatePath('/admin')
  revalidatePath('/admin/payments')
  revalidatePath(`/admin/payments/${validation.data.paymentId}`)
  return {}
}

export async function refundPaymentAction(
  _prevState: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const owner = await requireOwner(await headers())
  const validation = refundPaymentSchema.safeParse({
    paymentId: formData.get('paymentId'),
    reason: formData.get('reason'),
    refundMethod: formData.get('refundMethod'),
  })
  if (!validation.success)
    return { error: validation.error.issues[0]?.message ?? '入力内容を確認してください' }

  const db = getDb(appEnv().DB)
  const result = await refundPayment(db, { ...validation.data, owner, now: new Date() })
  if (!result.ok) {
    if (result.error === 'stripe_error')
      return { error: 'Stripeでの返金に失敗しました。時間をおいてもう一度お試しください。' }
    return { error: '既に処理済みか、対象の入金が見つかりません。' }
  }

  revalidatePath('/admin')
  revalidatePath('/admin/payments')
  revalidatePath(`/admin/payments/${validation.data.paymentId}`)
  return {}
}

export async function recordManualPaymentAction(
  _prevState: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const owner = await requireOwner(await headers())
  const validation = recordManualPaymentSchema.safeParse({
    contractorId: formData.get('contractorId'),
    invoiceIds: formData.getAll('invoiceIds'),
    amount: formData.get('amount'),
    method: formData.get('method'),
    paidOn: formData.get('paidOn'),
    note: formData.get('note'),
  })
  if (!validation.success)
    return { error: validation.error.issues[0]?.message ?? '入力内容を確認してください' }

  const db = getDb(appEnv().DB)
  const result = await recordManualPayment(db, { ...validation.data, owner, now: new Date() })
  if (!result.ok)
    return { error: '対象の請求が支払い可能な状態ではありません。画面を更新してもう一度お試しください。' }

  revalidatePath('/admin')
  revalidatePath(`/admin/contractors/${validation.data.contractorId}`)
  return {}
}
