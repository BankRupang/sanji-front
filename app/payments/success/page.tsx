'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { apiCall } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'

function PaymentSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { token, isLoaded } = useAuth()
  const toast = useToast()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')

  const paymentKey = searchParams.get('paymentKey') || ''
  const orderId = searchParams.get('orderId') || ''
  const amount = parseInt(searchParams.get('amount') || '0')
  const auctionId = searchParams.get('auctionId') || ''
  const type = searchParams.get('type') || 'deposit' // 'deposit' | 'winning'

  const isWinning = type === 'winning'
  const backHref = auctionId ? `/auctions/${auctionId}` : '/auctions'

  useEffect(() => {
    if (!isLoaded) return
    if (!paymentKey || !orderId) {
      router.replace(backHref)
      return
    }

    async function confirm() {
      const r = await apiCall('POST', '/api/v1/payments/confirm', {
        paymentKey,
        tossOrderId: orderId,
        amount,
      }, token)

      if (r.ok) {
        setStatus('success')
        toast(isWinning ? '낙찰금 결제가 완료되었습니다!' : '보증금 결제가 성공적으로 완료되었습니다!', 'success')
        setTimeout(() => router.replace(backHref), 1500)
      } else {
        setStatus('error')
        toast('결제 승인 실패: ' + (r.data?.message || r.data?.data?.message || ''), 'error')
        setTimeout(() => router.replace(backHref), 3000)
      }
    }

    confirm()
  }, [isLoaded, paymentKey, orderId, backHref, amount, token, router, toast, isWinning])

  return (
    <div className="container" style={{ textAlign: 'center', paddingTop: '80px' }}>
      {status === 'processing' && (
        <>
          <div className="spinner" style={{ margin: '0 auto 24px' }} />
          <h3>결제 승인 진행 중...</h3>
          <p style={{ color: 'var(--neu500)', marginTop: '8px' }}>잠시만 기다려주세요</p>
        </>
      )}
      {status === 'success' && (
        <>
          <div style={{ fontSize: '56px', marginBottom: '16px' }}>{isWinning ? '🏆' : '✅'}</div>
          <h2 style={{ marginBottom: '8px' }}>결제 완료</h2>
          <p style={{ color: 'var(--neu500)' }}>
            {isWinning ? '낙찰금 결제가 완료되었습니다. 거래가 성사됩니다.' : '보증금 결제가 완료되었습니다.'}{' '}
            잠시 후 이동합니다...
          </p>
        </>
      )}
      {status === 'error' && (
        <>
          <div style={{ fontSize: '56px', marginBottom: '16px' }}>❌</div>
          <h2 style={{ marginBottom: '8px' }}>결제 실패</h2>
          <p style={{ color: 'var(--neu500)', marginBottom: '20px' }}>결제 승인에 실패했습니다. 잠시 후 이동합니다...</p>
          <a href={backHref} className="btn btn-outline btn-sm">지금 돌아가기</a>
        </>
      )}
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="container" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <div className="spinner" style={{ margin: '0 auto 24px' }} />
        <p>처리 중...</p>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  )
}
