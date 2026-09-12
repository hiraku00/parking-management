'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { requireOwner } from '@/lib/auth/owner'
import { updateSettings } from '@/lib/services/settings'
import { settingsInputSchema } from '@/lib/validation'

export type SettingsFormState = { error?: string; success?: boolean }

export async function updateSettingsAction(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const owner = await requireOwner(await headers())

  const validation = settingsInputSchema.safeParse({
    businessName: formData.get('businessName'),
    businessAddress: formData.get('businessAddress'),
    businessPhone: formData.get('businessPhone'),
    invoiceRegistrationNumber: formData.get('invoiceRegistrationNumber'),
    taxRate: formData.get('taxRate'),
    bankName: formData.get('bankName'),
    bankBranch: formData.get('bankBranch'),
    bankAccountType: formData.get('bankAccountType'),
    bankAccountNumber: formData.get('bankAccountNumber'),
    bankAccountHolderKana: formData.get('bankAccountHolderKana'),
    cardPaymentEnabled: formData.get('cardPaymentEnabled') === 'on',
    bankTransferEnabled: formData.get('bankTransferEnabled') === 'on',
    invoiceLeadMonths: formData.get('invoiceLeadMonths'),
  })
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message ?? '入力内容を確認してください' }
  }

  const db = getDb(appEnv().DB)
  await updateSettings(db, validation.data, { kind: 'owner', email: owner.email }, new Date())

  revalidatePath('/admin/settings')
  return { success: true }
}
