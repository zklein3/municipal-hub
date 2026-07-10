'use client'

import { useState } from 'react'
import { logAttendance } from '@/app/actions/attendance'
import { selfReportTrainingAttendance } from '@/app/actions/training'
import { logIncidentAttendance } from '@/app/actions/incidents'

const INCIDENT_ROLES = [
  { value: 'crew', label: 'Crew' },
  { value: 'driver', label: 'Driver' },
  { value: 'officer', label: 'Officer' },
  { value: 'ems', label: 'EMS' },
  { value: 'standby', label: 'Standby' },
]

export default function CheckinClient({
  type, id, personnelId, title, subtitle, memberName, alreadyLogged,
}: {
  type: 'event_instance' | 'training_event' | 'incident'
  id: string
  personnelId: string
  title: string
  subtitle: string
  memberName: string
  alreadyLogged: boolean
}) {
  const [role, setRole] = useState('crew')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(alreadyLogged)
  const [error, setError] = useState<string | null>(null)

  async function handleCheckIn() {
    setLoading(true)
    setError(null)
    const result = type === 'event_instance' ? await logAttendance(id, [personnelId])
      : type === 'training_event' ? await selfReportTrainingAttendance(id)
      : await logIncidentAttendance(id, role)
    setLoading(false)
    if (result?.error) setError(result.error)
    else setDone(true)
  }

  return (
    <div className="max-w-md mx-auto mt-10 sm:mt-20 px-4">
      <div className="rounded-xl bg-white border border-zinc-200 shadow-sm p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">Check In</p>
        <h1 className="text-lg font-bold text-zinc-900">{title}</h1>
        {subtitle && <p className="text-sm text-zinc-500 mt-1">{subtitle}</p>}

        <div className="mt-6 rounded-lg bg-zinc-50 px-4 py-3">
          <p className="text-xs text-zinc-500">Checking in as</p>
          <p className="text-sm font-semibold text-zinc-900">{memberName}</p>
        </div>

        {type === 'incident' && !done && (
          <div className="mt-4 text-left">
            <label className="mb-1 block text-xs font-medium text-zinc-600">Your Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              {INCIDENT_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>
        )}

        {done ? (
          <div className="mt-6 rounded-lg bg-green-50 border border-green-200 px-4 py-4">
            <p className="text-sm font-semibold text-green-700">✓ You're checked in</p>
          </div>
        ) : (
          <button
            onClick={handleCheckIn}
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-red-700 px-4 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Checking in…' : 'Check In'}
          </button>
        )}
      </div>
    </div>
  )
}
