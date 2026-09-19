'use client'

import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { CheckIcon, InfoIcon, AlertTriangleIcon, XIcon, ClockIcon } from './icons'

// next-themes は使わない（v1はダークモード非対応。docs/design/07-screens.md §7.1
// 「ダークモードは対象外（v1）」）。常にlightテーマで表示する。
// アイコンは絵文字ではなくSVGグリフにする（12-review-followups.md §12.1）。
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CheckIcon className="cn-toast-ico tone-good" />,
        info: <InfoIcon className="cn-toast-ico tone-info" />,
        warning: <AlertTriangleIcon className="cn-toast-ico tone-warn" />,
        error: <XIcon className="cn-toast-ico tone-danger" />,
        loading: <ClockIcon className="cn-toast-ico tone-info" />,
      }}
      toastOptions={{
        classNames: {
          toast: 'cn-toast',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
