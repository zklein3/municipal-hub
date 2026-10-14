'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { getPublicHoseReport, type PublicHoseReport } from '@/app/actions/hose-reports'
import { unlockHoseManagement } from '@/app/actions/hose-testing-pin'
import HoseReportView, { type ReportNav, type ReportTab } from '@/components/HoseReportView'

// Same unlock as "Manage Hoses" on the testing page: the PIN token it stores is
// reused here, so an officer already unlocked on this device isn't asked again.
export default function PublicReportClient({ slug }: { slug: string }) {
  const pinKey = `fireops7_hose_pin_${slug}`

  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [report, setReport] = useState<ReportTab>('total')
  const [from, setFrom] = useState<string | undefined>()
  const [to, setTo] = useState<string | undefined>()
  const [session, setSession] = useState<string | null>(null)
  const [result, setResult] = useState<PublicHoseReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinBusy, setPinBusy] = useState(false)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(pinKey) ?? 'null') as { token: string; exp: number } | null
      if (saved && saved.exp > Date.now()) setToken(saved.token)
      else if (saved) localStorage.removeItem(pinKey)
    } catch { localStorage.removeItem(pinKey) }
    setReady(true)
  }, [pinKey])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    const res = await getPublicHoseReport(slug, token, { from, to, session, withSessions: report === 'tests' })
    setLoading(false)
    if ('error' in res) {
      if (res.locked) { localStorage.removeItem(pinKey); setToken(null); setPinError('The PIN unlock expired or was changed. Enter the PIN again.') }
      else setError(res.error)
      return
    }
    setResult(res)
  }, [slug, token, from, to, session, report, pinKey])

  useEffect(() => { load() }, [load])

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault()
    setPinBusy(true)
    setPinError(null)
    const res = await unlockHoseManagement(slug, pinInput)
    setPinBusy(false)
    if ('error' in res) { setPinError(res.error); return }
    localStorage.setItem(pinKey, JSON.stringify(res))
    setToken(res.token)
    setPinInput('')
  }

  function navigate(nav: ReportNav) {
    if (nav.report !== undefined) setReport(nav.report)
    if (nav.from !== undefined) setFrom(nav.from)
    if (nav.to !== undefined) setTo(nav.to)
    if (nav.session !== undefined) setSession(nav.session)
  }

  const backLink = (
    <Link href={`/hose-testing/${slug}`} className="print:hidden inline-block mb-4 text-sm font-semibold text-red-700 hover:text-red-900">
      ← Back to testing
    </Link>
  )

  if (!ready) return null

  if (!token) {
    return (
      <div>
        {backLink}
        <form onSubmit={handleUnlock} className="rounded-xl bg-white border border-zinc-200 p-5 max-w-sm">
          <h2 className="text-sm font-semibold text-zinc-900 mb-1">Officer PIN required</h2>
          <p className="text-xs text-zinc-500 mb-3">Reports cover the whole hose inventory, so they use the same PIN as Manage Hoses.</p>
          {pinError && <p className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{pinError}</p>}
          <input
            type="password" inputMode="numeric" autoComplete="off" value={pinInput}
            onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="PIN"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 mb-3"
          />
          <button type="submit" disabled={pinBusy || pinInput.length < 4}
            className="w-full rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
            {pinBusy ? 'Checking…' : 'View reports'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div>
      {backLink}
      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!result ? (
        <p className="text-sm text-zinc-500">{loading ? 'Loading…' : ''}</p>
      ) : (
        <div className={loading ? 'opacity-60 transition-opacity' : ''}>
          <HoseReportView
            departmentName={result.departmentName}
            report={report}
            dateFrom={result.dateFrom}
            dateTo={result.dateTo}
            data={result.data}
            sessions={result.sessions}
            sessionReport={result.sessionReport}
            onNavigate={navigate}
          />
        </div>
      )}
    </div>
  )
}
