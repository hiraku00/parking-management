import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface OwnerInfo {
    bank_name: string | null
    bank_branch_name: string | null
    account_type: string | null
    account_number: string | null
    account_holder_name: string | null
}

interface BankTransferInfoStepProps {
    totalAmount: number
    targetMonths: string[]
    owner: OwnerInfo
    onNext: () => void
}

export function BankTransferInfoStep({ totalAmount, targetMonths, owner, onNext }: BankTransferInfoStepProps) {
    const [isConfirmed, setIsConfirmed] = useState(false)

    return (
        <>
            <DialogHeader>
                <DialogTitle>STEP 1. 振込先の確認</DialogTitle>
                <DialogDescription>
                    まずは以下の口座へ、合計金額をお振込みください。<br />
                    <strong>お振込みが完了してから</strong>、確認にチェックを入れて進んでください。
                </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 sm:space-y-6 py-4">
                {/* Amount Info */}
                <div className="text-center p-4 sm:p-6 bg-indigo-50 rounded-xl border-2 border-indigo-100">
                    <div className="text-sm text-indigo-600 font-medium mb-1">振込合計金額</div>
                    <div className="text-3xl sm:text-4xl font-extrabold text-indigo-700">
                        ¥{totalAmount.toLocaleString()}
                    </div>
                    <div className="text-sm text-indigo-400 mt-2">
                        対象: {targetMonths.length > 1
                            ? `${targetMonths[0]} 〜 ${targetMonths[targetMonths.length - 1]}`
                            : targetMonths[0]
                        } ({targetMonths.length}ヶ月分)
                    </div>
                </div>

                {/* Bank Info Section */}
                <div className="bg-white p-4 rounded-lg border shadow-sm space-y-3">
                    <h4 className="font-semibold text-gray-700 flex items-center gap-2 border-b pb-2">
                        <span>🏦</span> 振込先口座
                    </h4>
                    <div className="grid grid-cols-[auto_1fr] sm:grid-cols-[80px_1fr] gap-x-3 sm:gap-x-4 gap-y-3 text-sm">
                        <div className="text-gray-500 whitespace-nowrap">銀行名</div>
                        <div className="font-bold text-base">{owner.bank_name}</div>

                        <div className="text-gray-500 whitespace-nowrap">支店名</div>
                        <div className="font-bold text-base">{owner.bank_branch_name}</div>

                        <div className="text-gray-500 whitespace-nowrap">口座種別</div>
                        <div className="font-medium">{owner.account_type === 'current' ? '当座' : '普通'}</div>

                        <div className="text-gray-500 whitespace-nowrap">口座番号</div>
                        <div className="font-mono font-bold text-lg tracking-wider">{owner.account_number}</div>

                        <div className="text-gray-500 self-center whitespace-nowrap">口座名義</div>
                        <div className="font-bold text-base text-gray-900 bg-gray-100 px-2 py-1 rounded inline-block break-all">
                            {owner.account_holder_name}
                        </div>
                    </div>
                </div>

                {/* Confirmation Checkbox */}
                <div className="flex items-start space-x-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <Checkbox
                        id="confirm-transfer"
                        checked={isConfirmed}
                        onCheckedChange={(checked) => setIsConfirmed(checked as boolean)}
                        className="mt-1"
                    />
                    <div className="grid gap-1.5 leading-none">
                        <Label
                            htmlFor="confirm-transfer"
                            className="text-sm font-bold text-orange-900 leading-snug cursor-pointer"
                        >
                            上記口座への振り込みを完了しました
                        </Label>
                        <p className="text-xs text-orange-700 font-medium">
                            ※振り込み前に次へ進むことはできません
                        </p>
                    </div>
                </div>

                <DialogFooter className="pt-2 flex flex-col sm:flex-col sm:space-x-0 gap-3">
                    <Button
                        className="w-full h-12 text-lg font-bold bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all disabled:opacity-30 disabled:grayscale"
                        onClick={onNext}
                        disabled={!isConfirmed}
                    >
                        振込報告画面へ進む
                    </Button>
                </DialogFooter>
            </div>
        </>
    )
}

