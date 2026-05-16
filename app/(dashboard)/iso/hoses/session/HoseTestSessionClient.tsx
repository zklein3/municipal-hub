'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { submitHoseTestSession } from '@/app/actions/iso'

const REQUIRED_PSI: Record<string, number> = {
  attack: 300,
  forestry: 300,
  booster: 300,
  supply: 200,
  hard_suction: 200,
  other: 300,
}

function requiredPsi(diameter_in: number, hose_type: string): number {
  if (diameter_in >= 4) return 200
  return REQUIRED_PSI[hose_type] ?? 300
}

type Hose = {
  id: string
  hose_identifier: string
  hose_type: string
  diameter_in: number
  length_ft: number
  status: string
}

type HoseResult = {
  passed: boolean | null
  failure_reason: string
}

export default function HoseTestSessionClient({
  hoses,
  testerName,
}: {
  hoses: Hose[]
  testerName: string
}) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)

  const [testDate, setTestDate] = useState(today)
  const [pressurePsi, setPressurePsi] = useState('')
  const [durationMin, setDurationMin] = useState('5')
  const [results, setResults] = useState<Record<string, HoseResult>>(
    Object.fromEntries(hoses.map(h => [h.id, { passed: null, failure_reason: '' }]))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allMarked = hoses.every(h => results[h.id]?.passed !== null)
  const markedCount = hoses.filter(h => results[h.id]?.passed !== null).length

  function setResult(hoseId: string, passed: boolean) {
    setResults(prev => ({ ...prev, [hoseId]: { ...prev[hoseId], passed, failure_reason: passed ? '' : prev[hoseId]?.failure_reason ?? '' } }))
  }

  function setFailureReason(hoseId: string, reason: string) {
    setResults(prev => ({ ...prev, [hoseId]: { ...prev[hoseId], failure_reason: reason } }))
  }

  async function handleSubmit() {
    if (!pressurePsi || !testDate) { setError('Date and pressure are required.'); return }
    if (!allMarked) { setError('Mark every hose pass or fail before submitting.'); return }
    setError(null)
    setLoading(true)

    const payload = hoses.map(h => ({
      hose_id: h.id,
      passed: results[h.id]!.passed!,
      failure_reason: results[h.id]!.failure_reason || null,
    }))

    const result = await submitHoseTestSession(testDate, parseInt(pressurePsi), parseInt(durationMin) || 5, payload)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.push('/iso/hoses')
    router.refresh()
  }

  if (hoses.length === 0) {
    return (
      <div className="max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/iso/hoses" className="text-sm text-zinc-500 hover:text-red-700">← Hoses</Link>
        </div>
        <h1 className="text-xl font-bold text-zinc-900 mb-4">Hose Test Session</h1>
        <div className="rounded-xl bg-white border border-zinc-200 px-6 py-12 text-center text-sm text-zinc-400">
          No in-service hoses found. Add hoses before running a test session.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/iso/hoses" className="text-sm text-zinc-500 hover:text-red-700">← Hoses</Link>
      </div>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Hose Test Session</h1>
          <p className="text-sm text-zinc-500 mt-0.5">NFPA 1962 · Tester: {testerName}</p>
        </div>
        <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
          {markedCount}/{hoses.length} marked
        </span>
      </div>

      {/* Session Header */}
      <div className="rounded-xl bg-white border border-zinc-200 p-5 mb-5">
        <h2 className="text-sm font-semibold text-zinc-700 mb-3">Test Parameters</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-zinc-600 mb-1">Test Date</label>
            <input type="date" value={testDate} onChange={e => setTestDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-zinc-600 mb-1">Pressure Used (PSI)</label>
            <input type="number" min="0" value={pressurePsi} onChange={e => setPressurePsi(e.target.value)}
              placeholder="e.g. 300"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
          </div>
          <div className="w-32">
            <label className="block text-xs font-medium text-zinc-600 mb-1">Duration (min)</label>
            <input type="number" min="1" value={durationMin} onChange={e => setDurationMin(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
          </div>
        </div>
      </div>

      {/* Hose List */}
      <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden divide-y divide-zinc-100 mb-5">
        {hoses.map(hose => {
          const result = results[hose.id]
          const reqPsi = requiredPsi(hose.diameter_in, hose.hose_type)
          const psiMet = pressurePsi && parseInt(pressurePsi) >= reqPsi
          return (
            <div key={hose.id} className="px-4 py-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-zinc-900">{hose.hose_identifier}</span>
                    <span className="text-xs text-zinc-400">{hose.diameter_in}" · {hose.length_ft} ft · {hose.hose_type}</span>
                  </div>
                  <p className={`text-xs mt-0.5 ${psiMet ? 'text-zinc-400' : 'text-amber-600 font-medium'}`}>
                    Required: {reqPsi} PSI{!psiMet && pressurePsi ? ' ⚠ pressure entered is below required' : ''}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setResult(hose.id, true)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                      result?.passed === true
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50'
                    }`}
                  >
                    Pass
                  </button>
                  <button
                    onClick={() => setResult(hose.id, false)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                      result?.passed === false
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50'
                    }`}
                  >
                    Fail
                  </button>
                </div>
              </div>
              {result?.passed === false && (
                <input
                  type="text"
                  value={result.failure_reason}
                  onChange={e => setFailureReason(hose.id, e.target.value)}
                  placeholder="Failure reason (optional)"
                  className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-zinc-700 focus:border-red-400 focus:outline-none"
                />
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={loading || !allMarked || !pressurePsi}
          className="flex-1 rounded-lg bg-red-700 px-4 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Saving...' : `Submit ${hoses.length} Test${hoses.length !== 1 ? 's' : ''}`}
        </button>
        <Link href="/iso/hoses"
          className="rounded-lg border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
          Cancel
        </Link>
      </div>
    </div>
  )
}
