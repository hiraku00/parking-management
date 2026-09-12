import { createClient } from "@/utils/supabase/server"
import { AddContractorDialog } from "./add-contractor-dialog"
import { EditContractorDialog } from "./edit-contractor-dialog"
import { DeleteContractorButton } from "./delete-contractor-button"
import { ManualPaymentDialog } from "./manual-payment-dialog"
import { calculateUnpaidMonths } from "@/utils/calculation"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ApprovePaymentButton } from "./approve-payment-button"

export default async function AdminPage() {
    const supabase = await createClient()

    // Fetch all contractors
    const { data: contractors } = await supabase
        .from('profiles')
        .select('id, full_name, monthly_fee, phone_number, contract_start_month, contract_end_month')
        .eq('role', 'contractor')
        .order('full_name')

    // Fetch all payments
    const { data: allPayments } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })

    const payments = allPayments?.filter(p => p.status === 'succeeded') || []
    const pendingPayments = allPayments?.filter(p => p.status === 'pending') || []

    // Group pending payments by transfer request (user + transfer details)
    const groupedPendingPayments = new Map<string, typeof pendingPayments>()
    pendingPayments.forEach(p => {
        const metadata = p.metadata as { transfer_date?: string; transfer_name?: string } | null
        // If metadata is empty (old data), fallback to ID to list individually
        const key = metadata?.transfer_date
            ? `${p.user_id}-${metadata.transfer_date}-${metadata.transfer_name}`
            : p.id

        if (!groupedPendingPayments.has(key)) {
            groupedPendingPayments.set(key, [])
        }
        groupedPendingPayments.get(key)?.push(p)
    })

    // Group paid payments by user for calculation
    const userPaidMonths = new Map<string, Set<string>>()
    payments?.forEach(p => {
        if (!userPaidMonths.has(p.user_id)) {
            userPaidMonths.set(p.user_id, new Set())
        }
        userPaidMonths.get(p.user_id)?.add(p.target_month)
    })

    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
    const currentMonthPaidCount = payments?.filter(p => p.target_month === currentMonth).length || 0

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">概要</h2>
                <AddContractorDialog />
            </div>

            {/* Pending Approvals */}
            {groupedPendingPayments.size > 0 && (
                <Card className="border-yellow-200 bg-yellow-50">
                    <CardHeader>
                        <CardTitle className="text-yellow-800 flex items-center gap-2">
                            🔔 承認待ちの振込 ({groupedPendingPayments.size}件)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>報告日</TableHead>
                                    <TableHead>契約者名</TableHead>
                                    <TableHead>対象月</TableHead>
                                    <TableHead>振込名義 / 日付</TableHead>
                                    <TableHead>金額</TableHead>
                                    <TableHead>操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Array.from(groupedPendingPayments.values()).map((group) => {
                                    const first = group[0]
                                    const metadata = first.metadata as { transfer_date?: string; transfer_name?: string } | null
                                    const contractor = contractors?.find(c => c.id === first.user_id)
                                    const ids = group.map(p => p.id)
                                    const totalAmount = group.reduce((sum, p) => sum + p.amount, 0)
                                    const sortedMonths = group.map(p => p.target_month).sort()

                                    // Range display
                                    const monthDisplay = sortedMonths.length > 1
                                        ? `${sortedMonths[0]} 〜 ${sortedMonths[sortedMonths.length - 1]}`
                                        : sortedMonths[0]

                                    return (
                                        <TableRow key={ids.join(',')} className="bg-white/50">
                                            <TableCell>{new Date(first.created_at).toLocaleDateString('ja-JP')}</TableCell>
                                            <TableCell className="font-medium">{contractor?.full_name || '不明'}</TableCell>
                                            <TableCell>
                                                {monthDisplay}
                                                {sortedMonths.length > 1 && <span className="text-xs text-gray-500 ml-1">({sortedMonths.length}ヶ月分)</span>}
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">
                                                    <div>{metadata?.transfer_name || '-'}</div>
                                                    <div className="text-gray-500 text-xs">{metadata?.transfer_date || '-'}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell>¥{totalAmount.toLocaleString()}</TableCell>
                                            <TableCell>
                                                <ApprovePaymentButton paymentIds={ids} />
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">契約者総数</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{contractors?.length || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">今月の支払済</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{currentMonthPaidCount}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>契約者一覧</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>氏名</TableHead>
                                <TableHead>電話番号</TableHead>
                                <TableHead>月額料金</TableHead>
                                <TableHead>契約期間</TableHead>
                                <TableHead>ステータス</TableHead>
                                <TableHead className="text-right">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {contractors?.map((contractor) => {
                                const paidMonths = userPaidMonths.get(contractor.id) || new Set()
                                const unpaidMonths = calculateUnpaidMonths(
                                    contractor.contract_start_month,
                                    contractor.contract_end_month,
                                    paidMonths,
                                    currentMonth
                                )
                                const unpaidPastCount = unpaidMonths.filter(m => m < currentMonth).length
                                const isCurrentMonthUnpaid = unpaidMonths.includes(currentMonth)

                                return (
                                    <TableRow key={contractor.id}>
                                        <TableCell className="font-medium">{contractor.full_name}</TableCell>
                                        <TableCell>{contractor.phone_number || '-'}</TableCell>
                                        <TableCell>¥{contractor.monthly_fee.toLocaleString()}</TableCell>
                                        <TableCell className="text-sm">
                                            {contractor.contract_start_month || '-'} 〜 {contractor.contract_end_month || '無期限'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                {unpaidPastCount > 0 && (
                                                    <Badge variant="destructive">滞納 {unpaidPastCount}ヶ月</Badge>
                                                )}
                                                {isCurrentMonthUnpaid ? (
                                                    <Badge variant="outline" className="text-red-500 border-red-500">
                                                        今月未払
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-green-500">今月支払済</Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <ManualPaymentDialog
                                                    contractorId={contractor.id}
                                                    contractorName={contractor.full_name}
                                                    monthlyFee={contractor.monthly_fee}
                                                    unpaidMonths={unpaidMonths}
                                                />
                                                <EditContractorDialog contractor={contractor} />
                                                <DeleteContractorButton id={contractor.id} name={contractor.full_name} />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                            {(!contractors || contractors.length === 0) && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-gray-500">
                                        契約者が見つかりません。
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
