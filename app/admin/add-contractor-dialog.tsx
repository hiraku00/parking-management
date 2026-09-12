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
import { addContractor } from "./actions"

export function AddContractorDialog() {
    const [open, setOpen] = useState(false)

    async function handleSubmit(formData: FormData) {
        const result = await addContractor(formData)
        if (result?.success) {
            setOpen(false)
        } else {
            alert("契約者の追加に失敗しました")
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>契約者を追加</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>新しい契約者を追加</DialogTitle>
                    <DialogDescription>
                        新しい契約者のプロフィールを作成します。契約者は名前と電話番号下4桁でログインできます。
                    </DialogDescription>
                </DialogHeader>
                <form action={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                氏名
                            </Label>
                            <Input id="name" name="name" className="col-span-3" required />
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
                                defaultValue="3000"
                                className="col-span-3"
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
                                defaultValue={new Date().toISOString().slice(0, 7)}
                                className="col-span-3"
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
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit">保存</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
