export function fmtNum(n: number | string | undefined | null): string {
  return Number(n || 0).toLocaleString('ko-KR')
}

export function fmtDate(s: string | undefined | null): string {
  if (!s) return '-'
  return new Date(s).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const LIVESTOCK_KW = ['소','돼지','닭','오리','한우','삼겹','갈비','육우','소고기','돼지고기','닭고기','계란','달걀','우유','양고기','흑돼지','토종닭','오리고기']
const SEAFOOD_KW   = ['고등어','갈치','오징어','낙지','문어','새우','게','굴','전복','조개','연어','참치','광어','우럭','꽃게','멸치','미역','다시마','가자미','도미','방어','명태','대구','바지락','홍합','가리비','해삼','성게','김','수산']
const FRUIT_KW     = ['사과','배','포도','딸기','수박','참외','복숭아','망고','바나나','오렌지','키위','감귤','레몬','블루베리','체리','자두','살구','무화과','멜론','파인애플','귤','유자','석류','감','대추','밤','호두','잣','코코넛']

export type ProductCategory = 'livestock' | 'seafood' | 'fruit' | 'farm'

export function categoryFor(name: string): ProductCategory {
  const n = name || ''
  if (LIVESTOCK_KW.some(k => n.includes(k))) return 'livestock'
  if (SEAFOOD_KW.some(k => n.includes(k))) return 'seafood'
  if (FRUIT_KW.some(k => n.includes(k))) return 'fruit'
  return 'farm'
}

const emojiMap: Record<string, string> = {
  사과: '🍎', 배: '🍐', 포도: '🍇', 딸기: '🍓', 수박: '🍉', 참외: '🍈',
  복숭아: '🍑', 망고: '🥭', 바나나: '🍌', 오렌지: '🍊', 키위: '🥝', 레몬: '🍋',
  블루베리: '🫐', 체리: '🍒', 파인애플: '🍍', 멜론: '🍈', 귤: '🍊', 감: '🍊', 밤: '🌰',
  토마토: '🍅', 당근: '🥕', 양파: '🧅', 마늘: '🧄', 고구마: '🍠', 가지: '🍆',
  배추: '🥬', 양상추: '🥦', 호박: '🎃', 오이: '🥒', 파프리카: '🫑', 콩: '🫘',
  쌀: '🌾', 고추: '🌶️', 감자: '🥔', 버섯: '🍄', 옥수수: '🌽', 브로콜리: '🥦',
  고등어: '🐟', 갈치: '🐟', 오징어: '🦑', 낙지: '🐙', 문어: '🐙', 새우: '🦐',
  게: '🦀', 굴: '🦪', 전복: '🐚', 연어: '🐟', 꽃게: '🦀', 미역: '🌿', 김: '🌿',
  한우: '🥩', 소고기: '🥩', 돼지고기: '🥩', 삼겹: '🥓', 닭고기: '🍗', 달걀: '🥚',
  계란: '🥚', 우유: '🥛',
}

export function emojiFor(name: string): string {
  for (const k in emojiMap) {
    if ((name || '').includes(k)) return emojiMap[k]
  }
  const cat = categoryFor(name)
  return { livestock: '🥩', seafood: '🐟', fruit: '🍎', farm: '🌾' }[cat]
}

export function bgClass(name: string): string {
  return { livestock: 'red', seafood: 'blue', fruit: 'yellow', farm: 'green' }[categoryFor(name)]
}

export function statusLabel(s: string): string {
  const labels: Record<string, string> = {
    READY: '대기중',
    PROGRESS: '진행중',
    RESULT_PENDING: '결과처리중',
    WON: '낙찰',
    SUCCESS: '거래완료',
    FAIL: '유찰',
    CANCEL: '취소',
    CANCELLED: '취소',
  }
  return labels[s] || s || '-'
}

export function parseJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

export function copyToClipboard(text: string, label: string, toast: (msg: string, type?: string) => void) {
  if (!text) return
  navigator.clipboard
    .writeText(text)
    .then(() => toast(`${label} 복사됨`, 'success'))
    .catch(() => {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      toast(`${label} 복사됨`, 'success')
    })
}

export function orderStatusLabel(s: string): string {
  const m: Record<string, string> = {
    PENDING: '결제대기',
    PAYMENT_SUCCESS: '결제완료',
    PAYMENT_FAILED: '결제실패',
    REFUNDED: '환불됨',
    FORFEITED: '보증금몰수',
    PENALTY_PENDING: '위약금대기',
    EXPIRED: '기한만료',
    COMPLETED: '거래완료',
  }
  return m[s] || s || '-'
}

export function orderStatusColor(s: string): string {
  const m: Record<string, string> = {
    PENDING: '#f59e0b',
    PAYMENT_SUCCESS: '#16a34a',
    PAYMENT_FAILED: '#dc2626',
    REFUNDED: '#3b82f6',
    FORFEITED: '#dc2626',
    PENALTY_PENDING: '#f59e0b',
    EXPIRED: '#6b7280',
    COMPLETED: '#16a34a',
  }
  return m[s] || '#6b7280'
}

export function orderTypeLabel(t: string): string {
  return t === 'DEPOSIT' ? '보증금' : t === 'WINNING' ? '낙찰금' : t || '-'
}

export function fmtCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000))
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
