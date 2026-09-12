'use client'

import { useTransition, useState } from "react"
import { Button } from "@/components/ui/button"
import { approvePayments } from "./actions"

export function ApprovePaymentButton({ paymentIds }: { paymentIds: string[] }) {
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const handleApprove = () => {
        if (!confirm(`この振込（${paymentIds.length}ヶ月分の申請）を承認し、支払い済みにしますか？`)) return

        setError(null)
        startTransition(async () => {
            const result = await approvePayments(paymentIds)
            if (result?.error) {
                setError(result.error)
                // Clear error after 5 seconds
                setTimeout(() => setError(null), 5000)
            }
        })
    }

    return (
        <div className="flex flex-col items-end gap-1">
            <Button
                size="sm"
                onClick={handleApprove}
                disabled={isPending}
                className="bg-green-600 hover:bg-green-700"
            >
                {isPending ? "処理中..." : "承認"}
            </Button>
            {error && <span className="text-[10px] text-red-600 font-bold">{error}</span>}
        </div>
    )
}
