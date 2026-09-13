'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updateSettingsAction, type SettingsFormState } from './actions'
import type { Settings } from '@/lib/services/settings'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? '保存中...' : '保存する'}
    </Button>
  )
}

export function SettingsForm({ initialData }: { initialData: Settings }) {
  const [state, formAction] = useActionState<SettingsFormState, FormData>(async (prevState, formData) => {
    const result = await updateSettingsAction(prevState, formData)
    // 保存が終わったらトーストで知らせる（docs/design/07-screens.md §7.1）
    if (result.success) toast.success('保存しました。')
    if (result.error) toast.error(result.error)
    return result
  }, {})

  return (
    <form action={formAction} className="space-y-8">
      {state.error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>事業者情報</CardTitle>
          <CardDescription>請求書や領収書に表示される情報です。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="屋号・会社名" required>
              <Input
                name="businessName"
                defaultValue={initialData.businessName}
                required
                placeholder="例: 駐車場 管理太郎"
              />
            </Field>
            <Field label="インボイス登録番号">
              <Input
                name="invoiceRegistrationNumber"
                defaultValue={initialData.invoiceRegistrationNumber ?? ''}
                placeholder="例: T1234567890123"
              />
            </Field>
          </div>
          <Field label="住所">
            <Input
              name="businessAddress"
              defaultValue={initialData.businessAddress}
              placeholder="例: 〒100-0001 東京都千代田区千代田1-1"
            />
          </Field>
          <Field label="電話番号">
            <Input name="businessPhone" defaultValue={initialData.businessPhone ?? ''} />
          </Field>
          <Field label="消費税率（%）">
            <Input name="taxRate" type="number" min={0} max={100} defaultValue={initialData.taxRate} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>振込先口座情報</CardTitle>
          <CardDescription>銀行振込を選択した契約者に表示される情報です。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="銀行名">
              <Input name="bankName" defaultValue={initialData.bankName ?? ''} />
            </Field>
            <Field label="支店名">
              <Input name="bankBranch" defaultValue={initialData.bankBranch ?? ''} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="口座種別">
              <Select name="bankAccountType" defaultValue={initialData.bankAccountType ?? undefined}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="未設定" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="普通">普通</SelectItem>
                  <SelectItem value="当座">当座</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="口座番号">
                <Input name="bankAccountNumber" defaultValue={initialData.bankAccountNumber ?? ''} />
              </Field>
            </div>
          </div>
          <Field label="口座名義（カナ）">
            <Input name="bankAccountHolderKana" defaultValue={initialData.bankAccountHolderKana ?? ''} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>支払い方法</CardTitle>
          <CardDescription>契約者が選べる支払い方法と、前払いの受付月数です。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox name="cardPaymentEnabled" defaultChecked={initialData.cardPaymentEnabled} />
            カード決済を受け付ける
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox name="bankTransferEnabled" defaultChecked={initialData.bankTransferEnabled} />
            銀行振込を受け付ける
          </label>
          <Field label="何か月先まで前払いを受け付けるか">
            <Input
              name="invoiceLeadMonths"
              type="number"
              min={0}
              max={12}
              defaultValue={initialData.invoiceLeadMonths}
            />
          </Field>
          <Field label="支払期日（日）">
            <Input
              name="paymentDueDay"
              type="number"
              min={1}
              max={28}
              placeholder="未設定（月末）"
              defaultValue={initialData.paymentDueDay ?? ''}
            />
          </Field>
        </CardContent>
      </Card>

      <SubmitButton />
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
