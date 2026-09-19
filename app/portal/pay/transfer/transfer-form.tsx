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
      {pending ? '送信中...' : '振り込みました'}
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
      {state.error && <div className="notice notice--danger">{state.error}</div>}
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
          placeholder={defaultPayerName ? undefined : '例: タナカ タロウ'}
          className="h-14 text-lg"
        />
        {!defaultPayerName && (
          <p className="text-base text-muted-foreground">
            通帳や明細に出る名前を、カタカナで入力してください。
          </p>
        )}
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
