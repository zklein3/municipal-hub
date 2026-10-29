'use client'

import { createContext, useContext, useEffect, useState } from 'react'

// Sidebar badge numbers that stay current without a page reload. The layout renders the first
// numbers on the server; this checks /api/nav-counts every minute (while the tab is visible) and
// whenever you come back to the tab, and the sidebar prefers the newer numbers.
const LiveBadgesContext = createContext<Record<string, number>>({})

export function useLiveBadges() {
  return useContext(LiveBadgesContext)
}

const POLL_MS = 60_000

export default function LiveNavBadgesProvider({
  enabled, initialKey, children,
}: {
  enabled: boolean
  // Changes whenever the server renders the layout with new numbers, so older polled values are dropped.
  initialKey: string
  children: React.ReactNode
}) {
  const [live, setLive] = useState<Record<string, number>>({})

  useEffect(() => { setLive({}) }, [initialKey])

  useEffect(() => {
    if (!enabled) return
    let stopped = false
    async function refresh() {
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch('/api/nav-counts', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json() as Record<string, number>
        if (!stopped && data && Object.keys(data).length > 0) setLive(data)
      } catch { /* offline or signed out — keep the numbers we have */ }
    }
    const timer = setInterval(refresh, POLL_MS)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      stopped = true
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [enabled])

  return <LiveBadgesContext.Provider value={live}>{children}</LiveBadgesContext.Provider>
}
