'use client'

import { useState, useEffect } from 'react'

export default function HelpPrompt({
  id,
  showHelp,
  helpResetKey,
  children,
}: {
  id: string
  showHelp: boolean
  helpResetKey: number
  children: React.ReactNode
}) {
  const [dismissed, setDismissed] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Re-read localStorage whenever helpResetKey changes (help was re-enabled)
  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem(`setup_help_dismissed_${id}`)
    setDismissed(saved === 'true')
  }, [id, helpResetKey])

  if (!mounted || !showHelp || dismissed) return null

  function dismiss() {
    setDismissed(true)
    localStorage.setItem(`setup_help_dismissed_${id}`, 'true')
  }

  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
      <span className="mt-0.5 shrink-0 text-blue-400">ⓘ</span>
      <p className="flex-1 leading-relaxed">{children}</p>
      <button
        onClick={dismiss}
        title="Dismiss"
        className="shrink-0 text-blue-400 hover:text-blue-600 transition-colors text-base leading-none mt-0.5"
      >
        ✕
      </button>
    </div>
  )
}
