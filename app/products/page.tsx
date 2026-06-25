'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiCall } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import ProductCard, { type ProductItem } from '@/components/ProductCard'
import { fmtNum, fmtDate, emojiFor, bgClass, copyToClipboard } from '@/lib/utils'

export default function ProductsPage() {
  const { token, userRole, userId } = useAuth()
  const toast = useToast()
  const router = useRouter()

  const [products, setProducts] = useState<ProductItem[]>([])
  const [loading, setLoading] = useState(true)

  // Create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [cpForm, setCpForm] = useState({ name: '', quantity: '', description: '' })

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailProduct, setDetailProduct] = useState<ProductItem & { description?: string } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const canCreate = userRole === 'SELLER' || userRole === 'MASTER'

  useEffect(() => { loadProducts() }, [token])

  async function loadProducts() {
    setLoading(true)
    const r = await apiCall('GET', '/api/v1/products?page=0&size=20', undefined, token)
    if (r.ok) setProducts(r.data?.data?.content || [])
    setLoading(false)
  }

  async function showDetail(id: string) {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailProduct(null)
    const r = await apiCall('GET', `/api/v1/products/${id}`, undefined, token)
    if (r.ok) setDetailProduct(r.data?.data || r.data)
    else toast('상품 조회 실패', 'error')
    setDetailLoading(false)
  }

  async function deleteProduct(id: string) {
    if (!window.confirm('상품을 삭제하시겠습니까? 연결된 경매는 먼저 취소해야 합니다.')) return
    const r = await apiCall('DELETE', `/api/v1/products/${id}`, undefined, token)
    if (r.ok) { toast('상품이 삭제되었습니다.', 'success'); loadProducts() }
    else toast('삭제 실패: ' + (r.data?.message || ''), 'error')
  }

  async function doCreateProduct() {
    const { name, description, quantity } = cpForm
    if (!name || !description || !quantity) { toast('모든 항목을 입력하세요.', 'error'); return }
    const r = await apiCall('POST', '/api/v1/products', { name, description, quantity }, token)
    if (r.ok) {
      toast('상품이 등록되었습니다.', 'success')
      setCreateOpen(false)
      setCpForm({ name: '', quantity: '', description: '' })
      loadProducts()
    } else {
      toast('등록 실패: ' + (r.data?.message || ''), 'error')
    }
  }

  const p = detailProduct

  return (
    <div className="container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div className="section-title">상품 목록</div>
        {canCreate && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { if (!token) { router.push('/login'); return }; setCreateOpen(true) }}
          >
            + 상품 등록
          </button>
        )}
      </div>
      <div className="section-sub">등록된 농산물 상품 목록입니다</div>

      {loading ? (
        <div className="loading"><div className="spinner" />불러오는 중...</div>
      ) : products.length > 0 ? (
        <div className="auction-grid">
          {products.map(prod => (
            <ProductCard
              key={prod.id || prod.productId}
              product={prod}
              onDetail={showDetail}
              onDelete={deleteProduct}
            />
          ))}
        </div>
      ) : (
        <div className="empty">
          <div className="empty-icon">📦</div>
          <h3>등록된 상품이 없습니다</h3>
        </div>
      )}

      {/* Create Product Modal */}
      {createOpen && (
        <div className="modal-backdrop open" onClick={e => e.target === e.currentTarget && setCreateOpen(false)}>
          <div className="modal">
            <div className="modal-title">
              상품 등록
              <button className="modal-close" onClick={() => setCreateOpen(false)}>×</button>
            </div>
            <div className="form-group">
              <label>상품명 <span className="req">*</span></label>
              <input
                value={cpForm.name}
                onChange={e => setCpForm(p => ({ ...p, name: e.target.value }))}
                placeholder="정기배 사과 10kg"
              />
            </div>
            <div className="form-group">
              <label>수량 <span className="req">*</span></label>
              <input
                value={cpForm.quantity}
                onChange={e => setCpForm(p => ({ ...p, quantity: e.target.value }))}
                placeholder="10박스"
              />
            </div>
            <div className="form-group">
              <label>상품 설명 <span className="req">*</span></label>
              <textarea
                value={cpForm.description}
                onChange={e => setCpForm(p => ({ ...p, description: e.target.value }))}
                placeholder="상품에 대한 자세한 설명"
              />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={doCreateProduct}>
              등록하기
            </button>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {detailOpen && (
        <div className="modal-backdrop open" onClick={e => e.target === e.currentTarget && setDetailOpen(false)}>
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-title">
              상품 상세
              <button className="modal-close" onClick={() => setDetailOpen(false)}>×</button>
            </div>
            {detailLoading ? (
              <div className="loading"><div className="spinner" /></div>
            ) : p ? (
              <>
                <div style={{ textAlign: 'center', padding: '24px 0', background: 'var(--g100)', borderRadius: 'var(--radius-lg)', marginBottom: '20px', fontSize: '64px' }}>
                  {emojiFor(p.name || '')}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>{p.name || '-'}</div>
                <div style={{ fontSize: '14px', color: 'var(--neu500)', marginBottom: '16px', lineHeight: 1.7 }}>
                  {p.description || '설명 없음'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div className="card" style={{ padding: '14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: 'var(--neu500)', marginBottom: '4px' }}>수량</div>
                    <div style={{ fontSize: '18px', fontWeight: 700 }}>{p.quantity || '-'}</div>
                  </div>
                  <div className="card" style={{ padding: '14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: 'var(--neu500)', marginBottom: '4px' }}>판매자 ID</div>
                    <div
                      style={{ fontSize: '11px', fontFamily: 'monospace', cursor: 'pointer', wordBreak: 'break-all' }}
                      onClick={() => copyToClipboard(String(p.sellerId || p.userId || ''), '판매자 ID', toast)}
                      title="클릭하여 복사"
                    >
                      {String(p.sellerId || p.userId || '-')}
                    </div>
                  </div>
                </div>
                <div className="card" style={{ padding: '12px 14px', background: 'var(--neu100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--neu500)' }}>상품 ID: </span>
                    <span
                      style={{ fontSize: '11px', fontFamily: 'monospace', cursor: 'pointer' }}
                      onClick={() => copyToClipboard(String(p.id || p.productId || ''), '상품 ID', toast)}
                      title="클릭하여 복사"
                    >
                      {String(p.id || p.productId || '-')}
                    </span>
                  </div>
                  {(userRole === 'MASTER' || userRole === 'MANAGER' || (userRole === 'SELLER' && (p.sellerId || p.userId)?.toString() === userId)) && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => { deleteProduct(String(p.id || p.productId)); setDetailOpen(false) }}
                    >
                      삭제
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="empty"><div className="empty-icon">⚠️</div><h3>불러오기 실패</h3></div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
