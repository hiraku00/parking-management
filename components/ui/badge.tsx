import * as React from 'react'
import { cn } from 'cn'
import { Slot } from 'radix-ui'

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

function Badge({
  className,
  variant = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & { variant?: BadgeVariant; asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span'

  return <Comp data-slot="badge" data-variant={variant} className={cn(className)} {...props} />
}

export { Badge }
