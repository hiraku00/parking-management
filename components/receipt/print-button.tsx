'use client'

import { Button } from '@/components/ui/button'

export function PrintButton() {
  return (
    <Button variant="outline" className="min-h-12" onClick={() => window.print()}>
      保存・印刷する
    </Button>
  )
}
