'use client'

import { useActionState, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { voidInvoiceAction } from '../actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
    >
      {pending ? '処理中...' : '免除する'}
    </button>
  )
}

/** shadcn/ui 等を導入していないため、ネイティブの <dialog> で確認ダイアログを
 *  代替する。取り消せない操作なので、理由の入力を必須にして誤操作を防ぐ。 */
export function VoidInvoiceForm({
  invoiceId,
  contractorId,
  month,
}: {
  invoiceId: string
  contractorId: string
  month: string
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [state, formAction] = useActionState(voidInvoiceAction, {})

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="text-xs font-medium text-red-600 hover:underline"
      >
        免除
      </button>
      <dialog ref={dialogRef} className="w-full max-w-sm rounded-lg p-0 backdrop:bg-black/30">
        <form action={formAction} className="space-y-4 p-5">
          <h2 className="font-semibold text-slate-900">{month}分の請求を免除しますか？</h2>
          <p className="text-sm text-slate-500">この操作は取り消せません。理由を入力してください。</p>
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <input type="hidden" name="contractorId" value={contractorId} />
          <textarea
            name="reason"
            required
            rows={2}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="例: 特別対応のため"
          />
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              キャンセル
            </button>
            <SubmitButton />
          </div>
        </form>
      </dialog>
    </>
  )
}
