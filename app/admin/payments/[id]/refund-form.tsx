'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { refundPaymentAction, type PaymentActionState } from '../actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? '処理中...' : '返金する'}
    </Button>
  )
}

/**
 * succeeded の入金に出す［返金する］。カード決済は既定でStripeへ返金し、
 * 振込・現金は「返金済み」として記録するだけ（実際の送金・手渡しは管理者が行う）。
 * 参照: docs/design/12-review-followups.md §12.2
 */
export function RefundForm({
  paymentId,
  paymentMethod,
}: {
  paymentId: string
  paymentMethod: 'card' | 'bank_transfer' | 'cash' | 'other'
}) {
  const isCard = paymentMethod === 'card'
  const defaultMethod: 'card' | 'bank_transfer' | 'cash' =
    paymentMethod === 'card' || paymentMethod === 'bank_transfer' || paymentMethod === 'cash'
      ? paymentMethod
      : 'bank_transfer'
  const [open, setOpen] = useState(false)
  const [state, action] = useActionState<PaymentActionState, FormData>(async (prevState, formData) => {
    const result = await refundPaymentAction(prevState, formData)
    if (!result.error) {
      toast.success('返金しました')
      setOpen(false)
    }
    return result
  }, {})

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          返金する
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form action={action}>
          <DialogHeader>
            <DialogTitle>この入金を返金しますか？</DialogTitle>
            <DialogDescription>
              対象の請求は未払いに戻り、契約者のホームに表示されます。この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          <input type="hidden" name="paymentId" value={paymentId} />
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="refundMethod">返金方法</Label>
              <Select name="refundMethod" defaultValue={defaultMethod}>
                <SelectTrigger id="refundMethod" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isCard && <SelectItem value="card">カードに返金（Stripe）</SelectItem>}
                  <SelectItem value="bank_transfer">銀行振込で返金</SelectItem>
                  <SelectItem value="cash">現金で返金</SelectItem>
                </SelectContent>
              </Select>
              {isCard && (
                <p className="field-note">
                  カードを選ぶと、Stripe側で実際に返金の手続きを行います。振込・現金は「返金済み」として記録するだけで、実際の送金・手渡しは別途行ってください。
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reason">理由</Label>
              <Textarea
                id="reason"
                name="reason"
                required
                rows={2}
                placeholder="例: 解約に伴う前払い分の返金"
              />
            </div>
            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
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
