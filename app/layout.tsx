import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '駐車場管理システム',
  description: '月極駐車場の契約・請求・入金管理',
  manifest: '/manifest.webmanifest',
  // apple-mobile-web-app-capable は付けない（appleWebAppは使わない）。
  // ホーム画面に追加してもSafariで開くようにし、QRログインのCookieが
  // 引き継がれるようにするため。参照: docs/design/09-ux-improvements.md §9.4.9
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
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
