'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiCall } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import AuctionCard, { type AuctionItem } from '@/components/AuctionCard'

export default function HomePage() {
  const { token } = useAuth()
  const [auctions, setAuctions] = useState<AuctionItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const r = await apiCall('GET', '/api/v1/auctions?status=PROGRESS&page=0&size=6', undefined, token)
      if (r.ok) setAuctions(r.data?.data?.content || [])
      setLoading(false)
    }
    load()
  }, [token])

  return (
    <>
      <div className="hero">
        <div className="hero-inner">
          <div className="hero-text">
            <h1>산지에서 직접,<br />경매로 만나다</h1>
            <p>전국 농산물 생산자와 구매자를 잇는<br />실시간 경매 플랫폼</p>
            <div className="hero-badges">
              <span className="hero-badge">🔴 실시간 입찰</span>
              <span className="hero-badge">✅ 신선 농산물</span>
              <span className="hero-badge">📦 산지 직송</span>
            </div>
          </div>
          <div className="hero-img">🌾</div>
        </div>
      </div>

      <div className="container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div className="section-title">진행 중인 경매</div>
          <Link href="/auctions" className="btn btn-outline btn-sm">전체 보기 →</Link>
        </div>
        <div className="section-sub">지금 입찰 가능한 경매입니다</div>

        {loading ? (
          <div className="loading"><div className="spinner" />불러오는 중...</div>
        ) : auctions.length > 0 ? (
          <div className="auction-grid">
            {auctions.map(a => <AuctionCard key={a.id || a.auctionId} a={a} />)}
          </div>
        ) : (
          <div className="empty">
            <div className="empty-icon">🏷️</div>
            <h3>진행 중인 경매가 없습니다</h3>
          </div>
        )}
      </div>
    </>
  )
}
