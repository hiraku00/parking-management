'use client'

import { Button } from '@/components/ui/button'

export function PrintButton() {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      この領収書を印刷する
    </Button>
  )
}
