'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { startPaymentAction, type PayFormState } from '../actions'

type Method = 'card' | 'bank_transfer'

const METHOD_COPY: Record<Method, { icon: string; title: string; note: string }> = {
  card: { icon: '💳', title: 'カード・スマホ決済', note: 'Apple Pay・Google Payも可・すぐに完了します' },
  bank_transfer: { icon: '🏦', title: '銀行振込', note: '確認まで1〜3日かかります' },
}

function SubmitButton({ movingToStripe }: { movingToStripe: boolean }) {
  const { pending } = useFormStatus()
  return (
    <>
      <Button type="submit" size="lg" disabled={pending} className="h-14 w-full text-lg font-bold">
        {pending ? '処理中...' : 'お支払いへ'}
      </Button>
      {pending && movingToStripe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90">
          <p className="text-lg font-bold text-slate-900">決済画面へ移動しています…</p>
        </div>
      )}
    </>
  )
}

function MethodCard({
  method,
  selectable,
  checked,
  onSelect,
}: {
  method: Method
  selectable: boolean
  checked: boolean
  onSelect: () => void
}) {
  const copy = METHOD_COPY[method]
  return (
    <label className="block min-h-16 rounded-md border p-4 has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary">
      <span className="flex items-center gap-3">
        {selectable && (
          <input
            type="radio"
            name="method"
            value={method}
            checked={checked}
            onChange={onSelect}
            className="size-5 accent-primary"
          />
        )}
        <span>
          <span className="block text-lg font-bold text-slate-900">
            {copy.icon} {copy.title}
          </span>
          <span className="block text-base text-muted-foreground">{copy.note}</span>
        </span>
      </span>
    </label>
  )
}

export function MethodForm({
  count,
  cardEnabled,
  bankTransferEnabled,
  defaultMethod,
}: {
  count: number
  cardEnabled: boolean
  bankTransferEnabled: boolean
  defaultMethod: Method
}) {
  const [state, formAction] = useActionState<PayFormState, FormData>(startPaymentAction, {})
  const bothEnabled = cardEnabled && bankTransferEnabled
  const [method, setMethod] = useState<Method>(defaultMethod)

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <div className="rounded-md bg-destructive/10 p-4 text-base leading-relaxed text-destructive">
          {state.error}
        </div>
      )}
      <input type="hidden" name="count" value={count} />

      <fieldset className="space-y-3">
        <legend className="sr-only">お支払い方法</legend>
        {bothEnabled ? (
          <>
            <MethodCard
              method="card"
              selectable
              checked={method === 'card'}
              onSelect={() => setMethod('card')}
            />
            <MethodCard
              method="bank_transfer"
              selectable
              checked={method === 'bank_transfer'}
              onSelect={() => setMethod('bank_transfer')}
            />
          </>
        ) : (
          <>
            <input type="hidden" name="method" value={cardEnabled ? 'card' : 'bank_transfer'} />
            <MethodCard
              method={cardEnabled ? 'card' : 'bank_transfer'}
              selectable={false}
              checked
              onSelect={() => {}}
            />
          </>
        )}
      </fieldset>

      <SubmitButton movingToStripe={bothEnabled ? method === 'card' : cardEnabled} />
    </form>
  )
}
