'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiCall } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import AuctionCard, { type AuctionItem } from '@/components/AuctionCard'

const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.1.0&q=85&fm=jpg&crop=entropy&cs=srgb',
  'https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?ixlib=rb-4.1.0&q=85&fm=jpg&crop=entropy&cs=srgb',
  'https://images.unsplash.com/photo-1563514227147-6d2ff665a6a0?ixlib=rb-4.1.0&q=85&fm=jpg&crop=entropy&cs=srgb',
  'https://images.unsplash.com/photo-1444858291040-58f756a3bdd6?ixlib=rb-4.1.0&q=85&fm=jpg&crop=entropy&cs=srgb',
  'https://images.unsplash.com/photo-1560493676-04071c5f467b?ixlib=rb-4.1.0&q=85&fm=jpg&crop=entropy&cs=srgb',
  'https://images.unsplash.com/photo-1464226184884-fa280b87c399?ixlib=rb-4.1.0&q=85&fm=jpg&crop=entropy&cs=srgb',
]

export default function HomePage() {
  const { token } = useAuth()
  const [auctions, setAuctions] = useState<AuctionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [heroIndex, setHeroIndex] = useState(0)

  useEffect(() => {
    async function load() {
      const r = await apiCall('GET', '/api/v1/auctions?status=PROGRESS&page=0&size=6', undefined, token)
      if (r.ok) setAuctions(r.data?.data?.content || [])
      setLoading(false)
    }
    load()
  }, [token])

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex(i => (i + 1) % HERO_IMAGES.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [])

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
        </div>
        <div className="hero-img">
          {HERO_IMAGES.map((src, i) => (
            <img
              key={src}
              src={src}
              alt=""
              className="hero-img-slide"
              style={{ opacity: i === heroIndex ? 1 : 0, zIndex: i === heroIndex ? 1 : 0 }}
            />
          ))}
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
