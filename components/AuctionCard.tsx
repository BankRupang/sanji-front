import Link from 'next/link'
import { emojiFor, bgClass, statusLabel, fmtNum, fmtDate } from '@/lib/utils'

export interface AuctionItem {
  id?: string
  auctionId?: string
  status?: string
  product?: { name?: string }
  productName?: string
  title?: string
  startPrice?: number
  currentPrice?: number
  bidUnit?: number
  startAt?: string
  sellerId?: string
}

export default function AuctionCard({ a }: { a: AuctionItem }) {
  const id = a.id || a.auctionId
  const name = a.product?.name || a.productName || a.title || ''
  const em = emojiFor(name)
  const bc = bgClass(name || 'a')

  return (
    <Link href={`/auctions/${id}`} className="auction-card">
      <div className={`card-thumb ${bc}`}>
        {em}
        <span className={`card-status status-${a.status || 'READY'}`}>
          {statusLabel(a.status || '')}
        </span>
      </div>
      <div className="card-body">
        <div className="card-name">{name || '상품명 미등록'}</div>
        <div className="card-seller">판매자 ID: {String(a.sellerId || '-')}</div>
        <div className="card-price">
          <span className="price-label">시작가</span>
          <span className="price-val">{fmtNum(a.startPrice || a.currentPrice || 0)}</span>
          <span className="price-unit">원</span>
        </div>
        <div className="card-meta">
          <span>입찰단위 {fmtNum(a.bidUnit || 0)}원</span>
          <span className={a.status === 'PROGRESS' ? 'timer' : ''}>
            {a.startAt ? fmtDate(a.startAt) : '-'}
          </span>
        </div>
      </div>
    </Link>
  )
}
