import { getSession } from "@/app/lib/auth"
import { notFound, redirect } from "next/navigation"
import { ReceiptStyle } from "./receipt-style"
import { ReceiptControlBar } from "./receipt-control-bar"

type Props = {
    params: Promise<{ id: string }>
}

export default async function ReceiptPage({ params }: Props) {
    const { id } = await params
    const session = await getSession()
    const contractorId = session?.id

    if (!contractorId) {
        redirect("/login")
    }

    // Use Admin Client to bypass RLS for custom contractor auth
    const { createAdminClient } = await import("@/utils/supabase/admin")
    const supabase = createAdminClient()

    // Fetch payment details with security check (must belong to contractor)
    const { data: payment } = await supabase
        .from("payments")
        .select(`
            *,
            profiles:user_id (full_name)
        `)
        .eq("id", id)
        .eq("user_id", contractorId)
        .single()

    if (!payment) {
        notFound()
    }

    // Fetch owner details (for receipt issuer info)
    const { data: owner } = await supabase
        .from("profiles")
        .select("company_name, address, phone_number, invoice_registration_number")
        .eq("role", "owner")
        .single()

    const { profiles: profile } = payment
    const contractorName = profile?.full_name || "契約者様"

    return (
        <div className="min-h-screen bg-gray-100 p-8 flex flex-col items-center print:bg-white print:p-0">
            <ReceiptStyle />

            {/* Control Bar (Hidden when printing) */}
            <ReceiptControlBar />

            {/* Receipt Paper (A4 size approximation) */}
            <div className="w-full max-w-[210mm] bg-white shadow-lg p-12 min-h-[148mm] relative print:shadow-none print:w-full print:max-w-none">

                {/* Header */}
                <div className="text-center border-b-2 border-gray-800 pb-6 mb-8">
                    <h1 className="text-3xl font-serif font-bold tracking-widest text-gray-900">領収書</h1>
                    <p className="text-sm text-gray-500 mt-2">Receipt</p>
                </div>

                {/* Main Content */}
                <div className="space-y-8">
                    {/* Amount */}
                    <div className="flex justify-between items-end border-b border-gray-300 pb-2">
                        <div className="text-xl">
                            <span className="font-bold text-2xl underline decoration-1 underline-offset-4">{contractorName}</span> 様
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-500 mb-1">金額 (Amount)</p>
                            <p className="text-4xl font-bold">¥{payment.amount.toLocaleString()}-</p>
                        </div>
                    </div>

                    {/* Details */}
                    <div className="py-4">
                        <div className="grid grid-cols-[100px_1fr] gap-4 mb-2">
                            <span className="text-gray-600">但し</span>
                            <span>{payment.target_month.replace('-', '年')}月分 駐車場代として</span>
                        </div>
                        <div className="grid grid-cols-[100px_1fr] gap-4">
                            <span className="text-gray-600">発行日</span>
                            <span>{new Date(payment.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        </div>
                        <div className="grid grid-cols-[100px_1fr] gap-4 mt-8 pt-4 border-t border-dashed border-gray-300 text-sm text-gray-500">
                            <span>お支払方法</span>
                            <span>
                                {payment.stripe_session_id === 'manual_entry' ? '現金・その他' : 'クレジットカード'}
                            </span>
                        </div>
                        <div className="mt-2 text-right text-xs text-gray-400">
                            No. {payment.id.split('-')[0]}
                        </div>
                    </div>
                </div>

                {/* Issuer Information */}
                <div className="mt-16 bg-gray-50 p-6 rounded border border-gray-200 print:bg-white print:border-gray-300">
                    <h3 className="font-bold text-lg mb-2">{owner?.company_name || '駐車場管理者'}</h3>
                    <div className="text-sm space-y-1 text-gray-600">
                        {owner?.address && <p>{owner.address}</p>}
                        {owner?.phone_number && <p>TEL: {owner.phone_number}</p>}

                        {owner?.invoice_registration_number && (
                            <div className="mt-4 pt-2 border-t border-gray-300 w-fit">
                                <p className="font-mono text-xs">登録番号: {owner.invoice_registration_number}</p>
                            </div>
                        )}
                    </div>

                    {/* Stamp Placeholder */}
                    <div className="absolute bottom-12 right-12 w-20 h-20 border-2 border-red-500 rounded-full opacity-50 flex items-center justify-center text-red-500 font-bold -rotate-12 print:opacity-100">
                        領収済
                    </div>
                </div>
            </div>
        </div>
    )
}
