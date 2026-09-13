'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const MAX_ATTEMPTS = 3
const INTERVAL_MS = 3000

/**
 * カード決済「確認中」の完了画面で、`fulfillCheckout` の結果が変わるまで
 * 数回だけ自動で再読み込みする。`router.refresh()` はサーバーコンポーネントの
 * 再描画だけを行うため、このクライアントコンポーネント自体は再マウントされず、
 * 試行回数の state はリロードをまたいで保持される（結果が変わって親が別の
 * 表示に切り替われば、このコンポーネントごとアンマウントされる）。
 * 参照: docs/design/09-ux-improvements.md §9.4.5
 */
export function AutoRefresh() {
  const router = useRouter()
  const [attempts, setAttempts] = useState(0)

  useEffect(() => {
    if (attempts >= MAX_ATTEMPTS) return
    const timer = setTimeout(() => {
      setAttempts((a) => a + 1)
      router.refresh()
    }, INTERVAL_MS)
    return () => clearTimeout(timer)
  }, [attempts, router])

  if (attempts < MAX_ATTEMPTS) return null

  return (
    <div className="space-y-4">
      <p className="text-base text-slate-900">
        確認に時間がかかっています。数分後にホームでご確認ください。二重に支払う必要はありません。
      </p>
      <Button asChild size="lg" className="h-14 w-full text-lg font-bold">
        <Link href="/portal">ホームに戻る</Link>
      </Button>
    </div>
  )
}
