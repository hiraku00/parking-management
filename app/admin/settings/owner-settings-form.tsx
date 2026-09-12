'use client'

import { updateOwnerSettings } from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

import { useTransition, useState } from "react"


interface OwnerSettingsFormProps {
    initialData: {
        company_name: string | null
        address: string | null
        invoice_registration_number: string | null
        bank_name: string | null
        bank_branch_name: string | null
        account_type: string | null
        account_number: string | null
        account_holder_name: string | null
    }
}

export function OwnerSettingsForm({ initialData }: OwnerSettingsFormProps) {
    const [isPending, startTransition] = useTransition()
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    const handleSubmit = async (formData: FormData) => {
        startTransition(async () => {
            const result = await updateOwnerSettings(formData)
            if (result.error) {
                setMessage({ type: 'error', text: result.error })
            } else {
                setMessage({ type: 'success', text: "設定を更新しました。" })
                // Hide message after 3 seconds
                setTimeout(() => setMessage(null), 3000)
            }
        })
    }

    return (
        <form action={handleSubmit} className="space-y-8">
            {message && (
                <div className={`p-4 rounded-md ${message.type === 'error' ? 'bg-red-50 text-red-900' : 'bg-green-50 text-green-900'}`}>
                    {message.text}
                </div>
            )}
            <Card>
                <CardHeader>
                    <CardTitle>事業者情報</CardTitle>
                    <CardDescription>
                        請求書や領収書に表示される情報です。
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="companyName">屋号・会社名</Label>
                            <Input
                                id="companyName"
                                name="companyName"
                                defaultValue={initialData.company_name || ""}
                                placeholder="例: 駐車場 管理太郎"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="invoiceNumber">インボイス登録番号</Label>
                            <Input
                                id="invoiceNumber"
                                name="invoiceNumber"
                                defaultValue={initialData.invoice_registration_number || ""}
                                placeholder="例: T1234567890123"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="address">住所</Label>
                        <Input
                            id="address"
                            name="address"
                            defaultValue={initialData.address || ""}
                            placeholder="例: 〒100-0001 東京都千代田区千代田1-1"
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>振込先口座情報</CardTitle>
                    <CardDescription>
                        銀行振込を選択した契約者に表示される情報です。
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="bankName">銀行名</Label>
                            <Input
                                id="bankName"
                                name="bankName"
                                defaultValue={initialData.bank_name || ""}
                                placeholder="例: みずほ銀行"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="branchName">支店名</Label>
                            <Input
                                id="branchName"
                                name="branchName"
                                defaultValue={initialData.bank_branch_name || ""}
                                placeholder="例: 丸の内支店"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="accountType">口座種別</Label>
                            <div className="flex items-center space-x-4 pt-2">
                                <label className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        name="accountType"
                                        value="ordinary"
                                        defaultChecked={initialData.account_type === "ordinary" || !initialData.account_type}
                                        className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <span>普通</span>
                                </label>
                                <label className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        name="accountType"
                                        value="current"
                                        defaultChecked={initialData.account_type === "current"}
                                        className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <span>当座</span>
                                </label>
                            </div>
                        </div>
                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="accountNumber">口座番号</Label>
                            <Input
                                id="accountNumber"
                                name="accountNumber"
                                defaultValue={initialData.account_number || ""}
                                placeholder="例: 1234567"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="accountHolder">口座名義（カナ）</Label>
                        <Input
                            id="accountHolder"
                            name="accountHolder"
                            defaultValue={initialData.account_holder_name || ""}
                            placeholder="例: チュウシャジョウ　カンリタロウ"
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button type="submit" disabled={isPending}>
                    {isPending ? "保存中..." : "保存する"}
                </Button>
            </div>
        </form>
    )
}
