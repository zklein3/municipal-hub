'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import QRScanner from './QRScanner'

export default function QRScanButton({
  hint,
  buttonLabel,
  buttonClassName,
}: {
  hint?: string
  buttonLabel?: string
  buttonClassName?: string
}) {
  const router = useRouter()
  const [supported, setSupported] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setSupported(
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia
    )
  }, [])

  function handleScan(raw: string) {
    setScanning(false)
    try {
      const url = new URL(raw)
      router.push(url.pathname + url.search)
      return
    } catch { /* not a URL — treat as raw code */ }
    router.push(`/scan?code=${encodeURIComponent(raw)}`)
  }

  if (!mounted || !supported) return null

  return (
    <>
      {scanning && createPortal(
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <p className="text-white text-sm font-medium text-center mb-4">
              {hint ?? 'Point camera at a FireOps7 QR label'}
            </p>
            <QRScanner
              onScan={handleScan}
              onClose={() => setScanning(false)}
              hint="QR detected — navigating..."
            />
          </div>
        </div>,
        document.body
      )}
      <button
        type="button"
        onClick={() => setScanning(true)}
        className={buttonClassName ?? 'rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors'}
      >
        {buttonLabel ?? 'Scan QR'}
      </button>
    </>
  )
}
