'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { reportTransferAction, type ReportTransferFormState } from '../actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending} className="h-14 w-full text-lg font-bold">
      {pending ? '送信中...' : '振込を報告する'}
    </Button>
  )
}

export function TransferForm({
  count,
  defaultPayerName,
  defaultPaidOn,
  maxDate,
}: {
  count: number
  defaultPayerName: string
  defaultPaidOn: string
  maxDate: string
}) {
  const [state, formAction] = useActionState<ReportTransferFormState, FormData>(reportTransferAction, {})

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <div className="rounded-md bg-destructive/10 p-4 text-base leading-relaxed text-destructive">
          {state.error}
        </div>
      )}
      <input type="hidden" name="count" value={count} />
      <div className="space-y-2">
        <Label htmlFor="payerName" className="text-base">
          振込名義
        </Label>
        <Input
          id="payerName"
          name="payerName"
          defaultValue={defaultPayerName}
          required
          className="h-14 text-lg"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="paidOn" className="text-base">
          振込日
        </Label>
        <Input
          id="paidOn"
          name="paidOn"
          type="date"
          defaultValue={defaultPaidOn}
          max={maxDate}
          required
          className="h-14 text-lg"
        />
      </div>
      <SubmitButton />
    </form>
  )
}
