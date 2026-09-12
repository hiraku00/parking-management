'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { voidInvoiceAction } from '../actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? '処理中...' : '免除する'}
    </Button>
  )
}

/** 取り消せない操作なので、理由の入力を必須にして誤操作を防ぐ。 */
export function VoidInvoiceForm({
  invoiceId,
  contractorId,
  month,
}: {
  invoiceId: string
  contractorId: string
  month: string
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(async (prevState: { error?: string }, formData: FormData) => {
    const result = await voidInvoiceAction(prevState, formData)
    if (!result.error) setOpen(false)
    return result
  }, {})

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-destructive">
          免除
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>{month}分の請求を免除しますか？</DialogTitle>
            <DialogDescription>この操作は取り消せません。理由を入力してください。</DialogDescription>
          </DialogHeader>
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <input type="hidden" name="contractorId" value={contractorId} />
          <div className="py-4">
            <Textarea name="reason" required rows={2} placeholder="例: 特別対応のため" />
            {state.error && <p className="mt-2 text-sm text-destructive">{state.error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
