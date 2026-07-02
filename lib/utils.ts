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

const emojiMap: Record<string, string> = {
  사과: '🍎', 배: '🍐', 포도: '🍇', 딸기: '🍓', 감: '🫐',
  수박: '🍉', 참외: '🍈', 복숭아: '🍑', 망고: '🥭', 바나나: '🍌',
  오렌지: '🍊', 키위: '🥝', 토마토: '🍅', 당근: '🥕', 양파: '🧅',
  마늘: '🧄', 고구마: '🍠', 가지: '🍆', 배추: '🥬', 양상추: '🥦',
  호박: '🎃', 오이: '🥒', 파프리카: '🫑', 콩: '🫘', 쌀: '🌾', 장미: '🌹',
  블루베리: '🫐', 코코넛: '🥥', 레몬: '🍋', 라임: '🍋‍🟩', 파인애플: '🍍',
  체리: '🍒', 올리브: '🫒', 멜론: '🍈', 감자: '🥔', 옥수수: '🌽',
  브로콜리: '🥦', 땅콩: '🥜', 밤: '🌰', 버섯: '🍄‍🟫'
}

export function emojiFor(name: string): string {
  for (const k in emojiMap) {
    if ((name || '').includes(k)) return emojiMap[k]
  }
  const defaults = ['🌾', '🍋', '🥦', '🫘', '🌿', '🌱']
  return defaults[Math.abs((name || 'a').charCodeAt(0)) % 6]
}

export function bgClass(name: string): string {
  const cls = ['green', 'yellow', 'purple']
  return cls[Math.abs((name || 'a').charCodeAt(0)) % 3]
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
