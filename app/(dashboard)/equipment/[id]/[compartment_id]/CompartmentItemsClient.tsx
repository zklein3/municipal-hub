'use client'

import { useState } from 'react'
import { moveItemToCompartment, removeItemFromCompartment } from '@/app/actions/equipment'

interface CompartmentItem {
  id: string
  item_id: string
  item_name: string
  category_name: string
  tracks_assets: boolean
  requires_inspection: boolean
  expected_quantity: number
  assets: { id: string; asset_tag: string | null; status: string }[]
}

interface ApparatusOption {
  id: string
  unit_number: string
  apparatus_name: string | null
  compartments: {
    id: string
    compartment_code: string
    compartment_name: string | null
  }[]
}

function assetStatusBadge(status: string) {
  const s = status?.toUpperCase()
  if (s === 'IN SERVICE') return 'bg-green-100 text-green-700'
  if (s === 'OUT OF SERVICE') return 'bg-yellow-100 text-yellow-700'
  return 'bg-zinc-100 text-zinc-500'
}

export default function CompartmentItemsClient({
  items: initialItems,
  allApparatus,
  currentCompartmentId,
}: {
  items: CompartmentItem[]
  allApparatus: ApparatusOption[]
  currentCompartmentId: string
}) {
  const [items, setItems] = useState(initialItems)
  const [moveItem, setMoveItem] = useState<CompartmentItem | null>(null)
  const [moveApparatusId, setMoveApparatusId] = useState('')
  const [moveCompartmentId, setMoveCompartmentId] = useState('')
  const [moveLoading, setMoveLoading] = useState(false)
  const [moveError, setMoveError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removeLoading, setRemoveLoading] = useState(false)

  const moveApparatus = allApparatus.find(a => a.id === moveApparatusId)
  const availableCompartments = (moveApparatus?.compartments ?? []).filter(
    c => c.id !== currentCompartmentId
  )

  async function handleMove() {
    if (!moveItem || !moveCompartmentId) return
    setMoveLoading(true)
    setMoveError(null)
    const result = await moveItemToCompartment(moveItem.id, moveCompartmentId)
    if (result?.error) {
      setMoveError(result.error)
    } else {
      setItems(prev => prev.filter(i => i.id !== moveItem.id))
      setMoveItem(null)
      setMoveApparatusId('')
      setMoveCompartmentId('')
    }
    setMoveLoading(false)
  }

  async function handleRemove(id: string) {
    setRemoveLoading(true)
    const result = await removeItemFromCompartment(id)
    if (!result?.error) {
      setItems(prev => prev.filter(i => i.id !== id))
    }
    setRemovingId(null)
    setRemoveLoading(false)
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl bg-white border border-zinc-200 px-6 py-10 text-center text-sm text-zinc-400">
        No items assigned to this compartment.
      </div>
    )
  }

  return (
    <>
      <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden divide-y divide-zinc-100">
        {items.map(item => (
          <div key={item.id} className="px-4 py-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="font-medium text-zinc-900">{item.item_name}</p>
                {item.category_name && (
                  <p className="text-xs text-zinc-400">{item.category_name}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-semibold text-zinc-700">×{item.expected_quantity}</span>
                {removingId === item.id ? (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleRemove(item.id)}
                      disabled={removeLoading}
                      className="rounded px-2 py-1 text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setRemovingId(null)}
                      className="rounded px-2 py-1 text-xs font-semibold border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => { setMoveItem(item); setMoveApparatusId(''); setMoveCompartmentId('') }}
                      className="rounded px-2.5 py-1 text-xs font-semibold border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
                    >
                      Move
                    </button>
                    <button
                      onClick={() => setRemovingId(item.id)}
                      className="rounded px-2.5 py-1 text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>

            {item.tracks_assets && item.assets.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {item.assets.map(a => (
                  <span
                    key={a.id}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${assetStatusBadge(a.status)}`}
                  >
                    {a.asset_tag ?? 'Unknown'}
                  </span>
                ))}
              </div>
            )}
            {item.tracks_assets && item.assets.length === 0 && (
              <p className="text-xs text-zinc-400 italic mt-1">No assets assigned</p>
            )}
            {item.requires_inspection && (
              <div className="mt-1.5">
                <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs text-blue-700">
                  Inspectable
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Move modal */}
      {moveItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl p-6">
            <h2 className="text-base font-semibold text-zinc-900 mb-1">Move Item</h2>
            <p className="text-sm text-zinc-500 mb-4">{moveItem.item_name}</p>

            {moveError && (
              <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {moveError}
              </div>
            )}

            <div className="flex flex-col gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Apparatus</label>
                <select
                  value={moveApparatusId}
                  onChange={e => { setMoveApparatusId(e.target.value); setMoveCompartmentId('') }}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  <option value="">Select apparatus...</option>
                  {allApparatus.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.unit_number}{a.apparatus_name ? ` — ${a.apparatus_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Compartment</label>
                <select
                  value={moveCompartmentId}
                  onChange={e => setMoveCompartmentId(e.target.value)}
                  disabled={!moveApparatusId}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50"
                >
                  <option value="">Select compartment...</option>
                  {availableCompartments.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.compartment_code}{c.compartment_name ? ` — ${c.compartment_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleMove}
                disabled={moveLoading || !moveCompartmentId}
                className="flex-1 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
              >
                {moveLoading ? 'Moving...' : 'Move Item'}
              </button>
              <button
                onClick={() => setMoveItem(null)}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
