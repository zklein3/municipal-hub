'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { claimHoseInApp, releaseHoseInApp, forceReleaseHoseInApp } from '@/app/actions/iso'
import { startHoseTestSession, openHoseTestSession, abandonHoseTestSession, type OpenedSession } from '@/app/actions/hose-test-sessions'
import HoseTestDraftScreen from '@/components/HoseTestDraftScreen'
import { createClient } from '@/lib/supabase/client'

type Hose = {
  id: string
  hose_identifier: string
  hose_type: string
  diameter_in: number
  length_ft: number
  status: string
}

export type OpenDraft = {
  id: string
  testerName: string
  testDate: string
  hoseCount: number
  failedCount: number
}

type Lock = { id: string; hose_id: string; session_token: string; tester_name: string | null }

const SESSION_TOKEN_KEY = 'fireops7_hose_testing_session_token_inapp'

export default function HoseTestSessionClient({
  hoses,
  testerName,
  departmentId,
  initialLocks,
  openDrafts,
}: {
  hoses: Hose[]
  testerName: string
  departmentId: string
  initialLocks: Lock[]
  openDrafts: OpenDraft[]
}) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)

  const [draft, setDraft] = useState<OpenedSession | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [sizeFilter, setSizeFilter] = useState<number | null>(null)

  const [testDate, setTestDate] = useState(today)
  const [pressurePsi, setPressurePsi] = useState('')
  const [durationMin, setDurationMin] = useState('5')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [claimingId, setClaimingId] = useState<string | null>(null)

  // Identifies this browser tab so it can tell "my own lock" apart from
  // someone else's — same locking model as the public hose-testing page,
  // shared via the same hose_testing_locks table so an officer here and a
  // public/mutual-aid tester there can't both grab the same physical hose.
  // Persisted per-tab so reloading this same tab reconnects to claims already
  // made, instead of orphaning them under a fresh random ID.
  const [sessionToken] = useState<string>(() => {
    if (typeof window === 'undefined') return crypto.randomUUID()
    const existing = sessionStorage.getItem(SESSION_TOKEN_KEY)
    if (existing) return existing
    const fresh = crypto.randomUUID()
    sessionStorage.setItem(SESSION_TOKEN_KEY, fresh)
    return fresh
  })
  const [lockedByOthers, setLockedByOthers] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(initialLocks.map(l => [l.hose_id, l.tester_name]))
  )
  // Realtime DELETE payloads only ever carry the row's own primary key (`id`),
  // never other columns, even with replica identity full — a hard Realtime+RLS
  // restriction. This ref (built from INSERT/UPDATE payloads, which do carry
  // full rows) lets a bare-PK DELETE resolve back to a hose_id.
  const lockIdToHoseId = useRef<Record<string, string>>(
    Object.fromEntries(initialLocks.map(l => [l.id, l.hose_id]))
  )

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`hose_testing_locks_app_${departmentId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hose_testing_locks', filter: `department_id=eq.${departmentId}` },
        payload => {
          const row = payload.new as Lock
          lockIdToHoseId.current = { ...lockIdToHoseId.current, [row.id]: row.hose_id }
          if (row.session_token !== sessionToken) setLockedByOthers(prev => ({ ...prev, [row.hose_id]: row.tester_name }))
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'hose_testing_locks', filter: `department_id=eq.${departmentId}` },
        payload => {
          const row = payload.new as Lock
          lockIdToHoseId.current = { ...lockIdToHoseId.current, [row.id]: row.hose_id }
          setLockedByOthers(prev => {
            const next = { ...prev }
            if (row.session_token !== sessionToken) next[row.hose_id] = row.tester_name
            else delete next[row.hose_id]
            return next
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'hose_testing_locks', filter: `department_id=eq.${departmentId}` },
        payload => {
          const deletedId = (payload.old as { id: string }).id
          const hoseId = lockIdToHoseId.current[deletedId]
          if (!hoseId) return
          const rest = { ...lockIdToHoseId.current }
          delete rest[deletedId]
          lockIdToHoseId.current = rest
          setLockedByOthers(prev => {
            const next = { ...prev }
            delete next[hoseId]
            return next
          })
          // If this was *our own* selection, someone else force-releasing it
          // wouldn't otherwise be reflected here (this session was never in
          // lockedByOthers for its own claim, so nothing above touches it).
          let wasMine = false
          setSelected(prev => {
            if (!prev.has(hoseId)) return prev
            wasMine = true
            const next = new Set(prev)
            next.delete(hoseId)
            return next
          })
          if (wasMine) setError('Your selection on a hose was cleared by another officer.')
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId])

  const [clearingId, setClearingId] = useState<string | null>(null)

  async function handleForceRelease(hoseId: string) {
    if (!confirm('Clear this selection? Only do this if the other tester left without finishing it (device died, walked away, etc.).')) return
    setClearingId(hoseId)
    await forceReleaseHoseInApp(hoseId)
    setClearingId(null)
  }

  async function toggleSelected(hoseId: string) {
    setError(null)
    if (selected.has(hoseId)) {
      setSelected(prev => { const next = new Set(prev); next.delete(hoseId); return next })
      releaseHoseInApp(hoseId, sessionToken)
      return
    }
    if (hoseId in lockedByOthers) return
    setClaimingId(hoseId)
    const result = await claimHoseInApp(hoseId, sessionToken, testerName)
    setClaimingId(null)
    if (result?.error) {
      setError(result.error)
      return
    }
    setSelected(prev => new Set(prev).add(hoseId))
  }

  const uniqueSizes = Array.from(new Set(hoses.map(h => h.diameter_in))).sort((a, b) => a - b)
  const filteredHoses = hoses
    .filter(h => sizeFilter === null || h.diameter_in === sizeFilter)
    .filter(h => h.hose_identifier.toLowerCase().includes(search.trim().toLowerCase()))
  const groupedHoses = uniqueSizes
    .filter(size => sizeFilter === null || size === sizeFilter)
    .map(size => ({ size, hoses: filteredHoses.filter(h => h.diameter_in === size) }))
    .filter(g => g.hoses.length > 0)
  const selectedHoses = hoses.filter(h => selected.has(h.id))

  async function handleSelectAllToggle() {
    const filteredIds = filteredHoses.map(h => h.id)
    const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selected.has(id))
    if (allFilteredSelected) {
      await Promise.all(filteredIds.map(id => releaseHoseInApp(id, sessionToken)))
      setSelected(prev => { const next = new Set(prev); filteredIds.forEach(id => next.delete(id)); return next })
    } else {
      const toClaim = filteredIds.filter(id => !selected.has(id) && !(id in lockedByOthers))
      const claimResults = await Promise.all(toClaim.map(id => claimHoseInApp(id, sessionToken, testerName)))
      const succeededIds = toClaim.filter((id, i) => !claimResults[i]?.error)
      setSelected(prev => { const next = new Set(prev); succeededIds.forEach(id => next.add(id)); return next })
    }
  }

  const canContinue = selectedHoses.length > 0 && !!pressurePsi

  async function handleContinue() {
    setError(null)
    if (selectedHoses.length === 0) { setError('Select at least one hose to test.'); return }
    if (!pressurePsi) { setError('Pressure is required.'); return }
    setLoading(true)
    const res = await startHoseTestSession(null, {
      testerName,
      testDate,
      pressurePsi: parseInt(pressurePsi),
      durationMin: parseInt(durationMin) || 5,
      hoseIds: selectedHoses.map(h => h.id),
      lockToken: sessionToken,
    })
    setLoading(false)
    if ('error' in res) { setError(res.error); return }
    setSelected(new Set())
    setDraft(res.session)
  }

  async function handleResume(id: string) {
    setError(null)
    setLoading(true)
    const res = await openHoseTestSession(null, id, sessionToken)
    setLoading(false)
    if ('error' in res) { setError(res.error); return }
    if (res.session.status !== 'draft') { setError('That test was already finalized or discarded.'); router.refresh(); return }
    setDraft(res.session)
  }

  async function handleDiscardOpen(id: string) {
    if (!confirm('Discard this open test? Nothing will be logged and its hoses will be released.')) return
    await abandonHoseTestSession(null, id)
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

  if (!draft) {
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
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {openDrafts.length > 0 && (
          <div className="mb-5 rounded-xl bg-amber-50 border border-amber-200 p-4">
            <h2 className="text-sm font-semibold text-amber-900 mb-2">Open tests ({openDrafts.length})</h2>
            <p className="text-xs text-amber-700 mb-3">Started but not finalized — nothing here counts as tested yet.</p>
            <div className="flex flex-col gap-2">
              {openDrafts.map(d => (
                <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg bg-white border border-amber-200 px-3 py-2">
                  <div className="min-w-0 text-xs text-zinc-700">
                    <span className="font-semibold">{d.testerName || 'Unknown tester'}</span>
                    <span className="text-zinc-400 ml-2">{d.testDate} · {d.hoseCount} hose{d.hoseCount !== 1 ? 's' : ''}{d.failedCount > 0 ? ` · ${d.failedCount} failed` : ''}</span>
                  </div>
                  <div className="flex gap-3 shrink-0">
                    <button onClick={() => handleResume(d.id)} disabled={loading} className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50">Resume</button>
                    <button onClick={() => handleDiscardOpen(d.id)} className="text-xs font-semibold text-zinc-400 hover:text-red-700">Discard</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Test Parameters — set before selecting, carried into marking */}
        <div className="rounded-xl bg-white border border-zinc-200 p-5 mb-5">
          <h2 className="text-sm font-semibold text-zinc-700 mb-3">Test Parameters</h2>
          <p className="flex items-start gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 mb-3 text-xs leading-relaxed text-blue-700">
            <span className="shrink-0">💡</span>
            <span>
              NFPA 1962 reference — Attack hose (1&Prime;&ndash;3&Prime;): 300 PSI. Supply hose (4&Prime;+): 200 PSI.
              Hold test pressure for at least 3 minutes. Testing multiple sizes together? Enter the pressure for the
              size you&apos;re testing now. Your department can enter a different value if it follows another standard.
            </span>
          </p>
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

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-700">
            Select Hoses to Test — {selected.size}/{hoses.length} selected
          </h2>
          <button onClick={handleSelectAllToggle} className="text-xs font-semibold text-red-700 hover:text-red-900">
            {filteredHoses.length > 0 && filteredHoses.every(h => selected.has(h.id)) ? 'Select None' : 'Select All'}
          </button>
        </div>

        <div className="relative mb-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search hose ID..."
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400 hover:text-zinc-700">
              Clear
            </button>
          )}
        </div>

        {uniqueSizes.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setSizeFilter(null)}
              className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
                sizeFilter === null ? 'bg-red-700 text-white border-red-700' : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              All Sizes
            </button>
            {uniqueSizes.map(size => (
              <button
                key={size}
                onClick={() => setSizeFilter(size)}
                className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
                  sizeFilter === size ? 'bg-red-700 text-white border-red-700' : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50'
                }`}
              >
                {size}&quot;
              </button>
            ))}
          </div>
        )}

        {selected.size > 0 && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3">
            <p className="text-xs font-semibold text-red-800 mb-2">Selected for this round ({selected.size})</p>
            <div className="flex flex-wrap gap-2">
              {selectedHoses.map(h => (
                <button
                  key={h.id}
                  onClick={() => toggleSelected(h.id)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white border border-red-300 px-2.5 py-1 text-xs font-mono font-semibold text-red-800 hover:bg-red-100"
                >
                  {h.hose_identifier}
                  <span className="text-red-400">✕</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {groupedHoses.length === 0 ? (
          <div className="rounded-xl bg-white border border-zinc-200 px-6 py-12 text-center text-sm text-zinc-400 mb-5">
            No hoses match &quot;{search}&quot;.
          </div>
        ) : (
          <div className="mb-5 space-y-4">
            {groupedHoses.map(group => (
              <div key={group.size}>
                <h3 className="text-xs font-semibold text-zinc-500 mb-1.5 px-1">
                  {group.size}&quot; Hose <span className="text-zinc-400 font-normal">({group.hoses.length})</span>
                </h3>
                <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden divide-y divide-zinc-100">
                  {group.hoses.map(hose => (
                    hose.id in lockedByOthers ? (
                      <div key={hose.id} className="flex items-center gap-3 px-4 py-3 bg-zinc-50">
                        <input type="checkbox" checked={false} disabled className="w-4 h-4 rounded border-zinc-300" />
                        <div className="min-w-0 flex-1">
                          <span className="font-mono font-semibold text-zinc-400">{hose.hose_identifier}</span>
                          <span className="text-xs text-zinc-400 ml-2">{hose.length_ft} ft · {hose.hose_type}</span>
                        </div>
                        <span className="shrink-0 text-xs font-medium text-amber-600">
                          🔒 In progress{lockedByOthers[hose.id] ? ` — ${lockedByOthers[hose.id]}` : ''}
                        </span>
                        <button
                          onClick={() => handleForceRelease(hose.id)}
                          disabled={clearingId === hose.id}
                          className="shrink-0 text-xs font-semibold text-zinc-400 hover:text-red-700 disabled:opacity-50"
                        >
                          {clearingId === hose.id ? 'Clearing...' : 'Clear'}
                        </button>
                      </div>
                    ) : (
                      <label key={hose.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-50">
                        <input
                          type="checkbox"
                          checked={selected.has(hose.id)}
                          disabled={claimingId === hose.id}
                          onChange={() => toggleSelected(hose.id)}
                          className="w-4 h-4 rounded border-zinc-300 text-red-600 focus:ring-red-500 disabled:opacity-50"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="font-mono font-semibold text-zinc-900">{hose.hose_identifier}</span>
                          <span className="text-xs text-zinc-400 ml-2">{hose.length_ft} ft · {hose.hose_type}</span>
                        </div>
                      </label>
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleContinue}
          disabled={!canContinue || loading}
          className="w-full rounded-lg bg-red-700 px-4 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Starting…' : `Start Test with ${selected.size} Hose${selected.size !== 1 ? 's' : ''} →`}
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/iso/hoses" className="text-sm text-zinc-500 hover:text-red-700">← Hoses</Link>
      </div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900">Hose Test Session</h1>
        <p className="text-sm text-zinc-500 mt-0.5">NFPA 1962 · Tester: {testerName}</p>
      </div>
      <HoseTestDraftScreen
        slug={null}
        initial={draft}
        onLeave={() => { setDraft(null); router.refresh() }}
        onDiscarded={() => { setDraft(null); router.refresh() }}
        onFinished={() => { router.push('/iso/hoses'); router.refresh() }}
      />
    </div>
  )
}
