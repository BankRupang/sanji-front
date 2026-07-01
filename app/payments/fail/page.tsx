'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useToast } from '@/contexts/ToastContext'

function PaymentFailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const toast = useToast()

  const message = searchParams.get('message') || '결제가 취소되었거나 실패했습니다.'
  const auctionId = searchParams.get('auctionId') || ''
  const backHref = auctionId ? `/auctions/${auctionId}` : '/auctions'

  useEffect(() => {
    toast('결제 실패: ' + message, 'error')
    setTimeout(() => router.replace(backHref), 3000)
  }, [backHref, message, router, toast])

  return (
    <div className="container" style={{ textAlign: 'center', paddingTop: '80px' }}>
      <div style={{ fontSize: '56px', marginBottom: '16px' }}>❌</div>
      <h2 style={{ marginBottom: '8px' }}>결제 실패</h2>
      <p style={{ color: 'var(--neu500)', marginBottom: '8px' }}>{message}</p>
      <p style={{ color: 'var(--neu500)', marginBottom: '20px', fontSize: '14px' }}>잠시 후 이전 페이지로 이동합니다...</p>
      <a href={backHref} className="btn btn-outline btn-sm">지금 돌아가기</a>
    </div>
  )
}

export default function PaymentFailPage() {
  return (
    <Suspense fallback={
      <div className="container" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <div className="spinner" style={{ margin: '0 auto 24px' }} />
        <p>처리 중...</p>
      </div>
    }>
      <PaymentFailContent />
    </Suspense>
  )
}
