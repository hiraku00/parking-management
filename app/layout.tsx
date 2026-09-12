import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '駐車場管理システム',
  description: '月極駐車場の契約・請求・入金管理',
}

// next/font/google はvinextでは部分対応のため使わない
// （app/globals.css の --font-sans を参照。docs/design/03-architecture.md §3.1, §3.4）。
// shadcn/uiのinit（`npx shadcn init`）は既定でGeistフォントを追加するため、
// 導入のたびにこのファイルへの変更を取り消す必要がある。
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
