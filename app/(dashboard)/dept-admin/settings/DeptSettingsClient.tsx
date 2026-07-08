'use client'

import { useState } from 'react'
import { saveDeptTimezone } from '@/app/actions/departments'
import { TIMEZONES } from '@/lib/format-datetime'

export default function DeptSettingsClient({
  departmentId,
  timezone: initial,
}: {
  departmentId: string
  timezone: string
}) {
  const [timezone, setTimezone] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  async function handleSave() {
    setSaving(true); setSaveError(null); setSaveSuccess(false)
    const result = await saveDeptTimezone(departmentId, timezone)
    if (result?.error) setSaveError(result.error)
    else setSaveSuccess(true)
    setSaving(false)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">Department Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">Timezone and display preferences for this department.</p>
      </div>

      <div className="rounded-xl bg-white border border-zinc-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-zinc-900 mb-1">Timezone</h2>
        <p className="text-xs text-zinc-500 mb-4">
          Used to display timestamps like sign-ins, certifications, and inspection logs in your department's local time.
        </p>

        {saveError && (
          <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{saveError}</div>
        )}
        {saveSuccess && (
          <div className="mb-3 rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-700">Timezone saved.</div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={timezone}
            onChange={e => { setTimezone(e.target.value); setSaveSuccess(false) }}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            {TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
