'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { archiveContractorAction } from '../actions'

export function ArchiveButton({
  contractorId,
  contractorName,
}: {
  contractorId: string
  contractorName: string
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="border-destructive text-destructive hover:bg-destructive/10"
        >
          契約を終了してアーカイブ
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{contractorName}さんの契約を終了しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            この操作は取り消せません。契約者はログインできなくなりますが、記録は保存されます。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault()
              startTransition(async () => {
                await archiveContractorAction(contractorId)
              })
            }}
          >
            {isPending ? '処理中...' : 'アーカイブする'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
