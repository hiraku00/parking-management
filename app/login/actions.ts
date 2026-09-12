'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { encrypt } from '@/app/lib/auth'
import { ownerLoginSchema, contractorLoginSchema } from '@/lib/validations'

export async function loginOwner(formData: FormData) {
    // Validate input
    const validation = ownerLoginSchema.safeParse({
        email: formData.get('email'),
        password: formData.get('password'),
    })

    if (!validation.success) {
        const error = validation.error.issues[0]?.message || '入力エラーが発生しました'
        return redirect(`/login?message=${encodeURIComponent(error)}`)
    }

    const { email, password } = validation.data
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return redirect(`/login?message=${encodeURIComponent('認証に失敗しました')}`)
    }

    return redirect('/admin')
}

export async function loginContractor(formData: FormData) {
    // Validate input
    const validation = contractorLoginSchema.safeParse({
        name: formData.get('name'),
        phone: formData.get('phone'),
    })

    if (!validation.success) {
        const error = validation.error.issues[0]?.message || '入力エラーが発生しました'
        return redirect(`/login?message=${encodeURIComponent(error)}`)
    }

    const { name, phone } = validation.data

    const { createAdminClient } = await import("@/utils/supabase/admin")
    const supabase = createAdminClient()

    // Find profile by name and phone_last4
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, role, phone_last4')
        .eq('full_name', name)
        .eq('role', 'contractor')
        .single()

    if (error || !profile) {
        return redirect(`/login?message=${encodeURIComponent('契約者が見つかりません')}`)
    }

    // Verify phone_last4
    if (profile.phone_last4 !== phone) {
        return redirect(`/login?message=${encodeURIComponent('電話番号が正しくありません')}`)
    }

    // Set secure cookie for contractor session
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const session = await encrypt({ id: profile.id, role: 'contractor' })
    const cookieStore = await cookies()

    cookieStore.set('contractor_session', session, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires,
    })

    return redirect('/portal')
}

export async function logout() {
    const supabase = await createClient()
    await supabase.auth.signOut()

    const cookieStore = await cookies()
    cookieStore.delete('contractor_session')

    return redirect('/login')
}
