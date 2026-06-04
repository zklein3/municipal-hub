'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fulfillReorderRequest, dismissReorderRequest } from '@/app/actions/medical'

export interface RestockRequest {
  id: string
  supply_name: string
  storeroom_name: string
  requested_by_name: string | null
  notes: string | null
  created_at: string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function RestockTab({ requests }: { requests: RestockRequest[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFulfill(id: string) {
    setLoading(id); setError(null)
    const r = await fulfillReorderRequest(id)
    if (r?.error) setError(r.error)
    else router.refresh()
    setLoading(null)
  }

  async function handleDismiss(id: string) {
    setLoading(id + '_dismiss'); setError(null)
    const r = await dismissReorderRequest(id)
    if (r?.error) setError(r.error)
    else router.refresh()
    setLoading(null)
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-xl bg-white border border-zinc-200 px-6 py-12 text-center text-sm text-zinc-400">
        No pending restock requests.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      {requests.map(req => (
        <div key={req.id} className="rounded-xl bg-white border border-zinc-200 shadow-sm p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-900">{req.supply_name}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{req.storeroom_name}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-zinc-400">
                {req.requested_by_name && <span>Requested by {req.requested_by_name}</span>}
                <span>{fmtDate(req.created_at)}</span>
                {req.notes && <span className="italic text-zinc-500">{req.notes}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a href="/medical" className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
                onClick={() => handleFulfill(req.id)}>
                Fulfill →
              </a>
              <button onClick={() => handleDismiss(req.id)}
                disabled={loading === req.id + '_dismiss'}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-50 disabled:opacity-50">
                {loading === req.id + '_dismiss' ? '...' : 'Dismiss'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
