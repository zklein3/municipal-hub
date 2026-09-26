'use client'

import { useRef, useState } from 'react'
import {
  saveHoseTestItem,
  saveHoseTestSessionParams,
  finalizeHoseTestSession,
  abandonHoseTestSession,
  type OpenedSession,
  type DraftItem,
} from '@/app/actions/hose-test-sessions'

// NFPA 1962: attack hose (1"-3") tests at 300 PSI, supply hose (4"-6") at 200 PSI.
function requiredPsi(diameter_in: number): number {
  return diameter_in >= 4 ? 200 : 300
}

export type FinishedInfo = {
  passed: number
  failed: number
  retired: number
  passedHoseIds: string[]
  failedHoseIds: string[]
  retiredHoseIds: string[]
}

const inputCls = 'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500'

export default function HoseTestDraftScreen({
  slug,
  initial,
  onLeave,
  onFinished,
  onDiscarded,
}: {
  slug: string | null
  initial: OpenedSession
  onLeave: () => void
  onFinished: (info: FinishedInfo) => void
  onDiscarded: () => void
}) {
  const sessionId = initial.id
  const [items, setItems] = useState<Record<string, DraftItem>>(() => Object.fromEntries(initial.items.map(i => [i.hose_id, i])))
  const order = initial.items.map(i => i.hose_id)

  const [search, setSearch] = useState('')
  const [failedOnly, setFailedOnly] = useState(false)
  const [error, setError] = useState<string | null>(initial.conflictHoseIds.length
    ? `${initial.conflictHoseIds.length} hose(s) in this test are now selected by another tester.`
    : null)
  const [busy, setBusy] = useState(false)
  const [pendingSaves, setPendingSaves] = useState(0)
  const [confirmMode, setConfirmMode] = useState<'finalize' | 'discard' | null>(null)

  const [testDate, setTestDate] = useState(initial.testDate)
  const [pressurePsi, setPressurePsi] = useState(initial.pressurePsi ? String(initial.pressurePsi) : '')
  const [durationMin, setDurationMin] = useState(String(initial.durationMin))

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  async function persist(hoseId: string, item: DraftItem) {
    setPendingSaves(n => n + 1)
    const res = await saveHoseTestItem(slug, sessionId, hoseId, {
      result: item.result === 'fail' ? 'fail' : 'pending',
      failureReason: item.failure_reason,
      retire: item.retire_on_finalize,
    })
    setPendingSaves(n => n - 1)
    if ('error' in res) setError(res.error)
  }

  function update(hoseId: string, patch: Partial<DraftItem>, debounce = false) {
    setError(null)
    const next = { ...items[hoseId], ...patch }
    setItems(prev => ({ ...prev, [hoseId]: next }))
    clearTimeout(timers.current[hoseId])
    if (debounce) timers.current[hoseId] = setTimeout(() => persist(hoseId, next), 600)
    else persist(hoseId, next)
  }

  function flushNow(hoseId: string) {
    if (timers.current[hoseId]) {
      clearTimeout(timers.current[hoseId])
      delete timers.current[hoseId]
      persist(hoseId, items[hoseId])
    }
  }

  async function saveParams() {
    const psi = parseInt(pressurePsi)
    if (!testDate || !psi) return
    const res = await saveHoseTestSessionParams(slug, sessionId, { testDate, pressurePsi: psi, durationMin: parseInt(durationMin) || 5 })
    if ('error' in res) setError(res.error)
  }

  const all = order.map(id => items[id])
  const failed = all.filter(i => i.result === 'fail')
  const pending = all.length - failed.length
  const missingNotes = failed.filter(i => !i.failure_reason.trim()).length
  const term = search.trim().toLowerCase()
  const visible = all.filter(i =>
    (!failedOnly || i.result === 'fail') &&
    (!term || i.hose_identifier.toLowerCase().includes(term)))

  function requestFinalize() {
    setError(null)
    if (!pressurePsi || !parseInt(pressurePsi)) { setError('Pressure is required.'); return }
    if (missingNotes > 0) { setError(`Enter a failure note for every failed hose (${missingNotes} missing).`); return }
    setConfirmMode('finalize')
  }

  async function handleFinalize() {
    setConfirmMode(null)
    setBusy(true)
    Object.values(timers.current).forEach(clearTimeout)
    timers.current = {}
    // Make sure the latest notes and params are saved before locking the session.
    await saveParams()
    for (const i of failed) await saveHoseTestItem(slug, sessionId, i.hose_id, { result: 'fail', failureReason: i.failure_reason, retire: i.retire_on_finalize })
    const res = await finalizeHoseTestSession(slug, sessionId)
    setBusy(false)
    if ('error' in res) { setError(res.error); return }
    onFinished(res)
  }

  async function handleDiscard() {
    setConfirmMode(null)
    setBusy(true)
    const res = await abandonHoseTestSession(slug, sessionId)
    setBusy(false)
    if ('error' in res) { setError(res.error); return }
    onDiscarded()
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-bold text-zinc-900">Test in progress</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Tester: {initial.testerName} · {all.length} hose{all.length !== 1 ? 's' : ''} · nothing is logged until you Finalize
          </p>
        </div>
        <span className="shrink-0 text-xs text-zinc-400">{pendingSaves > 0 ? 'Saving…' : 'Saved'}</span>
      </div>

      <div className="rounded-xl bg-white border border-zinc-200 p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-zinc-600 mb-1">Test Date</label>
          <input type="date" value={testDate} onChange={e => setTestDate(e.target.value)} onBlur={saveParams} className={inputCls} />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-zinc-600 mb-1">Pressure Used (PSI)</label>
          <input type="number" min="0" value={pressurePsi} onChange={e => setPressurePsi(e.target.value)} onBlur={saveParams} className={inputCls} />
        </div>
        <div className="w-full sm:w-28">
          <label className="block text-xs font-medium text-zinc-600 mb-1">Minutes</label>
          <input type="number" min="1" value={durationMin} onChange={e => setDurationMin(e.target.value)} onBlur={saveParams} className={inputCls} />
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">{pending} pending</span>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${failed.length ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-400'}`}>{failed.length} failed</span>
        {failed.length > 0 && (
          <button onClick={() => setFailedOnly(v => !v)} className="text-xs font-semibold text-red-700 hover:underline">
            {failedOnly ? 'Show all' : 'Show failed only'}
          </button>
        )}
      </div>

      <div className="relative mb-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search hose number to mark a failure…"
          className={inputCls}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400 hover:text-zinc-700">Clear</button>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden divide-y divide-zinc-100 mb-5">
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-400">No hoses match.</p>
        ) : visible.map(item => {
          const reqPsi = requiredPsi(item.diameter_in)
          const psi = parseInt(pressurePsi)
          const psiLow = !!psi && psi < reqPsi
          const isFail = item.result === 'fail'
          return (
            <div key={item.hose_id} className={`px-4 py-3 ${isFail ? 'bg-red-50' : ''}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-mono font-semibold text-zinc-900">{item.hose_identifier}</span>
                  <span className="text-xs text-zinc-400 ml-2">{item.diameter_in}&quot; · {item.length_ft} ft · {item.hose_type}</span>
                  {psiLow && <p className="text-xs text-amber-600 font-medium mt-0.5">Required {reqPsi} PSI — pressure entered is below that</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isFail ? 'bg-red-600 text-white' : 'bg-zinc-100 text-zinc-500'}`}>
                    {isFail ? 'Fail' : 'Pending'}
                  </span>
                  {isFail ? (
                    <button onClick={() => update(item.hose_id, { result: 'pending', failure_reason: '', retire_on_finalize: false })}
                      className="text-xs font-semibold text-zinc-500 hover:text-zinc-800">Undo</button>
                  ) : (
                    <button onClick={() => update(item.hose_id, { result: 'fail' })}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">Mark Fail</button>
                  )}
                </div>
              </div>
              {isFail && (
                <div className="mt-2 flex flex-col gap-2">
                  <input
                    type="text"
                    value={item.failure_reason}
                    onChange={e => update(item.hose_id, { failure_reason: e.target.value }, true)}
                    onBlur={() => flushNow(item.hose_id)}
                    placeholder="Failure note (required)"
                    className={`w-full rounded-lg border px-3 py-1.5 text-xs text-zinc-800 focus:outline-none ${item.failure_reason.trim() ? 'border-red-200 bg-white' : 'border-red-400 bg-white'}`}
                  />
                  <label className="flex items-center gap-2 text-xs text-red-700 cursor-pointer">
                    <input type="checkbox" checked={item.retire_on_finalize}
                      onChange={e => update(item.hose_id, { retire_on_finalize: e.target.checked })}
                      className="w-3.5 h-3.5 rounded border-red-300 text-red-600 focus:ring-red-500" />
                    Take this hose out of service
                  </label>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {confirmMode === 'finalize' && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 mb-3">
          <p className="text-sm font-semibold text-red-900 mb-1">Finalize this test?</p>
          <p className="text-sm text-red-800">
            <strong>{pending}</strong> hose{pending !== 1 ? 's' : ''} still pending will be recorded as <strong>PASSED</strong>.
            <br />
            <strong>{failed.length}</strong> hose{failed.length !== 1 ? 's' : ''} will be recorded as <strong>FAILED</strong>.
          </p>
          <p className="text-xs text-red-700 mt-1 mb-3">The test is locked after this. Mistakes can be corrected by an officer in Hose Inventory.</p>
          <div className="flex gap-3">
            <button onClick={handleFinalize} className="flex-1 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800">
              Yes, finalize
            </button>
            <button onClick={() => setConfirmMode(null)} className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              Go back
            </button>
          </div>
        </div>
      )}

      {confirmMode === 'discard' && (
        <div className="rounded-xl border-2 border-zinc-300 bg-zinc-50 p-4 mb-3">
          <p className="text-sm font-semibold text-zinc-900 mb-1">Discard this test?</p>
          <p className="text-xs text-zinc-600 mb-3">Nothing will be logged and the hoses will be released.</p>
          <div className="flex gap-3">
            <button onClick={handleDiscard} className="flex-1 rounded-lg bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-900">
              Yes, discard
            </button>
            <button onClick={() => setConfirmMode(null)} className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              Go back
            </button>
          </div>
        </div>
      )}

      {confirmMode === null && (
        <>
          <button
            onClick={requestFinalize}
            disabled={busy}
            className="w-full rounded-lg bg-red-700 px-4 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors mb-3"
          >
            {busy ? 'Working…' : `Finalize Test (${pending} pass · ${failed.length} fail)`}
          </button>
          <div className="flex gap-3">
            <button onClick={onLeave} disabled={busy} className="flex-1 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50">
              Leave — keep draft
            </button>
            <button onClick={() => setConfirmMode('discard')} disabled={busy} className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
              Discard
            </button>
          </div>
        </>
      )}
    </div>
  )
}
