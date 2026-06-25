'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiCall } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { fmtNum, fmtDate, orderStatusLabel, orderStatusColor, orderTypeLabel } from '@/lib/utils'

type Tab = 'profile' | 'orders' | 'payments' | 'notifications'

interface UserInfo {
  name?: string; phone?: string; slackId?: string; email?: string; businessNumber?: string;
}

interface Order {
  orderId?: string; id?: string; orderNumber?: string; auctionId?: string;
  amount?: number; status?: string; orderType?: string; paymentDueAt?: string; updatedAt?: string;
}

interface Notification {
  message?: string; title?: string; createdAt?: string;
}

export default function MyPage() {
  const { token, userId, userName, userRole, isLoaded } = useAuth()
  const toast = useToast()
  const router = useRouter()

  const [tab, setTab] = useState<Tab>('profile')
  const [userInfo, setUserInfo] = useState<UserInfo>({})

  // Profile edit
  const [editMode, setEditMode] = useState(false)
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', slackId: '' })
  const [bizEditMode, setBizEditMode] = useState(false)
  const [bizForm, setBizForm] = useState({ businessNumber: '' })

  // Orders
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)

  // Payments
  const [payments, setPayments] = useState<Order[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)

  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notiLoading, setNotiLoading] = useState(false)

  useEffect(() => {
    if (isLoaded && !token) { router.push('/login'); return }
    if (token) loadUserInfo()
  }, [token, isLoaded])

  async function loadUserInfo() {
    const r = await apiCall('GET', '/api/v1/users/me', undefined, token)
    if (r.ok) {
      const d = r.data?.data || r.data
      setUserInfo(d)
      setProfileForm({ name: d.name || '', phone: d.phone || '', slackId: d.slackId || '' })
      setBizForm({ businessNumber: d.businessNumber || '' })
    }
  }

  async function loadOrders() {
    setOrdersLoading(true)
    const [dep, win] = await Promise.all([
      apiCall('GET', '/api/v1/orders/deposit/me?page=0&size=50', undefined, token),
      apiCall('GET', '/api/v1/orders/winning/me?page=0&size=50', undefined, token),
    ])
    const deposits = dep.ok ? (dep.data?.data?.content || []).map((o: Order) => ({ ...o, orderType: 'DEPOSIT' })) : []
    const winnings = win.ok ? (win.data?.data?.content || []).map((o: Order) => ({ ...o, orderType: 'WINNING' })) : []
    setOrders([...deposits, ...winnings])
    setOrdersLoading(false)
  }

  async function loadPayments() {
    setPaymentsLoading(true)
    const [dep, win] = await Promise.all([
      apiCall('GET', '/api/v1/orders/deposit/me?page=0&size=50', undefined, token),
      apiCall('GET', '/api/v1/orders/winning/me?page=0&size=50', undefined, token),
    ])
    const all: Order[] = [
      ...(dep.ok ? dep.data?.data?.content || [] : []),
      ...(win.ok ? win.data?.data?.content || [] : []),
    ]
    setPayments(all.filter(o => o.status === 'PAID'))
    setPaymentsLoading(false)
  }

  async function loadNotifications() {
    setNotiLoading(true)
    const r = await apiCall('GET', '/api/v1/notifications?page=0&size=20', undefined, token)
    if (r.ok) setNotifications(r.data?.data?.content || [])
    setNotiLoading(false)
  }

  function switchTab(t: Tab) {
    setTab(t)
    if (t === 'orders') loadOrders()
    else if (t === 'payments') loadPayments()
    else if (t === 'notifications') loadNotifications()
  }

  async function doUpdateProfile() {
    const b: Record<string, string> = {}
    if (profileForm.name) b.name = profileForm.name
    if (profileForm.phone) b.phone = profileForm.phone
    if (profileForm.slackId) b.slackId = profileForm.slackId
    const r = await apiCall('PATCH', '/api/v1/users/me/profile', b, token)
    if (r.ok) { toast('프로필이 수정되었습니다.', 'success'); setEditMode(false); loadUserInfo() }
    else toast('수정 실패', 'error')
  }

  async function doUpdateBusiness() {
    if (!bizForm.businessNumber) { toast('사업자번호를 입력하세요.', 'error'); return }
    const r = await apiCall('PATCH', '/api/v1/users/me/business', { businessNumber: bizForm.businessNumber }, token)
    if (r.ok) { toast('사업자번호가 수정되었습니다.', 'success'); setBizEditMode(false); loadUserInfo() }
    else toast('수정 실패', 'error')
  }

  async function doDeleteAccount() {
    if (!window.confirm('정말 탈퇴하시겠습니까?')) return
    const r = await apiCall('DELETE', '/api/v1/users/me', undefined, token)
    if (r.ok) { toast('탈퇴가 완료되었습니다.', 'success'); router.push('/') }
    else toast('탈퇴 실패', 'error')
  }

  async function doRepayOrder(orderId: string) {
    if (!window.confirm('재결제를 진행하시겠습니까?')) return
    const r = await apiCall('POST', `/api/v1/payments/repay/${orderId}`, undefined, token)
    if (r.ok) { toast('재결제가 완료되었습니다.', 'success'); loadOrders() }
    else toast('재결제 실패: ' + (r.data?.message || ''), 'error')
  }

  if (!isLoaded) return <div className="loading"><div className="spinner" /></div>
  if (!token) return null

  const initials = (userName || 'U').substring(0, 1).toUpperCase()

  return (
    <div className="container">
      <div className="profile-header">
        <div className="profile-avatar">{initials}</div>
        <div>
          <div className="profile-name">{userName}</div>
          <div className="profile-email">{userRole}</div>
        </div>
      </div>

      <div className="tabs">
        {(['profile', 'orders', 'payments', 'notifications'] as Tab[]).map(t => (
          <button
            key={t}
            className={`tab${tab === t ? ' active' : ''}`}
            onClick={() => switchTab(t)}
          >
            {{ profile: '프로필', orders: '내 주문', payments: '결제 내역', notifications: '알림' }[t]}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {tab === 'profile' && (
        <>
          <div className="card">
            <div className="card-title">
              내 정보
              {!editMode && <button className="btn btn-outline btn-sm" onClick={() => setEditMode(true)}>수정하기</button>}
              {editMode && <button className="btn btn-outline btn-sm" onClick={() => setEditMode(false)}>취소</button>}
            </div>
            {!editMode ? (
              <div className="form-row">
                <div className="form-group"><label>이름</label><div style={{ padding: '8px 0', fontWeight: 600 }}>{userInfo.name || '-'}</div></div>
                <div className="form-group"><label>전화번호</label><div style={{ padding: '8px 0' }}>{userInfo.phone || '-'}</div></div>
                <div className="form-group"><label>Slack ID</label><div style={{ padding: '8px 0' }}>{userInfo.slackId || '-'}</div></div>
                <div className="form-group"><label>이메일</label><div style={{ padding: '8px 0', color: 'var(--neu500)' }}>{userInfo.email || '-'}</div></div>
              </div>
            ) : (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>이름</label>
                    <input value={profileForm.name} onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))} placeholder="변경할 이름" />
                  </div>
                  <div className="form-group">
                    <label>전화번호</label>
                    <input value={profileForm.phone} onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))} placeholder="010-1234-5678" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Slack ID</label>
                  <input value={profileForm.slackId} onChange={e => setProfileForm(p => ({ ...p, slackId: e.target.value }))} placeholder="U01234567" />
                </div>
                <button className="btn btn-primary" onClick={doUpdateProfile}>저장</button>
              </>
            )}
          </div>

          <div className="card">
            <div className="card-title">
              사업자번호
              {!bizEditMode && <button className="btn btn-outline btn-sm" onClick={() => setBizEditMode(true)}>수정하기</button>}
              {bizEditMode && <button className="btn btn-outline btn-sm" onClick={() => setBizEditMode(false)}>취소</button>}
            </div>
            {!bizEditMode ? (
              <div className="form-group"><label>사업자번호</label><div style={{ padding: '8px 0', fontWeight: 600 }}>{userInfo.businessNumber || '-'}</div></div>
            ) : (
              <>
                <div className="form-group">
                  <label>사업자번호</label>
                  <input value={bizForm.businessNumber} onChange={e => setBizForm({ businessNumber: e.target.value })} placeholder="123-45-67890" />
                  <div className="form-hint">형식: 000-00-00000</div>
                </div>
                <button className="btn btn-primary" onClick={doUpdateBusiness}>저장</button>
              </>
            )}
          </div>

          <div className="card" style={{ border: '2px solid var(--red)' }}>
            <div className="card-title" style={{ color: 'var(--red)' }}>계정 탈퇴</div>
            <p style={{ fontSize: '14px', color: 'var(--neu500)', marginBottom: '14px' }}>
              회원 탈퇴 시 계정 정보가 비활성화됩니다.
            </p>
            <button className="btn btn-danger btn-sm" onClick={doDeleteAccount}>회원 탈퇴</button>
          </div>
        </>
      )}

      {/* Orders Tab */}
      {tab === 'orders' && (
        <div>
          <div className="card-title" style={{ marginBottom: '16px' }}>내 주문 목록</div>
          {ordersLoading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : orders.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>종류</th><th>주문번호</th><th>경매ID</th>
                  <th>금액</th><th>상태</th><th>납부기한</th><th></th>
                </tr></thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.orderId || o.id}>
                      <td>
                        <span style={{
                          fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: 600,
                          background: o.orderType === 'DEPOSIT' ? 'var(--g100)' : '#fef3c7',
                          color: o.orderType === 'DEPOSIT' ? 'var(--g800)' : '#92400e',
                        }}>
                          {orderTypeLabel(o.orderType || '')}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--neu500)' }}>{o.orderNumber || '-'}</td>
                      <td>
                        <Link href={`/auctions/${o.auctionId}`} style={{ fontSize: '12px', color: 'var(--g700)', fontFamily: 'monospace' }}>
                          {(o.auctionId || '').substring(0, 8)}…
                        </Link>
                      </td>
                      <td style={{ fontWeight: 700 }}>{fmtNum(o.amount || 0)}원</td>
                      <td><span style={{ fontSize: '12px', fontWeight: 600, color: orderStatusColor(o.status || '') }}>{orderStatusLabel(o.status || '')}</span></td>
                      <td style={{ fontSize: '12px', color: 'var(--neu500)' }}>{o.paymentDueAt ? fmtDate(o.paymentDueAt) : '-'}</td>
                      <td>
                        {o.status === 'FAILED' && (
                          <button className="btn btn-sm btn-outline" onClick={() => doRepayOrder(String(o.orderId || o.id))}>재결제</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty"><div className="empty-icon">📋</div><h3>주문 내역이 없습니다</h3></div>
          )}
        </div>
      )}

      {/* Payments Tab */}
      {tab === 'payments' && (
        <div>
          <div className="card-title" style={{ marginBottom: '16px' }}>결제 내역</div>
          {paymentsLoading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : payments.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>종류</th><th>주문번호</th><th>경매ID</th><th>금액</th><th>상태</th><th>결제일</th>
                </tr></thead>
                <tbody>
                  {payments.map(o => (
                    <tr key={o.orderId || o.id}>
                      <td>
                        <span style={{
                          fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: 600,
                          background: o.orderType === 'DEPOSIT' ? 'var(--g100)' : '#fef3c7',
                          color: o.orderType === 'DEPOSIT' ? 'var(--g800)' : '#92400e',
                        }}>
                          {orderTypeLabel(o.orderType || '')}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--neu500)' }}>{o.orderNumber || '-'}</td>
                      <td>
                        <Link href={`/auctions/${o.auctionId}`} style={{ fontSize: '12px', color: 'var(--g700)', fontFamily: 'monospace' }}>
                          {(o.auctionId || '').substring(0, 8)}…
                        </Link>
                      </td>
                      <td style={{ fontWeight: 700 }}>{fmtNum(o.amount || 0)}원</td>
                      <td><span style={{ fontSize: '12px', fontWeight: 600, color: '#16a34a' }}>완료</span></td>
                      <td style={{ fontSize: '12px', color: 'var(--neu500)' }}>{fmtDate(o.updatedAt || '')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty"><div className="empty-icon">💳</div><h3>결제 내역이 없습니다</h3></div>
          )}
        </div>
      )}

      {/* Notifications Tab */}
      {tab === 'notifications' && (
        <div className="card">
          <div className="card-title">알림 목록</div>
          {notiLoading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : notifications.length > 0 ? (
            notifications.map((n, i) => (
              <div key={i} className="noti-item">
                <div className="noti-icon" style={{ background: 'var(--g100)' }}>🔔</div>
                <div className="noti-text">
                  <div className="noti-title">{n.message || n.title || '-'}</div>
                  <div className="noti-time">{fmtDate(n.createdAt || '')}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty"><div className="empty-icon">🔔</div><h3>알림이 없습니다</h3></div>
          )}
        </div>
      )}
    </div>
  )
}
