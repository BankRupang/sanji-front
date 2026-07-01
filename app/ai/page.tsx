'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import { apiCall } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { fmtDate } from '@/lib/utils'

interface Session {
  id?: string
  sessionId?: string
  createdAt?: string
}

interface Message {
  role: string
  content?: string
}

export default function AiPage() {
  const { token } = useAuth()
  const toast = useToast()

  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<string | null>(null)
  const [messages, setMessages] = useState<{ role: string; text: string; time: string }[]>([
    { role: 'ai', text: '안녕하세요! 산지직경 AI 상담사입니다. 🌾\n농산물 경매에 대해 궁금한 점을 물어보세요.', time: '지금' },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  const msgsRef = useRef<HTMLDivElement>(null)
  // ref로 activeSession 최신값 유지 (stale closure 방지)
  const activeSessionRef = useRef<string | null>(null)

  useEffect(() => {
    activeSessionRef.current = activeSession
  }, [activeSession])

  const loadSessions = useCallback(async () => {
    const r = await apiCall('GET', '/api/v1/ai/sessions?page=0&size=20', undefined, token)
    if (r.ok) {
      const items: Session[] = r.data?.data?.content || []
      setSessions(items)
      // 현재 활성 세션이 없을 때만 첫 세션 자동 선택 (ref로 최신값 확인)
      if (items.length > 0 && !activeSessionRef.current) {
        selectSession(items[0].id || items[0].sessionId || '')
      }
    }
  }, [token])

  async function createSession() {
    if (!token) { toast('로그인이 필요합니다.', 'error'); return }
    const r = await apiCall('POST', '/api/v1/ai/sessions', undefined, token)
    if (r.ok) {
      const d = r.data?.data || r.data
      const sid = d.id || d.sessionId
      setActiveSession(sid)
      activeSessionRef.current = sid
      setMessages([{ role: 'ai', text: '안녕하세요! 산지직경 AI 상담사입니다. 🌾\n농산물 경매에 대해 궁금한 점을 물어보세요.', time: '지금' }])
      // 세션 목록에 바로 추가 (loadSessions 호출 없이)
      setSessions(prev => [d, ...prev.filter(s => (s.id || s.sessionId) !== sid)])
    } else {
      toast('세션 생성 실패', 'error')
    }
  }

  async function selectSession(id: string) {
    setActiveSession(id)
    activeSessionRef.current = id
    const r = await apiCall('GET', `/api/v1/ai/sessions/${id}/messages`, undefined, token)
    if (r.ok) {
      const msgs: Message[] = r.data?.data || []
      const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      setMessages([
        { role: 'ai', text: '안녕하세요! 산지직경 AI 상담사입니다. 🌾\n농산물 경매에 대해 궁금한 점을 물어보세요.', time: '지금' },
        ...msgs.map(m => ({ role: m.role === 'USER' ? 'user' : 'ai', text: m.content || '', time: now })),
      ])
    }
  }

  useEffect(() => {
    if (token) loadSessions()
  }, [token, loadSessions])

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight
  }, [messages])

  async function sendChat() {
    if (!token) { toast('로그인이 필요합니다.', 'error'); return }
    const msg = input.trim()
    if (!msg || sending) return

    // 입력창 즉시 초기화
    setInput('')

    let sid = activeSessionRef.current

    // 세션이 없으면 먼저 생성
    if (!sid) {
      const r = await apiCall('POST', '/api/v1/ai/sessions', undefined, token)
      if (!r.ok) { toast('세션 생성 실패', 'error'); setInput(msg); return }
      const d = r.data?.data || r.data
      sid = d.id || d.sessionId || ''
      setActiveSession(sid)
      activeSessionRef.current = sid
      // 세션 목록에 바로 추가 (loadSessions 없이 → 메시지 초기화 방지)
      setSessions(prev => [d, ...prev.filter(s => (s.id || s.sessionId) !== sid)])
    }

    const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

    // 내 메시지 즉시 표시
    setMessages(prev => [...prev, { role: 'user', text: msg, time: now }])

    // AI 응답 대기 중 표시
    setSending(true)
    setMessages(prev => [...prev, { role: 'ai', text: '...', time: now }])

    const r = await apiCall('POST', `/api/v1/ai/sessions/${sid}/chat`, { message: msg }, token)

    setSending(false)

    if (r.ok) {
      const d = r.data?.data || r.data
      const answer = d.answer || d.message || d.response || JSON.stringify(d)
      const replyTime = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      // 마지막 '...' 메시지를 실제 답변으로 교체
      setMessages(prev => [...prev.slice(0, -1), { role: 'ai', text: answer, time: replyTime }])
    } else {
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'ai', text: '죄송합니다, 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', time: now },
      ])
    }
  }

  return (
    <div className="chat-layout">
      {/* Sidebar */}
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          AI 상담
          <button className="btn btn-primary btn-sm" onClick={createSession}>+ 새 대화</button>
        </div>
        <div className="chat-session-list">
          {!token ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--neu500)', fontSize: '13px' }}>
              로그인 후 이용 가능합니다
            </div>
          ) : sessions.length > 0 ? (
            sessions.map(s => {
              const sid = s.id || s.sessionId || ''
              return (
                <div
                  key={sid}
                  className={`chat-session-item${activeSession === sid ? ' active' : ''}`}
                  onClick={() => selectSession(sid)}
                >
                  💬 세션 {fmtDate(s.createdAt || '')}
                </div>
              )
            })
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--neu500)', fontSize: '13px' }}>
              대화 내역이 없습니다
            </div>
          )}
        </div>
      </div>

      {/* Chat main */}
      <div className="chat-main">
        <div className="chat-header">AI 농산물 상담사</div>
        <div className="chat-messages" ref={msgsRef}>
          {messages.map((m, i) => (
            <div key={i} className={`msg msg-${m.role}`}>
              <div
                className="msg-bubble"
                style={{
                  whiteSpace: 'pre-wrap',
                  opacity: m.text === '...' ? 0.5 : 1,
                  fontStyle: m.text === '...' ? 'italic' : 'normal',
                }}
              >
                {m.text}
              </div>
              <div className="msg-time">{m.time}</div>
            </div>
          ))}
        </div>
        <div className="chat-input-area">
          <textarea
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="메시지를 입력하세요..."
            rows={1}
            disabled={sending}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() }
            }}
          />
          <button className="btn btn-primary" onClick={sendChat} disabled={sending}>
            {sending ? '...' : '전송'}
          </button>
        </div>
      </div>
    </div>
  )
}
