'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { createCheckoutSession } from "./actions"
import { BankTransferDialog } from "./bank-transfer-dialog"

interface PaymentDashboardProps {
    contractorId: string
    unpaidMonths: string[] // sorted old -> new
    monthlyFee: number
    owner: {
        bank_name: string | null
        bank_branch_name: string | null
        account_type: string | null
        account_number: string | null
        account_holder_name: string | null
    }
}

export function PaymentDashboard({ contractorId, unpaidMonths, monthlyFee, owner }: PaymentDashboardProps) {
    const [selectedCount, setSelectedCount] = useState<number>(unpaidMonths.length > 0 ? 1 : 0)

    const targetMonths = unpaidMonths.slice(0, selectedCount)
    const totalAmount = selectedCount * monthlyFee

    const handleMonthClick = (index: number) => {
        // Clicking index 0 means paying for 1 month (index 0)
        // Clicking index 2 means paying for 3 months (indices 0, 1, 2)
        setSelectedCount(index + 1)
    }

    if (unpaidMonths.length === 0) {
        return (
            <div className="bg-gray-50 border rounded-lg p-8 text-center text-gray-500">
                お支払いが必要な月はありません。
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Visual Selection List */}
            <div className="space-y-2">
                <p className="text-sm text-gray-500">
                    お支払いを行う範囲を選択してください（古い月から順に選択されます）。
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {unpaidMonths.map((month, index) => {
                        const isSelected = index < selectedCount
                        return (
                            <div
                                key={month}
                                onClick={() => handleMonthClick(index)}
                                className={`
                                    cursor-pointer p-4 rounded-lg border-2 transition-all duration-200 relative
                                    ${isSelected
                                        ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                                        : 'border-slate-200 bg-white hover:border-indigo-200'
                                    }
                                `}
                            >
                                <div className="flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <span className={`text-lg font-bold ${isSelected ? 'text-indigo-900' : 'text-slate-600'}`}>
                                            {month}
                                        </span>
                                        <span className="text-sm text-muted-foreground">
                                            ¥{monthlyFee.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className={`
                                        w-6 h-6 rounded-full border-2 flex items-center justify-center
                                        ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300'}
                                    `}>
                                        {isSelected && (
                                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                                {isSelected && (
                                    <div className="absolute top-2 right-2">
                                        {/* Optional badge or indicator */}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Action Panel (Sticky-like) */}
            <div className="bg-white border rounded-xl shadow-lg p-4 md:p-6 sticky bottom-4 z-10 transition-all">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 md:gap-6">
                    <div className="text-center md:text-left w-full md:w-auto">
                        <div className="text-sm text-gray-500 mb-1 flex flex-col md:block">
                            <span>選択中: <span className="font-bold text-gray-900">{selectedCount}ヶ月分</span></span>
                            <span className="hidden md:inline"> </span>
                            <span className="text-xs sm:text-sm">
                                （{targetMonths.length > 1
                                    ? `${targetMonths[0]} 〜 ${targetMonths[targetMonths.length - 1]}`
                                    : targetMonths[0]
                                }）
                            </span>
                        </div>
                        <div className="flex items-baseline gap-2 justify-center md:justify-start">
                            <span className="text-sm font-bold text-gray-600">合計</span>
                            <span className="text-2xl md:text-3xl font-extrabold text-indigo-600">
                                ¥{totalAmount.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                        {/* Credit Card Action */}
                        <form action={createCheckoutSession} className="flex-1 w-full md:w-auto">
                            <input type="hidden" name="months" value={JSON.stringify(targetMonths)} />
                            <Button
                                type="submit"
                                size="lg"
                                className="w-full md:w-auto font-bold text-lg h-12 px-8 shadow-md hover:shadow-lg transition-shadow"
                            >
                                💳 カードで支払う
                            </Button>
                        </form>

                        {/* Bank Transfer Action */}
                        {owner.bank_name ? (
                            <BankTransferDialog
                                contractorId={contractorId}
                                targetMonths={targetMonths}
                                monthlyFee={monthlyFee}
                                owner={owner}
                                trigger={
                                    <Button
                                        variant="outline"
                                        size="lg"
                                        className="w-full md:w-auto font-bold text-lg h-12 bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                                    >
                                        🏦 銀行振込で払う
                                    </Button>
                                }
                            />
                        ) : (
                            <div className="flex items-center text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-lg">
                                ※銀行振込は現在ご利用いただけません
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
