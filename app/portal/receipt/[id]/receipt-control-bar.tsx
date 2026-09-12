'use client'

import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"

export function ReceiptControlBar() {
    return (
        <div className="w-full max-w-[210mm] mb-6 flex justify-between items-center print:hidden">
            <Button variant="outline" onClick={() => window.history.back()}>
                戻る
            </Button>
            <Button onClick={() => window.print()} className="gap-2 bg-blue-600 hover:bg-blue-700">
                <Printer className="h-4 w-4" />
                印刷 / PDF保存
            </Button>
        </div>
    )
}
