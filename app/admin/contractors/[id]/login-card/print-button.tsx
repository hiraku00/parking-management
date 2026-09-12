'use client'

import { Button } from '@/components/ui/button'

export function PrintButton() {
  return (
    <Button className="w-full" onClick={() => window.print()}>
      この画面を印刷する
    </Button>
  )
}
