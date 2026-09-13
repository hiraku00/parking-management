'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import type { ContractorFormState } from './actions'

export type ContractorFormValues = {
  name: string
  nameKana: string
  phone: string
  spaceLabel: string
  monthlyFee: number
  contractStartMonth: string
  contractEndMonth: string
  note: string
}

const EMPTY_VALUES: ContractorFormValues = {
  name: '',
  nameKana: '',
  phone: '',
  spaceLabel: '',
  monthlyFee: 3000,
  contractStartMonth: new Date().toISOString().slice(0, 7),
  contractEndMonth: '',
  note: '',
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  )
}

export function ContractorForm({
  action,
  initialValues,
  submitLabel = '保存',
  showFeeChangeOption = false,
}: {
  action: (prevState: ContractorFormState, formData: FormData) => Promise<ContractorFormState>
  initialValues?: ContractorFormValues
  submitLabel?: string
  showFeeChangeOption?: boolean
}) {
  const values = initialValues ?? EMPTY_VALUES
  const [state, formAction] = useActionState(async (prevState: ContractorFormState, formData: FormData) => {
    const result = await action(prevState, formData)
    // 新規登録は成功すると詳細画面へredirectするため、ここに戻ってくるのは
    // 更新（同じ画面に留まる）の成功時か、どちらの失敗時か。
    // 保存が終わったらトーストで知らせる（docs/design/07-screens.md §7.1）
    if (!result.error) toast.success('保存しました。')
    return result
  }, {})
  const [monthlyFee, setMonthlyFee] = useState(values.monthlyFee)

  const feeChanged = showFeeChangeOption && monthlyFee !== values.monthlyFee

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="氏名" required>
          <Input name="name" defaultValue={values.name} required placeholder="例: 田中太郎" />
        </Field>
        <Field label="フリガナ">
          <Input name="nameKana" defaultValue={values.nameKana} placeholder="例: タナカ タロウ" />
          {!values.nameKana && (
            <p className="text-xs text-muted-foreground">振込の照合に使います。入力をおすすめします。</p>
          )}
        </Field>
        <Field label="電話番号" required>
          <Input name="phone" defaultValue={values.phone} required placeholder="例: 090-1234-5678" />
        </Field>
        <Field label="区画">
          <Input name="spaceLabel" defaultValue={values.spaceLabel} placeholder="例: A-3" />
        </Field>
        <Field label="月額料金（円）" required>
          <Input
            name="monthlyFee"
            type="number"
            min={1}
            defaultValue={values.monthlyFee}
            onChange={(e) => setMonthlyFee(Number(e.target.value))}
            required
          />
        </Field>
        <div />
        <Field label="契約開始月" required>
          <Input name="contractStartMonth" type="month" defaultValue={values.contractStartMonth} required />
        </Field>
        <Field label="契約終了月（無期限は空欄）">
          <Input name="contractEndMonth" type="month" defaultValue={values.contractEndMonth} />
        </Field>
      </div>

      <Field label="メモ">
        <Textarea name="note" defaultValue={values.note} rows={3} />
      </Field>

      {feeChanged && (
        <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <Checkbox name="applyFeeToOpenInvoices" className="mt-0.5" />
          未入金の請求にも新しい月額料金を反映する（入金済み・確認中の月は変更されません）
        </label>
      )}

      <SubmitButton label={submitLabel} pendingLabel="保存中..." />
    </form>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  )
}
