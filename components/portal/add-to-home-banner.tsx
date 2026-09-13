'use client'

import { useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const DISMISSED_KEY = 'portal:add-to-home-dismissed'

function subscribe() {
  return () => {}
}

function getSnapshot(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return true
  }
}

function getServerSnapshot(): boolean {
  return true
}

/**
 * ホーム画面に追加すると次からすぐ開けることを、1回だけ案内する。
 * 閉じたことは端末のlocalStorageに保存する（端末ごとの設定で十分なため）。
 * サーバー側の描画とlocalStorageの実際の値がずれる（初回は必ず閉じた
 * 状態で描画される）ため、外部ストアとして useSyncExternalStore で読む。
 * 参照: docs/design/09-ux-improvements.md §9.4.9
 */
export function AddToHomeBanner() {
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [justDismissed, setJustDismissed] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  function dismiss() {
    setJustDismissed(true)
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // 保存できなくても閉じる操作自体は反映する
    }
  }

  if (dismissed || justDismissed) return null

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="text-base text-slate-900">ホーム画面に追加すると、次からすぐに開けます</p>
        {showHelp && (
          <p className="text-base text-muted-foreground">
            共有ボタン（□に↑）をタップし、「ホーム画面に追加」を選んでください。
          </p>
        )}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-12"
            onClick={() => setShowHelp((v) => !v)}
          >
            やり方を見る
          </Button>
          <Button type="button" variant="ghost" size="sm" className="min-h-12" onClick={dismiss}>
            閉じる
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
