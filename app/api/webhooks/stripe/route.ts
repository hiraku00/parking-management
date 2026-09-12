import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe } from '@/utils/stripe/server'
import Stripe from 'stripe'

export async function POST(req: Request) {
    const body = await req.text()
    const signature = (await headers()).get('Stripe-Signature') as string

    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        )
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return new NextResponse(`Webhook Error: ${message}`, { status: 400 })
    }

    const session = event.data.object as Stripe.Checkout.Session

    if (event.type === 'checkout.session.completed') {
        const { createAdminClient } = await import("@/utils/supabase/admin")
        const supabase = createAdminClient()
        const { userId, targetMonth, targetMonths: targetMonthsStr } = session.metadata!

        // Handle both single month (legacy/fallback) and multiple months (new)
        let months: string[] = []
        if (targetMonthsStr) {
            try {
                months = JSON.parse(targetMonthsStr)
            } catch (e) {
                console.error("Failed to parse targetMonths", e)
            }
        } else if (targetMonth) {
            months = [targetMonth]
        }

        if (months.length === 0) {
            console.error("No target months found in metadata")
            return new NextResponse("Metadata Error", { status: 400 })
        }

        const amountPerMonth = Math.floor(session.amount_total! / months.length)

        const records = months.map(month => ({
            user_id: userId,
            amount: amountPerMonth,
            currency: session.currency || 'jpy',
            status: 'succeeded',
            target_month: month,
            stripe_session_id: session.id,
            payment_method: 'stripe'
        }))

        // Insert payment records
        const { error } = await supabase.from('payments').insert(records)

        if (error) {
            console.error('Error inserting payment:', error)
            return new NextResponse(`Database Error: ${error.message || JSON.stringify(error)}`, { status: 500 })
        }
    }

    return new NextResponse(null, { status: 200 })
}
