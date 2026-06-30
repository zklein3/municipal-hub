'use client'

import { useState } from 'react'
import { updatePdCaseNumberSettings } from '@/app/actions/pd-contacts'

export default function PdCaseNumberClient({
  departmentId,
  initialMode,
  initialPrefix,
}: {
  departmentId: string
  initialMode: 'auto' | 'manual'
  initialPrefix: string | null
}) {
  const [mode, setMode] = useState<'auto' | 'manual'>(initialMode)
  const [prefix, setPrefix] = useState(initialPrefix ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    const res = await updatePdCaseNumberSettings(departmentId, mode, prefix || null)
    setSaving(false)
    if (res?.error) { setError(res.error); return }
    setSaved(true)
  }

  const year = new Date().getFullYear().toString().slice(-2)
  const previewPrefix = prefix.trim() || 'ABC'

  return (
    <div className="max-w-xl">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-900">Case Numbering</h2>
        <p className="text-sm text-zinc-500 mt-0.5">Choose whether Report Number is assigned automatically or entered manually by the officer.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-xl bg-white shadow-sm border border-zinc-200 p-4 space-y-4">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-zinc-900">
            <input type="radio" name="mode" checked={mode === 'manual'} onChange={() => setMode('manual')} />
            Manual — officer types their own case/report number
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
            <p className="mt-2 text-xs text-zinc-400">Preview: <span className="font-mono">{previewPrefix}{year}-0001</span>, resets to 0001 each new year.</p>
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
    </div>
  )
}
