'use client'

import { useEffect, useRef, useState } from 'react'
import { unlockAgilityTest } from '@/app/actions/agility-pin'
import { searchAgilityTestPersonnel, submitAgilityTest } from '@/app/actions/agility-tests'
import { evaluateEvolution, formatSeconds, type AgilityEvolutionSpec } from '@/lib/agility-test-spec'

const ADMIN_NAME_KEY = 'fireops7_agility_admin_name'
const pinKey = (slug: string) => `fireops7_agility_pin_${slug}`
const draftKey = (slug: string) => `fireops7_agility_draft_${slug}`

type Person = { id: string; name: string }
type RecordedEvolution = {
  number: number
  name: string
  timeSeconds: number
  cutoffSeconds: number
  result: 'pass' | 'fail'
  subCheckValues: Record<string, boolean | number>
  restBeforeSeconds: number | null
}

// Local calendar date, not UTC — new Date().toISOString() shifts to UTC first,
// which rolls the date to "tomorrow" in the evening in any timezone behind
// UTC (e.g. Central after ~6-7pm). This test is administered in person, right
// now, on this device — the device's own local date is always the right one.
function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseTimeInput(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.includes(':')) {
    const [m, s] = trimmed.split(':')
    const mins = parseInt(m, 10)
    const secs = parseFloat(s)
    if (Number.isNaN(mins) || Number.isNaN(secs)) return null
    return mins * 60 + secs
  }
  const n = parseFloat(trimmed)
  return Number.isNaN(n) ? null : n
}

// Elapsed time is always derived from a stored start timestamp vs. right now,
// never accumulated tick-by-tick — so a backgrounded tab or a locked phone
// screen (both very real for a device sitting next to a stair-climb tower)
// can never cause drift. The candidate's real elapsed time keeps counting
// correctly even if the screen was off for part of it.
function liveElapsed(startedAt: number | null): number {
  if (startedAt === null) return 0
  return (Date.now() - startedAt) / 1000
}

export default function AgilityTestClient({ slug, evolutions }: { slug: string; evolutions: AgilityEvolutionSpec[] }) {
  // ── PIN unlock — gates the entire page, not just part of it (see lib/agility-pin.ts).
  const [pinToken, setPinToken] = useState<string | null>(null)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinBusy, setPinBusy] = useState(false)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(pinKey(slug)) ?? 'null') as { token: string; exp: number } | null
      if (saved && saved.exp > Date.now()) setPinToken(saved.token)
      else if (saved) localStorage.removeItem(pinKey(slug))
    } catch { localStorage.removeItem(pinKey(slug)) }
  }, [slug])

  async function submitPin() {
    setPinBusy(true); setPinError(null)
    const res = await unlockAgilityTest(slug, pinInput.trim())
    setPinBusy(false)
    if ('error' in res) { setPinError(res.error); return }
    localStorage.setItem(pinKey(slug), JSON.stringify(res))
    setPinToken(res.token)
    setPinInput('')
  }

  function handlePinExpired() {
    localStorage.removeItem(pinKey(slug))
    setPinToken(null)
    setPinError('The PIN unlock expired or was changed. Enter the PIN again.')
  }

  // ── Wizard state ────────────────────────────────────────────────────────
  type Step = 'setup' | 'evolution' | 'review' | 'done'
  const [step, setStep] = useState<Step>('setup')

  const [subjectType, setSubjectType] = useState<'employee' | 'candidate'>('candidate')
  const [candidateName, setCandidateName] = useState('')
  const [personQuery, setPersonQuery] = useState('')
  const [personResults, setPersonResults] = useState<Person[]>([])
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [testDate, setTestDate] = useState(todayLocal)
  const [administeredBy, setAdministeredBy] = useState('')
  const [notes, setNotes] = useState('')
  const [setupError, setSetupError] = useState<string | null>(null)

  const [evolutionIndex, setEvolutionIndex] = useState(0)
  const [recorded, setRecorded] = useState<RecordedEvolution[]>([])
  const [timeInput, setTimeInput] = useState('')
  const [subCheckValues, setSubCheckValues] = useState<Record<string, boolean | number | ''>>({})
  const [evoError, setEvoError] = useState<string | null>(null)

  // Two independent, mutually-exclusive clocks — see liveElapsed's comment.
  // evoTimerStart: the running evolution clock. breakTimerStart: the "between
  // evolution rest" clock, started the instant one evolution ends and stopped
  // the instant the next one starts. pendingRestSeconds holds the just-closed
  // break's elapsed time until it's attached to the evolution about to be recorded.
  const [evoTimerStart, setEvoTimerStart] = useState<number | null>(null)
  const [breakTimerStart, setBreakTimerStart] = useState<number | null>(null)
  const [pendingRestSeconds, setPendingRestSeconds] = useState<number | null>(null)
  const [, forceTick] = useState(0)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result, setResult] = useState<{ testId: string; overallResult: 'pass' | 'fail' } | null>(null)

  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => { topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [step, evolutionIndex])

  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_NAME_KEY)
    if (stored) setAdministeredBy(stored)
  }, [])

  // Re-render every half second while either clock is running, purely to
  // refresh the live mm:ss readouts — elapsed itself is always computed fresh
  // from Date.now(), this just triggers the redraw.
  useEffect(() => {
    if (evoTimerStart === null && breakTimerStart === null) return
    const id = setInterval(() => forceTick(t => t + 1), 500)
    return () => clearInterval(id)
  }, [evoTimerStart, breakTimerStart])

  // Resume an in-progress test after a reload or the phone screen locking —
  // a real risk for a device sitting next to a stair-climb tower mid-test.
  // Only restores when a draft was mid-evolution/review; a finished or
  // not-yet-started test never gets saved in the first place (see save effect).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey(slug))
      if (!raw) return
      const d = JSON.parse(raw)
      if (d.step !== 'evolution' && d.step !== 'review') return
      setSubjectType(d.subjectType)
      setCandidateName(d.candidateName)
      setSelectedPerson(d.selectedPerson)
      setTestDate(d.testDate)
      if (d.administeredBy) setAdministeredBy(d.administeredBy)
      setNotes(d.notes ?? '')
      setEvolutionIndex(d.evolutionIndex)
      setRecorded(d.recorded ?? [])
      setEvoTimerStart(d.evoTimerStart)
      setBreakTimerStart(d.breakTimerStart)
      setPendingRestSeconds(d.pendingRestSeconds)
      setStep(d.step)
    } catch {
      localStorage.removeItem(draftKey(slug))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist the in-progress test on every relevant change. 'setup' (nothing
  // started yet) and 'done' (already submitted) both clear it instead.
  useEffect(() => {
    if (step === 'setup' || step === 'done') {
      localStorage.removeItem(draftKey(slug))
      return
    }
    const draft = {
      subjectType, candidateName, selectedPerson, testDate, administeredBy, notes,
      evolutionIndex, recorded, evoTimerStart, breakTimerStart, pendingRestSeconds, step,
    }
    localStorage.setItem(draftKey(slug), JSON.stringify(draft))
  }, [step, subjectType, candidateName, selectedPerson, testDate, administeredBy, notes, evolutionIndex, recorded, evoTimerStart, breakTimerStart, pendingRestSeconds, slug])

  useEffect(() => {
    if (subjectType !== 'employee' || !pinToken) return
    const t = setTimeout(async () => {
      const results = await searchAgilityTestPersonnel(slug, pinToken, personQuery)
      setPersonResults(results)
    }, 200)
    return () => clearTimeout(t)
  }, [personQuery, subjectType, pinToken, slug])

  function saveAdministeredBy(name: string) {
    setAdministeredBy(name)
    localStorage.setItem(ADMIN_NAME_KEY, name)
  }

  function startTest() {
    setSetupError(null)
    if (subjectType === 'candidate' && !candidateName.trim()) { setSetupError('Enter the candidate’s name.'); return }
    if (subjectType === 'employee' && !selectedPerson) { setSetupError('Select an employee.'); return }
    if (!administeredBy.trim()) { setSetupError('Enter your name (administered by).'); return }
    setEvolutionIndex(0)
    setRecorded([])
    setTimeInput('')
    setSubCheckValues({})
    setEvoTimerStart(null)
    setBreakTimerStart(null)
    setPendingRestSeconds(null)
    setStep('evolution')
  }

  function handleStartEvolution() {
    setEvoError(null)
    if (breakTimerStart !== null) {
      setPendingRestSeconds(liveElapsed(breakTimerStart))
      setBreakTimerStart(null)
    }
    setEvoTimerStart(Date.now())
  }

  function handleEndEvolution() {
    if (evoTimerStart === null) return
    const elapsed = liveElapsed(evoTimerStart)
    setEvoTimerStart(null)
    setTimeInput(elapsed.toFixed(1))
  }

  function recordEvolution() {
    setEvoError(null)
    const spec = evolutions[evolutionIndex]
    const seconds = parseTimeInput(timeInput)
    if (seconds === null) { setEvoError('Enter a time (seconds, or m:ss) — or use Start/End Evolution above.'); return }
    const cleanedValues: Record<string, boolean | number> = {}
    for (const sc of spec.subChecks) {
      const v = subCheckValues[sc.key]
      if (v === undefined || v === '') { setEvoError('Answer every item below before continuing.'); return }
      cleanedValues[sc.key] = v
    }
    const evoResult = evaluateEvolution(spec, seconds, cleanedValues)
    const next = [...recorded, {
      number: spec.number, name: spec.name, timeSeconds: seconds, cutoffSeconds: spec.cutoffSeconds,
      result: evoResult, subCheckValues: cleanedValues, restBeforeSeconds: pendingRestSeconds,
    }]
    setRecorded(next)
    setTimeInput('')
    setSubCheckValues({})
    setPendingRestSeconds(null)
    setEvoTimerStart(null)

    if (evoResult === 'fail' || evolutionIndex === evolutions.length - 1) {
      setBreakTimerStart(null)
      setStep('review')
    } else {
      setEvolutionIndex(evolutionIndex + 1)
      setBreakTimerStart(Date.now()) // rest starts the instant this evolution ends
    }
  }

  async function handleSubmit() {
    setSubmitting(true); setSubmitError(null)
    const res = await submitAgilityTest(slug, pinToken, {
      subjectType,
      personnelId: selectedPerson?.id ?? null,
      candidateName: subjectType === 'employee' ? (selectedPerson?.name ?? '') : candidateName,
      testDate,
      administeredByName: administeredBy,
      notes,
      evolutions: recorded.map(r => ({
        number: r.number, timeSeconds: r.timeSeconds, subCheckValues: r.subCheckValues, restBeforeSeconds: r.restBeforeSeconds,
      })),
    })
    setSubmitting(false)
    if ('error' in res) {
      if (res.error === 'PIN required.') { handlePinExpired(); return }
      setSubmitError(res.error)
      return
    }
    localStorage.removeItem(draftKey(slug))
    setResult(res)
    setStep('done')
  }

  function resetForNextTest() {
    localStorage.removeItem(draftKey(slug))
    setStep('setup')
    setSubjectType('candidate')
    setCandidateName('')
    setSelectedPerson(null)
    setPersonQuery('')
    setTestDate(todayLocal())
    setNotes('')
    setResult(null)
    setSubmitError(null)
    setEvoTimerStart(null)
    setBreakTimerStart(null)
    setPendingRestSeconds(null)
  }

  // ── PIN gate ────────────────────────────────────────────────────────────
  if (!pinToken) {
    return (
      <div ref={topRef} className="rounded-xl bg-white border border-zinc-200 p-5">
        <p className="text-sm font-semibold text-zinc-900 mb-1">🔒 Officer PIN required</p>
        <p className="text-xs text-zinc-500 mb-3">Ask a department admin for the agility test PIN if you don&apos;t have it.</p>
        <form onSubmit={e => { e.preventDefault(); if (pinInput.trim()) submitPin() }} className="flex flex-col gap-2">
          <input
            type="password" inputMode="numeric" autoComplete="off" autoFocus
            value={pinInput} onChange={e => setPinInput(e.target.value)}
            placeholder="PIN"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
          <button type="submit" disabled={pinBusy || !pinInput.trim()}
            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
            {pinBusy ? 'Checking…' : 'Unlock'}
          </button>
        </form>
        {pinError && <p className="mt-2 text-xs text-red-600">{pinError}</p>}
      </div>
    )
  }

  return (
    <div ref={topRef}>
      {step === 'setup' && (
        <div className="rounded-xl bg-white border border-zinc-200 p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-zinc-700">New Test</h2>

          {setupError && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{setupError}</div>}

          <div className="flex gap-2">
            {(['candidate', 'employee'] as const).map(t => (
              <button key={t} type="button" onClick={() => { setSubjectType(t); setSetupError(null) }}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                  subjectType === t ? 'bg-red-700 text-white border-red-700' : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50'
                }`}>
                {t === 'candidate' ? 'Hiring Candidate' : 'Current Employee'}
              </button>
            ))}
          </div>

          {subjectType === 'candidate' ? (
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Candidate&apos;s Name</label>
              <input type="text" value={candidateName} onChange={e => setCandidateName(e.target.value)}
                placeholder="Full name"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Employee</label>
              {selectedPerson ? (
                <div className="flex items-center justify-between rounded-lg border border-zinc-300 px-3 py-2 text-sm">
                  <span className="font-medium text-zinc-900">{selectedPerson.name}</span>
                  <button type="button" onClick={() => { setSelectedPerson(null); setPersonQuery('') }} className="text-xs font-semibold text-red-700 hover:underline">Change</button>
                </div>
              ) : (
                <>
                  <input type="text" value={personQuery} onChange={e => setPersonQuery(e.target.value)}
                    placeholder="Search by name…"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                  {personResults.length > 0 && (
                    <div className="mt-1 rounded-lg border border-zinc-200 divide-y divide-zinc-100 max-h-48 overflow-y-auto">
                      {personResults.map(p => (
                        <button key={p.id} type="button" onClick={() => setSelectedPerson(p)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50">{p.name}</button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-zinc-600 mb-1">Test Date</label>
              <input type="date" value={testDate} onChange={e => setTestDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-zinc-600 mb-1">Administered By</label>
              <input type="text" value={administeredBy} onChange={e => saveAdministeredBy(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
            </div>
          </div>

          <button type="button" onClick={startTest}
            className="rounded-lg bg-red-700 px-4 py-3 text-sm font-semibold text-white hover:bg-red-800">
            Start Test →
          </button>
        </div>
      )}

      {step === 'evolution' && (() => {
        const spec = evolutions[evolutionIndex]
        const running = evoTimerStart !== null
        const resting = breakTimerStart !== null
        return (
          <div className="rounded-xl bg-white border border-zinc-200 p-5 flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Evolution {spec.number} of {evolutions.length}</p>
              <h2 className="text-base font-bold text-zinc-900">{spec.name}</h2>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{spec.description}</p>
            </div>

            {evoError && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{evoError}</div>}

            {resting && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-800">Resting — {formatSeconds(liveElapsed(breakTimerStart))}</span>
                <span className="text-[11px] text-amber-600">Starting the clock below stops this and logs it as rest before this evolution</span>
              </div>
            )}

            <div className="rounded-lg border border-zinc-200 p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-zinc-500">Evolution Clock</p>
                <p className={`text-2xl font-mono font-bold ${running ? 'text-red-700' : 'text-zinc-400'}`}>
                  {running ? formatSeconds(liveElapsed(evoTimerStart)) : '0:00'}
                </p>
              </div>
              {running ? (
                <button type="button" onClick={handleEndEvolution}
                  className="shrink-0 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">
                  ■ End Evolution
                </button>
              ) : (
                <button type="button" onClick={handleStartEvolution}
                  className="shrink-0 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">
                  ▶ Start Evolution
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                {spec.timeLabel} <span className="text-zinc-400 font-normal">— cutoff: {spec.cutoffLabel} ({formatSeconds(spec.cutoffSeconds)})</span>
              </label>
              <input type="text" inputMode="decimal" value={timeInput} onChange={e => setTimeInput(e.target.value)}
                placeholder="e.g. 47 or 3:22 — or use the clock above"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              <p className="text-[11px] text-zinc-400 mt-1">Filled in automatically by End Evolution above — still editable if you need to correct it.</p>
            </div>

            {spec.subChecks.map(sc => (
              <div key={sc.key}>
                <label className="block text-xs font-medium text-zinc-600 mb-1">{sc.label}</label>
                {sc.type === 'boolean' ? (
                  <div className="flex gap-2">
                    {[true, false].map(v => (
                      <button key={String(v)} type="button"
                        onClick={() => setSubCheckValues(prev => ({ ...prev, [sc.key]: v }))}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                          subCheckValues[sc.key] === v
                            ? v ? 'bg-green-600 text-white border-green-600' : 'bg-red-700 text-white border-red-700'
                            : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50'
                        }`}>
                        {v ? 'Yes' : 'No'}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input type="number" min="0" value={(subCheckValues[sc.key] as number | undefined) ?? ''}
                    onChange={e => setSubCheckValues(prev => ({ ...prev, [sc.key]: e.target.value === '' ? '' : parseInt(e.target.value, 10) }))}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                )}
              </div>
            ))}

            <button type="button" onClick={recordEvolution}
              className="rounded-lg bg-red-700 px-4 py-3 text-sm font-semibold text-white hover:bg-red-800">
              Record &amp; Continue →
            </button>
          </div>
        )
      })()}

      {step === 'review' && (
        <div className="rounded-xl bg-white border border-zinc-200 p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-zinc-700">Review</h2>

          <div className={`rounded-lg px-3 py-2 text-sm font-bold ${
            recorded.some(r => r.result === 'fail') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
            Overall: {recorded.some(r => r.result === 'fail') ? 'FAIL' : 'PASS'}
            {recorded.some(r => r.result === 'fail') && (
              <span className="block font-normal text-xs mt-0.5">
                Stopped at Evolution {recorded[recorded.length - 1].number} — candidate does not proceed further.
              </span>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 divide-y divide-zinc-100">
            {recorded.map(r => (
              <div key={r.number}>
                {r.restBeforeSeconds !== null && (
                  <div className="px-3 pt-2 text-[11px] font-medium text-amber-700 bg-amber-50">
                    Rest before this evolution: {formatSeconds(r.restBeforeSeconds)}
                  </div>
                )}
                <div className={`flex items-center justify-between px-3 py-2 text-sm ${r.restBeforeSeconds !== null ? 'bg-amber-50' : ''}`}>
                  <span className="text-zinc-700">{r.number}. {r.name}</span>
                  <span className={`font-mono font-semibold ${r.result === 'pass' ? 'text-green-700' : 'text-red-700'}`}>
                    {formatSeconds(r.timeSeconds)} — {r.result.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
          </div>

          {submitError && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{submitError}</div>}

          <button type="button" onClick={handleSubmit} disabled={submitting}
            className="rounded-lg bg-red-700 px-4 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
            {submitting ? 'Saving…' : 'Submit Test'}
          </button>
        </div>
      )}

      {step === 'done' && result && (
        <div className="rounded-xl bg-white border border-zinc-200 p-5 flex flex-col gap-4 text-center">
          <p className={`text-2xl font-black ${result.overallResult === 'pass' ? 'text-green-700' : 'text-red-700'}`}>
            {result.overallResult === 'pass' ? 'PASS' : 'FAIL'}
          </p>
          <p className="text-sm text-zinc-600">
            {subjectType === 'employee'
              ? 'Saved to the employee’s record.'
              : 'Saved. Print a copy for Chief/HR below.'}
          </p>

          {subjectType === 'candidate' && (
            <a href={`/print/agility-test?id=${result.testId}`} target="_blank" rel="noopener noreferrer"
              className="rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
              Open Printable Result →
            </a>
          )}

          <button type="button" onClick={resetForNextTest}
            className="rounded-lg bg-red-700 px-4 py-3 text-sm font-semibold text-white hover:bg-red-800">
            Log Another Test
          </button>
        </div>
      )}
    </div>
  )
}
