import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '駐車場管理システム',
  description: '月極駐車場の契約・請求・入金管理',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
