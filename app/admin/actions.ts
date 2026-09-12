'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import {
    addContractorSchema,
    updateContractorSchema,
    deleteContractorSchema,
    createManualPaymentSchema,
    updateOwnerSettingsSchema,
    approvePaymentsSchema,
} from '@/lib/validations'

export async function addContractor(formData: FormData) {
    // Validate input
    const validation = addContractorSchema.safeParse({
        name: formData.get('name'),
        phoneNumber: formData.get('phoneNumber'),
        monthlyFee: formData.get('monthlyFee'),
        contractStart: formData.get('contractStart'),
        contractEnd: formData.get('contractEnd'),
    })

    if (!validation.success) {
        const error = validation.error.issues[0]?.message || '入力エラーが発生しました'
        return { error }
    }

    const { name, phoneNumber, monthlyFee, contractStart, contractEnd } = validation.data

    // Extract last 4 digits from phone number
    const phoneLast4 = phoneNumber.replace(/\D/g, '').slice(-4)

    const supabase = await createClient()

    const { error } = await supabase
        .from('profiles')
        .insert({
            full_name: name,
            role: 'contractor',
            monthly_fee: monthlyFee,
            phone_number: phoneNumber,
            phone_last4: phoneLast4,
            contract_start_month: contractStart,
            contract_end_month: contractEnd || null,
        })

    if (error) {
        console.error('Error adding contractor:', error)
        return { error: '契約者の追加中にシステムエラーが発生しました。入力内容を確認して、もう一度お試しください。' }
    }

    revalidatePath('/admin')
    return { success: true }
}

export async function updateContractor(formData: FormData) {
    // Validate input
    const validation = updateContractorSchema.safeParse({
        id: formData.get('id'),
        name: formData.get('name'),
        phoneNumber: formData.get('phoneNumber'),
        monthlyFee: formData.get('monthlyFee'),
        contractStart: formData.get('contractStart'),
        contractEnd: formData.get('contractEnd'),
    })

    if (!validation.success) {
        const error = validation.error.issues[0]?.message || '入力エラーが発生しました'
        return { error }
    }

    const { id, name, phoneNumber, monthlyFee, contractStart, contractEnd } = validation.data

    // Extract last 4 digits from phone number
    const phoneLast4 = phoneNumber.replace(/\D/g, '').slice(-4)

    const supabase = await createClient()

    const { error } = await supabase
        .from('profiles')
        .update({
            full_name: name,
            monthly_fee: monthlyFee,
            phone_number: phoneNumber,
            phone_last4: phoneLast4,
            contract_start_month: contractStart,
            contract_end_month: contractEnd || null,
        })
        .eq('id', id)

    if (error) {
        console.error('Error updating contractor:', error)
        return { error: '契約者情報の更新中にエラーが発生しました。しばらく待ってから再度保存してください。' }
    }

    revalidatePath('/admin')
    return { success: true }
}

export async function deleteContractor(formData: FormData) {
    // Validate input
    const validation = deleteContractorSchema.safeParse({
        id: formData.get('id'),
    })

    if (!validation.success) {
        const error = validation.error.issues[0]?.message || '入力エラーが発生しました'
        return { error }
    }

    const { id } = validation.data
    const supabase = await createClient()

    const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting contractor:', error)
        // Check for foreign key violation (e.g., payment history exists)
        if (error.code === '23503') {
            return { error: '過去の入金記録があるため、データを削除することができません。' }
        }
        return { error: '契約者の削除中にエラーが発生しました。' }
    }

    revalidatePath('/admin')
    return { success: true }
}

export async function createManualPayment(formData: FormData) {
    // Validate input
    const validation = createManualPaymentSchema.safeParse({
        userId: formData.get('userId'),
        amount: formData.get('amount'),
        targetMonth: formData.get('targetMonth'),
        paymentMethod: formData.get('paymentMethod'),
    })

    if (!validation.success) {
        const error = validation.error.issues[0]?.message || '入力エラーが発生しました'
        return { error }
    }

    const { userId, amount, targetMonth, paymentMethod } = validation.data
    const supabase = await createClient()

    const { error } = await supabase
        .from('payments')
        .insert({
            user_id: userId,
            amount: amount,
            currency: 'jpy',
            status: 'succeeded',
            target_month: targetMonth,
            stripe_session_id: 'manual_entry', // Mark as manual payment
            payment_method: paymentMethod as 'cash' | 'bank_transfer',
        })

    if (error) {
        console.error('Admin Manual Payment Error:', { error, userId, targetMonth, amount })
        return { error: '入金記録の保存に失敗しました。画面を更新して再度お試しください。' }
    }

    revalidatePath('/admin')
    return { success: true }
}

export async function updateOwnerSettings(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: '認証されていません' }
    }

    // Validate input
    const validation = updateOwnerSettingsSchema.safeParse({
        companyName: formData.get('companyName'),
        address: formData.get('address'),
        invoiceNumber: formData.get('invoiceNumber'),
        bankName: formData.get('bankName'),
        branchName: formData.get('branchName'),
        accountType: formData.get('accountType'),
        accountNumber: formData.get('accountNumber'),
        accountHolder: formData.get('accountHolder'),
    })

    if (!validation.success) {
        const error = validation.error.issues[0]?.message || '入力エラーが発生しました'
        return { error }
    }

    const { companyName, address, invoiceNumber, bankName, branchName, accountType, accountNumber, accountHolder } = validation.data

    // Update the owner profile. We assume there is only one owner profile linked to this auth user
    const { error } = await supabase
        .from('profiles')
        .update({
            company_name: companyName,
            address: address,
            invoice_registration_number: invoiceNumber || null,
            bank_name: bankName,
            bank_branch_name: branchName,
            account_type: accountType,
            account_number: accountNumber,
            account_holder_name: accountHolder,
        })
        .eq('role', 'owner')
        .eq('auth_id', user.id)

    if (error) {
        console.error('Error updating owner settings:', error)
        return { error: '設定の保存中にエラーが発生しました。しばらく待ってから再度お試しください。' }
    }

    revalidatePath('/admin/settings')
    return { success: true }
}

export async function approvePayments(paymentIds: string[]) {
    const supabase = await createClient()

    // Check auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: '認証されていません' }

    // Validate input
    const validation = approvePaymentsSchema.safeParse({ paymentIds })

    if (!validation.success) {
        const error = validation.error.issues[0]?.message || '入力エラーが発生しました'
        return { error }
    }

    const { paymentIds: validatedIds } = validation.data

    const { error } = await supabase
        .from('payments')
        .update({ status: 'succeeded' })
        .in('id', validatedIds)

    if (error) {
        console.error('Admin Payment Approval Error:', { error, paymentIds })
        return { error: '承認処理に失敗しました' }
    }

    revalidatePath('/admin')
    return { success: true }
}
