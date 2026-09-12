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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateContractor } from "./actions"
import { Pencil } from "lucide-react"

type Contractor = {
    id: string
    full_name: string
    monthly_fee: number
    phone_number: string | null
    contract_start_month: string | null
    contract_end_month: string | null
}

export function EditContractorDialog({ contractor }: { contractor: Contractor }) {
    const [open, setOpen] = useState(false)

    async function handleSubmit(formData: FormData) {
        const result = await updateContractor(formData)
        if (result?.success) {
            setOpen(false)
        } else {
            alert("契約者の更新に失敗しました")
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Pencil className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>契約者情報を編集</DialogTitle>
                    <DialogDescription>
                        契約者のプロフィール情報を編集します。
                    </DialogDescription>
                </DialogHeader>
                <form action={handleSubmit}>
                    <input type="hidden" name="id" value={contractor.id} />
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                氏名
                            </Label>
                            <Input
                                id="name"
                                name="name"
                                className="col-span-3"
                                defaultValue={contractor.full_name}
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="phoneNumber" className="text-right">
                                電話番号
                            </Label>
                            <Input
                                id="phoneNumber"
                                name="phoneNumber"
                                type="tel"
                                placeholder="090-1234-5678"
                                className="col-span-3"
                                defaultValue={contractor.phone_number || ''}
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="monthlyFee" className="text-right">
                                月額料金
                            </Label>
                            <Input
                                id="monthlyFee"
                                name="monthlyFee"
                                type="number"
                                className="col-span-3"
                                defaultValue={contractor.monthly_fee}
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="contractStart" className="text-right">
                                契約開始月
                            </Label>
                            <Input
                                id="contractStart"
                                name="contractStart"
                                type="month"
                                className="col-span-3"
                                defaultValue={contractor.contract_start_month || ''}
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="contractEnd" className="text-right">
                                契約終了月
                            </Label>
                            <Input
                                id="contractEnd"
                                name="contractEnd"
                                type="month"
                                placeholder="無期限の場合は空欄"
                                className="col-span-3"
                                defaultValue={contractor.contract_end_month || ''}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit">更新</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
