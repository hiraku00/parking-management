'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * 振込先などの値をコピーするボタン。押すと2秒間「コピーしました ✓」に変わる。
 * 本番はCloudflare Workers（常にHTTPS）で配信するため、Clipboard APIが
 * 使えない状況は想定していない。参照: docs/design/09-ux-improvements.md §9.4.4
 */
export function CopyButton({ value, label = 'コピー' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-12 min-w-24 shrink-0 text-base"
      onClick={handleCopy}
    >
      {copied ? 'コピーしました ✓' : label}
    </Button>
  )
}
