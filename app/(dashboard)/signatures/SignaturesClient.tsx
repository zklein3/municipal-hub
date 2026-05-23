'use client'

import { useState } from 'react'
import IncidentSignaturePadModal from './IncidentSignaturePadModal'

interface PendingRow {
  sig_id: string
  incident_id: string
  created_at: string
  incident: {
    id: string
    incident_number: string
    incident_date: string
    incident_type: string | null
    address: string | null
    city: string | null
    state: string | null
  } | null
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function SignaturesClient({
  rows,
  memberName,
}: {
  rows: PendingRow[]
  memberName: string
}) {
  const [pending, setPending] = useState<PendingRow[]>(rows)
  const [activeSig, setActiveSig] = useState<PendingRow | null>(null)

  function handleSigned(sig_id: string) {
    setPending(prev => prev.filter(r => r.sig_id !== sig_id))
    setActiveSig(null)
  }

  if (pending.length === 0) {
    return (
      <div className="rounded-xl bg-white border border-zinc-200 px-6 py-12 text-center">
        <p className="text-2xl mb-2">✓</p>
        <p className="text-sm font-semibold text-zinc-700">All caught up</p>
        <p className="text-xs text-zinc-400 mt-1">No pending signatures — you&apos;re all set.</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {pending.map(row => {
          const inc = row.incident
          const location = [inc?.address, inc?.city, inc?.state].filter(Boolean).join(', ')
          return (
            <div key={row.sig_id} className="rounded-xl bg-white border border-zinc-200 p-5 flex items-center gap-4">
              {/* Date block */}
              {inc?.incident_date && (
                <div className="shrink-0 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-center min-w-[52px]">
                  <p className="text-xs font-semibold text-red-500 uppercase">
                    {new Date(inc.incident_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                  </p>
                  <p className="text-2xl font-bold text-red-800 leading-none">
                    {new Date(inc.incident_date + 'T00:00:00').getDate()}
                  </p>
                </div>
              )}
              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-zinc-900 text-sm">
                  {inc?.incident_number ?? '—'}
                  {inc?.incident_type && (
                    <span className="ml-2 text-xs font-normal text-zinc-400">{inc.incident_type}</span>
                  )}
                </p>
                {inc?.incident_date && (
                  <p className="text-xs text-zinc-500 mt-0.5">{formatDate(inc.incident_date)}</p>
                )}
                {location && (
                  <p className="text-xs text-zinc-400 mt-0.5 truncate">{location}</p>
                )}
              </div>
              {/* Sign button */}
              <button
                onClick={() => setActiveSig(row)}
                className="shrink-0 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition-colors"
              >
                Sign
              </button>
            </div>
          )
        })}
      </div>

      {activeSig && (
        <IncidentSignaturePadModal
          sig_id={activeSig.sig_id}
          memberName={memberName}
          incidentLabel={
            activeSig.incident
              ? `${activeSig.incident.incident_number}${activeSig.incident.incident_date ? ' — ' + formatDate(activeSig.incident.incident_date) : ''}`
              : 'Incident'
          }
          onClose={() => setActiveSig(null)}
          onSigned={() => handleSigned(activeSig.sig_id)}
        />
      )}
    </>
  )
}
