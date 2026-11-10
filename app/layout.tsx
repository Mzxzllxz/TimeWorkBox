import type { ReactNode } from 'react'
import './globals.css'

export const metadata = {
  title: 'TimeWorkBox',
  description: '일간·주간·월간 타임박싱 플래너',
}

// 저장된 테마를 첫 화면이 그려지기 전에 적용한다(깜빡임 방지). 기본은 라이트.
const applyTheme = `try{document.documentElement.dataset.theme=localStorage.getItem('theme')==='dark'?'dark':'light'}catch(e){}`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: applyTheme }} />
        {children}
      </body>
    </html>
  )
}
