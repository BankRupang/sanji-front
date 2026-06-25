'use client'

import { useToasts } from '@/contexts/ToastContext'

export default function Toast() {
  const toasts = useToasts()
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast${t.type ? ' ' + t.type : ''}`}>
          {t.message}
        </div>
      ))}
    </div>
  )
}
