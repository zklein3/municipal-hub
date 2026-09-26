'use client'

import { useEffect, useRef, useState } from 'react'
import { addPublicHose, claimHose, claimHoses, editPublicHose, releaseHose, releaseHoses, setPublicHoseStatus } from '@/app/actions/hose-testing'
import { startHoseTestSession, openHoseTestSession, type OpenedSession } from '@/app/actions/hose-test-sessions'
import { unlockHoseManagement } from '@/app/actions/hose-testing-pin'
import HoseTestDraftScreen, { type FinishedInfo } from '@/components/HoseTestDraftScreen'
import { createClient } from '@/lib/supabase/client'
import { matchesHoseSearch } from '@/lib/hose-search'

const TESTER_NAME_KEY = 'fireops7_hose_testing_tester_name'
const SESSION_TOKEN_KEY = 'fireops7_hose_testing_session_token'
const draftKey = (slug: string) => `fireops7_hose_testing_draft_${slug}`

const HOSE_TYPES = [
  { value: 'attack', label: 'Attack' },
  { value: 'supply', label: 'Supply' },
  { value: 'forestry', label: 'Forestry' },
  { value: 'booster', label: 'Booster' },
  { value: 'hard_suction', label: 'Hard Suction' },
  { value: 'other', label: 'Other' },
]

type Hose = {
  id: string
  hose_identifier: string
  hose_type: string
  diameter_in: number
  length_ft: number
  status: string
}

type Lock = { id: string; hose_id: string; session_token: string; tester_name: string | null }

export default function HoseTestingClient({
  slug,
  departmentId,
  initialHoses,
  initialLocks,
  initialRecentlyTestedIds,
}: {
  slug: string
  departmentId: string
  initialHoses: Hose[]
  initialLocks: Lock[]
  initialRecentlyTestedIds: string[]
}) {
  const today = new Date().toISOString().slice(0, 10)

  const [step, setStep] = useState<'select' | 'draft' | 'manage'>('select')
  const [draft, setDraft] = useState<OpenedSession | null>(null)
  const [hoses, setHoses] = useState(initialHoses)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [sizeFilter, setSizeFilter] = useState<number | null>(null)

  const [testerName, setTesterName] = useState('')
  const [testDate, setTestDate] = useState(today)
  const [pressurePsi, setPressurePsi] = useState('')
  const [durationMin, setDurationMin] = useState('5')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const pinKey = `fireops7_hose_pin_${slug}`
  const [pinToken, setPinToken] = useState<string | null>(null)
  const [showPin, setShowPin] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinBusy, setPinBusy] = useState(false)
  const pinPanelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (showPin) pinPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [showPin])
  const pendingAfterUnlock = useRef<null | (() => void)>(null)
  const [selectingAll, setSelectingAll] = useState(false)

  const [showAddHose, setShowAddHose] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [retiringId, setRetiringId] = useState<string | null>(null)

  // Manually forced back into the testing queue from Manage Hoses, bypassing
  // the 30-day recently-tested exclusion for this hose this session.
  const [forcedIds, setForcedIds] = useState<Set<string>>(new Set())

  // Session token identifies this browser tab so concurrent public sessions
  // can tell "my own lock" apart from "someone else's lock" on the same hose.
  // Persisted per-tab (not per-visit) so reloading this same tab reconnects
  // to claims already made, instead of orphaning them under a fresh random ID.
  const [sessionToken] = useState<string>(() => {
    if (typeof window === 'undefined') return crypto.randomUUID()
    const existing = sessionStorage.getItem(SESSION_TOKEN_KEY)
    if (existing) return existing
    const fresh = crypto.randomUUID()
    sessionStorage.setItem(SESSION_TOKEN_KEY, fresh)
    return fresh
  })
  // Locks held under this browser's own token are not "someone else's" — after a
  // reload they must stay selectable rather than showing as In progress.
  const [lockedByOthers, setLockedByOthers] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(initialLocks.filter(l => l.session_token !== sessionToken).map(l => [l.hose_id, l.tester_name]))
  )
  // Realtime DELETE payloads only ever carry the row's own primary key (`id`),
  // never other columns, even with replica identity full — that's a hard
  // Realtime+RLS restriction, not something fixable via query/policy tuning.
  // So a release event can't tell us *which hose* was unlocked on its own;
  // this ref (built from INSERT/UPDATE payloads, which do carry full rows)
  // lets a bare-PK DELETE resolve back to a hose_id. A ref rather than state
  // since it's a lookup table, not something that itself drives rendering.
  const lockIdToHoseId = useRef<Record<string, string>>(
    Object.fromEntries(initialLocks.map(l => [l.id, l.hose_id]))
  )
  // 30-day exclusion is set once on load and only needs to move locally when
  // *this* session submits a test — it isn't collision-sensitive the way
  // locks are, so it doesn't need a live feed of its own.
  const [recentlyTestedIds] = useState<Set<string>>(new Set(initialRecentlyTestedIds))
  const [claimingId, setClaimingId] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(TESTER_NAME_KEY)
    if (stored) setTesterName(stored)

    try {
      const saved = JSON.parse(localStorage.getItem(pinKey) ?? 'null') as { token: string; exp: number } | null
      if (saved && saved.exp > Date.now()) setPinToken(saved.token)
      else if (saved) localStorage.removeItem(pinKey)
    } catch { localStorage.removeItem(pinKey) }

    // A fresh page load starts with nothing selected, so this browser's own
    // leftover selection locks (from before the reload) are released rather than
    // left blocking other testers. Locks that belong to an open test are kept.
    const releaseStaleOwnLocks = () => {
      const own = initialLocks.filter(l => l.session_token === sessionToken).map(l => l.hose_id)
      if (own.length) releaseHoses(slug, own, sessionToken)
    }

    // Pick up a test left in progress in this browser (reload, closed tab).
    const draftId = localStorage.getItem(draftKey(slug))
    if (!draftId) { releaseStaleOwnLocks(); return }
    openHoseTestSession(slug, draftId, sessionToken).then(res => {
      if ('error' in res || res.session.status !== 'draft') {
        localStorage.removeItem(draftKey(slug))
        releaseStaleOwnLocks()
        return
      }
      setDraft(res.session)
      setStep('draft')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Live lock state — Realtime instead of polling, so an unattended tab costs
  // an idle socket instead of a query every 5s (see 2026-08-13 incident: a
  // forgotten tab polled overnight and drained the Supabase Disk IO budget).
  // RLS scopes anon reads to departments with hose_testing_enabled = true.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`hose_testing_locks_${departmentId}`)
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
          // Only the primary key survives on a DELETE payload for an RLS-enabled
          // table — resolve it back to a hose_id via the ref built above.
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
          // Covers force-release from the officer session page — if this was
          // *our own* selection, someone else clearing the lock on the server
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
          if (wasMine) setError(`Your selection on a hose was cleared by an officer.`)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId])

  function saveTesterName(name: string) {
    setTesterName(name)
    localStorage.setItem(TESTER_NAME_KEY, name)
  }

  async function toggleSelected(hoseId: string) {
    setError(null)
    if (selected.has(hoseId)) {
      setSelected(prev => { const next = new Set(prev); next.delete(hoseId); return next })
      releaseHose(slug, hoseId, sessionToken)
      return
    }
    if (hoseId in lockedByOthers) return
    setClaimingId(hoseId)
    const result = await claimHose(slug, hoseId, sessionToken, testerName)
    setClaimingId(null)
    if (result?.error) {
      setError(result.error)
      return
    }
    setSelected(prev => new Set(prev).add(hoseId))
  }

  async function handleSelectAllToggle() {
    const filteredIds = filteredHoses.map(h => h.id)
    const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selected.has(id))
    setError(null)
    setSelectingAll(true)
    try {
      if (allFilteredSelected) {
        setSelected(prev => { const next = new Set(prev); filteredIds.forEach(id => next.delete(id)); return next })
        await releaseHoses(slug, filteredIds, sessionToken)
      } else {
        const toClaim = filteredIds.filter(id => !selected.has(id) && !(id in lockedByOthers))
        const res = await claimHoses(slug, toClaim, sessionToken, testerName)
        if ('error' in res && res.error) { setError(res.error); return }
        const claimed = 'claimed' in res ? res.claimed : []
        setSelected(prev => { const next = new Set(prev); claimed.forEach(id => next.add(id)); return next })
      }
    } finally {
      setSelectingAll(false)
    }
  }

  // Manage sees the full roster (fixing a typo shouldn't require the hose to
  // re-enter the testing queue first); Select excludes anything tested in
  // the last 30 days so it isn't retested unnecessarily.
  const visibleHoses = step === 'manage' ? hoses : hoses.filter(h => !recentlyTestedIds.has(h.id) || forcedIds.has(h.id))
  const uniqueSizes = Array.from(new Set(visibleHoses.map(h => h.diameter_in))).sort((a, b) => a - b)
  const filteredHoses = visibleHoses
    .filter(h => sizeFilter === null || h.diameter_in === sizeFilter)
    .filter(h => matchesHoseSearch(h.hose_identifier, search))
  const groupedHoses = uniqueSizes
    .filter(size => sizeFilter === null || size === sizeFilter)
    .map(size => ({ size, hoses: filteredHoses.filter(h => h.diameter_in === size) }))
    .filter(g => g.hoses.length > 0)
  const selectedHoses = hoses.filter(h => selected.has(h.id))
  const canContinue = selectedHoses.length > 0 && testerName.trim() && pressurePsi

  async function handleContinue() {
    setError(null)
    if (!testerName.trim() || !pressurePsi) { setError('Tester name and pressure are required.'); return }
    if (selectedHoses.length === 0) { setError('Select at least one hose to test.'); return }
    setLoading(true)
    const res = await startHoseTestSession(slug, {
      testerName: testerName.trim(),
      testDate,
      pressurePsi: parseInt(pressurePsi),
      durationMin: parseInt(durationMin) || 5,
      hoseIds: selectedHoses.map(h => h.id),
      lockToken: sessionToken,
    })
    setLoading(false)
    if ('error' in res) { setError(res.error); return }
    localStorage.setItem(draftKey(slug), res.session.id)
    setSelected(new Set())
    setDraft(res.session)
    setStep('draft')
  }

  function leaveDraft() {
    setDraft(null)
    setStep('select')
  }

  function handleDraftDiscarded() {
    localStorage.removeItem(draftKey(slug))
    leaveDraft()
  }

  function handleDraftFinished(info: FinishedInfo) {
    localStorage.removeItem(draftKey(slug))
    // Passed hoses drop out of the queue (recently tested); failed ones stay so
    // they can be retested, unless they were taken out of service.
    const gone = new Set([...info.passedHoseIds, ...info.retiredHoseIds])
    setHoses(prev => prev.filter(h => !gone.has(h.id)))
    setSuccess(
      `Test finalized — ${info.passed} passed, ${info.failed} failed.` +
      (info.retired > 0 ? ` ${info.retired} hose${info.retired !== 1 ? 's' : ''} taken out of service.` : '')
    )
    leaveDraft()
  }

  // ── Officer PIN: unlocks "+ Add Hose" / "Manage Hoses" only; testing needs no PIN.
  function requireUnlock(then: () => void) {
    if (pinToken) { then(); return }
    pendingAfterUnlock.current = then
    setPinError(null)
    setPinInput('')
    setShowPin(true)
  }

  function handlePinRequired() {
    localStorage.removeItem(pinKey)
    setPinToken(null)
    setPinInput('')
    setPinError('The PIN unlock expired or was changed. Enter the PIN again.')
    setShowPin(true)
  }

  async function submitPin() {
    setPinBusy(true)
    setPinError(null)
    const res = await unlockHoseManagement(slug, pinInput.trim())
    setPinBusy(false)
    if ('error' in res) { setPinError(res.error); return }
    localStorage.setItem(pinKey, JSON.stringify(res))
    setPinToken(res.token)
    setShowPin(false)
    setPinInput('')
    const next = pendingAfterUnlock.current
    pendingAfterUnlock.current = null
    next?.()
  }

  async function handleAddHose(formData: FormData) {
    setAddError(null)
    setAdding(true)
    formData.set('pin_token', pinToken ?? '')
    const result = await addPublicHose(slug, formData)
    if (result?.pinRequired) { setAdding(false); handlePinRequired(); return }
    if (result?.error || !result.hose) {
      setAddError(result?.error ?? 'Failed to add hose.')
      setAdding(false)
      return
    }
    const newHose = result.hose
    setHoses(prev => [...prev, newHose].sort((a, b) => a.hose_identifier.localeCompare(b.hose_identifier)))
    setSelected(prev => new Set(prev).add(newHose.id))
    setAdding(false)
    setShowAddHose(false)
  }

  async function handleEditHose(hoseId: string, formData: FormData) {
    setEditError(null)
    setEditing(true)
    formData.set('pin_token', pinToken ?? '')
    const result = await editPublicHose(slug, hoseId, formData)
    if (result?.pinRequired) { setEditing(false); handlePinRequired(); return }
    if (result?.error || !result.hose) {
      setEditError(result?.error ?? 'Failed to update hose.')
      setEditing(false)
      return
    }
    const updated = result.hose
    setHoses(prev => [...prev.filter(h => h.id !== hoseId), updated].sort((a, b) => a.hose_identifier.localeCompare(b.hose_identifier)))
    setEditing(false)
    setEditingId(null)
  }

  function handleForceInclude(hoseId: string) {
    setForcedIds(prev => new Set(prev).add(hoseId))
  }

  async function handleRetire(hoseId: string) {
    if (!confirm('Take this hose out of service? It will no longer show up here for testing.')) return
    setRetiringId(hoseId)
    const result = await setPublicHoseStatus(slug, hoseId, 'out_of_service', pinToken)
    setRetiringId(null)
    if (result?.pinRequired) { handlePinRequired(); return }
    if (result?.error) { setError(result.error); return }
    setHoses(prev => prev.filter(h => h.id !== hoseId))
    setSelected(prev => { const next = new Set(prev); next.delete(hoseId); return next })
  }

  return (
    <div>
      {success && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">{success}</div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Test parameters — set before selecting; once a test starts they live on the draft screen */}
      {step !== 'draft' && (
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
        <div className="mb-3">
          <label className="block text-xs font-medium text-zinc-600 mb-1">Tester Name</label>
          <input type="text" value={testerName} onChange={e => saveTesterName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
        </div>
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
      )}

      {(step === 'select' || step === 'manage') && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            {step === 'select' ? (
              <h2 className="text-sm font-semibold text-zinc-700">
                Select Hoses to Test{visibleHoses.length > 0 ? ` — ${selected.size}/${visibleHoses.length} selected` : ''}
              </h2>
            ) : (
              <h2 className="text-sm font-semibold text-zinc-700">Manage Hoses — edit ID, size, or type</h2>
            )}
            <div className="flex flex-wrap gap-2">
              {step === 'select' && visibleHoses.length > 0 && (
                <button
                  onClick={handleSelectAllToggle}
                  disabled={selectingAll}
                  className="text-xs font-semibold text-red-700 hover:text-red-900 disabled:opacity-60"
                >
                  {selectingAll ? 'Selecting…' : filteredHoses.length > 0 && filteredHoses.every(h => selected.has(h.id)) ? 'Select None' : 'Select All'}
                </button>
              )}
              {step === 'select' && (
                <button onClick={() => (showAddHose ? setShowAddHose(false) : requireUnlock(() => setShowAddHose(true)))}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50">
                  {showAddHose ? 'Cancel' : `${pinToken ? '' : '🔒 '}+ Add Hose`}
                </button>
              )}
              <button
                onClick={() => {
                  if (step === 'manage') { setStep('select'); setEditingId(null); setEditError(null); return }
                  requireUnlock(() => { setStep('manage'); setEditingId(null); setEditError(null) })
                }}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
              >
                {step === 'manage' ? '← Back to Testing' : `${pinToken ? '' : '🔒 '}Manage Hoses`}
              </button>
            </div>
          </div>

          {showPin && (
            <div ref={pinPanelRef} className="mb-4 rounded-xl border-2 border-zinc-300 bg-white p-4">
              <p className="text-sm font-semibold text-zinc-900 mb-1">🔒 Officer PIN required</p>
              <p className="text-xs text-zinc-500 mb-3">Adding or editing hoses needs the officer PIN. Testing does not.</p>
              <form onSubmit={e => { e.preventDefault(); if (pinInput.trim()) submitPin() }} className="flex flex-col gap-2">
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value)}
                  placeholder="PIN"
                  className="w-full min-w-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
                <div className="flex gap-2">
                  <button type="submit" disabled={pinBusy || !pinInput.trim()} className="flex-1 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
                    {pinBusy ? 'Checking…' : 'Unlock'}
                  </button>
                  <button type="button" onClick={() => { setShowPin(false); pendingAfterUnlock.current = null }} className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50">
                    Cancel
                  </button>
                </div>
              </form>
              {pinError && <p className="mt-2 text-xs text-red-600">{pinError}</p>}
            </div>
          )}

          {visibleHoses.length > 0 && (
            <div className="relative mb-3">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search hose ID..."
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400 hover:text-zinc-700"
                >
                  Clear
                </button>
              )}
            </div>
          )}

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

          {step === 'select' && selected.size > 0 && (
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

          {step === 'select' && showAddHose && (
            <form action={handleAddHose} className="rounded-xl bg-white border border-zinc-200 p-4 mb-5 flex flex-col gap-3">
              {addError && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{addError}</div>}
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Hose ID</label>
                <input name="hose_identifier" type="text" required placeholder="H-0001"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Type</label>
                  <select name="hose_type" required defaultValue="attack"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                    {HOSE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="w-28">
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Diameter (in)</label>
                  <input name="diameter_in" type="number" step="0.25" min="0.5" required placeholder="1.75"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                </div>
                <div className="w-28">
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Length (ft)</label>
                  <input name="length_ft" type="number" min="0" required placeholder="50"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                </div>
              </div>
              <button type="submit" disabled={adding}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
                {adding ? 'Adding...' : 'Add Hose'}
              </button>
            </form>
          )}

          {hoses.length === 0 ? (
            <div className="rounded-xl bg-white border border-zinc-200 px-6 py-12 text-center text-sm text-zinc-400 mb-5">
              No hoses on file yet — use &quot;+ Add Hose&quot; above to register the first one.
            </div>
          ) : step === 'select' && visibleHoses.length === 0 ? (
            <div className="rounded-xl bg-white border border-zinc-200 px-6 py-12 text-center text-sm text-zinc-400 mb-5">
              All hoses have been tested within the last 30 days — nothing left to test right now.
            </div>
          ) : groupedHoses.length === 0 ? (
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
                      step === 'manage' && editingId === hose.id ? (
                        <form
                          key={hose.id}
                          action={(formData) => handleEditHose(hose.id, formData)}
                          className="px-4 py-3 flex flex-col gap-2 bg-zinc-50"
                        >
                          {editError && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{editError}</div>}
                          <div className="flex gap-2">
                            <input name="hose_identifier" type="text" required defaultValue={hose.hose_identifier}
                              className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm font-mono focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                            <select name="hose_type" required defaultValue={hose.hose_type}
                              className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                              {HOSE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <input name="diameter_in" type="number" step="0.25" min="0.5" required defaultValue={hose.diameter_in}
                              placeholder="Diameter"
                              className="w-24 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                            <input name="length_ft" type="number" min="0" required defaultValue={hose.length_ft}
                              placeholder="Length (ft)"
                              className="w-28 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                            <button type="submit" disabled={editing}
                              className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50">
                              {editing ? 'Saving...' : 'Save'}
                            </button>
                            <button type="button" onClick={() => { setEditingId(null); setEditError(null) }}
                              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50">
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : step === 'manage' ? (
                        <div key={hose.id} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50">
                          <div className="min-w-0 flex-1">
                            <span className="font-mono font-semibold text-zinc-900">{hose.hose_identifier}</span>
                            <span className="text-xs text-zinc-400 ml-2">{hose.length_ft} ft · {hose.hose_type}</span>
                            {recentlyTestedIds.has(hose.id) && !forcedIds.has(hose.id) && (
                              <span className="text-xs text-amber-600 ml-2">· tested recently</span>
                            )}
                          </div>
                          <div className="flex gap-2 shrink-0">
                            {recentlyTestedIds.has(hose.id) && !forcedIds.has(hose.id) && (
                              <button
                                onClick={() => handleForceInclude(hose.id)}
                                className="text-xs font-semibold text-amber-700 hover:text-amber-900"
                              >
                                Force Test
                              </button>
                            )}
                            <button
                              onClick={() => { setEditingId(hose.id); setEditError(null) }}
                              className="text-xs font-semibold text-zinc-500 hover:text-red-700"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleRetire(hose.id)}
                              disabled={retiringId === hose.id}
                              className="text-xs font-semibold text-zinc-400 hover:text-red-700 disabled:opacity-50"
                            >
                              {retiringId === hose.id ? 'Saving...' : 'Deactivate'}
                            </button>
                          </div>
                        </div>
                      ) : hose.id in lockedByOthers ? (
                        <div key={hose.id} className="flex items-center gap-3 px-4 py-3 bg-zinc-50">
                          <input type="checkbox" checked={false} disabled className="w-4 h-4 rounded border-zinc-300" />
                          <div className="min-w-0 flex-1">
                            <span className="font-mono font-semibold text-zinc-400">{hose.hose_identifier}</span>
                            <span className="text-xs text-zinc-400 ml-2">{hose.length_ft} ft · {hose.hose_type}</span>
                          </div>
                          <span className="shrink-0 text-xs font-medium text-amber-600">
                            🔒 In progress{lockedByOthers[hose.id] ? ` — ${lockedByOthers[hose.id]}` : ''}
                          </span>
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

          {step === 'select' && hoses.length > 0 && (
            <button
              onClick={handleContinue}
              disabled={!canContinue || loading}
              className="w-full rounded-lg bg-red-700 px-4 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Starting…' : `Start Test with ${selected.size} Hose${selected.size !== 1 ? 's' : ''} →`}
            </button>
          )}
        </>
      )}

      {step === 'draft' && draft && (
        <HoseTestDraftScreen
          slug={slug}
          initial={draft}
          onLeave={leaveDraft}
          onDiscarded={handleDraftDiscarded}
          onFinished={handleDraftFinished}
        />
      )}
    </div>
  )
}
