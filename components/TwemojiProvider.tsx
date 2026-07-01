'use client'

import { useEffect } from 'react'
import twemoji from '@twemoji/api'

const PARSE_OPTS = { folder: 'svg', ext: '.svg' }

export default function TwemojiProvider() {
  useEffect(() => {
    twemoji.parse(document.body, PARSE_OPTS)

    let timer: ReturnType<typeof setTimeout>
    const observer = new MutationObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(() => twemoji.parse(document.body, PARSE_OPTS), 50)
    })

    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [])

  return null
}
