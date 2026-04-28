'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'

export default function QrPrintLabel({
  code,
  title,
  subtitle,
  buttonClassName,
}: {
  code: string
  title: string
  subtitle?: string
  buttonClassName?: string
}) {
  const [showLabel, setShowLabel] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    if (showLabel) {
      document.body.classList.add('qr-printing')
    } else {
      document.body.classList.remove('qr-printing')
    }
  }, [showLabel, mounted])

  useEffect(() => {
    if (!showLabel) return
    const handler = () => setShowLabel(false)
    window.addEventListener('afterprint', handler)
    return () => window.removeEventListener('afterprint', handler)
  }, [showLabel])

  function handlePrint() {
    setShowLabel(true)
    setTimeout(() => window.print(), 150)
  }

  return (
    <>
      {mounted && showLabel && createPortal(
        <div className="qr-print-label">
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            padding: '2rem',
            border: '2px dashed #a1a1aa',
            borderRadius: '12px',
            background: '#fff',
          }}>
            <QRCodeSVG value={code} size={200} level="M" />
            <p style={{ fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.1em', color: '#18181b', margin: 0 }}>
              {code}
            </p>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '1rem', fontWeight: 600, color: '#27272a', margin: 0 }}>{title}</p>
              {subtitle && <p style={{ fontSize: '0.875rem', color: '#71717a', marginTop: '0.25rem' }}>{subtitle}</p>}
            </div>
          </div>
        </div>,
        document.body
      )}
      <button
        type="button"
        onClick={handlePrint}
        className={buttonClassName ?? 'text-xs font-medium text-red-700 hover:underline print:hidden'}
      >
        Print QR Label
      </button>
    </>
  )
}
