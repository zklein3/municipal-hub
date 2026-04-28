'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    BarcodeDetector?: {
      new(options?: { formats?: string[] }): {
        detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>
      }
    }
  }
}

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
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const detectedRef = useRef(false)
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
    async function start() {
      if (
        typeof window === 'undefined' ||
        !navigator.mediaDevices?.getUserMedia ||
        typeof window.BarcodeDetector === 'undefined'
      ) {
        setError('Camera QR scanning is not supported on this browser. Try Chrome on Android or desktop.')
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
      const detector = new window.BarcodeDetector!({ formats: ['qr_code'] })
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) return

      video.srcObject = stream
      try {
        await video.play()
      } catch {
        setError('Unable to start camera preview.')
        stop()
        return
      }

      const loop = async () => {
        if (detectedRef.current) return
        if (video.readyState >= 2) {
          const ctx = canvas.getContext('2d')
          if (ctx) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            ctx.drawImage(video, 0, 0)
            try {
              const codes = await detector.detect(canvas)
              const raw = codes?.[0]?.rawValue?.trim()
              if (raw) {
                detectedRef.current = true
                stop()
                onScanRef.current(raw)
                return
              }
            } catch { /* keep scanning */ }
          }
        }
        frameRef.current = requestAnimationFrame(loop)
      }

      frameRef.current = requestAnimationFrame(loop)
    }

    start()
  }, [stop])

  if (error) {
    return (
      <div className="w-full">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-3">
          {error}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 border border-zinc-200"
        >
          Close
        </button>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="rounded-xl border border-zinc-200 bg-zinc-950 p-3">
        <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg" />
        <canvas ref={canvasRef} className="hidden" />
        {hint && (
          <p className="mt-2 text-center text-xs text-zinc-300">{hint}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => { stop(); onClose() }}
        className="mt-3 w-full rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 border border-zinc-200"
      >
        Cancel
      </button>
    </div>
  )
}
