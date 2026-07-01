import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/contexts/ToastContext'
import Header from '@/components/Header'
import Toast from '@/components/Toast'
import TwemojiProvider from '@/components/TwemojiProvider'

export const metadata: Metadata = {
  title: '산지직경 — 산지에서 직접 경매로',
  description: '전국 농산물 생산자와 구매자를 잇는 실시간 경매 플랫폼',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>
          <ToastProvider>
            <TwemojiProvider />
            <Header />
            {children}
            <Toast />
          </ToastProvider>
        </AuthProvider>
        <Script src="https://js.tosspayments.com/v1/payment" strategy="lazyOnload" />
      </body>
    </html>
  )
}
