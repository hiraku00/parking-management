'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
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
import { approveTransferAction, rejectTransferAction, type PaymentActionState } from '../actions'

function SubmitButton({ children, variant }: { children: React.ReactNode; variant?: 'destructive' }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? '処理中...' : children}
    </Button>
  )
}

export function ApproveRejectForm({ paymentId }: { paymentId: string }) {
  const [open, setOpen] = useState(false)
  const [approveState, approveAction] = useActionState<PaymentActionState, FormData>(
    async (prevState, formData) => {
      const result = await approveTransferAction(prevState, formData)
      if (!result.error) toast.success('入金を承認しました')
      return result
    },
    {},
  )
  const [rejectState, rejectAction] = useActionState<PaymentActionState, FormData>(
    async (prevState, formData) => {
      const result = await rejectTransferAction(prevState, formData)
      if (!result.error) setOpen(false)
      return result
    },
    {},
  )

  return (
    <div className="flex items-center gap-3">
      <form action={approveAction}>
        <input type="hidden" name="paymentId" value={paymentId} />
        <SubmitButton>承認する</SubmitButton>
      </form>
      {approveState.error && <p className="text-sm text-destructive">{approveState.error}</p>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline">
            却下する
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <form action={rejectAction}>
            <DialogHeader>
              <DialogTitle>この振込報告を却下しますか？</DialogTitle>
              <DialogDescription>理由を入力してください。契約者に表示されます。</DialogDescription>
            </DialogHeader>
            <input type="hidden" name="paymentId" value={paymentId} />
            <div className="py-4">
              <Textarea name="reason" required rows={2} placeholder="例: 入金が確認できませんでした" />
              {rejectState.error && <p className="mt-2 text-sm text-destructive">{rejectState.error}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                キャンセル
              </Button>
              <SubmitButton variant="destructive">却下する</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
