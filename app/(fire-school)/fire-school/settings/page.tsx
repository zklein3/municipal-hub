'use client'

import { useEffect, useState } from 'react'
import { TIMEZONES, DEFAULT_TIMEZONE } from '@/lib/format-datetime'

export const TZ_KEY = 'fire_school_timezone'
export const TZ_DEFAULT = DEFAULT_TIMEZONE

export default function FireSchoolSettingsPage() {
  const [timezone, setTimezone] = useState(TZ_DEFAULT)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(TZ_KEY)
    if (stored) setTimezone(stored)
  }, [])

  function handleSave() {
    localStorage.setItem(TZ_KEY, timezone)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900">Settings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Display preferences saved to this device</p>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-zinc-200 p-6">
        <label className="block text-sm font-semibold text-zinc-700 mb-1">Timezone</label>
        <p className="text-xs text-zinc-400 mb-3">
          Timestamps in the fill log will display in this timezone.
        </p>
        <select
          value={timezone}
          onChange={e => {
            setTimezone(e.target.value)
            setSaved(false)
          }}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 mb-4"
        >
          {TIMEZONES.map(tz => (
            <option key={tz.value} value={tz.value}>{tz.label}</option>
          ))}
        </select>

        <button
          onClick={handleSave}
          className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 transition-colors"
        >
          {saved ? '✓ Saved' : 'Save'}
        </button>
      </div>
    </div>
  )
}
