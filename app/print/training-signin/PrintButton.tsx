'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import NativePrint from '@/lib/native-print'

// On Android the WebView supports printing via the system PrintManager, which
// also includes "Save as PDF". We call our custom NativePrint plugin so the
// user never has to leave the app.
function triggerPrint(jobName = 'FireOps7 Document') {
  if (Capacitor.isNativePlatform()) {
    NativePrint.print({ jobName }).catch(console.error)
    return
  }
  window.print()
}

export default function PrintButton({
  auto,
  jobName,
}: {
  auto?: boolean
  jobName?: string
}) {
  useEffect(() => {
    if (auto && !Capacitor.isNativePlatform()) {
      const t = setTimeout(() => window.print(), 800)
      return () => clearTimeout(t)
    }
  }, [auto])

  return (
    <button
      type="button"
      onClick={() => triggerPrint(jobName)}
      style={{
        position: 'fixed', top: '1rem', right: '1rem',
        background: '#b91c1c', color: '#fff',
        border: 'none', borderRadius: '8px',
        padding: '0.5rem 1.25rem',
        fontSize: '0.875rem', fontWeight: 600,
        cursor: 'pointer', zIndex: 9999,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}
      className="no-print"
    >
      Print / Save PDF
    </button>
  )
}
