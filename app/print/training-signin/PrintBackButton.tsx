'use client'

import { useRouter } from 'next/navigation'

export default function PrintBackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter()

  function handleBack() {
    if (window.history.length > 1) router.back()
    else router.push(fallbackHref)
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      style={{
        position: 'fixed', top: '1rem', left: '1rem',
        background: '#fff', color: '#27272a',
        border: '1px solid #d4d4d8', borderRadius: '8px',
        padding: '0.5rem 1.25rem',
        fontSize: '0.875rem', fontWeight: 600,
        cursor: 'pointer', zIndex: 9999,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
      }}
      className="no-print"
    >
      ← Back
    </button>
  )
}
