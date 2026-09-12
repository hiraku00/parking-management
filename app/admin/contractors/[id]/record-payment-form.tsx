'use client'

import { useActionState, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { formatYen } from '@/lib/domain/money'
import { recordManualPaymentAction, type PaymentActionState } from '../../payments/actions'

type PayableInvoice = { id: string; label: string; remaining: number }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? '記録中...' : '記録する'}
    </Button>
  )
}

export function RecordPaymentForm({
  contractorId,
  invoices,
  today,
}: {
  contractorId: string
  invoices: PayableInvoice[]
  today: string
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [state, formAction] = useActionState<PaymentActionState, FormData>(async (prevState, formData) => {
    const result = await recordManualPaymentAction(prevState, formData)
    if (!result.error) {
      toast.success('入金を記録しました')
      setOpen(false)
      setSelected(new Set())
    }
    return result
  }, {})

  const suggestedAmount = useMemo(
    () => invoices.filter((i) => selected.has(i.id)).reduce((sum, i) => sum + i.remaining, 0),
    [invoices, selected],
  )

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (invoices.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          入金を記録
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={formAction} className="space-y-4">
          <DialogHeader>
            <DialogTitle>入金を記録</DialogTitle>
          </DialogHeader>
          <input type="hidden" name="contractorId" value={contractorId} />

          <div className="space-y-2">
            <Label>対象の請求</Label>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
              {invoices.map((inv) => (
                <label key={inv.id} className="flex items-center justify-between gap-2 py-1 text-sm">
                  <span className="flex items-center gap-2">
                    <Checkbox
                      name="invoiceIds"
                      value={inv.id}
                      checked={selected.has(inv.id)}
                      onCheckedChange={() => toggle(inv.id)}
                    />
                    {inv.label}
                  </span>
                  <span className="text-muted-foreground">残額 {formatYen(inv.remaining)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">入金額</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              min={1}
              defaultValue={suggestedAmount || undefined}
              key={suggestedAmount}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="method">方法</Label>
            <Select name="method" defaultValue="cash">
              <SelectTrigger id="method" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">現金</SelectItem>
                <SelectItem value="bank_transfer">銀行振込</SelectItem>
                <SelectItem value="other">その他</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paidOn">受領日</Label>
            <Input id="paidOn" name="paidOn" type="date" defaultValue={today} max={today} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">メモ（任意）</Label>
            <Input id="note" name="note" maxLength={500} />
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <SubmitButton />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
