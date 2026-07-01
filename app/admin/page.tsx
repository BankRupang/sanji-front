'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiCall, GW } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { fmtNum, fmtDate, statusLabel } from '@/lib/utils'

type AdminTab = 'users' | 'products' | 'auctions' | 'ai-docs'

interface User {
  id?: string; userId?: string; uuid?: string; name?: string; email?: string;
  role?: string; status?: string; phone?: string; businessNumber?: string; slackId?: string;
}

interface Product {
  id?: string; productId?: string; name?: string; description?: string; quantity?: string;
}

interface AuctionItem {
  id?: string; auctionId?: string; status?: string;
  product?: { name?: string }; productName?: string;
  startPrice?: number; startAt?: string;
}

interface AiDoc {
  source?: string; title?: string; createdAt?: string;
}

export default function AdminPage() {
  const { token, userRole, isLoaded } = useAuth()
  const toast = useToast()
  const router = useRouter()

  const [tab, setTab] = useState<AdminTab>('users')

  // Users
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userDetailOpen, setUserDetailOpen] = useState(false)
  const [userIdInput, setUserIdInput] = useState('')
  const [userIdSearching, setUserIdSearching] = useState(false)

  // Products
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)

  // Auctions
  const [auctions, setAuctions] = useState<AuctionItem[]>([])
  const [auctionsLoading, setAuctionsLoading] = useState(false)

  // AI Docs
  const [aiDocs, setAiDocs] = useState<AiDoc[]>([])
  const [aiDocsLoading, setAiDocsLoading] = useState(false)
  const [docSrc, setDocSrc] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Users ────────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    const q = new URLSearchParams({ page: '0', size: '50' })
    if (roleFilter) q.set('role', roleFilter)
    if (statusFilter) q.set('status', statusFilter)
    const r = await apiCall('GET', `/api/v1/users/all?${q}`, undefined, token)
    if (r.ok) {
      const list = r.data?.data?.content || []
      setUsers(list)
    } else toast('사용자 목록 불러오기 실패. 관리자 권한을 확인하세요.', 'error')
    setUsersLoading(false)
  }, [token, roleFilter, statusFilter, toast])

  useEffect(() => {
    if (isLoaded && (!token || (userRole !== 'MASTER' && userRole !== 'MANAGER'))) {
      router.push('/')
    }
    if (token) loadUsers()
  }, [token, isLoaded, userRole, router, loadUsers])

  async function searchUserById() {
    const uid = userIdInput.trim()
    if (!uid) { toast('User ID를 입력하세요.', 'error'); return }
    setUserIdSearching(true)
    const r = await apiCall('GET', `/api/v1/user/one?userId=${uid}`, undefined, token)
    setUserIdSearching(false)
    if (r.ok) {
      setSelectedUser(r.data?.data || r.data)
      setUserDetailOpen(true)
    } else {
      toast('조회 실패: UUID가 맞는지 확인하세요. (' + (r.data?.message || r.status) + ')', 'error')
    }
  }

  async function viewUser(user: User) {
    // 목록 데이터로 즉시 모달 오픈 (로딩 없이 바로 보이게)
    setSelectedUser(user)
    setUserDetailOpen(true)
    // 목록 응답의 userId로 상세 조회하여 보강
    const uid = user.userId || user.id || user.uuid
    if (uid) {
      const r = await apiCall('GET', `/api/v1/user/one?userId=${uid}`, undefined, token)
      if (r.ok) setSelectedUser(prev => ({ ...prev, ...(r.data?.data || r.data) }))
    }
  }

  async function suspendUser(uid: string) {
    if (!window.confirm('이 회원을 정지하시겠습니까?')) return
    const r = await apiCall('PATCH', '/api/v1/users/suspended', { userId: uid }, token)
    if (r.ok) { toast('정지되었습니다.', 'success'); loadUsers() }
    else toast('실패', 'error')
  }

  async function unsuspendUser(uid: string) {
    const r = await apiCall('PATCH', '/api/v1/users/unsuspended', { userId: uid }, token)
    if (r.ok) { toast('정지가 해제되었습니다.', 'success'); loadUsers() }
    else toast('실패', 'error')
  }

  // ── Products ─────────────────────────────────────────────────────────────
  async function loadAdminProducts() {
    setProductsLoading(true)
    const r = await apiCall('GET', '/api/v1/products?page=0&size=50', undefined, token)
    if (r.ok) setProducts(r.data?.data?.content || [])
    setProductsLoading(false)
  }

  async function deleteProduct(id: string) {
    if (!window.confirm('상품을 삭제하시겠습니까? 연결된 경매는 먼저 취소해야 합니다.')) return
    const r = await apiCall('DELETE', `/api/v1/products/${id}`, undefined, token)
    if (r.ok) { toast('상품이 삭제되었습니다.', 'success'); loadAdminProducts() }
    else toast('삭제 실패: ' + (r.data?.message || ''), 'error')
  }

  // ── Auctions ─────────────────────────────────────────────────────────────
  async function loadAdminAuctions() {
    setAuctionsLoading(true)
    const r = await apiCall('GET', '/api/v1/auctions?page=0&size=30', undefined, token)
    if (r.ok) setAuctions(r.data?.data?.content || [])
    setAuctionsLoading(false)
  }

  async function startAuction(id: string) {
    const r = await apiCall('POST', `/api/v1/auctions/${id}/start`, undefined, token)
    if (r.ok) { toast('경매를 시작했습니다.', 'success'); loadAdminAuctions() }
    else toast('실패: ' + (r.data?.message || ''), 'error')
  }

  async function closeAuction(id: string) {
    if (!window.confirm('경매를 강제 마감하시겠습니까?')) return
    const r = await apiCall('POST', `/api/v1/auctions/${id}/close`, {}, token)
    if (r.ok) { toast('경매가 마감되었습니다.', 'success'); loadAdminAuctions() }
    else toast('실패: ' + (r.data?.message || ''), 'error')
  }

  async function cancelAuction(id: string) {
    const reason = window.prompt('취소 사유를 입력하세요:')
    if (!reason) return
    const r = await apiCall('POST', `/api/v1/auctions/${id}/cancel`, { reason }, token)
    if (r.ok) { toast('경매가 취소되었습니다.', 'success'); loadAdminAuctions() }
    else toast('실패: ' + (r.data?.message || ''), 'error')
  }

  // ── AI Docs ───────────────────────────────────────────────────────────────
  async function loadAiDocs() {
    setAiDocsLoading(true)
    const r = await apiCall('GET', '/api/v1/admin/ai/documents?page=0&size=20', undefined, token)
    if (r.ok) setAiDocs(r.data?.data?.content || [])
    setAiDocsLoading(false)
  }

  async function uploadAiDoc() {
    const file = fileInputRef.current?.files?.[0]
    if (!docSrc || !file) { toast('source와 파일을 선택하세요.', 'error'); return }
    const fd = new FormData()
    fd.append('file', file)
    fd.append('source', docSrc)
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(GW + '/api/v1/admin/ai/documents', { method: 'POST', headers, body: fd })
    if (res.ok) { toast('문서가 등록되었습니다.', 'success'); setDocSrc(''); loadAiDocs() }
    else toast('등록 실패', 'error')
  }

  async function reembedAiDoc(src: string, file: File) {
    if (!window.confirm(`'${src}' 문서를 새 파일로 재임베딩하시겠습니까?`)) return
    const fd = new FormData()
    fd.append('file', file)
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(GW + `/api/v1/admin/ai/documents/${encodeURIComponent(src)}`, { method: 'PUT', headers, body: fd })
    if (res.ok) { toast('재임베딩되었습니다.', 'success'); loadAiDocs() }
    else toast('재임베딩 실패', 'error')
  }

  async function deleteAiDoc(src: string) {
    if (!window.confirm(`'${src}' 문서를 삭제하시겠습니까?`)) return
    const r = await apiCall('DELETE', `/api/v1/admin/ai/documents/${encodeURIComponent(src)}`, undefined, token)
    if (r.ok) { toast('삭제되었습니다.', 'success'); loadAiDocs() }
    else toast('삭제 실패', 'error')
  }

  function switchTab(t: AdminTab) {
    setTab(t)
    if (t === 'users') loadUsers()
    else if (t === 'products') loadAdminProducts()
    else if (t === 'auctions') loadAdminAuctions()
    else if (t === 'ai-docs') loadAiDocs()
  }

  if (!isLoaded) return <div className="loading"><div className="spinner" /></div>

  const u = selectedUser

  return (
    <div className="container">
      <div className="section-title">관리자 대시보드</div>
      <div className="section-sub">회원 관리 및 경매 운영</div>

      <div className="tabs">
        {([['users', '회원 관리'], ['products', '상품 관리'], ['auctions', '경매 관리'], ['ai-docs', 'AI 문서']] as [AdminTab, string][]).map(([t, label]) => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => switchTab(t)}>
            {label}
          </button>
        ))}
      </div>

      {/* Users */}
      {tab === 'users' && (
        <>
          <div className="filter-bar" style={{ marginBottom: '16px' }}>
            <span className="filter-label">역할</span>
            <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); }}>
              <option value="">전체</option>
              <option>BUYER</option><option>SELLER</option><option>MANAGER</option><option>MASTER</option>
            </select>
            <span className="filter-label">상태</span>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); }}>
              <option value="">전체</option>
              <option>ACTIVE</option><option>SUSPENDED</option><option>DELETED</option>
            </select>
            <button className="btn btn-primary btn-sm" onClick={loadUsers}>검색</button>
          </div>
          <div className="filter-bar" style={{ marginBottom: '16px' }}>
            <span className="filter-label">UUID 직접 조회</span>
            <input
              style={{ flex: 1, minWidth: '260px' }}
              value={userIdInput}
              onChange={e => setUserIdInput(e.target.value)}
              placeholder="User UUID 붙여넣기"
              onKeyDown={e => e.key === 'Enter' && searchUserById()}
            />
            <button className="btn btn-outline btn-sm" onClick={searchUserById} disabled={userIdSearching}>
              {userIdSearching ? '조회 중...' : '조회'}
            </button>
          </div>
          {usersLoading ? <div className="loading"><div className="spinner" /></div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>이름</th><th>역할</th><th>상태</th><th>이메일</th><th>User ID</th><th>관리</th></tr></thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.userId || u.id || u.email || i}>
                      <td style={{ fontWeight: 600 }}>{u.name || '-'}</td>
                      <td><span className={`badge-role role-${u.role}`}>{u.role || '-'}</span></td>
                      <td>
                        {u.status === 'ACTIVE'
                          ? <span style={{ color: 'var(--g700)', fontWeight: 600 }}>활성</span>
                          : u.status === 'SUSPENDED'
                          ? <span style={{ color: 'var(--red)', fontWeight: 600 }}>정지</span>
                          : <span style={{ color: 'var(--neu500)' }}>탈퇴</span>}
                      </td>
                      <td style={{ color: 'var(--neu500)' }}>{u.email || '-'}</td>
                      <td>
                        {u.userId ? (
                          <span
                            style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--neu400)', cursor: 'pointer' }}
                            title={u.userId}
                            onClick={() => { navigator.clipboard.writeText(u.userId!); toast('복사됨', 'success') }}
                          >
                            {u.userId.slice(0, 8)}…
                          </span>
                        ) : <span style={{ color: 'var(--neu300)' }}>-</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button className="btn btn-outline btn-sm" onClick={() => viewUser(u)}>상세</button>
                          {u.status === 'ACTIVE' && <button className="btn btn-danger btn-sm" onClick={() => suspendUser(String(u.id || u.userId))}>정지</button>}
                          {u.status === 'SUSPENDED' && <button className="btn btn-outline btn-sm" onClick={() => unsuspendUser(String(u.id || u.userId))}>해제</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Products */}
      {tab === 'products' && (
        productsLoading ? <div className="loading"><div className="spinner" /></div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>상품명</th><th>설명</th><th>수량</th><th>상품 ID</th><th>삭제</th></tr></thead>
              <tbody>
                {products.length > 0 ? products.map(p => (
                  <tr key={p.id || p.productId}>
                    <td style={{ fontWeight: 600 }}>{p.name || '-'}</td>
                    <td style={{ color: 'var(--neu500)', fontSize: '13px' }}>{(p.description || '').substring(0, 30)}</td>
                    <td>{p.quantity || '-'}</td>
                    <td style={{ fontSize: '11px', fontFamily: 'monospace' }}>{String(p.id || p.productId || '')}</td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteProduct(String(p.id || p.productId))}>삭제</button>
                    </td>
                  </tr>
                )) : <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--neu500)' }}>상품 없음</td></tr>}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Auctions */}
      {tab === 'auctions' && (
        auctionsLoading ? <div className="loading"><div className="spinner" /></div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>상품명</th><th>상태</th><th>시작가</th><th>시작 시간</th><th>제어</th></tr></thead>
              <tbody>
                {auctions.map(a => {
                  const aid = String(a.id || a.auctionId)
                  return (
                    <tr key={aid}>
                      <td>
                        <Link href={`/auctions/${aid}`} style={{ fontWeight: 600, color: 'var(--g800)', cursor: 'pointer' }}>
                          {a.product?.name || a.productName || '-'}
                        </Link>
                      </td>
                      <td>
                        <span className={`card-status status-${a.status}`} style={{ position: 'static', display: 'inline-block' }}>
                          {statusLabel(a.status || '')}
                        </span>
                      </td>
                      <td>{fmtNum(a.startPrice || 0)}원</td>
                      <td>{fmtDate(a.startAt || '')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '5px' }}>
                          {a.status === 'READY' && <button className="btn btn-primary btn-sm" onClick={() => startAuction(aid)}>시작</button>}
                          {a.status === 'PROGRESS' && <button className="btn btn-accent btn-sm" onClick={() => closeAuction(aid)}>마감</button>}
                          {(a.status === 'READY' || a.status === 'PROGRESS') && <button className="btn btn-danger btn-sm" onClick={() => cancelAuction(aid)}>취소</button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* AI Docs */}
      {tab === 'ai-docs' && (
        <>
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-title">AI 문서 등록 (RAG)</div>
            <div className="form-group">
              <label>source 식별자</label>
              <input value={docSrc} onChange={e => setDocSrc(e.target.value)} placeholder="product-manual-v1" />
            </div>
            <div className="form-group">
              <label>파일 선택 (PDF, Word, Excel, txt)</label>
              <input type="file" ref={fileInputRef} />
            </div>
            <button className="btn btn-primary" onClick={uploadAiDoc}>등록</button>
          </div>
          {aiDocsLoading ? <div className="loading"><div className="spinner" /></div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>source</th><th>파일명</th><th>등록일</th><th>작업</th></tr></thead>
                <tbody>
                  {aiDocs.length > 0 ? aiDocs.map(d => (
                    <tr key={d.source}>
                      <td>{d.source || '-'}</td>
                      <td>{d.title || '-'}</td>
                      <td>{fmtDate(d.createdAt || '')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                            재임베딩
                            <input
                              type="file"
                              style={{ display: 'none' }}
                              onChange={e => {
                                const file = e.target.files?.[0]
                                if (file) reembedAiDoc(d.source || '', file)
                                e.target.value = ''
                              }}
                            />
                          </label>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteAiDoc(d.source || '')}>삭제</button>
                        </div>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--neu500)' }}>등록된 문서 없음</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* User Detail Modal */}
      {userDetailOpen && u && (
        <div className="modal-backdrop open" onClick={e => e.target === e.currentTarget && setUserDetailOpen(false)}>
          <div className="modal">
            <div className="modal-title">
              회원 상세
              <button className="modal-close" onClick={() => setUserDetailOpen(false)}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {u.userId && (
                <div className="form-group">
                  <label>User ID</label>
                  <div
                    style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--neu500)', cursor: 'pointer', wordBreak: 'break-all' }}
                    title="클릭하여 복사"
                    onClick={() => { navigator.clipboard.writeText(u.userId!); toast('User ID 복사됨', 'success') }}
                  >
                    {u.userId} 📋
                  </div>
                </div>
              )}
              <div className="form-group"><label>이름</label><div style={{ fontWeight: 600 }}>{u.name || '-'}</div></div>
              <div className="form-group"><label>이메일</label><div style={{ color: 'var(--neu500)' }}>{u.email || '-'}</div></div>
              <div className="form-group"><label>역할</label><span className={`badge-role role-${u.role}`}>{u.role || '-'}</span></div>
              <div className="form-group"><label>상태</label>
                {u.status === 'ACTIVE'
                  ? <span style={{ color: 'var(--g700)', fontWeight: 600 }}>활성</span>
                  : u.status === 'SUSPENDED'
                  ? <span style={{ color: 'var(--red)', fontWeight: 600 }}>정지</span>
                  : <span style={{ color: 'var(--neu500)' }}>탈퇴</span>}
              </div>
              <div className="form-group"><label>사업자번호</label><div style={{ color: 'var(--neu500)' }}>{u.businessNumber || '-'}</div></div>
              <div className="form-group"><label>Slack ID</label><div style={{ color: 'var(--neu500)' }}>{u.slackId || '-'}</div></div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                {u.status === 'ACTIVE' && (
                  <button className="btn btn-danger" onClick={() => { suspendUser(String(u.id || u.userId)); setUserDetailOpen(false) }}>정지</button>
                )}
                {u.status === 'SUSPENDED' && (
                  <button className="btn btn-outline" onClick={() => { unsuspendUser(String(u.id || u.userId)); setUserDetailOpen(false) }}>정지 해제</button>
                )}
                <button className="btn btn-outline" onClick={() => setUserDetailOpen(false)}>닫기</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
