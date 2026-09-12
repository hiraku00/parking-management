'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
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

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-2 focus:outline-indigo-500 focus:-outline-offset-1'

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
    >
      {pending ? pendingLabel : label}
    </button>
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
  const [state, formAction] = useActionState(action, {})
  const [monthlyFee, setMonthlyFee] = useState(values.monthlyFee)

  const feeChanged = showFeeChangeOption && monthlyFee !== values.monthlyFee

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="氏名" required>
          <input
            name="name"
            defaultValue={values.name}
            required
            className={inputClass}
            placeholder="例: 田中太郎"
          />
        </Field>
        <Field label="フリガナ">
          <input
            name="nameKana"
            defaultValue={values.nameKana}
            className={inputClass}
            placeholder="例: タナカ タロウ"
          />
        </Field>
        <Field label="電話番号" required>
          <input
            name="phone"
            defaultValue={values.phone}
            required
            className={inputClass}
            placeholder="例: 090-1234-5678"
          />
        </Field>
        <Field label="区画">
          <input
            name="spaceLabel"
            defaultValue={values.spaceLabel}
            className={inputClass}
            placeholder="例: A-3"
          />
        </Field>
        <Field label="月額料金（円）" required>
          <input
            name="monthlyFee"
            type="number"
            min={1}
            defaultValue={values.monthlyFee}
            onChange={(e) => setMonthlyFee(Number(e.target.value))}
            required
            className={inputClass}
          />
        </Field>
        <div />
        <Field label="契約開始月" required>
          <input
            name="contractStartMonth"
            type="month"
            defaultValue={values.contractStartMonth}
            required
            className={inputClass}
          />
        </Field>
        <Field label="契約終了月（無期限は空欄）">
          <input
            name="contractEndMonth"
            type="month"
            defaultValue={values.contractEndMonth}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="メモ">
        <textarea name="note" defaultValue={values.note} rows={3} className={inputClass} />
      </Field>

      {feeChanged && (
        <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <input type="checkbox" name="applyFeeToOpenInvoices" className="mt-0.5" />
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
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  )
}
