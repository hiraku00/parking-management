'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { requireOwner } from '@/lib/auth/owner'
import { archiveContractor, createContractor, updateContractor } from '@/lib/services/contractors'
import {
  invalidateContractorSessions,
  reissueLoginToken,
  unlockContractor,
} from '@/lib/services/contractor-auth'
import { voidInvoice } from '@/lib/services/invoices'
import { contractorInputSchema, voidInvoiceSchema } from '@/lib/validation'

export type ContractorFormState = { error: string } | { error?: undefined }

function formValues(formData: FormData) {
  return {
    name: formData.get('name'),
    nameKana: formData.get('nameKana'),
    phone: formData.get('phone'),
    spaceLabel: formData.get('spaceLabel'),
    monthlyFee: formData.get('monthlyFee'),
    contractStartMonth: formData.get('contractStartMonth'),
    contractEndMonth: formData.get('contractEndMonth'),
    note: formData.get('note'),
  }
}

export async function createContractorAction(
  _prevState: ContractorFormState,
  formData: FormData,
): Promise<ContractorFormState> {
  // Server Actionはアクションのパスに関係なく呼び出せるため、/admin* のパスを
  // proxy.ts が守っていても、ここで改めてオーナーかどうかを確認する。
  const owner = await requireOwner(await headers())

  const validation = contractorInputSchema.safeParse(formValues(formData))
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message ?? '入力内容を確認してください' }
  }

  const db = getDb(appEnv().DB)
  const result = await createContractor(
    db,
    validation.data,
    { kind: 'owner', email: owner.email },
    new Date(),
  )
  if (!result.ok) {
    return { error: '在籍中の同じ名前の契約者が既に登録されています。' }
  }

  revalidatePath('/admin/contractors')
  revalidatePath('/admin')
  redirect(`/admin/contractors/${result.contractorId}`)
}

export async function updateContractorAction(
  contractorId: string,
  _prevState: ContractorFormState,
  formData: FormData,
): Promise<ContractorFormState> {
  const owner = await requireOwner(await headers())

  const validation = contractorInputSchema.safeParse(formValues(formData))
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message ?? '入力内容を確認してください' }
  }
  const applyFeeToOpenInvoices = formData.get('applyFeeToOpenInvoices') === 'on'

  const db = getDb(appEnv().DB)
  const result = await updateContractor(
    db,
    contractorId,
    validation.data,
    applyFeeToOpenInvoices,
    { kind: 'owner', email: owner.email },
    new Date(),
  )
  if (!result.ok) {
    return result.error === 'duplicate_name'
      ? { error: '在籍中の同じ名前の契約者が既に登録されています。' }
      : { error: '契約者が見つかりませんでした。' }
  }

  revalidatePath(`/admin/contractors/${contractorId}`)
  revalidatePath('/admin/contractors')
  revalidatePath('/admin')
  return {}
}

export type ArchiveContractorResult = { error?: string }

export async function archiveContractorAction(contractorId: string): Promise<ArchiveContractorResult> {
  const owner = await requireOwner(await headers())
  const db = getDb(appEnv().DB)
  const result = await archiveContractor(db, contractorId, { kind: 'owner', email: owner.email }, new Date())
  if (!result.ok) return { error: '契約者が見つかりませんでした。' }

  revalidatePath('/admin/contractors')
  revalidatePath('/admin')
  redirect('/admin/contractors')
}

export type VoidInvoiceFormState = { error?: string }

export async function voidInvoiceAction(
  _prevState: VoidInvoiceFormState,
  formData: FormData,
): Promise<VoidInvoiceFormState> {
  const owner = await requireOwner(await headers())

  const validation = voidInvoiceSchema.safeParse({
    invoiceId: formData.get('invoiceId'),
    reason: formData.get('reason'),
  })
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message ?? '入力内容を確認してください' }
  }

  const db = getDb(appEnv().DB)
  const result = await voidInvoice(db, {
    invoiceId: validation.data.invoiceId,
    reason: validation.data.reason,
    actor: { kind: 'owner', email: owner.email },
    now: new Date(),
  })

  if (!result.ok) {
    const messages = {
      invoice_not_found: '請求が見つかりませんでした。',
      invoice_not_open: 'この請求はすでに支払済みか免除済みです。',
      invoice_has_allocations: '入金・確認中の振込があるため免除できません。',
    } as const
    return { error: messages[result.error] }
  }

  const contractorId = formData.get('contractorId')
  if (typeof contractorId === 'string') revalidatePath(`/admin/contractors/${contractorId}`)
  revalidatePath('/admin')
  return {}
}

/**
 * ログインカードのQRを再発行する。取得した平文トークンはこの場限りなので、
 * 印刷ページへ渡すためにURLのクエリに載せて redirect する
 * （DBにはハッシュしか保存しないため、他に受け渡す手段が無い）。
 */
export async function reissueLoginTokenAction(contractorId: string): Promise<{ error?: string }> {
  const owner = await requireOwner(await headers())
  const db = getDb(appEnv().DB)
  const result = await reissueLoginToken(db, contractorId, { kind: 'owner', email: owner.email }, new Date())
  if (!result.ok) return { error: '契約者が見つかりませんでした。' }

  revalidatePath(`/admin/contractors/${contractorId}`)
  redirect(`/admin/contractors/${contractorId}/login-card?token=${encodeURIComponent(result.token)}`)
}

export async function invalidateSessionsAction(contractorId: string): Promise<{ error?: string }> {
  const owner = await requireOwner(await headers())
  const db = getDb(appEnv().DB)
  const result = await invalidateContractorSessions(
    db,
    contractorId,
    { kind: 'owner', email: owner.email },
    new Date(),
  )
  if (!result.ok) return { error: '契約者が見つかりませんでした。' }

  revalidatePath(`/admin/contractors/${contractorId}`)
  return {}
}

export async function unlockContractorAction(contractorId: string): Promise<{ error?: string }> {
  const owner = await requireOwner(await headers())
  const db = getDb(appEnv().DB)
  const result = await unlockContractor(db, contractorId, { kind: 'owner', email: owner.email }, new Date())
  if (!result.ok) return { error: '契約者が見つかりませんでした。' }

  revalidatePath(`/admin/contractors/${contractorId}`)
  return {}
}
