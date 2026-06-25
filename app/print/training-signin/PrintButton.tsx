'use client'

import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'

// Android's WebView (which the Capacitor app wraps) doesn't implement
// window.print() — it's a silent no-op. Hand off to the system browser
// (Chrome), which has real print-to-PDF support, instead.
function triggerPrint() {
  if (Capacitor.isNativePlatform()) {
    Browser.open({ url: window.location.href })
    return
  }
  window.print()
}

export default function PrintButton({ auto }: { auto?: boolean }) {
  const [isNative, setIsNative] = useState(false)

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform())
  }, [])

  useEffect(() => {
    if (auto && !Capacitor.isNativePlatform()) {
      const t = setTimeout(() => window.print(), 800)
      return () => clearTimeout(t)
    }
  }, [auto])

  return (
    <button
      type="button"
      onClick={triggerPrint}
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
      {isNative ? 'Open in Browser to Print' : 'Print / Save PDF'}
    </button>
  )
}
