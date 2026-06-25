'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiCall } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

export default function SignupPage() {
  const toast = useToast()
  const router = useRouter()

  const [form, setForm] = useState({
    username: '', name: '', email: '', phone: '',
    businessNumber: '', password: '', slackId: '',
    role: 'BUYER', notificationAllow: true,
  })

  function set(key: string, val: string | boolean) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function doSignup() {
    const body: Record<string, unknown> = {
      username: form.username, name: form.name, email: form.email,
      password: form.password, businessNumber: form.businessNumber,
      slackId: form.slackId, notificationAllow: form.notificationAllow, role: form.role,
    }
    if (form.phone) body.phone = form.phone

    const r = await apiCall('POST', '/api/v1/auth/signup', body)
    if (r.ok) {
      toast('회원가입 완료! 로그인해주세요.', 'success')
      router.push('/login')
    } else {
      toast(
        '가입 실패: ' + (r.data?.message || r.data?.data?.message || JSON.stringify(r.data?.errors || r.data)),
        'error',
      )
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-title">회원가입</div>
        <div className="auth-sub">구매자 또는 판매자로 가입하세요</div>

        <div className="form-row">
          <div className="form-group">
            <label>아이디 <span className="req">*</span></label>
            <input value={form.username} onChange={e => set('username', e.target.value)} placeholder="4~12자, 영문자+숫자" />
            <div className="form-hint">예: farmer01</div>
          </div>
          <div className="form-group">
            <label>이름 <span className="req">*</span></label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="홍길동" />
          </div>
        </div>

        <div className="form-group">
          <label>이메일 <span className="req">*</span></label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@example.com" />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>전화번호</label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="010-1234-5678" />
          </div>
          <div className="form-group">
            <label>사업자번호 <span className="req">*</span></label>
            <input value={form.businessNumber} onChange={e => set('businessNumber', e.target.value)} placeholder="123-45-67890" />
          </div>
        </div>

        <div className="form-group">
          <label>비밀번호 <span className="req">*</span></label>
          <input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="8~15자, 대소문자+숫자+특수문자" />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Slack ID <span className="req">*</span></label>
            <input value={form.slackId} onChange={e => set('slackId', e.target.value)} placeholder="U01234567" />
          </div>
          <div className="form-group">
            <label>역할 <span className="req">*</span></label>
            <select value={form.role} onChange={e => set('role', e.target.value)}>
              <option value="BUYER">구매자 (BUYER)</option>
              <option value="SELLER">판매자 (SELLER)</option>
            </select>
          </div>
        </div>

        <div className="form-check">
          <input
            type="checkbox"
            id="notify"
            checked={form.notificationAllow}
            onChange={e => set('notificationAllow', e.target.checked)}
          />
          <label htmlFor="notify">알림 수신 동의</label>
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', marginBottom: '14px' }}
          onClick={doSignup}
        >
          가입하기
        </button>
        <div style={{ textAlign: 'center', fontSize: '14px', color: 'var(--neu500)' }}>
          이미 계정이 있으신가요?{' '}
          <Link href="/login" style={{ color: 'var(--g800)', fontWeight: 600 }}>로그인</Link>
          &nbsp;·&nbsp;
          <Link href="/admin-signup" style={{ color: 'var(--neu500)', fontWeight: 600 }}>관리자 가입</Link>
        </div>
      </div>
    </div>
  )
}
