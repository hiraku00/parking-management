import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { ArrowLeft } from "lucide-react"

interface BankTransferFormStepProps {
    onSubmit: (transferName: string, transferDate: string) => Promise<void>
    onBack: () => void
    isSubmitting: boolean
    error: string | null
}

export function BankTransferFormStep({ onSubmit, onBack, isSubmitting, error }: BankTransferFormStepProps) {
    const [transferName, setTransferName] = useState("")
    const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10))

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!confirm('入力内容に間違いはありませんか？')) return
        onSubmit(transferName, transferDate)
    }

    return (
        <>
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    STEP 2. 振込完了の報告
                </DialogTitle>
                <DialogDescription>
                    お振込みいただいた内容を入力してください。
                </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
                <div className="bg-green-50 px-4 py-3 rounded text-green-800 text-sm font-medium flex items-center gap-2">
                    <span className="text-lg">✅</span>
                    振込手続き完了済み
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                        <span className="text-lg">⚠️</span>
                        <div>
                            <p className="font-bold">エラー</p>
                            <p>{error}</p>
                        </div>
                    </div>
                )}

                {/* Report Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid gap-2">
                        <Label htmlFor="transferName">振込名義（カナ）</Label>
                        <Input
                            id="transferName"
                            value={transferName}
                            onChange={(e) => setTransferName(e.target.value)}
                            placeholder="ヤマダ タロウ"
                            className="text-lg"
                            required
                        />
                        <p className="text-xs text-muted-foreground">
                            ※実際に振込を行った際の名前（依頼人名）を入力してください。
                        </p>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="transferDate">振込日</Label>
                        <Input
                            id="transferDate"
                            type="date"
                            value={transferDate}
                            onChange={(e) => setTransferDate(e.target.value)}
                            className="text-lg"
                            required
                        />
                    </div>

                    <DialogFooter className="pt-4 flex items-center gap-2 sm:justify-between">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onBack}
                            className="text-gray-500"
                        >
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            戻る
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="flex-1 bg-indigo-600 hover:bg-indigo-700 h-11 text-base">
                            {isSubmitting ? "送信中..." : "報告を送信する"}
                        </Button>
                    </DialogFooter>
                </form>
            </div>
        </>
    )
}
