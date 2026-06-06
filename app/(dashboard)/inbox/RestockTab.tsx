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

export interface ExpiredLot {
  supply_name: string
  storeroom_name: string
  quantity_remaining: number
  expiration_date: string
  lot_number: string | null
  go_to_href: string
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function RestockTab({
  requests,
  expiredLots,
}: {
  requests: RestockRequest[]
  expiredLots: ExpiredLot[]
}) {
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

  if (requests.length === 0 && expiredLots.length === 0) {
    return (
      <div className="rounded-xl bg-white border border-zinc-200 px-6 py-12 text-center text-sm text-zinc-400">
        No pending restock requests.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Expired lots requiring action */}
      {expiredLots.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-zinc-900">Expired Stock</h3>
            <span className="rounded-full bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5">{expiredLots.length} lot{expiredLots.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="rounded-xl bg-red-50 border border-red-200 overflow-hidden divide-y divide-red-100">
            {expiredLots.map((lot, i) => (
              <div key={i} className="flex items-center px-4 py-3 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">{lot.supply_name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {lot.storeroom_name}{lot.lot_number ? ` · Lot ${lot.lot_number}` : ''}
                  </p>
                  <p className="text-xs text-red-600 font-medium mt-0.5">
                    Expired {fmtDate(lot.expiration_date)} · {lot.quantity_remaining} remaining
                  </p>
                </div>
                <a href={lot.go_to_href}
                  className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
                  Go to →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending restock requests */}
      {requests.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 mb-3">Restock Requests</h3>
          <div className="flex flex-col gap-3">
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
        </div>
      )}
    </div>
  )
}
