import { getSession } from "@/app/lib/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { calculateUnpaidMonths } from "@/utils/calculation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PaymentDashboard } from "./payment-dashboard"

export default async function PortalPage({
    searchParams,
}: {
    searchParams: Promise<{ success?: string; month?: string; months?: string; error?: string }>
}) {
    const { success, month, months, error } = await searchParams

    let displayMonths = month
    if (months) {
        try {
            const parsed = JSON.parse(months)
            if (Array.isArray(parsed)) {
                displayMonths = parsed.join(', ')
            }
        } catch {
            // Ignore parse error
        }
    }
    const session = await getSession()
    if (!session || !session.id) {
        redirect("/login")
    }
    const contractorId = session.id as string

    // Use Admin Client to bypass RLS for custom contractor auth
    const { createAdminClient } = await import("@/utils/supabase/admin")
    const supabase = createAdminClient()

    // Fetch contractor profile
    const { data: contractor } = await supabase
        .from("profiles")
        .select("full_name, contract_start_month, contract_end_month, monthly_fee")
        .eq("id", contractorId)
        .single()

    // Fetch payments
    const { data: payments } = await supabase
        .from("payments")
        .select("*")
        .eq("user_id", contractorId)
        .order("created_at", { ascending: false })

    // Fetch owner profile for bank details
    const { data: owner } = await supabase
        .from("profiles")
        .select("bank_name, bank_branch_name, account_type, account_number, account_holder_name")
        .eq("role", "owner")
        .single()

    const paidMonths = new Set(payments?.filter(p => p.status === 'succeeded').map((p) => p.target_month))
    const pendingMonths = new Set(payments?.filter(p => p.status === 'pending').map((p) => p.target_month))


    // unpaidMonthsFromCalc includes months that are NOT succeeded. 
    // This INCLUDES pending months.
    const unpaidMonthsFromCalc = calculateUnpaidMonths(
        contractor?.contract_start_month || null,
        contractor?.contract_end_month || null,
        paidMonths
    )

    // Truely unpaid (not paid AND not pending) user for BankTransferDialog
    const eligibleForTransferMonths = unpaidMonthsFromCalc.filter(m => !pendingMonths.has(m))

    return (
        <div className="space-y-6">
            {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-md flex items-center gap-3">
                    <span className="text-xl">✅</span>
                    <div>
                        <span className="font-bold">{displayMonths}</span>のお支払いが完了しました。ありがとうございます。
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md flex items-center gap-3">
                    <span className="text-xl">⚠️</span>
                    <div>
                        <p className="font-bold">エラーが発生しました</p>
                        <p className="text-sm">{error}</p>
                    </div>
                </div>
            )}

            {/* Unpaid Months */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle>お支払い</CardTitle>
                            <CardDescription className="mt-1">
                                未払いのお支払い方法を選択してください。
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Pending Payments Alert */}
                    {pendingMonths.size > 0 && (
                        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                            <span className="text-2xl">⏳</span>
                            <div>
                                <h3 className="font-bold text-yellow-800">確認中のお支払いがあります</h3>
                                <p className="text-sm text-yellow-700 mt-1">
                                    銀行振込の確認待ちです: <span className="font-medium">{Array.from(pendingMonths).sort().join(', ')}</span>
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="grid gap-8">
                        {/* Unified Payment Dashboard */}
                        <PaymentDashboard
                            contractorId={contractorId || ""}
                            unpaidMonths={eligibleForTransferMonths}
                            monthlyFee={contractor?.monthly_fee || 0}
                            owner={{
                                bank_name: owner?.bank_name ?? null,
                                bank_branch_name: owner?.bank_branch_name ?? null,
                                account_type: owner?.account_type ?? null,
                                account_number: owner?.account_number ?? null,
                                account_holder_name: owner?.account_holder_name ?? null,
                            }}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Payment History */}
            <Card>
                <CardHeader>
                    <CardTitle>過去のお支払い履歴</CardTitle>
                    <CardDescription>
                        これまでの入金記録です。
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>日付</TableHead>
                                <TableHead>対象月</TableHead>
                                <TableHead>金額</TableHead>
                                <TableHead>状態</TableHead>
                                <TableHead>領収書</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {payments?.map((payment) => (
                                <TableRow key={payment.id}>
                                    <TableCell>{new Date(payment.created_at).toLocaleDateString('ja-JP')}</TableCell>
                                    <TableCell>{payment.target_month}</TableCell>
                                    <TableCell>¥{payment.amount.toLocaleString()}</TableCell>
                                    <TableCell>
                                        <Badge variant={payment.status === 'succeeded' ? 'default' : 'secondary'}>
                                            {payment.status === 'succeeded' ? '支払済' : payment.status === 'pending' ? '確認中' : payment.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {payment.status === 'succeeded' && (
                                            <div className="flex items-center gap-2">
                                                <a href={`/portal/receipt/${payment.id}`} target="_blank" className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm bg-blue-50 px-3 py-1 rounded-full border border-blue-200 hover:bg-blue-100 transition-colors">
                                                    <span>📄</span>
                                                    領収書を発行
                                                </a>
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {(!payments || payments.length === 0) && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                                        まだお支払いの履歴はありません。
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
