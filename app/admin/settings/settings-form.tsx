'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { updateSettingsAction, type SettingsFormState } from './actions'
import type { Settings } from '@/lib/services/settings'

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-2 focus:outline-indigo-500 focus:-outline-offset-1'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
    >
      {pending ? '保存中...' : '保存する'}
    </button>
  )
}

export function SettingsForm({ initialData }: { initialData: Settings }) {
  const [state, formAction] = useActionState<SettingsFormState, FormData>(updateSettingsAction, {})

  return (
    <form action={formAction} className="space-y-8">
      {state.error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</div>}
      {state.success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">保存しました。</div>
      )}

      <Section title="事業者情報" description="請求書や領収書に表示される情報です。">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="屋号・会社名" required>
            <input
              name="businessName"
              defaultValue={initialData.businessName}
              required
              className={inputClass}
              placeholder="例: 駐車場 管理太郎"
            />
          </Field>
          <Field label="インボイス登録番号">
            <input
              name="invoiceRegistrationNumber"
              defaultValue={initialData.invoiceRegistrationNumber ?? ''}
              className={inputClass}
              placeholder="例: T1234567890123"
            />
          </Field>
        </div>
        <Field label="住所">
          <input
            name="businessAddress"
            defaultValue={initialData.businessAddress}
            className={inputClass}
            placeholder="例: 〒100-0001 東京都千代田区千代田1-1"
          />
        </Field>
        <Field label="電話番号">
          <input name="businessPhone" defaultValue={initialData.businessPhone ?? ''} className={inputClass} />
        </Field>
        <Field label="消費税率（%）">
          <input
            name="taxRate"
            type="number"
            min={0}
            max={100}
            defaultValue={initialData.taxRate}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="振込先口座情報" description="銀行振込を選択した契約者に表示される情報です。">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="銀行名">
            <input name="bankName" defaultValue={initialData.bankName ?? ''} className={inputClass} />
          </Field>
          <Field label="支店名">
            <input name="bankBranch" defaultValue={initialData.bankBranch ?? ''} className={inputClass} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="口座種別">
            <select
              name="bankAccountType"
              defaultValue={initialData.bankAccountType ?? ''}
              className={inputClass}
            >
              <option value="">未設定</option>
              <option value="普通">普通</option>
              <option value="当座">当座</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="口座番号">
              <input
                name="bankAccountNumber"
                defaultValue={initialData.bankAccountNumber ?? ''}
                className={inputClass}
              />
            </Field>
          </div>
        </div>
        <Field label="口座名義（カナ）">
          <input
            name="bankAccountHolderKana"
            defaultValue={initialData.bankAccountHolderKana ?? ''}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="支払い方法" description="契約者が選べる支払い方法と、前払いの受付月数です。">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="cardPaymentEnabled" defaultChecked={initialData.cardPaymentEnabled} />
          カード決済を受け付ける
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="bankTransferEnabled"
            defaultChecked={initialData.bankTransferEnabled}
          />
          銀行振込を受け付ける
        </label>
        <Field label="何か月先まで前払いを受け付けるか">
          <input
            name="invoiceLeadMonths"
            type="number"
            min={0}
            max={12}
            defaultValue={initialData.invoiceLeadMonths}
            className={inputClass}
          />
        </Field>
      </Section>

      <SubmitButton />
    </form>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-white p-6">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <p className="mb-4 text-sm text-slate-500">{description}</p>
      <div className="space-y-4">{children}</div>
    </div>
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
