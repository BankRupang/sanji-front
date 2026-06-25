'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiCall } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import AuctionCard, { type AuctionItem } from '@/components/AuctionCard'

export default function AuctionsPage() {
  const { token, userRole, isLoaded } = useAuth()
  const toast = useToast()
  const router = useRouter()

  const [auctions, setAuctions] = useState<AuctionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Create auction modal
  const [createOpen, setCreateOpen] = useState(false)
  const [caForm, setCaForm] = useState({ productId: '', startPrice: '', bidUnit: '', startAt: '' })

  const canCreate = userRole === 'SELLER' || userRole === 'MASTER'

  useEffect(() => { if (isLoaded) loadAuctions() }, [status, page, isLoaded])

  async function loadAuctions() {
    setLoading(true)
    const q = status ? `&status=${status}` : ''
    const r = await apiCall('GET', `/api/v1/auctions?page=${page}&size=12${q}`, undefined, token)
    if (r.ok) {
      setAuctions(r.data?.data?.content || [])
      setTotalPages(r.data?.data?.totalPages || 1)
    }
    setLoading(false)
  }

  async function doCreateAuction() {
    const { productId, startPrice, bidUnit, startAt } = caForm
    if (!productId || !startPrice || !bidUnit || !startAt) {
      toast('모든 항목을 입력하세요.', 'error'); return
    }
    const r = await apiCall(
      'POST', '/api/v1/auctions',
      { productId, startPrice: parseInt(startPrice), bidUnit: parseInt(bidUnit), startAt },
      token,
    )
    if (r.ok) {
      toast('경매가 등록되었습니다.', 'success')
      setCreateOpen(false)
      setCaForm({ productId: '', startPrice: '', bidUnit: '', startAt: '' })
      loadAuctions()
    } else {
      toast('등록 실패: ' + (r.data?.message || ''), 'error')
    }
  }

  function openCreate() {
    if (!token) { router.push('/login'); return }
    const kstOffset = 540 * 60 * 1000
    const kstDate = new Date(Date.now() + kstOffset + 60 * 60000)
    setCaForm(prev => ({ ...prev, startAt: kstDate.toISOString().slice(0, 16) }))
    setCreateOpen(true)
  }

  return (
    <div className="container">
      <div className="section-title">경매 목록</div>
      <div className="section-sub">전체 경매를 검색하고 필터링하세요</div>

      <div className="filter-bar">
        <span className="filter-label">상태</span>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(0) }}>
          <option value="">전체</option>
          <option value="READY">대기중</option>
          <option value="PROGRESS">진행중</option>
          <option value="RESULT_PENDING">결과처리중</option>
          <option value="WON">낙찰</option>
          <option value="SUCCESS">거래완료</option>
          <option value="FAIL">유찰</option>
          <option value="CANCELLED">취소</option>
        </select>
        {canCreate && (
          <button
            className="btn btn-primary btn-sm"
            style={{ marginLeft: 'auto' }}
            onClick={openCreate}
          >
            + 경매 등록
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" />불러오는 중...</div>
      ) : auctions.length > 0 ? (
        <div className="auction-grid">
          {auctions.map(a => <AuctionCard key={a.id || a.auctionId} a={a} />)}
        </div>
      ) : (
        <div className="empty">
          <div className="empty-icon">🏷️</div>
          <h3>경매가 없습니다</h3>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            const p = Math.max(0, page - 2) + i
            if (p >= totalPages) return null
            return (
              <button
                key={p}
                className={`btn ${p === page ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                onClick={() => setPage(p)}
              >
                {p + 1}
              </button>
            )
          })}
        </div>
      )}

      {/* Create Auction Modal */}
      {createOpen && (
        <div className="modal-backdrop open" onClick={e => e.target === e.currentTarget && setCreateOpen(false)}>
          <div className="modal">
            <div className="modal-title">
              경매 등록
              <button className="modal-close" onClick={() => setCreateOpen(false)}>×</button>
            </div>
            <div className="form-group">
              <label>상품 ID (UUID) <span className="req">*</span></label>
              <input
                value={caForm.productId}
                onChange={e => setCaForm(p => ({ ...p, productId: e.target.value }))}
                placeholder="상품 UUID"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>시작가 <span className="req">*</span></label>
                <input
                  type="number" min="1"
                  value={caForm.startPrice}
                  onChange={e => setCaForm(p => ({ ...p, startPrice: e.target.value }))}
                  placeholder="10000"
                />
              </div>
              <div className="form-group">
                <label>입찰 단위 <span className="req">*</span></label>
                <input
                  type="number" min="1"
                  value={caForm.bidUnit}
                  onChange={e => setCaForm(p => ({ ...p, bidUnit: e.target.value }))}
                  placeholder="1000"
                />
              </div>
            </div>
            <div className="form-group">
              <label>시작 시간 <span className="req">*</span></label>
              <input
                type="datetime-local"
                value={caForm.startAt}
                onChange={e => setCaForm(p => ({ ...p, startAt: e.target.value }))}
              />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={doCreateAuction}>
              경매 등록
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
