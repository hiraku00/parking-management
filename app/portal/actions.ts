'use server'

import { stripe } from '@/utils/stripe/server'
import Stripe from 'stripe'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/lib/auth'
import { createCheckoutSessionSchema, reportBankTransferSchema } from '@/lib/validations'

export async function createCheckoutSession(formData: FormData) {
    try {
        const authSession = await getSession()
        const contractorId = authSession?.id

        if (!contractorId) {
            return redirect('/login?message=セッションが切れました。再度ログインしてください。')
        }

        // Validate input
        const validation = createCheckoutSessionSchema.safeParse({
            months: formData.get('months'),
        })

        if (!validation.success) {
            const error = validation.error.issues[0]?.message || '入力エラーが発生しました'
            return redirect(`/portal?error=${encodeURIComponent(error)}`)
        }

        const { months: targetMonths } = validation.data
        // Sort months just in case
        targetMonths.sort()

        const { createAdminClient } = await import("@/utils/supabase/admin")
        const supabase = createAdminClient()
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('monthly_fee, full_name')
            .eq('id', contractorId)
            .single()

        if (profileError || !profile) {
            console.error('Profile fetch error:', profileError)
            return redirect('/portal?error=プロファイルが見つかりません')
        }

        const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = targetMonths.map(month => ({
            price_data: {
                currency: 'jpy',
                product_data: {
                    name: `Parking Fee - ${month}`,
                    description: `Monthly parking fee for ${profile.full_name}`,
                },
                unit_amount: profile.monthly_fee,
            },
            quantity: 1,
        }))

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/portal?success=true&months=${encodeURIComponent(JSON.stringify(targetMonths))}`,
            cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/portal?canceled=true`,
            metadata: {
                userId: contractorId as string,
                targetMonths: JSON.stringify(targetMonths),
            },
        })

        if (session.url) {
            redirect(session.url)
        }
    } catch (error: unknown) {
        // If it's a redirect, just rethrow it
        if (error instanceof Error && 'digest' in error && typeof error.digest === 'string' && error.digest.includes('NEXT_REDIRECT')) {
            throw error
        }

        console.error('Stripe Checkout Error:', error)
        const message = error instanceof Stripe.errors.StripeError
            ? '決済システムの初期化に失敗しました。時間をおいて再度お試しいただくか、管理者へお問い合わせください。'
            : '決済エラーが発生しました。'

        return redirect(`/portal?error=${encodeURIComponent(message)}`)
    }
}

export async function reportBankTransfer(formData: FormData) {
    // Validate input
    const validation = reportBankTransferSchema.safeParse({
        contractorId: formData.get('contractorId'),
        months: formData.get('months'),
        transferName: formData.get('transferName'),
        transferDate: formData.get('transferDate'),
    })

    if (!validation.success) {
        const error = validation.error.issues[0]?.message || '入力エラーが発生しました'
        return { error }
    }

    const { contractorId, months: inputMonths, transferName, transferDate } = validation.data

    const { createAdminClient } = await import("@/utils/supabase/admin")
    const supabase = createAdminClient()

    // Fetch monthly fee from profile FIRST (fixing hardcoded amount bug)
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('monthly_fee')
        .eq('id', contractorId)
        .single()

    if (profileError || !profile) {
        return { error: '契約者情報が見つかりませんでした。再度ログインをお試しください。' }
    }

    // Create payment records for each month with correct amount
    const records = inputMonths.map(month => ({
        user_id: contractorId,
        amount: profile.monthly_fee, // Use actual monthly fee from profile
        currency: 'jpy',
        status: 'pending', // Pending approval
        target_month: month,
        payment_method: 'bank_transfer',
        metadata: {
            transfer_name: transferName,
            transfer_date: transferDate
        }
    }))

    const { error } = await supabase
        .from('payments')
        .insert(records)

    if (error) {
        // Detailed log for admin
        console.error('Database Error during reportBankTransfer:', {
            error,
            contractorId,
            months: inputMonths
        })

        // Context-aware error message for user
        if (error.code === '23505') { // Unique constraint violation (though unlikely with target_month if not restricted)
            return { error: '一部の月は既に報告済みか、支払済みの可能性があります。' }
        }

        return { error: 'サーバーとの通信に失敗しました。時間をおいて再度お試しください。' }
    }

    // Revalidate paths
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/portal')
    revalidatePath('/admin')

    return { success: true }
}
