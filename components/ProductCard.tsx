'use client'

import { emojiFor, bgClass } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

export interface ProductItem {
  id?: string
  productId?: string
  name?: string
  description?: string
  quantity?: string
  sellerId?: string
  userId?: string
}

interface Props {
  product: ProductItem
  onDetail: (id: string) => void
  onDelete: (id: string) => void
}

export default function ProductCard({ product: p, onDetail, onDelete }: Props) {
  const { userRole, userId } = useAuth()
  const id = (p.id || p.productId || '').toString()
  const name = p.name || ''
  const em = emojiFor(name)
  const bc = bgClass(name || 'p')

  const canDelete =
    userRole === 'MASTER' ||
    userRole === 'MANAGER' ||
    (userRole === 'SELLER' && (p.sellerId || p.userId)?.toString() === userId)

  return (
    <div className="auction-card" onClick={() => onDetail(id)} style={{ cursor: 'pointer' }}>
      <div className={`card-thumb ${bc}`}>{em}</div>
      <div className="card-body">
        <div className="card-name">{name || '-'}</div>
        <div className="card-seller">수량: {p.quantity || '-'}</div>
        <div
          className="card-seller"
          style={{ fontSize: '13px', color: 'var(--neu700)', marginTop: '6px' }}
        >
          {(p.description || '').substring(0, 50)}
          {(p.description || '').length > 50 ? '...' : ''}
        </div>
        <div className="card-meta">
          <span style={{ fontSize: '11px', color: 'var(--neu300)' }}>
            ID: {id.substring(0, 8)}…
          </span>
          {canDelete && (
            <button
              className="btn btn-danger btn-sm"
              style={{ fontSize: '11px', padding: '3px 8px' }}
              onClick={e => { e.stopPropagation(); onDelete(id) }}
            >
              삭제
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
