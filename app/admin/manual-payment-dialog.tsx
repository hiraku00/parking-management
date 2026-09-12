'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { createManualPayment } from "./actions"
import { BadgeJapaneseYen } from "lucide-react"

type ManualPaymentDialogProps = {
    contractorId: string
    contractorName: string
    monthlyFee: number
    unpaidMonths: string[]
}

export function ManualPaymentDialog({ contractorId, contractorName, monthlyFee, unpaidMonths }: ManualPaymentDialogProps) {
    const [open, setOpen] = useState(false)
    const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set())
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer'>('cash')
    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleMonthToggle = (month: string) => {
        const newSelected = new Set(selectedMonths)
        if (newSelected.has(month)) {
            newSelected.delete(month)
        } else {
            newSelected.add(month)
        }
        setSelectedMonths(newSelected)
    }

    async function handleSubmit() {
        if (selectedMonths.size === 0) return

        const methodText = paymentMethod === 'cash' ? '現金' : '銀行振込'
        if (!confirm(`${selectedMonths.size}ヶ月分の入金（${methodText}）を消込しますか？`)) {
            return
        }

        setIsSubmitting(true)
        setError(null)

        try {
            // Process sequentially to keep simple logic (could be parallelized)
            for (const month of Array.from(selectedMonths)) {
                const formData = new FormData()
                formData.append('userId', contractorId)
                formData.append('amount', monthlyFee.toString())
                formData.append('targetMonth', month)
                formData.append('paymentMethod', paymentMethod)

                const result = await createManualPayment(formData)
                if (result?.error) {
                    setError(`${month}分の消込に失敗しました: ${result.error}`)
                    setIsSubmitting(false)
                    return
                }
            }

            setOpen(false)
            setSelectedMonths(new Set())
        } catch {
            setError('予期せぬエラーが発生しました。')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-blue-500 hover:text-blue-700 hover:bg-blue-50">
                    <BadgeJapaneseYen className="h-5 w-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>手動入金消込</DialogTitle>
                    <DialogDescription>
                        {contractorName}さんの未払い月を入金済みとして記録します。<br />
                        現金や振込で受領した場合に使用してください。
                    </DialogDescription>
                </DialogHeader>

                {unpaidMonths.length === 0 ? (
                    <div className="py-6 text-center text-gray-500">
                        未払いの月はありません。
                    </div>
                ) : (
                    <div className="grid gap-4 py-4 max-h-[300px] overflow-y-auto">
                        <div className="space-y-2 mb-4">
                            <Label>支払い方法</Label>
                            <div className="flex items-center space-x-4">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="paymentMethod"
                                        value="cash"
                                        checked={paymentMethod === 'cash'}
                                        onChange={() => setPaymentMethod('cash')}
                                        className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span>現金</span>
                                </label>
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="paymentMethod"
                                        value="bank_transfer"
                                        checked={paymentMethod === 'bank_transfer'}
                                        onChange={() => setPaymentMethod('bank_transfer')}
                                        className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span>銀行振込</span>
                                </label>
                            </div>
                        </div>

                        <p className="text-sm font-medium mb-2">未払い月一覧</p>
                        {unpaidMonths.map((month) => (
                            <div key={month} className="flex items-center space-x-2 border p-3 rounded-md">
                                <Checkbox
                                    id={`month-${month}`}
                                    checked={selectedMonths.has(month)}
                                    onCheckedChange={() => handleMonthToggle(month)}
                                />
                                <Label htmlFor={`month-${month}`} className="flex-1 cursor-pointer flex justify-between items-center">
                                    <span>{month}</span>
                                    <span className="text-gray-500">¥{monthlyFee.toLocaleString()}</span>
                                </Label>
                            </div>
                        ))}
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-4">
                        {error}
                    </div>
                )}

                <DialogFooter>
                    <div className="flex w-full justify-between items-center">
                        <span className="font-bold">
                            合計: ¥{(selectedMonths.size * monthlyFee).toLocaleString()}
                        </span>
                        <Button onClick={handleSubmit} disabled={selectedMonths.size === 0 || isSubmitting}>
                            {isSubmitting ? '処理中...' : '消込実行'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
