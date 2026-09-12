import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogTrigger,
} from "@/components/ui/dialog"
import { reportBankTransfer } from "./actions"
import { BankTransferInfoStep } from "./components/bank-transfer-info-step"
import { BankTransferFormStep } from "./components/bank-transfer-form-step"

interface BankTransferDialogProps {
    contractorId: string
    targetMonths: string[]
    monthlyFee: number
    owner: {
        bank_name: string | null
        bank_branch_name: string | null
        account_type: string | null
        account_number: string | null
        account_holder_name: string | null
    }
    trigger?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function BankTransferDialog({
    contractorId,
    targetMonths,
    monthlyFee,
    owner,
    trigger,
    open: controlledOpen,
    onOpenChange: setControlledOpen
}: BankTransferDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const [step, setStep] = useState<'info' | 'form'>('info')

    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen

    const setOpen = (newOpen: boolean) => {
        if (!newOpen) {
            // Reset step when closing
            setTimeout(() => setStep('info'), 300)
        }
        if (isControlled) {
            setControlledOpen?.(newOpen)
        } else {
            setInternalOpen(newOpen)
        }
    }

    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const totalAmount = targetMonths.length * monthlyFee

    const handleSubmit = async (transferName: string, transferDate: string) => {
        setIsSubmitting(true)
        setError(null)
        try {
            const formData = new FormData()
            formData.append('contractorId', contractorId)
            formData.append('months', JSON.stringify(targetMonths))
            formData.append('transferName', transferName)
            formData.append('transferDate', transferDate)

            const result = await reportBankTransfer(formData)
            if (result?.error) {
                setError(result.error)
            } else {
                setOpen(false)
                setStep('info')
            }
        } catch {
            setError('予期せぬエラーが発生しました。しばらく時間をおいてから再度お試しください。')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-[500px] w-[95vw] max-h-[90vh] overflow-y-auto transition-all rounded-lg">
                {step === 'info' ? (
                    <BankTransferInfoStep
                        totalAmount={totalAmount}
                        targetMonths={targetMonths}
                        owner={owner}
                        onNext={() => setStep('form')}
                    />
                ) : (
                    <BankTransferFormStep
                        onSubmit={handleSubmit}
                        onBack={() => setStep('info')}
                        isSubmitting={isSubmitting}
                        error={error}
                    />
                )}
            </DialogContent>
        </Dialog>
    )
}

