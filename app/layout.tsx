import type { ReactNode } from 'react'
import './globals.css'

export const metadata = {
  title: 'TimeWorkBox',
  description: '일간·주간·월간 타임박싱 플래너',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
