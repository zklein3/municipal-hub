'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import SignaturePad from 'signature_pad'

export interface SignatureCaptureHandle {
  getDataUrl: () => string | null
}

const SignatureCapture = forwardRef<SignatureCaptureHandle, { label: string }>(function SignatureCapture({ label }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  const [isEmpty, setIsEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const pad = new SignaturePad(canvas, { backgroundColor: 'rgb(255, 255, 255)' })
    padRef.current = pad

    function resize() {
      if (!canvas || !padRef.current) return
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      canvas.width = canvas.offsetWidth * ratio
      canvas.height = canvas.offsetHeight * ratio
      canvas.getContext('2d')!.scale(ratio, ratio)
      padRef.current.clear()
      setIsEmpty(true)
    }

    resize()
    window.addEventListener('resize', resize)
    pad.addEventListener('beginStroke', () => setIsEmpty(false))

    return () => {
      window.removeEventListener('resize', resize)
      pad.off()
    }
  }, [])

  useImperativeHandle(ref, () => ({
    getDataUrl: () => (padRef.current && !padRef.current.isEmpty()) ? canvasRef.current!.toDataURL('image/png') : null,
  }))

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs font-medium text-zinc-700">{label}</label>
        <button type="button" onClick={() => { padRef.current?.clear(); setIsEmpty(true) }}
          className="text-xs text-zinc-400 hover:text-zinc-700">
          Clear
        </button>
      </div>
      <div className="relative h-28 rounded-lg border border-zinc-300 bg-white">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-crosshair touch-none" />
        {isEmpty && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="select-none text-sm text-zinc-300">Sign here</p>
          </div>
        )}
      </div>
    </div>
  )
})

export default SignatureCapture
