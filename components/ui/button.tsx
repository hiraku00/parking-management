import * as React from 'react'
import { cn } from 'cn'
import { Slot } from 'radix-ui'

// 見た目はすべて app/globals.css の [data-slot="button"] セレクタが決める
// （docs/design/10-design-system.md §10.7）。ここでは状態（variant/size）を
// data属性として渡すだけ。
export type ButtonVariant = 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link'
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm'

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
}) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp data-slot="button" data-variant={variant} data-size={size} className={cn(className)} {...props} />
  )
}

export { Button }
