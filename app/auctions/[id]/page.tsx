'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
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
  finalPrice?: number
  bidUnit?: number
  startAt?: string
  sellerId?: string
  winnerId?: string
}

interface BidItem {
  currentPrice?: number
  bidPrice?: number
  price?: number
  createdAt?: string
}

interface WinningOrder {
  orderId?: string
  orderNumber?: string
  auctionId?: string
  amount?: number
  status?: string
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
  const [hasPaidDeposit, setHasPaidDeposit] = useState(false)

  // Deposit modal
  const [depositOpen, setDepositOpen] = useState(false)
  const [depositAmount, setDepositAmount] = useState(0)
  const [depositStep, setDepositStep] = useState<'toss' | 'confirm'>('toss')
  const [depPaymentKey, setDepPaymentKey] = useState('')
  const [deporderId, setDeporderId] = useState('')

  // Winning payment
  const [winningOrder, setWinningOrder] = useState<WinningOrder | null>(null)
  const [winningOpen, setWinningOpen] = useState(false)
  const [winningPaid, setWinningPaid] = useState(false)
  const [winningPayAmount, setWinningPayAmount] = useState<number | null>(null)

  // Edit modal
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ startPrice: '', bidUnit: '' })
  const [editDate, setEditDate] = useState('')
  const [editHour, setEditHour] = useState('10')
  const [editMinute, setEditMinute] = useState('00')
  const [editAmpm, setEditAmpm] = useState<'AM' | 'PM'>('AM')

  // Close auction modal
  const [closeOpen, setCloseOpen] = useState(false)
  const [closeForm, setCloseForm] = useState({ winnerId: '', finalPrice: '' })

  const stompRef = useRef<Client | null>(null)
  const connectingRef = useRef(false)
  const bidUnitRef = useRef(1000)

  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1))
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

  useEffect(() => {
    return () => {
      stompRef.current?.deactivate()
      stompRef.current = null
    }
  }, [id])

  const syncCurrentPrice = useCallback(async (auctionId: string) => {
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
  }, [token, toast])

  async function checkWinningOrder() {
    const r = await apiCall('GET', '/api/v1/orders/winning/me?page=0&size=50', undefined, token)
    if (r.ok) {
      const orders: WinningOrder[] = r.data?.data?.content || []
      const order = orders.find(o =>
        o.auctionId === id || (o as any).auction?.id === id || (o as any).auctionUuid === id
      )
      if (order) {
        setWinningOrder(order)
        setWinningPaid(order.status === 'PAYMENT_SUCCESS')
        if (order.orderId) fetchWinningPaymentAmount(order.orderId)
      }
    }
  }

  // 보증금이 제외된 실제 결제 금액(잔금)을 payment-service에서 조회
  async function fetchWinningPaymentAmount(orderId: string): Promise<number | null> {
    const r = await apiCall('GET', `/api/v1/payments/order/${orderId}`, undefined, token)
    if (r.ok) {
      const p = r.data?.data || r.data
      const amt = p?.amount
      if (typeof amt === 'number') {
        setWinningPayAmount(amt)
        return amt
      }
    }
    return null
  }

  const connectBid = useCallback(async (auctionId: string) => {
    // 이미 연결 시도 중이면 무시 (중복 구독 방지)
    if (connectingRef.current) return
    connectingRef.current = true

    // 기존 연결 완전 종료 후 새로 연결
    if (stompRef.current) {
      await stompRef.current.deactivate()
      stompRef.current = null
    }

    const wsUrl = GW.replace(/^http/, 'ws') + '/ws/bid-native'
    const connectHeaders: Record<string, string> = { 'X-User-Id': userId }
    if (token) connectHeaders['Authorization'] = `Bearer ${token}`

    const client = new Client({
      brokerURL: wsUrl,
      connectHeaders,
      reconnectDelay: 0,
      onConnect: () => {
        stompRef.current = client
        connectingRef.current = false
        setConnected(true)
        toast('실시간 입찰 연결됨', 'success')

        client.subscribe('/user/queue/errors', msg => {
          try {
            const d = JSON.parse(msg.body)
            // 백엔드 오타 교정
            const errMsg = (d.message || d.code || '오류')
              .replace(/않겠습니다/g, '않았습니다')
              .replace(/않읐습니다/g, '않았습니다')
              .replace(/않읐니다/g, '않았습니다')
            toast('입찰 실패: ' + errMsg, 'error')
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
        connectingRef.current = false
        toast('STOMP 오류: ' + (frame.headers?.message || '알 수 없는 오류'), 'error')
        setConnected(false)
      },
      onDisconnect: () => {
        connectingRef.current = false
        setConnected(false)
        stompRef.current = null
      },
    })
    client.activate()
  }, [userId, token, toast, syncCurrentPrice])

  const checkDepositStatus = useCallback(async () => {
    const r = await apiCall('GET', '/api/v1/orders/deposit/me?page=0&size=50', undefined, token)
    if (r.ok) {
      const orders: { auctionId: string; status: string }[] = r.data?.data?.content || []
      setHasPaidDeposit(orders.some(o => o.auctionId === id && o.status === 'PAYMENT_SUCCESS'))
    }
  }, [token, id])

  const loadAuction = useCallback(async () => {
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
        if (token) connectBid(id)
        syncCurrentPrice(id)
      }
      if (a.status === 'WON' && token && userRole === 'BUYER') {
        checkWinningOrder()
      }
    } else {
      toast('경매를 불러올 수 없습니다.', 'error')
    }
    setLoading(false)
  }, [id, token, toast, connectBid, syncCurrentPrice])

  useEffect(() => {
    if (!token || userRole !== 'BUYER' || !id) return
    const onVisible = () => { if (!document.hidden) checkDepositStatus() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [token, userRole, id, checkDepositStatus])

  useEffect(() => {
    if (!isLoaded || !id) return
    let cancelled = false

    if (!cancelled) loadAuction()
    if (!cancelled && token && userRole === 'BUYER') checkDepositStatus()

    return () => { cancelled = true }
  }, [id, isLoaded, token, userRole, loadAuction, checkDepositStatus])

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

  function openCloseModal() {
    setCloseForm({ winnerId: '', finalPrice: '' })
    setCloseOpen(true)
  }

  async function doCloseAuction(withWinner: boolean) {
    if (withWinner) {
      if (!closeForm.winnerId.trim()) { toast('낙찰자 ID를 입력하세요.', 'error'); return }
      if (!closeForm.finalPrice || parseInt(closeForm.finalPrice) < 1) { toast('낙찰가를 입력하세요.', 'error'); return }
    }
    if (!window.confirm(withWinner ? `낙찰가 ${parseInt(closeForm.finalPrice).toLocaleString()}원으로 낙찰 처리하시겠습니까?` : '유찰 처리하시겠습니까?')) return

    const body = withWinner
      ? { winnerId: closeForm.winnerId.trim(), finalPrice: parseInt(closeForm.finalPrice) }
      : {}
    const r = await apiCall('POST', `/api/v1/auctions/${id}/close`, body, token)
    if (r.ok) {
      toast(withWinner ? '낙찰 처리되었습니다.' : '유찰 처리되었습니다.', 'success')
      setCloseOpen(false)
      loadAuction()
    } else {
      toast('실패: ' + (r.data?.message || ''), 'error')
    }
  }

  async function adminCancelAuction() {
    const reason = window.prompt('취소 사유를 입력하세요:')
    if (!reason) return
    const r = await apiCall('POST', `/api/v1/auctions/${id}/cancel`, { reason }, token)
    if (r.ok) { toast('경매가 취소되었습니다.', 'success'); loadAuction() }
    else toast('실패: ' + (r.data?.message || ''), 'error')
  }

  function openEdit() {
    if (!auction) return
    setEditForm({
      startPrice: String(auction.startPrice || ''),
      bidUnit: String(auction.bidUnit || ''),
    })
    // parse existing startAt into date / hour / minute / ampm
    if (auction.startAt) {
      const dt = new Date(auction.startAt)
      const yyyy = dt.getFullYear()
      const mm = String(dt.getMonth() + 1).padStart(2, '0')
      const dd = String(dt.getDate()).padStart(2, '0')
      setEditDate(`${yyyy}-${mm}-${dd}`)
      const rawHour = dt.getHours()
      const ampm: 'AM' | 'PM' = rawHour < 12 ? 'AM' : 'PM'
      const h12 = rawHour === 0 ? 12 : rawHour > 12 ? rawHour - 12 : rawHour
      setEditHour(String(h12))
      setEditMinute(String(dt.getMinutes()).padStart(2, '0'))
      setEditAmpm(ampm)
    }
    setEditOpen(true)
  }

  function buildEditStartAt(): string {
    if (!editDate) return ''
    let hour = parseInt(editHour)
    if (editAmpm === 'AM') {
      if (hour === 12) hour = 0
    } else {
      if (hour !== 12) hour += 12
    }
    const hh = String(hour).padStart(2, '0')
    return `${editDate}T${hh}:${editMinute}:00`
  }

  async function doEditAuction() {
    const body: Record<string, unknown> = {}
    if (editForm.startPrice) body.startPrice = parseInt(editForm.startPrice)
    if (editForm.bidUnit) body.bidUnit = parseInt(editForm.bidUnit)
    const startAt = buildEditStartAt()
    if (startAt) body.startAt = startAt

    if (Object.keys(body).length === 0) {
      toast('수정할 내용을 입력하세요.', 'error'); return
    }

    const r = await apiCall('PATCH', `/api/v1/auctions/${id}`, body, token)
    if (r.ok) {
      toast('경매가 수정되었습니다.', 'success')
      setEditOpen(false)
      loadAuction()
    } else {
      toast('수정 실패: ' + (r.data?.message || ''), 'error')
    }
  }

  async function initiateDeposit() {
    if (!token) { router.push('/login'); return }
    const r = await apiCall('POST', '/api/v1/orders/deposit', { auctionId: id }, token)
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

    setDeporderId(order.orderNumber || '')
    try {
      const TossPayments = (window as unknown as { TossPayments: TossPaymentsFn }).TossPayments
      TossPayments('test_ck_24xLea5zVAJ0NLBRvPNlrQAMYNwW').requestPayment('카드', {
        amount: order.amount,
        orderId: order.orderNumber,
        orderName: '보증금 납부',
        customerName: '구매자',
        successUrl: `${window.location.origin}/payments/success?auctionId=${id}&type=deposit`,
        failUrl: `${window.location.origin}/payments/fail?auctionId=${id}`,
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
      { paymentKey: depPaymentKey, tossOrderId: deporderId, amount: parseInt(amtStr) || 0 },
      token,
    )
    if (r.ok) {
      toast('보증금 결제가 완료되었습니다.', 'success')
      setHasPaidDeposit(true)
      setDepositOpen(false)
    } else {
      toast('결제 승인 실패: ' + (r.data?.message || r.data?.data?.message || ''), 'error')
    }
  }

  async function initiateWinningPayment() {
    if (!token) { router.push('/login'); return }

    const order = winningOrder
    if (!order) {
      await checkWinningOrder()
      toast('낙찰 주문 정보를 불러올 수 없습니다.', 'error')
      return
    }

    let amount = winningPayAmount
    if (amount == null && order.orderId) {
      amount = await fetchWinningPaymentAmount(order.orderId)
    }
    if (amount == null) {
      toast('결제 금액을 불러올 수 없습니다. 잠시 후 다시 시도해주세요.', 'error')
      return
    }

    try {
      const TossPayments = (window as unknown as { TossPayments: TossPaymentsFn }).TossPayments
      TossPayments('test_ck_24xLea5zVAJ0NLBRvPNlrQAMYNwW').requestPayment('카드', {
        amount,
        orderId: order.orderNumber,
        orderName: '낙찰금 결제',
        customerName: '구매자',
        successUrl: `${window.location.origin}/payments/success?auctionId=${id}&type=winning`,
        failUrl: `${window.location.origin}/payments/fail?auctionId=${id}`,
      })
    } catch {
      toast('Toss 결제창 초기화 실패', 'error')
    }
  }

  async function repayWinning() {
    if (!winningOrder?.orderId) { toast('주문 정보가 없습니다.', 'error'); return }
    const r = await apiCall('POST', `/api/v1/payments/repay/${winningOrder.orderId}`, undefined, token)
    if (r.ok) {
      const repayOrder = r.data?.data || r.data
      const amount = await fetchWinningPaymentAmount(winningOrder.orderId)
      if (amount == null) {
        toast('결제 금액을 불러올 수 없습니다. 잠시 후 다시 시도해주세요.', 'error')
        return
      }
      try {
        const TossPayments = (window as unknown as { TossPayments: TossPaymentsFn }).TossPayments
        TossPayments('test_ck_24xLea5zVAJ0NLBRvPNlrQAMYNwW').requestPayment('카드', {
          amount,
          orderId: repayOrder.orderNumber || winningOrder.orderNumber,
          orderName: '낙찰금 재결제',
          customerName: '구매자',
          successUrl: `${window.location.origin}/payments/success?auctionId=${id}&type=winning`,
          failUrl: `${window.location.origin}/payments/fail?auctionId=${id}`,
        })
      } catch {
        toast('Toss 결제창 초기화 실패', 'error')
      }
    } else {
      toast('재결제 요청 실패: ' + (r.data?.message || ''), 'error')
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
  const isWon = auction.status === 'WON'
  const isAdmin = userRole === 'MASTER' || userRole === 'MANAGER'
  const isSeller = userRole === 'SELLER' && auction.sellerId?.toString() === userId
  const canControl = isAdmin || isSeller
  const isWinner = userRole === 'BUYER' && (
    (auction.winnerId && auction.winnerId === userId) || (isWon && winningOrder !== null)
  )

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
              {isWon && (auction.finalPrice || currentPrice) > 0 && (
                <div className="meta-item">
                  <div className="meta-label">낙찰가</div>
                  <div className="meta-val" style={{ color: 'var(--g700)', fontWeight: 700 }}>
                    {fmtNum(auction.finalPrice || currentPrice)}원
                  </div>
                </div>
              )}
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
                {canControl && auction.status === 'READY' && (
                  <button className="btn btn-outline btn-sm" onClick={openEdit}>경매 수정</button>
                )}
                {isAdmin && auction.status === 'READY' && (
                  <button className="btn btn-primary btn-sm" onClick={adminStartAuction}>강제 시작</button>
                )}
                {isAdmin && auction.status === 'PROGRESS' && (
                  <button className="btn btn-accent btn-sm" onClick={openCloseModal}>조기 낙찰/마감</button>
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
              {isWon ? '🏆 낙찰 완료' : '실시간 입찰'}
            </div>

            <div className="current-price">
              <div className="cp-label">{isWon ? '최종 낙찰가' : '현재 최고가'}</div>
              <div className="cp-val">{fmtNum(isWon ? (auction.finalPrice || currentPrice) : currentPrice)}</div>
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
            ) : isWon && isWinner ? (
              <div style={{ marginBottom: '14px' }}>
                {winningPaid ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '16px',
                    background: 'var(--g50)',
                    borderRadius: '10px',
                    border: '1px solid var(--g200)',
                    marginBottom: '8px',
                  }}>
                    <div style={{ fontSize: '28px', marginBottom: '6px' }}>✅</div>
                    <div style={{ fontWeight: 700, color: 'var(--g700)', fontSize: '15px' }}>낙찰금 결제 완료</div>
                    <div style={{ fontSize: '13px', color: 'var(--neu500)', marginTop: '4px' }}>거래가 성사되었습니다</div>
                  </div>
                ) : (
                  <>
                    <div style={{
                      padding: '12px 16px',
                      background: 'var(--y50, #fffbeb)',
                      borderRadius: '10px',
                      border: '1px solid var(--y200, #fde68a)',
                      marginBottom: '12px',
                      fontSize: '13px',
                      color: 'var(--neu700)',
                    }}>
                      🎉 축하합니다! 낙찰되었습니다.<br />
                      <span style={{ color: 'var(--neu500)', fontSize: '12px' }}>낙찰금을 결제하여 거래를 완료하세요.</span>
                    </div>
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', marginBottom: '8px' }}
                      onClick={() => setWinningOpen(true)}
                    >
                      🏆 낙찰금 결제하기 ({fmtNum(winningPayAmount ?? winningOrder?.amount ?? auction.finalPrice ?? 0)}원)
                    </button>
                    {winningOrder?.status === 'PAYMENT_FAIL' && (
                      <button
                        className="btn btn-accent btn-sm"
                        style={{ width: '100%' }}
                        onClick={repayWinning}
                      >
                        재결제 시도
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : !isActive && !isWon ? (
              <div style={{ textAlign: 'center', padding: '12px', color: 'var(--neu500)', fontSize: '14px' }}>
                {statusLabel(auction.status || '')} 상태입니다
              </div>
            ) : isWon && !isWinner && userRole === 'BUYER' ? (
              <div style={{ textAlign: 'center', padding: '12px', color: 'var(--neu500)', fontSize: '14px' }}>
                다른 분이 낙찰받은 경매입니다
              </div>
            ) : isWon ? (
              <div style={{ textAlign: 'center', padding: '12px', color: 'var(--neu500)', fontSize: '14px' }}>
                낙찰 완료된 경매입니다
              </div>
            ) : (
              <Link href="/login" className="btn btn-outline" style={{ width: '100%', marginBottom: '14px', display: 'flex' }}>
                로그인 후 입찰
              </Link>
            )}

            {isActive && token && userRole === 'BUYER' && !hasPaidDeposit && (
              <button
                className="btn btn-accent"
                style={{ width: '100%', marginBottom: '8px' }}
                onClick={() => setDepositOpen(true)}
              >
                💳 보증금 납부 ({fmtNum(auction.startPrice || 0)}원)
              </button>
            )}

            {!isWon && (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* Close Auction Modal */}
      {closeOpen && (
        <div className="modal-backdrop open" onClick={e => e.target === e.currentTarget && setCloseOpen(false)}>
          <div className="modal" style={{ maxWidth: '440px' }}>
            <div className="modal-title">
              조기 낙찰 / 마감
              <button className="modal-close" onClick={() => setCloseOpen(false)}>×</button>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--neu500)', marginBottom: '20px' }}>
              낙찰자 정보를 입력하면 <strong>낙찰 처리</strong>, 비워두고 유찰 처리를 누르면 <strong>유찰</strong>됩니다.
            </p>
            <div className="form-group">
              <label>낙찰자 ID (UUID)</label>
              <input
                value={closeForm.winnerId}
                onChange={e => setCloseForm(p => ({ ...p, winnerId: e.target.value }))}
                placeholder="낙찰자 유저 UUID"
              />
            </div>
            <div className="form-group">
              <label>최종 낙찰가 (원)</label>
              <input
                type="number" min="1"
                value={closeForm.finalPrice}
                onChange={e => setCloseForm(p => ({ ...p, finalPrice: e.target.value }))}
                placeholder="낙찰가 입력"
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => doCloseAuction(true)}
              >
                🏆 낙찰 처리
              </button>
              <button
                className="btn btn-danger"
                style={{ flex: 1 }}
                onClick={() => doCloseAuction(false)}
              >
                유찰 처리
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Auction Modal */}
      {editOpen && (
        <div className="modal-backdrop open" onClick={e => e.target === e.currentTarget && setEditOpen(false)}>
          <div className="modal">
            <div className="modal-title">
              경매 수정
              <button className="modal-close" onClick={() => setEditOpen(false)}>×</button>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--neu500)', marginBottom: '16px' }}>
              빈 칸으로 두면 해당 항목은 변경되지 않습니다.
            </p>
            <div className="form-row">
              <div className="form-group">
                <label>시작가</label>
                <input
                  type="number" min="1"
                  value={editForm.startPrice}
                  onChange={e => setEditForm(p => ({ ...p, startPrice: e.target.value }))}
                  placeholder={String(auction.startPrice || '')}
                />
              </div>
              <div className="form-group">
                <label>입찰 단위</label>
                <input
                  type="number" min="1"
                  value={editForm.bidUnit}
                  onChange={e => setEditForm(p => ({ ...p, bidUnit: e.target.value }))}
                  placeholder={String(auction.bidUnit || '')}
                />
              </div>
            </div>
            <div className="form-group">
              <label>시작 날짜</label>
              <input
                type="date"
                value={editDate}
                onChange={e => setEditDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>시작 시간</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  value={editHour}
                  onChange={e => setEditHour(e.target.value)}
                  style={{ flex: 1 }}
                >
                  {hours.map(h => (
                    <option key={h} value={h}>{h}시</option>
                  ))}
                </select>
                <select
                  value={editMinute}
                  onChange={e => setEditMinute(e.target.value)}
                  style={{ flex: 1 }}
                >
                  {minutes.map(m => (
                    <option key={m} value={m}>{m}분</option>
                  ))}
                </select>
                <select
                  value={editAmpm}
                  onChange={e => setEditAmpm(e.target.value as 'AM' | 'PM')}
                  style={{ flex: 1 }}
                >
                  <option value="AM">오전</option>
                  <option value="PM">오후</option>
                </select>
              </div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={doEditAuction}>
              수정 저장
            </button>
          </div>
        </div>
      )}

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
                  <label>orderId <span className="req">*</span></label>
                  <input value={deporderId} onChange={e => setDeporderId(e.target.value)} placeholder="Toss orderId" readOnly />
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

      {/* Winning Payment Modal */}
      {winningOpen && (
        <div className="modal-backdrop open" onClick={e => e.target === e.currentTarget && setWinningOpen(false)}>
          <div className="modal" style={{ maxWidth: '420px' }}>
            <div className="modal-title">
              🏆 낙찰금 결제
              <button className="modal-close" onClick={() => setWinningOpen(false)}>×</button>
            </div>
            <div style={{
              padding: '12px 16px',
              background: 'var(--g50)',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
              color: 'var(--neu600)',
            }}>
              <div style={{ marginBottom: '4px' }}>
                <span style={{ color: 'var(--neu500)' }}>상품명</span>
                <span style={{ float: 'right', fontWeight: 600, color: 'var(--neu800)' }}>{name}</span>
              </div>
              {winningOrder?.orderNumber && (
                <div>
                  <span style={{ color: 'var(--neu500)' }}>주문번호</span>
                  <span style={{ float: 'right', fontFamily: 'monospace', fontSize: '12px' }}>{winningOrder.orderNumber}</span>
                </div>
              )}
            </div>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label>결제 금액</label>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--g700)', padding: '8px 0' }}>
                {fmtNum(winningPayAmount ?? winningOrder?.amount ?? auction.finalPrice ?? currentPrice ?? 0)}원
              </div>
            </div>
            {!winningOrder && (
              <div style={{ padding: '10px 14px', background: 'var(--y50, #fffbeb)', borderRadius: '8px', fontSize: '13px', color: 'var(--y700, #92400e)', marginBottom: '16px' }}>
                ⚠️ 낙찰 주문 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.
              </div>
            )}
            <p style={{ fontSize: '13px', color: 'var(--neu500)', marginBottom: '20px' }}>
              Toss Payments로 낙찰금을 결제합니다. 결제 완료 후 거래가 성사됩니다.
            </p>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={initiateWinningPayment}
              disabled={!winningOrder}
            >
              토스로 결제하기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
