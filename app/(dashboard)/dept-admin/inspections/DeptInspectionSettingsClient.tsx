'use client'

import { useState } from 'react'
import { saveDeptInspectionSettings } from '@/app/actions/departments'

function hoursToLabel(hours: number): string {
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''}`
  const days = Math.floor(hours / 24)
  const rem = hours % 24
  if (rem === 0) return `${days} day${days !== 1 ? 's' : ''}`
  return `${days} day${days !== 1 ? 's' : ''}, ${rem} hour${rem !== 1 ? 's' : ''}`
}

export default function DeptInspectionSettingsClient({
  departmentId,
  inspection_session_duration_hours,
}: {
  departmentId: string
  inspection_session_duration_hours: number
}) {
  const [hours, setHours] = useState(inspection_session_duration_hours)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSave(formData: FormData) {
    setLoading(true); setError(null); setSuccess(null)
    const result = await saveDeptInspectionSettings(formData)
    if (result.error) setError(result.error)
    else setSuccess('Settings saved.')
    setLoading(false)
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Inspection Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">Configure how inspection sessions behave for your department.</p>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">{success}</div>}

      <form action={handleSave} className="flex flex-col gap-5">
        <input type="hidden" name="department_id" value={departmentId} />

        <div className="rounded-xl bg-white border border-zinc-200 p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-zinc-900">Session Duration</h2>
          <p className="text-sm text-zinc-500 -mt-2">
            How long an inspection session stays open before expiring. A session that reaches this limit
            without being closed will be marked expired and a new session will start on next visit.
            Set this to match your longest inspection window — daily, per-shift, or weekly.
          </p>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Duration (hours)
            </label>
            <div className="flex items-center gap-3">
              <input
                name="inspection_session_duration_hours"
                type="number"
                min="1"
                max="8760"
                value={hours}
                onChange={e => setHours(parseInt(e.target.value) || 1)}
                className="w-32 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              <span className="text-sm text-zinc-500">= {hoursToLabel(hours || 1)}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[12, 24, 48, 168, 360, 720].map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHours(h)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    hours === h
                      ? 'bg-red-700 border-red-700 text-white'
                      : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50'
                  }`}
                >
                  {hoursToLabel(h)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              Common: 12h (half-shift), 24h (daily), 48h (48-hour shift), 7 days (weekly apparatus check), 15 days (bi-weekly)
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
