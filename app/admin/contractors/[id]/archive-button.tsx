'use client'

import { useRef, useTransition } from 'react'
import { archiveContractorAction } from '../actions'

export function ArchiveButton({
  contractorId,
  contractorName,
}: {
  contractorId: string
  contractorName: string
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        契約を終了してアーカイブ
      </button>
      <dialog ref={dialogRef} className="w-full max-w-sm rounded-lg p-0 backdrop:bg-black/30">
        <div className="space-y-4 p-5">
          <h2 className="font-semibold text-slate-900">{contractorName}さんの契約を終了しますか？</h2>
          <p className="text-sm text-slate-500">
            この操作は取り消せません。契約者はログインできなくなりますが、記録は保存されます。
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              キャンセル
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await archiveContractorAction(contractorId)
                })
              }
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isPending ? '処理中...' : 'アーカイブする'}
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
