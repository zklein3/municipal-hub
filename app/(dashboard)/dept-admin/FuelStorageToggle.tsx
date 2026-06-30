'use client'

import { useState } from 'react'
import { setFuelStorageModule } from '@/app/actions/departments'

export default function FuelStorageToggle({ enabled }: { enabled: boolean }) {
  const [active, setActive] = useState(enabled)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle() {
    setSaving(true)
    setError(null)
    const result = await setFuelStorageModule(!active)
    if (result?.error) {
      setError(result.error)
    } else {
      setActive(prev => !prev)
    }
    setSaving(false)
  }

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">On-Site Fuel Storage</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Track fuel deliveries into department-owned storage tanks and automatically deduct gallons when apparatus fill up on-site.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'
          }`}>
            {active ? 'Enabled' : 'Disabled'}
          </span>
          <button
            onClick={handleToggle}
            disabled={saving}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
              active
                ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                : 'bg-red-700 text-white hover:bg-red-800'
            }`}
          >
            {saving ? 'Saving…' : active ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
