'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

export default function QRScanner({
  onScan,
  onClose,
  hint,
}: {
  onScan: (raw: string) => void
  onClose: () => void
  hint?: string
}) {
  const [error, setError] = useState('')
  const [photoError, setPhotoError] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const detectedRef = useRef(false)
  const scanningRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const onScanRef = useRef(onScan)
  useEffect(() => { onScanRef.current = onScan }, [onScan])

  const stop = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => { return () => stop() }, [stop])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const NativeDetector = (typeof window !== 'undefined' && 'BarcodeDetector' in window)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (window as any).BarcodeDetector
      : null
    let detector: { detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } | null = null
    if (NativeDetector) {
      try { detector = new NativeDetector({ formats: ['qr_code'] }) } catch { /* unsupported */ }
    }

    async function start() {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setError('Camera access is not available on this browser.')
        return
      }
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
      } catch {
        setError('Unable to access camera. Check permissions and try again.')
        return
      }

      streamRef.current = stream
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) return

      video.srcObject = stream
      try { await video.play() } catch {
        setError('Unable to start camera preview.')
        stop()
        return
      }

      const tryDecode = async () => {
        if (detectedRef.current || scanningRef.current || video.readyState < 2) return
        scanningRef.current = true

        try {
          if (detector) {
            const codes = await detector.detect(video)
            if (codes.length > 0 && codes[0].rawValue != null) {
              detectedRef.current = true
              onScanRef.current(codes[0].rawValue)
              stop()
              return
            }
          }
        } catch { /* fall through */ }

        try {
          const ctx = canvas.getContext('2d')
          if (ctx) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            ctx.drawImage(video, 0, 0)
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const code = jsQR(imageData.data, imageData.width, imageData.height)
            if (code?.data != null) {
              detectedRef.current = true
              onScanRef.current(code.data)
              stop()
              return
            }
          }
        } catch { /* ignore */ }

        scanningRef.current = false
      }

      const loop = () => {
        if (detectedRef.current) return
        tryDecode()
        frameRef.current = requestAnimationFrame(loop)
      }
      frameRef.current = requestAnimationFrame(loop)
    }

    start()
  }, [stop])

  // Decode a full-resolution photo captured via the native camera app
  function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoError('')

    const reader = new FileReader()
    reader.onload = evt => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)
        if (code?.data != null) {
          detectedRef.current = true
          stop()
          onScanRef.current(code.data)
        } else {
          setPhotoError('No QR code found in the photo. Try better lighting or move closer.')
          // reset so they can try again
          if (fileInputRef.current) fileInputRef.current.value = ''
        }
      }
      img.src = evt.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  if (error) {
    return (
      <div className="w-full">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-3">
          {error}
        </div>
        {/* Still offer photo capture even if live stream fails */}
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
          onChange={handlePhotoCapture} className="hidden" />
        <button type="button" onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 mb-2">
          Take Photo Instead
        </button>
        <button type="button" onClick={onClose}
          className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 border border-zinc-200">
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="rounded-xl border border-zinc-200 bg-zinc-950 p-3">
        <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg" />
        <canvas ref={canvasRef} className="hidden" />
        {hint && <p className="mt-2 text-center text-xs text-zinc-300">{hint}</p>}
      </div>

      {/* Hidden native camera input — full-res photo → jsQR */}
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
        onChange={handlePhotoCapture} className="hidden" />

      {photoError && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {photoError}
        </div>
      )}

      <button type="button" onClick={() => fileInputRef.current?.click()}
        className="mt-3 w-full rounded-lg bg-orange-600 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-700">
        Take Photo to Scan
      </button>
      <button type="button" onClick={() => { stop(); onClose() }}
        className="mt-2 w-full rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 border border-zinc-200">
        Cancel
      </button>
    </div>
  )
}
