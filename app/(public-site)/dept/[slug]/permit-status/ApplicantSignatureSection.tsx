'use client'

import { useRef, useEffect, useState, useTransition } from 'react'
import SignaturePad from 'signature_pad'
import { savePermitApplicantSignature, acknowledgePermitPrintAndSign } from '@/app/actions/public-site'

export default function ApplicantSignatureSection({
  confirmationCode,
  departmentId,
  contactName,
  slug,
}: {
  confirmationCode: string
  departmentId: string
  contactName: string
  slug: string
}) {
  const [mode, setMode] = useState<'choose' | 'sign' | 'done'>('choose')
  const [doneType, setDoneType] = useState<'signed' | 'acknowledged' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef    = useRef<SignaturePad | null>(null)
  const [isEmpty, setIsEmpty] = useState(true)

  useEffect(() => {
    if (mode !== 'sign') return
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
    return () => { window.removeEventListener('resize', resize); pad.off() }
  }, [mode])

  function handleConfirmSignature() {
    if (!padRef.current || padRef.current.isEmpty()) return
    canvasRef.current!.toBlob(blob => {
      if (!blob) { setError('Failed to capture signature.'); return }
      const fd = new FormData()
      fd.append('signature', blob, 'signature.png')
      fd.append('confirmation_code', confirmationCode)
      fd.append('department_id', departmentId)
      startTransition(async () => {
        const result = await savePermitApplicantSignature(fd)
        if (result?.error) { setError(result.error); return }
        setDoneType('signed')
        setMode('done')
      })
    }, 'image/png')
  }

  function handleAcknowledge() {
    const fd = new FormData()
    fd.append('confirmation_code', confirmationCode)
    fd.append('department_id', departmentId)
    startTransition(async () => {
      const result = await acknowledgePermitPrintAndSign(fd)
      if (result?.error) { setError(result.error); return }
      setDoneType('acknowledged')
      setMode('done')
    })
  }

  if (mode === 'done') {
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 p-6 text-center">
        <p className="text-2xl mb-2">✅</p>
        <p className="text-sm font-semibold text-green-800 mb-1">
          {doneType === 'signed' ? 'Signature Captured' : 'Acknowledged'}
        </p>
        <p className="text-xs text-green-700 mb-4">
          {doneType === 'signed'
            ? 'Your signature has been recorded. You may now print your permit.'
            : 'Acknowledged. Please print and sign the paper copy of your permit.'}
        </p>
        <a
          href={`/dept/${slug}/permit-print?code=${confirmationCode}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-xl bg-red-700 px-6 py-3 text-sm font-semibold text-white hover:bg-red-800 transition-colors"
        >
          Print My Permit ↗
        </a>
      </div>
    )
  }

  if (mode === 'sign') {
    return (
      <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Applicant Signature</p>
          <p className="text-sm font-bold text-zinc-900">{contactName}</p>
          <p className="text-xs text-zinc-500">Permit {confirmationCode}</p>
        </div>
        <div className="relative bg-white" style={{ height: '200px' }}>
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full touch-none cursor-crosshair" />
          {isEmpty && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="select-none text-zinc-300">Sign here</p>
            </div>
          )}
        </div>
        {error && <p className="px-5 py-2 text-sm text-red-600">{error}</p>}
        <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50 flex gap-2">
          <button onClick={() => { setMode('choose'); setError(null) }} disabled={isPending}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50">
            Back
          </button>
          <button onClick={() => { padRef.current?.clear(); setIsEmpty(true) }} disabled={isPending || isEmpty}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50">
            Clear
          </button>
          <button onClick={handleConfirmSignature} disabled={isPending || isEmpty}
            className="ml-auto rounded-lg bg-red-700 px-6 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
            {isPending ? 'Saving...' : 'Confirm Signature'}
          </button>
        </div>
      </div>
    )
  }

  // mode === 'choose'
  return (
    <div className="rounded-xl bg-white border border-zinc-200 p-5">
      <p className="text-sm font-semibold text-zinc-900 mb-1">One more step</p>
      <p className="text-xs text-zinc-500 mb-4">
        Please sign your permit to complete the process. You can sign digitally here or print and sign by hand.
      </p>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="flex flex-col gap-3">
        <button onClick={() => setMode('sign')}
          className="w-full rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3.5 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors text-left">
          Sign Digitally
          <p className="text-xs font-normal text-red-500 mt-0.5">Sign here with your finger — signature is saved with your permit</p>
        </button>
        <button onClick={handleAcknowledge} disabled={isPending}
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors text-left disabled:opacity-50">
          {isPending ? 'Saving...' : "I'll Print and Sign"}
          <p className="text-xs font-normal text-zinc-400 mt-0.5">Print the permit and sign the paper copy by hand</p>
        </button>
      </div>
    </div>
  )
}
