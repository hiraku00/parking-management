'use client'

import { useActionState, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatYen } from '@/lib/domain/money'
import { startPaymentAction, type PayFormState } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending} className="h-14 w-full text-lg font-bold">
      {pending ? '処理中...' : 'この内容で進む'}
    </Button>
  )
}

export function PayForm({
  invoices,
  cardEnabled,
  bankTransferEnabled,
}: {
  invoices: { month: string; remaining: number }[]
  cardEnabled: boolean
  bankTransferEnabled: boolean
}) {
  const [state, formAction] = useActionState<PayFormState, FormData>(startPaymentAction, {})
  const [count, setCount] = useState(1)
  const [method, setMethod] = useState<'card' | 'bank_transfer'>(cardEnabled ? 'card' : 'bank_transfer')

  const total = useMemo(
    () => invoices.slice(0, count).reduce((sum, i) => sum + i.remaining, 0),
    [invoices, count],
  )

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <div className="rounded-md bg-destructive/10 p-4 text-base leading-relaxed text-destructive">
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="count" className="text-base font-medium text-slate-900">
          何か月分お支払いしますか？
        </label>
        <Select name="count" value={String(count)} onValueChange={(v) => setCount(Number(v))}>
          <SelectTrigger id="count" className="h-14 w-full text-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {invoices.map((inv, i) => (
              <SelectItem key={inv.month} value={String(i + 1)}>
                {i + 1}か月分（{invoices[0].month}〜{inv.month}）
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border p-4">
        <div className="flex items-center justify-between text-base font-bold text-slate-900">
          <span>お支払い合計</span>
          <span className="text-xl">{formatYen(total)}</span>
        </div>
      </div>

      {cardEnabled && bankTransferEnabled ? (
        <fieldset className="space-y-3">
          <legend className="text-base font-medium text-slate-900">お支払い方法</legend>
          <label className="flex items-center gap-3 rounded-md border p-4 text-base has-[:checked]:border-primary">
            <input
              type="radio"
              name="method"
              value="card"
              checked={method === 'card'}
              onChange={() => setMethod('card')}
              className="size-5 accent-primary"
            />
            クレジットカード等
          </label>
          <label className="flex items-center gap-3 rounded-md border p-4 text-base has-[:checked]:border-primary">
            <input
              type="radio"
              name="method"
              value="bank_transfer"
              checked={method === 'bank_transfer'}
              onChange={() => setMethod('bank_transfer')}
              className="size-5 accent-primary"
            />
            銀行振込
          </label>
        </fieldset>
      ) : (
        <input type="hidden" name="method" value={cardEnabled ? 'card' : 'bank_transfer'} />
      )}

      <SubmitButton />
    </form>
  )
}
