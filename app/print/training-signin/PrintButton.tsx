'use client'

import { useEffect } from 'react'

export default function PrintButton({ auto }: { auto?: boolean }) {
  useEffect(() => {
    if (auto) {
      const t = setTimeout(() => window.print(), 800)
      return () => clearTimeout(t)
    }
  }, [auto])

  return (
    <button
      type="button"
      onClick={() => window.print()}
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
