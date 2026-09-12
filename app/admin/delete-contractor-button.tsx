'use client'

import { deleteContractor } from "./actions"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"

export function DeleteContractorButton({ id, name }: { id: string, name: string }) {
    async function handleDelete(formData: FormData) {
        if (!confirm(`${name}さんを削除してもよろしいですか？\n削除すると元に戻せません。`)) {
            return
        }

        const result = await deleteContractor(formData)
        if (result?.error) {
            alert(result.error)
        }
    }

    return (
        <form action={handleDelete}>
            <input type="hidden" name="id" value={id} />
            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                <Trash2 className="h-4 w-4" />
            </Button>
        </form>
    )
}
