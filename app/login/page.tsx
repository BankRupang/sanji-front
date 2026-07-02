'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiCall } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const { login } = useAuth()
  const toast = useToast()
  const router = useRouter()

  async function doLogin(u?: string, p?: string) {
    const usr = u ?? username
    const pwd = p ?? password
    if (!usr || !pwd) { toast('아이디와 비밀번호를 입력하세요.', 'error'); return }

    const r = await apiCall('POST', '/api/v1/auth/login', { username: usr, password: pwd })
    if (r.ok) {
      const d = r.data?.data || r.data
      login(d)
      toast(`로그인 성공! 환영합니다 ${d?.name || usr}`, 'success')
      router.push('/')
    } else {
      toast(
        '로그인 실패: ' + (r.data?.message || r.data?.data?.message || '아이디/비밀번호를 확인하세요.'),
        'error',
      )
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-title">로그인</div>
        <div className="auth-sub">산지직경에 오신 것을 환영합니다</div>

        <div className="auth-divider">테스트 계정으로 빠른 로그인</div>
        <div className="quick-login">
          {[
            { u: 'buyer99',  label: '🛒 Buyer' },
            { u: 'seller99', label: '🌾 Seller' },
            { u: 'manager1', label: '🏢 Manager' },
            { u: 'master1',  label: '👑 Master' },
          ].map(({ u, label }) => (
            <div key={u} className="ql-btn" onClick={() => doLogin(u, 'Test1234!')}>
              {label}<br />
              <small style={{ color: '#6b7280', fontWeight: 400 }}>{u}</small>
            </div>
          ))}
        </div>

        <div className="auth-divider">또는 직접 입력</div>
        <div className="form-group">
          <label>아이디</label>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="username"
            onKeyDown={e => e.key === 'Enter' && doLogin()}
          />
        </div>
        <div className="form-group">
          <label>비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="password"
            onKeyDown={e => e.key === 'Enter' && doLogin()}
          />
        </div>
        <button
          className="btn btn-primary"
          style={{ width: '100%', marginBottom: '14px' }}
          onClick={() => doLogin()}
        >
          로그인
        </button>
        <div style={{ textAlign: 'center', fontSize: '14px', color: 'var(--neu500)' }}>
          계정이 없으신가요?{' '}
          <Link href="/signup" style={{ color: 'var(--g800)', fontWeight: 600 }}>회원가입</Link>
        </div>
      </div>
    </div>
  )
}
