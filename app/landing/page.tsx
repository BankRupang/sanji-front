'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import './landing.css'

const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.1.0&q=85&fm=jpg&crop=entropy&cs=srgb',
  'https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?ixlib=rb-4.1.0&q=85&fm=jpg&crop=entropy&cs=srgb',
  'https://images.unsplash.com/photo-1563514227147-6d2ff665a6a0?ixlib=rb-4.1.0&q=85&fm=jpg&crop=entropy&cs=srgb',
  'https://images.unsplash.com/photo-1444858291040-58f756a3bdd6?ixlib=rb-4.1.0&q=85&fm=jpg&crop=entropy&cs=srgb',
]

const STATS = [
  { num: '3,200+', label: '등록 농가/생산자' },
  { num: '18,500+', label: '누적 낙찰 거래' },
  { num: '4.9억+', label: '누적 거래액(원)' },
  { num: '98.4%', label: '거래 성사율' },
]

const CATEGORIES = [
  { label: '농산물', emoji: '🌾', cls: 'green' },
  { label: '청과', emoji: '🍎', cls: 'yellow' },
  { label: '축산', emoji: '🥩', cls: 'red' },
  { label: '수산', emoji: '🐟', cls: 'blue' },
]

const FEATURES = [
  { icon: '🔴', title: '실시간 경매', desc: '경매 시작과 동시에 실시간으로 입찰가가 갱신되어 생생한 현장감을 느낄 수 있어요.' },
  { icon: '🛡️', title: '안전결제 시스템', desc: '낙찰 후 에스크로 기반 안전결제로 대금을 보호하고, 문제 발생 시 신속히 대응해요.' },
  { icon: '🚚', title: '산지 직송', desc: '중간 유통 단계를 줄여 생산자는 제값을 받고 구매자는 신선한 상품을 저렴하게 만나요.' },
]

const STEPS = [
  { n: 1, icon: '📝', title: '회원가입', desc: '구매자 또는 판매자로 가입하고 인증을 완료하세요' },
  { n: 2, icon: '📦', title: '상품 등록 · 탐색', desc: '판매자는 산지 상품을 등록하고 구매자는 경매를 탐색해요' },
  { n: 3, icon: '🔴', title: '실시간 입찰', desc: '경매 시작과 동시에 실시간으로 입찰에 참여하세요' },
  { n: 4, icon: '✅', title: '낙찰 · 안전결제', desc: '낙찰 후 안전결제로 대금을 지불하고 산지에서 직송받아요' },
]

const QUOTES = [
  { text: '판매 수수료가 낮고 정산이 빨라서 산지 농가 입장에서 정말 만족스러워요.', name: '김O수', role: '경남 사과 농가' },
  { text: '실시간 입찰이라 시세를 눈으로 보면서 원하는 가격에 낙찰받을 수 있어요.', name: '이O진', role: '서울 식자재 구매자' },
  { text: '중간 유통 없이 바로 거래하니 신선도가 확실히 다릅니다.', name: '박O영', role: '부산 수산물 유통업체' },
]

export default function LandingPage() {
  const { token } = useAuth()
  const [heroIndex, setHeroIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex(i => (i + 1) % HERO_IMAGES.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  return (
    <>
      <div className="lp-hero">
        <div className="lp-hero-inner">
          <div className="lp-hero-text">
            <span className="lp-hero-eyebrow">🌱 대한민국 1등 산지 경매 플랫폼</span>
            <h1>산지에서 직접,<br />경매로 만나다</h1>
            <p>전국 농·축·수산물 생산자와 구매자를 잇는<br />실시간 경매 플랫폼, 산지직경</p>
            <div className="lp-hero-badges">
              <span className="lp-hero-badge">🔴 실시간 입찰</span>
              <span className="lp-hero-badge">✅ 신선 농산물</span>
              <span className="lp-hero-badge">📦 산지 직송</span>
            </div>
            <div className="lp-hero-cta">
              <Link href="/auctions" className="btn btn-accent btn-lg">경매 둘러보기 →</Link>
              {!token && (
                <Link href="/signup" className="btn btn-lg lp-hero-cta-outline">무료로 시작하기</Link>
              )}
            </div>
          </div>
        </div>
        <div className="lp-hero-img">
          {HERO_IMAGES.map((src, i) => (
            <img
              key={src}
              src={src}
              alt=""
              className="lp-hero-img-slide"
              style={{ opacity: i === heroIndex ? 1 : 0, zIndex: i === heroIndex ? 1 : 0 }}
            />
          ))}
        </div>
      </div>

      <div className="lp-stats">
        <div className="lp-stats-inner">
          {STATS.map(s => (
            <div className="lp-stat-box" key={s.label}>
              <div className="lp-stat-num">{s.num}</div>
              <div className="lp-stat-lbl">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="lp-section">
        <div className="lp-section-head">
          <div className="lp-eyebrow">Category</div>
          <div className="lp-title">카테고리별 둘러보기</div>
          <div className="lp-sub">원하는 품목의 경매를 빠르게 찾아보세요</div>
        </div>
        <div className="lp-cat-grid">
          {CATEGORIES.map(c => (
            <Link href="/auctions" key={c.label} className={`lp-cat-btn lp-cat-${c.cls}`}>
              <span className="lp-cat-emoji">{c.emoji}</span>
              <span>{c.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-section-head">
          <div className="lp-eyebrow">Why Sanjijikgyeong</div>
          <div className="lp-title">왜 산지직경일까요?</div>
          <div className="lp-sub">생산자와 구매자 모두를 위한 투명하고 안전한 거래 경험</div>
        </div>
        <div className="lp-feature-grid">
          {FEATURES.map(f => (
            <div className="lp-feature-card" key={f.title}>
              <div className="lp-feature-icon">{f.icon}</div>
              <div className="lp-feature-title">{f.title}</div>
              <div className="lp-feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="lp-steps-section">
        <div className="lp-section">
          <div className="lp-section-head">
            <div className="lp-eyebrow">How it works</div>
            <div className="lp-title">이용 방법</div>
            <div className="lp-sub">누구나 쉽고 안전하게 산지 경매에 참여할 수 있어요</div>
          </div>
          <div className="lp-steps">
            {STEPS.map(s => (
              <div className="lp-step" key={s.n}>
                <div className="lp-step-icon">{s.icon}</div>
                <div className="lp-step-num">STEP {s.n}</div>
                <div className="lp-step-title">{s.title}</div>
                <div className="lp-step-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="lp-section">
        <div className="lp-section-head">
          <div className="lp-eyebrow">Testimonials</div>
          <div className="lp-title">이용자들의 이야기</div>
          <div className="lp-sub">산지직경과 함께한 생산자와 구매자들의 생생한 후기</div>
        </div>
        <div className="lp-quote-grid">
          {QUOTES.map(q => (
            <div className="lp-quote-card" key={q.name}>
              <div className="lp-quote-text">“{q.text}”</div>
              <div className="lp-quote-person">
                <div className="lp-quote-avatar">👤</div>
                <div>
                  <div className="lp-quote-name">{q.name}</div>
                  <div className="lp-quote-role">{q.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="lp-cta">
        <div className="lp-cta-inner">
          <h2>지금 바로 산지직경과 함께하세요</h2>
          <p>회원가입 후 실시간 경매에 참여하고 신선한 산지 상품을 직접 만나보세요</p>
          <div className="lp-cta-actions">
            {token ? (
              <Link href="/auctions" className="btn btn-accent btn-lg">경매 보러가기</Link>
            ) : (
              <>
                <Link href="/signup" className="btn btn-accent btn-lg">회원가입</Link>
                <Link href="/login" className="btn btn-lg lp-cta-outline">로그인</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
