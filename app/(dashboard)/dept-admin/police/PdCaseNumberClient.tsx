'use client'

import { useState } from 'react'
import { updatePdCaseNumberSettings, setPdCaseNumberStart } from '@/app/actions/pd-contacts'

export default function PdCaseNumberClient({
  departmentId,
  initialMode,
  initialPrefix,
  year,
  currentSeq,
}: {
  departmentId: string
  initialMode: 'auto' | 'manual'
  initialPrefix: string | null
  year: number
  currentSeq: number
}) {
  const [mode, setMode] = useState<'auto' | 'manual'>(initialMode)
  const [prefix, setPrefix] = useState(initialPrefix ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [seq, setSeq] = useState(currentSeq)
  const [startInput, setStartInput] = useState(String(seq + 1))
  const [startSaving, setStartSaving] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [startSaved, setStartSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    const res = await updatePdCaseNumberSettings(departmentId, mode, prefix || null)
    setSaving(false)
    if (res?.error) { setError(res.error); return }
    setSaved(true)
  }

  async function handleSetStart() {
    const nextNumber = parseInt(startInput, 10)
    if (!Number.isInteger(nextNumber) || nextNumber < 1) { setStartError('Enter a whole number of 1 or greater.'); return }
    if (!confirm(`Set the next case number to ${nextNumber}? Make sure this doesn't collide with a number already issued by hand this year.`)) return
    setStartSaving(true)
    setStartError(null)
    setStartSaved(false)
    const res = await setPdCaseNumberStart(departmentId, year, nextNumber)
    setStartSaving(false)
    if (res?.error) { setStartError(res.error); return }
    setSeq(nextNumber - 1)
    setStartSaved(true)
  }

  const yy = year.toString().slice(-2)
  const previewPrefix = prefix.trim() || 'ABC'

  return (
    <div className="max-w-xl">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-900">Case Numbering</h2>
        <p className="text-sm text-zinc-500 mt-0.5">Choose whether Case Number is assigned automatically or entered manually by the officer.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-xl bg-white shadow-sm border border-zinc-200 p-4 space-y-4">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-zinc-900">
            <input type="radio" name="mode" checked={mode === 'manual'} onChange={() => setMode('manual')} />
            Manual — officer types their own case number
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-900">
            <input type="radio" name="mode" checked={mode === 'auto'} onChange={() => setMode('auto')} />
            Auto — system assigns the next number on save
          </label>
        </div>

        {mode === 'auto' && (
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Prefix</label>
            <input
              value={prefix}
              onChange={e => setPrefix(e.target.value.toUpperCase())}
              placeholder="YPD"
              maxLength={6}
              className="w-32 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            <p className="mt-2 text-xs text-zinc-400">Preview: <span className="font-mono">{previewPrefix}{yy}-0001</span>, resets to 0001 each new year.</p>
          </div>
        )}

        <button
          type="button"
          disabled={saving || (mode === 'auto' && !prefix.trim())}
          onClick={handleSave}
          className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Settings'}
        </button>
      </div>

      {mode === 'auto' && (
        <div className="mt-4 rounded-xl bg-white shadow-sm border border-zinc-200 p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Starting Number — {year}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              If the department already issued case numbers by hand earlier this year, set the next number here so auto-numbering picks up where you left off instead of restarting at 0001.
            </p>
          </div>

          {startError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{startError}</div>
          )}

          <p className="text-xs text-zinc-400">Current next number: <span className="font-mono text-zinc-700">{previewPrefix}{yy}-{String(seq + 1).padStart(4, '0')}</span></p>

          <div className="flex gap-2 items-end">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Next number to assign</label>
              <input
                type="number"
                min={1}
                value={startInput}
                onChange={e => setStartInput(e.target.value)}
                className="w-32 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <button
              type="button"
              disabled={startSaving}
              onClick={handleSetStart}
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-900 disabled:opacity-50 transition-colors"
            >
              {startSaving ? 'Setting...' : startSaved ? 'Set ✓' : 'Set Starting Number'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
