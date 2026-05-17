'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { checkBottle, logFill, verifyFill } from '@/app/actions/fire-school'
import QRScanner from '@/components/QRScanner'

const CYLINDER_TYPE_LABELS: Record<string, string> = {
  composite_15: 'Carbon Fiber (15yr)',
  composite_30: 'Next-Gen Composite (30yr)',
  hoop_wrapped: 'Hoop-Wrapped (15yr)',
  steel:        'Steel',
  aluminum:     'Aluminum',
}

interface Bottle {
  bottle_id: string
  department_name: string | null
  psi: number | null
  cylinder_type: string | null
  manufacture_date: string | null
  last_requal_date: string | null
  requal_interval_years: number | null
  service_life_years: number | null
  requires_service_life: boolean | null
  active: boolean
}

interface CheckBottleResult {
  found: boolean
  bottle?: Bottle
  fillable?: boolean
  reason?: string | null
  unverifiedFill?: { id: string; filled_at: string } | null
}

export default function FillStationPage() {
  return <Suspense><FillStationContent /></Suspense>
}

function FillStationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [bottleInput, setBottleInput] = useState('')
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<CheckBottleResult | null>(null)
  const [logging, setLogging] = useState(false)
  const [notes, setNotes] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [verified, setVerified] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [skippedVerify, setSkippedVerify] = useState(false)

  const extractBottleIdFromScan = useCallback((raw: string): string => {
    const trimmed = raw.trim()
    if (!trimmed.includes('://') && !trimmed.includes('scan=')) return trimmed.toUpperCase()
    try {
      const url = new URL(trimmed)
      const scanParam = url.searchParams.get('scan')
      if (scanParam?.trim()) return scanParam.trim().toUpperCase()
      const pathParts = url.pathname.split('/').filter(Boolean)
      const last = pathParts[pathParts.length - 1]
      if (last) return last.trim().toUpperCase()
    } catch { /* fall through */ }
    const match = trimmed.match(/[?&]scan=([^&]+)/i)
    if (match?.[1]) {
      try { return decodeURIComponent(match[1]).trim().toUpperCase() } catch { return match[1].trim().toUpperCase() }
    }
    return trimmed.toUpperCase()
  }, [])

  useEffect(() => {
    const scan = searchParams.get('scan')
    if (scan?.trim()) handleCheck(scan.trim().toUpperCase())
  }, [])

  async function handleCheck(overrideBottleId?: string) {
    const rawValue = overrideBottleId ?? bottleInput
    const cleanBottleId = rawValue.trim().toUpperCase()

    if (!cleanBottleId) return

    setBottleInput(cleanBottleId)
    setChecking(true)
    setResult(null)

    try {
      const res = await checkBottle(cleanBottleId)
      setResult(res as CheckBottleResult)
    } finally {
      setChecking(false)
    }
  }

  async function handleLogFill() {
    if (!result?.bottle) return

    setLogging(true)

    try {
      const res = await logFill(result.bottle.bottle_id, notes)
      if (res.success) {
        handleReset()
      }
    } finally {
      setLogging(false)
    }
  }

  function handleReset() {
    setBottleInput('')
    setResult(null)
    setNotes('')
    setScannerOpen(false)
    setVerified(false)
    setSkippedVerify(false)
    router.replace('/fire-school')
  }

  const getRequalExpiry = (bottle: Bottle) => {
    if (!bottle.last_requal_date || !bottle.requal_interval_years) return null
    const d = new Date(bottle.last_requal_date)
    d.setFullYear(d.getFullYear() + bottle.requal_interval_years)
    return d
  }

  const getServiceLifeExpiry = (bottle: Bottle) => {
    if (!bottle.requires_service_life || !bottle.manufacture_date || !bottle.service_life_years) return null
    const d = new Date(bottle.manufacture_date)
    d.setFullYear(d.getFullYear() + bottle.service_life_years)
    return d
  }

  async function handleScan(raw: string) {
    setScannerOpen(false)
    const bottleId = extractBottleIdFromScan(raw)
    setBottleInput(bottleId)
    await handleCheck(bottleId)
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-zinc-900">SCBA Fill Station</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Enter a bottle ID or scan with the camera
        </p>
      </div>

      {!result && (
        <div className="rounded-xl bg-white shadow-sm border border-zinc-200 p-6">
          <label className="mb-2 block text-sm font-medium text-zinc-700">Bottle ID</label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={bottleInput}
              onChange={e => setBottleInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleCheck()}
              placeholder="B-0001"
              className="flex-1 min-w-0 rounded-lg border border-zinc-300 px-4 py-3 text-base sm:text-lg font-mono font-bold text-zinc-900 uppercase placeholder-zinc-300 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              autoFocus
            />
            <button
              onClick={() => handleCheck()}
              disabled={checking || !bottleInput.trim()}
              className="w-full sm:w-auto rounded-lg bg-orange-600 px-4 sm:px-6 py-3 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              {checking ? 'Checking...' : 'Check'}
            </button>
          </div>

          <div className="mt-3">
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              disabled={checking || scannerOpen}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              {scannerOpen ? 'Scanner Open...' : 'Scan QR with Camera'}
            </button>
          </div>

          <p className="mt-2 text-xs text-zinc-400">
            Press Enter, tap Check, or scan a QR code
          </p>

          {scannerOpen && (
            <div className="mt-4">
              <QRScanner
                onScan={handleScan}
                onClose={() => setScannerOpen(false)}
                hint="Point the camera at the bottle QR code"
              />
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-4">
          {!result.found && (
            <div className="rounded-xl bg-white shadow-sm border border-zinc-200 p-6 text-center">
              <div className="text-4xl mb-3">🔍</div>
              <h2 className="text-lg font-bold text-zinc-900 mb-1">Bottle Not Found</h2>
              <p className="text-sm text-zinc-500 mb-6">
                <span className="font-mono font-bold">{bottleInput.toUpperCase()}</span> is not in the system.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="flex-1 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Try Again
                </button>
                <button
                  onClick={() => router.push(`/fire-school/bottles?add=${bottleInput.toUpperCase()}`)}
                  className="flex-1 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
                >
                  Add Bottle
                </button>
              </div>
            </div>
          )}

          {result.found && result.bottle && (
            <>
              {/* Pending verification — primary screen */}
              {result.unverifiedFill && !skippedVerify && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
                  <div className="text-4xl mb-3">📋</div>
                  <h2 className="text-lg font-bold text-zinc-900 mb-1">Fill Pending Verification</h2>
                  <p className="text-sm text-zinc-500 mb-1">
                    <span className="font-mono font-bold">{result.bottle.bottle_id}</span>
                  </p>
                  <p className="text-xs text-zinc-400 mb-6">
                    Filled at{' '}
                    {new Date(result.unverifiedFill.filled_at).toLocaleString('en-US', {
                      timeZone: 'America/Chicago',
                      month: 'short', day: 'numeric',
                      hour: 'numeric', minute: '2-digit',
                    })}
                  </p>
                  {verified ? (
                    <p className="text-sm font-semibold text-green-700 mb-4">✓ Fill verified</p>
                  ) : (
                    <button
                      onClick={async () => {
                        setVerifying(true)
                        await verifyFill(result.unverifiedFill!.id)
                        setVerified(true)
                        setVerifying(false)
                      }}
                      disabled={verifying}
                      className="w-full rounded-lg bg-green-600 px-4 py-3 text-base font-bold text-white hover:bg-green-700 disabled:opacity-50 mb-3"
                    >
                      {verifying ? 'Verifying...' : 'Verify Fill'}
                    </button>
                  )}
                  <button
                    onClick={() => setSkippedVerify(true)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-50"
                  >
                    {verified ? 'Continue to Fill' : 'Skip — Proceed to Fill'}
                  </button>
                </div>
              )}
              {(!result.unverifiedFill || skippedVerify || verified) && <div
                className={`rounded-xl shadow-sm border p-5 ${
                  result.fillable ? 'bg-white border-zinc-200' : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4 gap-3">
                  <div>
                    <span className="text-3xl font-bold font-mono text-zinc-900 break-all">
                      {result.bottle.bottle_id}
                    </span>
                    {result.bottle.department_name && (
                      <p className="text-sm text-zinc-500 mt-0.5">
                        {result.bottle.department_name}
                      </p>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold whitespace-nowrap ${
                      result.fillable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {result.fillable ? '✓ OK to Fill' : '✗ Do Not Fill'}
                  </span>
                </div>

                {!result.fillable && result.reason && (
                  <div className="mb-4 rounded-lg bg-red-100 border border-red-200 px-4 py-3 text-sm font-medium text-red-800">
                    ⚠️ {result.reason}
                  </div>
                )}

                <div className="flex justify-end mb-3">
                  <a
                    href={`/fire-school/bottles?edit=${result.bottle.bottle_id}`}
                    className="text-xs font-medium text-zinc-400 hover:text-zinc-700 transition-colors"
                  >
                    Edit this bottle →
                  </a>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <DetailField
                    label="PSI"
                    value={result.bottle.psi ? `${result.bottle.psi} PSI` : null}
                  />
                  <DetailField
                    label="Type"
                    value={
                      result.bottle.cylinder_type
                        ? CYLINDER_TYPE_LABELS[result.bottle.cylinder_type] ??
                          result.bottle.cylinder_type
                        : null
                    }
                  />
                  <DetailField
                    label="Manufacture Date"
                    value={
                      result.bottle.manufacture_date
                        ? new Date(result.bottle.manufacture_date).toLocaleDateString()
                        : null
                    }
                  />
                  <DetailField
                    label="Last Requal"
                    value={
                      result.bottle.last_requal_date
                        ? new Date(result.bottle.last_requal_date).toLocaleDateString()
                        : null
                    }
                  />
                  <DetailField
                    label="Requal Expiry"
                    value={getRequalExpiry(result.bottle)?.toLocaleDateString() ?? null}
                  />
                  {result.bottle.requires_service_life && (
                    <DetailField
                      label="Service Life Ends"
                      value={getServiceLifeExpiry(result.bottle)?.toLocaleDateString() ?? null}
                    />
                  )}
                </div>
              </div>}

              {(!result.unverifiedFill || skippedVerify || verified) && result.fillable && (
                <div className="rounded-xl bg-white shadow-sm border border-zinc-200 p-5">
                  <h3 className="text-base font-semibold text-zinc-900 mb-3">Log Fill</h3>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Notes (optional)"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm mb-3 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
                  />
                  <button
                    onClick={handleLogFill}
                    disabled={logging}
                    className="w-full rounded-lg bg-green-600 px-4 py-3 text-base font-bold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {logging ? 'Logging Fill...' : '✓ Log Fill'}
                  </button>
                </div>
              )}

              <button
                onClick={handleReset}
                className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
              >
                ← Check Another Bottle
              </button>
            </>
          )}
        </div>
      )}

    </div>
  )
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: string | null
}) {
  return (
    <div className="rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-2">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 font-semibold text-zinc-900 break-words">{value ?? '—'}</div>
    </div>
  )
}