'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'

export default function Header() {
  const { token, userName, userRole, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const toast = useToast()

  const navLinks = [
    { href: '/', label: '홈' },
    { href: '/auctions', label: '경매 목록' },
    { href: '/products', label: '상품' },
    { href: '/ai', label: 'AI 상담' },
  ]

  const isAdmin = userRole === 'MASTER' || userRole === 'MANAGER'
  const initials = (userName || 'U').substring(0, 1).toUpperCase()

  function handleLogout() {
    logout()
    toast('로그아웃 되었습니다.')
    router.push('/')
  }

  return (
    <header className="hdr">
      <div className="hdr-inner">
        <Link href="/" className="logo">
          <Image src="/icon.webp" alt="산지직경 아이콘" width={32} height={32} />
          산지<span>직경</span>
        </Link>
        <nav className="nav">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`nav-btn${pathname === href ? ' active' : ''}`}
            >
              {label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              className={`nav-btn${pathname?.startsWith('/admin') ? ' active' : ''}`}
            >
              관리자
            </Link>
          )}
        </nav>
        <div className="hdr-actions">
          {token ? (
            <>
              <span className={`badge-role role-${userRole}`}>{userRole}</span>
              <Link href="/my" className="avatar" title="마이페이지">{initials}</Link>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>로그아웃</button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">로그인</Link>
              <Link href="/signup" className="btn btn-primary btn-sm">회원가입</Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
