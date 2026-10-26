'use client'

import { useEffect, useState } from 'react'
import { fetchCompartmentHistory, type CompartmentHistory } from '@/app/actions/compartments'

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

export default function CompartmentHistoryPanel({ compartmentId }: { compartmentId: string }) {
  const [data, setData] = useState<CompartmentHistory | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    fetchCompartmentHistory(compartmentId).then(r => {
      if (!live) return
      if ('error' in r) setError(r.error)
      else setData(r)
    })
    return () => { live = false }
  }, [compartmentId])

  if (error) return <p className="px-5 py-3 text-xs text-red-600">{error}</p>
  if (!data) return <p className="px-5 py-3 text-xs text-zinc-400">Loading history…</p>
  if (data.inspections.length === 0 && data.presence.length === 0) {
    return <p className="px-5 py-3 text-xs text-zinc-400">No inspections recorded for this compartment yet.</p>
  }

  return (
    <div className="px-5 py-3 border-b border-zinc-200 bg-zinc-50/50 space-y-4">
      {data.inspections.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-zinc-500 mb-2">Full Inspections</p>
          <div className="space-y-2">
            {data.inspections.map(log => (
              <div key={log.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${log.overall_result === 'PASS' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {log.overall_result}
                  </span>
                  <span className="text-zinc-700 truncate font-medium">{log.asset_tag}</span>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-zinc-500">{log.inspected_by_name ?? '—'}</p>
                  <p className="text-xs text-zinc-400">{fmt(log.inspected_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.presence.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-zinc-500 mb-2">Presence Checks</p>
          <div className="space-y-2">
            {data.presence.map(log => (
              <div key={log.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${log.present ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {log.present ? 'Present' : 'Missing'}
                  </span>
                  <span className="text-zinc-700 truncate">{log.item_name}</span>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-zinc-500">{log.inspected_by_name ?? '—'}</p>
                  <p className="text-xs text-zinc-400">{fmt(log.inspected_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
