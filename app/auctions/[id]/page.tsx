'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Client } from '@stomp/stompjs'
import { apiCall, GW } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { emojiFor, fmtNum, fmtDate, statusLabel, copyToClipboard } from '@/lib/utils'

interface Auction {
  id?: string
  auctionId?: string
  status?: string
  product?: { name?: string; description?: string; quantity?: string; productId?: string }
  productName?: string
  productDescription?: string
  startPrice?: number
  currentPrice?: number
  bidUnit?: number
  startAt?: string
  sellerId?: string
}

interface BidItem {
  currentPrice?: number
  bidPrice?: number
  price?: number
  createdAt?: string
}

// Toss Payments type shim
type TossPaymentsFn = (clientKey: string) => {
  requestPayment: (method: string, opts: Record<string, unknown>) => void
}

export default function AuctionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { token, userId, userRole, isLoaded } = useAuth()
  const toast = useToast()
  const router = useRouter()

  const [auction, setAuction] = useState<Auction | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPrice, setCurrentPrice] = useState(0)
  const [bidAmount, setBidAmount] = useState(0)
  const [bidHistory, setBidHistory] = useState<BidItem[]>([])
  const [connected, setConnected] = useState(false)

  // Deposit modal
  const [depositOpen, setDepositOpen] = useState(false)
  const [depositAmount, setDepositAmount] = useState(0)
  const [depositStep, setDepositStep] = useState<'toss' | 'confirm'>('toss')
  const [depPaymentKey, setDepPaymentKey] = useState('')
  const [depTossOrderId, setDepTossOrderId] = useState('')

  const stompRef = useRef<Client | null>(null)
  const bidUnitRef = useRef(1000)

  useEffect(() => {
    // Handle Toss redirect (does not require auth)
    const params = new URLSearchParams(window.location.search)
    const paymentType = params.get('paymentType')
    const paymentKey = params.get('paymentKey')
    const tossOrderId = params.get('orderId')
    const amount = parseInt(params.get('amount') || '0')

    if (paymentType === 'DEPOSIT_SUCCESS' && paymentKey && tossOrderId) {
      handleTossCallback(paymentKey, tossOrderId, amount)
      window.history.replaceState({}, '', window.location.pathname)
    } else if (paymentType === 'DEPOSIT_FAIL') {
      toast('결제 실패: ' + (params.get('message') || '결제가 취소되었거나 실패했습니다.'), 'error')
      window.history.replaceState({}, '', window.location.pathname)
    }

    return () => {
      stompRef.current?.deactivate()
      stompRef.current = null
    }
  }, [id])

  useEffect(() => {
    if (!isLoaded || !id) return
    loadAuction()
  }, [id, isLoaded])

  async function handleTossCallback(paymentKey: string, tossOrderId: string, amount: number) {
    toast('결제 승인 진행 중...', '')
    const r = await apiCall('POST', '/api/v1/payments/confirm', { paymentKey, tossOrderId, amount }, token)
    if (r.ok) toast('보증금 결제가 성공적으로 완료되었습니다!', 'success')
    else toast('결제 승인 실패: ' + (r.data?.message || r.data?.data?.message || ''), 'error')
  }

  async function loadAuction() {
    setLoading(true)
    const r = await apiCall('GET', `/api/v1/auctions/${id}`, undefined, token)
    if (r.ok) {
      const a: Auction = r.data?.data || r.data
      setAuction(a)
      const price = a.currentPrice || a.startPrice || 0
      bidUnitRef.current = a.bidUnit || 1000
      setCurrentPrice(price)
      setBidAmount(price + bidUnitRef.current)
      setDepositAmount(a.startPrice || 0)
      if (a.status === 'PROGRESS') {
        connectBid(id)
        syncCurrentPrice(id)
      }
    } else {
      toast('경매를 불러올 수 없습니다.', 'error')
    }
    setLoading(false)
  }

  function connectBid(auctionId: string) {
    stompRef.current?.deactivate()
    stompRef.current = null

    const wsUrl = GW.replace(/^http/, 'ws') + '/ws/bid-native'
    const connectHeaders: Record<string, string> = { 'X-User-Id': userId }
    if (token) connectHeaders['Authorization'] = `Bearer ${token}`

    const client = new Client({
      brokerURL: wsUrl,
      connectHeaders,
      reconnectDelay: 0,
      onConnect: () => {
        stompRef.current = client
        setConnected(true)
        toast('실시간 입찰 연결됨', 'success')

        client.subscribe('/user/queue/errors', msg => {
          try {
            const d = JSON.parse(msg.body)
            toast('입찰 실패: ' + (d.message || d.code || '오류'), 'error')
            if (d.code === 'BID-004' || d.message?.includes('변경')) syncCurrentPrice(auctionId)
          } catch { /* ignore */ }
        })

        client.subscribe(`/topic/auction/${auctionId}`, msg => {
          try {
            const d = JSON.parse(msg.body)
            const price = d.currentPrice || d.bidPrice || d.price
            if (price) {
              setCurrentPrice(price)
              setBidAmount(price + bidUnitRef.current)
              setBidHistory(prev => [d, ...prev.slice(0, 19)])
            }
          } catch { /* ignore */ }
        })
      },
      onStompError: frame => {
        toast('STOMP 오류: ' + (frame.headers?.message || '알 수 없는 오류'), 'error')
        setConnected(false)
      },
      onDisconnect: () => { setConnected(false); stompRef.current = null },
    })
    client.activate()
  }

  async function syncCurrentPrice(auctionId: string) {
    const r = await apiCall('GET', `/api/v1/bids/auctions/${auctionId}/highest`, undefined, token)
    if (r.ok) {
      const d = r.data?.data || r.data
      const cp = d?.finalPrice || d?.currentPrice
      if (cp) {
        setCurrentPrice(cp)
        setBidAmount(cp + bidUnitRef.current)
        toast('현재가 동기화: ' + fmtNum(cp) + '원', 'success')
      }
    }
  }

  async function placeBid() {
    if (!token) { toast('로그인이 필요합니다.', 'error'); return }
    if (!stompRef.current) { toast('WebSocket에 연결되지 않았습니다.', 'error'); return }
    stompRef.current.publish({
      destination: `/app/auction/${id}/bid`,
      headers: { 'X-User-Id': userId },
      body: JSON.stringify({ bidPrice: bidAmount, clientSeenPrice: currentPrice, actionType: 'BID' }),
    })
    toast('입찰 요청 전송됨', 'success')
  }

  async function adminStartAuction() {
    const r = await apiCall('POST', `/api/v1/auctions/${id}/start`, undefined, token)
    if (r.ok) { toast('경매를 시작했습니다.', 'success'); loadAuction() }
    else toast('실패: ' + (r.data?.message || ''), 'error')
  }

  async function adminCloseAuction() {
    if (!window.confirm('경매를 강제 마감하시겠습니까?')) return
    const r = await apiCall('POST', `/api/v1/auctions/${id}/close`, {}, token)
    if (r.ok) { toast('경매가 마감되었습니다.', 'success'); loadAuction() }
    else toast('실패: ' + (r.data?.message || ''), 'error')
  }

  async function adminCancelAuction() {
    const reason = window.prompt('취소 사유를 입력하세요:')
    if (!reason) return
    const r = await apiCall('POST', `/api/v1/auctions/${id}/cancel`, { reason }, token)
    if (r.ok) { toast('경매가 취소되었습니다.', 'success'); loadAuction() }
    else toast('실패: ' + (r.data?.message || ''), 'error')
  }

  async function initiateDeposit() {
    if (!token) { router.push('/login'); return }
    let r = await apiCall('POST', '/api/v1/orders/deposit', { auctionId: id }, token)
    let order = null

    if (!r.ok) {
      if (r.status === 409) {
        const list = await apiCall('GET', '/api/v1/orders/deposit/me?page=0&size=50', undefined, token)
        if (list.ok) {
          order = (list.data?.data?.content || []).find(
            (o: { auctionId: string; status: string }) => o.auctionId === id && o.status === 'PENDING',
          )
        }
      }
      if (!order) { toast('주문 생성 실패: ' + (r.data?.message || ''), 'error'); return }
    } else {
      order = r.data?.data || r.data
    }

    setDepTossOrderId(order.orderNumber || '')
    try {
      const TossPayments = (window as unknown as { TossPayments: TossPaymentsFn }).TossPayments
      TossPayments('test_ck_24xLea5zVAJ0NLBRvPNlrQAMYNwW').requestPayment('카드', {
        amount: order.amount,
        orderId: order.orderNumber,
        orderName: '보증금 납부',
        customerName: '구매자',
        successUrl: window.location.origin + window.location.pathname + '?paymentType=DEPOSIT_SUCCESS',
        failUrl: window.location.origin + window.location.pathname + '?paymentType=DEPOSIT_FAIL',
      })
    } catch {
      toast('Toss 결제창 초기화 실패', 'error')
    }
  }

  async function confirmDepositPayment() {
    if (!depPaymentKey) { toast('paymentKey를 입력하세요.', 'error'); return }
    const amtStr = String(depositAmount).replace(/[^0-9]/g, '')
    const r = await apiCall(
      'POST', '/api/v1/payments/confirm',
      { paymentKey: depPaymentKey, tossOrderId: depTossOrderId, amount: parseInt(amtStr) || 0 },
      token,
    )
    if (r.ok) {
      toast('보증금 결제가 완료되었습니다.', 'success')
      setDepositOpen(false)
    } else {
      toast('결제 승인 실패: ' + (r.data?.message || r.data?.data?.message || ''), 'error')
    }
  }

  if (loading) return <div className="loading"><div className="spinner" />불러오는 중...</div>
  if (!auction) return (
    <div className="container">
      <div className="empty"><div className="empty-icon">⚠️</div><h3>경매를 찾을 수 없습니다</h3></div>
    </div>
  )

  const name = auction.product?.name || auction.productName || ''
  const em = emojiFor(name)
  const isActive = auction.status === 'PROGRESS'
  const isAdmin = userRole === 'MASTER' || userRole === 'MANAGER'
  const isSeller = userRole === 'SELLER' && auction.sellerId?.toString() === userId
  const canControl = isAdmin || isSeller

  return (
    <div className="container">
      <Link href="/auctions" className="btn btn-ghost btn-sm" style={{ marginBottom: '20px', display: 'inline-flex' }}>
        ← 목록으로
      </Link>

      <div className="detail-layout">
        {/* Main */}
        <div>
          <div className="product-hero">
            <span className="product-emoji">{em}</span>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <div>
                <div className="product-title">{name || '-'}</div>
                <span className={`card-status status-${auction.status || 'READY'}`} style={{ position: 'static', display: 'inline-block', marginTop: '6px' }}>
                  {statusLabel(auction.status || '')}
                </span>
              </div>
            </div>
            <div className="product-desc">
              {auction.product?.description || auction.productDescription || '상품 설명이 없습니다.'}
            </div>
            <div className="product-meta-row">
              <div className="meta-item">
                <div className="meta-label">수량</div>
                <div className="meta-val">{auction.product?.quantity || '-'}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">입찰 단위</div>
                <div className="meta-val">{fmtNum(auction.bidUnit || 0)}원</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">경매 시작</div>
                <div className="meta-val">{fmtDate(auction.startAt)}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">경매 ID</div>
                <div
                  className="meta-val"
                  style={{ fontSize: '11px', fontFamily: 'monospace', cursor: 'pointer' }}
                  onClick={() => copyToClipboard(id, '경매 ID', toast)}
                  title="클릭하여 복사"
                >
                  {id}
                </div>
              </div>
              {(auction.product?.productId) && (
                <div className="meta-item">
                  <div className="meta-label">상품 ID</div>
                  <div
                    className="meta-val"
                    style={{ fontSize: '11px', fontFamily: 'monospace', cursor: 'pointer' }}
                    onClick={() => copyToClipboard(String(auction.product?.productId), '상품 ID', toast)}
                    title="클릭하여 복사"
                  >
                    {String(auction.product?.productId)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Admin/Seller Controls */}
          {canControl && (
            <div className="card">
              <div className="card-title">{isAdmin ? '관리자 제어' : '경매 제어'}</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {isAdmin && auction.status === 'READY' && (
                  <button className="btn btn-primary btn-sm" onClick={adminStartAuction}>강제 시작</button>
                )}
                {isAdmin && auction.status === 'PROGRESS' && (
                  <button className="btn btn-accent btn-sm" onClick={adminCloseAuction}>강제 마감</button>
                )}
                {canControl && (auction.status === 'READY' || auction.status === 'PROGRESS') && (
                  <button className="btn btn-danger btn-sm" onClick={adminCancelAuction}>경매 취소</button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="detail-sidebar">
          <div className="bid-panel">
            <div className="bid-panel-title">
              {isActive && <span className="live-dot" />}
              실시간 입찰
            </div>

            <div className="current-price">
              <div className="cp-label">현재 최고가</div>
              <div className="cp-val">{fmtNum(currentPrice)}</div>
              <div className="cp-unit">원</div>
            </div>

            {isActive && token ? (
              <>
                <div className="bid-input-row">
                  <input
                    className="bid-input"
                    type="number"
                    value={bidAmount}
                    onChange={e => setBidAmount(parseInt(e.target.value) || 0)}
                    min={currentPrice + 1}
                  />
                  <span style={{ alignSelf: 'center', fontSize: '14px', color: 'var(--neu500)' }}>원</span>
                </div>
                <div className="bid-presets">
                  {[1, 2, 5, 10].map(m => (
                    <button
                      key={m}
                      className="preset-btn"
                      onClick={() => setBidAmount(prev => prev + (auction.bidUnit || 1000) * m)}
                    >
                      +{fmtNum((auction.bidUnit || 1000) * m)}
                    </button>
                  ))}
                </div>
                <button className="btn btn-primary" style={{ width: '100%', marginBottom: '14px' }} onClick={placeBid}>
                  입찰하기
                </button>
                {!connected && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ width: '100%', marginBottom: '8px' }}
                    onClick={() => connectBid(id)}
                  >
                    재연결
                  </button>
                )}
              </>
            ) : !isActive ? (
              <div style={{ textAlign: 'center', padding: '12px', color: 'var(--neu500)', fontSize: '14px' }}>
                {statusLabel(auction.status || '')} 상태입니다
              </div>
            ) : (
              <Link href="/login" className="btn btn-outline" style={{ width: '100%', marginBottom: '14px', display: 'flex' }}>
                로그인 후 입찰
              </Link>
            )}

            {isActive && token && userRole === 'BUYER' && (
              <button
                className="btn btn-accent"
                style={{ width: '100%', marginBottom: '8px' }}
                onClick={() => setDepositOpen(true)}
              >
                💳 보증금 납부 ({fmtNum(auction.startPrice || 0)}원)
              </button>
            )}

            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--neu700)' }}>
              최근 입찰 현황
            </div>
            <div className="bid-history">
              {bidHistory.length > 0 ? (
                bidHistory.map((b, i) => (
                  <div key={i} className="bid-row">
                    <span className="bid-row-price">{fmtNum(b.currentPrice || b.bidPrice || b.price || 0)}원</span>
                    <span className="bid-row-user">{fmtDate(b.createdAt || '')}</span>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '12px', color: 'var(--neu500)', fontSize: '13px' }}>
                  입찰 내역이 없습니다
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Deposit Modal */}
      {depositOpen && (
        <div className="modal-backdrop open" onClick={e => e.target === e.currentTarget && setDepositOpen(false)}>
          <div className="modal" style={{ maxWidth: '420px' }}>
            <div className="modal-title">
              💳 보증금 납부
              <button className="modal-close" onClick={() => setDepositOpen(false)}>×</button>
            </div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label>납부 금액</label>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--g800)', padding: '8px 0' }}>
                {fmtNum(depositAmount)}원
              </div>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--neu500)', marginBottom: '20px' }}>
              보증금 납부 후 경매에 참여할 수 있습니다. Toss Payments로 결제됩니다.
            </p>

            {depositStep === 'toss' ? (
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={initiateDeposit}>
                토스로 결제하기
              </button>
            ) : (
              <>
                <div className="form-group">
                  <label>paymentKey <span className="req">*</span></label>
                  <input value={depPaymentKey} onChange={e => setDepPaymentKey(e.target.value)} placeholder="Toss 결제 완료 후 받은 paymentKey" />
                </div>
                <div className="form-group">
                  <label>tossOrderId <span className="req">*</span></label>
                  <input value={depTossOrderId} onChange={e => setDepTossOrderId(e.target.value)} placeholder="Toss orderId" readOnly />
                </div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={confirmDepositPayment}>
                  결제 승인
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%', marginTop: '8px' }}
                  onClick={() => setDepositStep('toss')}
                >
                  ← 돌아가기
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
