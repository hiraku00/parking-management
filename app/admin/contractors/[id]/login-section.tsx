'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
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
import { invalidateSessionsAction, reissueLoginTokenAction, unlockContractorAction } from '../actions'

export function LoginSection({
  contractorId,
  loginTokenIssuedAtLabel,
  isLocked,
  lockedUntilLabel,
}: {
  contractorId: string
  loginTokenIssuedAtLabel: string | null
  isLocked: boolean
  lockedUntilLabel: string | null
}) {
  const [isReissuing, startReissue] = useTransition()
  const [isInvalidating, startInvalidate] = useTransition()
  const [isUnlocking, startUnlock] = useTransition()

  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="text-slate-700">
          QRコード発行状況: {loginTokenIssuedAtLabel ? `${loginTokenIssuedAtLabel} に発行済み` : '未発行'}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={isReissuing}
            onClick={() =>
              startReissue(async () => {
                await reissueLoginTokenAction(contractorId)
              })
            }
          >
            {isReissuing ? '発行中...' : 'ログインカードを発行して表示'}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" disabled={isInvalidating}>
                ログインを無効化
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>今のログインをすべて無効化しますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  この契約者の現在ログイン中の端末はすべてログアウトされます。QRコード自体は無効になりません
                  （再発行したい場合は「ログインカードを発行して表示」を使ってください）。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault()
                    startInvalidate(async () => {
                      const result = await invalidateSessionsAction(contractorId)
                      if (result.error) toast.error(result.error)
                      else toast.success('ログインを無効化しました。')
                    })
                  }}
                >
                  {isInvalidating ? '処理中...' : '無効化する'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div>
        <p className={isLocked ? 'font-medium text-destructive' : 'text-slate-700'}>
          {isLocked ? `🔒 ロック中（${lockedUntilLabel} まで）` : 'ロックはされていません'}
        </p>
        {isLocked && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            disabled={isUnlocking}
            onClick={() =>
              startUnlock(async () => {
                const result = await unlockContractorAction(contractorId)
                if (result.error) toast.error(result.error)
                else toast.success('ロックを解除しました。')
              })
            }
          >
            {isUnlocking ? '処理中...' : 'ロックを解除する'}
          </Button>
        )}
      </div>
    </div>
  )
}
