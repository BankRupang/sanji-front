'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiCall } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

export default function AdminSignupPage() {
  const toast = useToast()
  const router = useRouter()

  const [form, setForm] = useState({
    username: '', name: '', email: '', phone: '',
    password: '', slackId: '', role: 'MANAGER',
    adminKey: '', notificationAllow: true,
  })

  function set(key: string, val: string | boolean) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function doAdminSignup() {
    const r = await apiCall('POST', '/api/v1/auth/admin/signup', {
      username: form.username, name: form.name, email: form.email,
      phone: form.phone, password: form.password, slackId: form.slackId,
      notificationAllow: form.notificationAllow, role: form.role, adminKey: form.adminKey,
    })
    if (r.ok) {
      toast('관리자 가입이 완료되었습니다. 로그인해주세요.', 'success')
      router.push('/login')
    } else {
      toast('가입 실패: ' + (r.data?.message || r.data?.data?.message || '입력값을 확인하세요.'), 'error')
    }
  }

  return (
    <div className="container" style={{ maxWidth: '480px' }}>
      <div className="card">
        <div className="card-title">관리자 가입</div>

        <div className="form-group">
          <label>아이디 <span className="req">*</span></label>
          <input value={form.username} onChange={e => set('username', e.target.value)} placeholder="영문, 숫자 4~20자" />
        </div>
        <div className="form-group">
          <label>이름 <span className="req">*</span></label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="홍길동" />
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
            <label>역할 <span className="req">*</span></label>
            <select value={form.role} onChange={e => set('role', e.target.value)}>
              <option value="MANAGER">중간 관리자 (MANAGER)</option>
              <option value="MASTER">마스터 관리자 (MASTER)</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>비밀번호 <span className="req">*</span></label>
          <input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="8~15자, 대소문자+숫자+특수문자" />
        </div>
        <div className="form-group">
          <label>Slack ID <span className="req">*</span></label>
          <input value={form.slackId} onChange={e => set('slackId', e.target.value)} placeholder="U01234567" />
        </div>
        <div className="form-group">
          <label>관리자 키 <span className="req">*</span></label>
          <input type="password" value={form.adminKey} onChange={e => set('adminKey', e.target.value)} placeholder="관리자 전용 키" />
        </div>

        <div className="form-check">
          <input
            type="checkbox"
            id="as-notify"
            checked={form.notificationAllow}
            onChange={e => set('notificationAllow', e.target.checked)}
          />
          <label htmlFor="as-notify">알림 수신 동의</label>
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', marginBottom: '14px' }}
          onClick={doAdminSignup}
        >
          관리자 가입
        </button>
        <div style={{ textAlign: 'center', fontSize: '14px', color: 'var(--neu500)' }}>
          일반 가입으로 돌아가기{' '}
          <Link href="/signup" style={{ color: 'var(--g800)', fontWeight: 600 }}>일반 가입</Link>
        </div>
      </div>
    </div>
  )
}
