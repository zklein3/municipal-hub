'use client'

// Restock a truck from storage in one pass: everything on the truck (compartments and bags) with what
// it needs to reach PAR, what the chosen storeroom has, and a quantity to move. Reached from the
// truck's inventory page ("Restock from storage").

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { restockFromStoreroom } from '@/app/actions/restock'

export type RestockLine = {
  destination_storeroom_id: string
  location: string
  supply_type_id: string
  supply_name: string
  unit: string
  is_controlled: boolean
  on_hand: number
  par: number
}

export default function RestockClient({
  apparatus, lines, storerooms, availability, canMoveControlled, scopeLabel = null,
}: {
  scopeLabel?: string | null
  apparatus: { id: string; unit_number: string; apparatus_name: string | null }
  lines: RestockLine[]
  storerooms: { id: string; name: string }[]
  // storeroom id → supply type id → quantity on hand there
  availability: Record<string, Record<string, number>>
  canMoveControlled: boolean
}) {
  const router = useRouter()
  // Default to the storeroom that can cover the most of what this truck needs.
  const defaultRoom = useMemo(() => {
    let best = storerooms[0]?.id ?? ''
    let bestScore = -1
    for (const s of storerooms) {
      const score = lines.reduce((n, l) => n + Math.min(Math.max(l.par - l.on_hand, 0), availability[s.id]?.[l.supply_type_id] ?? 0), 0)
      if (score > bestScore) { best = s.id; bestScore = score }
    }
    return best
  }, [storerooms, lines, availability])

  const [roomId, setRoomId] = useState(defaultRoom)
  const [qty, setQty] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const key = (l: RestockLine) => `${l.destination_storeroom_id}:${l.supply_type_id}`
  const available = (l: RestockLine) => availability[roomId]?.[l.supply_type_id] ?? 0
  const need = (l: RestockLine) => Math.max(l.par - l.on_hand, 0)
  const defaultQty = (l: RestockLine) => Math.min(need(l), available(l))
  const qtyFor = (l: RestockLine) => qty[key(l)] ?? String(defaultQty(l))
  const blocked = (l: RestockLine) => l.is_controlled && !canMoveControlled

  const sorted = [...lines].sort((a, b) => (need(b) > 0 ? 1 : 0) - (need(a) > 0 ? 1 : 0) || a.location.localeCompare(b.location) || a.supply_name.localeCompare(b.supply_name))
  const toMove = sorted.filter(l => !blocked(l) && (parseInt(qtyFor(l)) || 0) > 0)

  async function submit() {
    setBusy(true); setError(null); setResult(null)
    const r = await restockFromStoreroom(roomId, toMove.map(l => ({
      destination_storeroom_id: l.destination_storeroom_id, supply_type_id: l.supply_type_id, quantity: parseInt(qtyFor(l)) || 0,
    })), apparatus.id)
    setBusy(false)
    if (r.error) { setError(r.error); return }
    const res = r.results ?? []
    const ok = res.filter(x => x.moved > 0).reduce((n, x) => n + x.moved, 0)
    const failed = res.filter(x => x.error)
    setResult(`Moved ${ok} item${ok === 1 ? '' : 's'} onto ${apparatus.unit_number}.` + (failed.length ? ` ${failed.length} line${failed.length === 1 ? '' : 's'} not fully moved: ${failed.map(f => f.error).join(' ')}` : ''))
    setQty({})
    router.refresh()
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-5">
        <Link href={`/equipment/${apparatus.id}`} className="text-xs text-zinc-400 hover:text-zinc-600 mb-2 inline-block">← Unit {apparatus.unit_number}</Link>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">
          Restock {scopeLabel ?? `${apparatus.unit_number}${apparatus.apparatus_name ? ` — ${apparatus.apparatus_name}` : ''}`}
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Pick the storeroom, check the quantities, and move everything at once.
          {scopeLabel && <> <Link href={`/medical?mode=restock&apparatus=${apparatus.id}`} className="text-red-600 hover:underline">Whole truck instead →</Link></>}
        </p>
      </div>

      {result && <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 border border-green-200">{result} <Link href={`/equipment/${apparatus.id}`} className="font-semibold underline">Back to the truck</Link></div>}
      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}

      {storerooms.length === 0 ? (
        <div className="rounded-xl bg-white border border-zinc-200 px-6 py-10 text-center text-sm text-zinc-400">No storerooms to restock from.</div>
      ) : lines.length === 0 ? (
        <div className="rounded-xl bg-white border border-zinc-200 px-6 py-10 text-center text-sm text-zinc-400">Nothing medical is stocked on this truck yet.</div>
      ) : (<>
        <div className="flex items-center gap-2 mb-4">
          <label className="text-sm text-zinc-600">From</label>
          <select value={roomId} onChange={e => { setRoomId(e.target.value); setQty({}) }}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
            {storerooms.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="rounded-xl bg-white border border-zinc-200 divide-y divide-zinc-100">
          {sorted.map(l => {
            const n = need(l)
            const a = available(l)
            return (
              <div key={key(l)} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${n === 0 ? 'opacity-60' : ''}`}>
                <div className="flex-1 min-w-[12rem]">
                  <p className="text-sm font-semibold text-zinc-900">{l.supply_name}</p>
                  <p className="text-xs text-zinc-400">
                    {l.location} · {l.on_hand} on hand · PAR {l.par}
                    {n > 0 ? <span className="text-amber-700 font-semibold"> · needs {n}</span> : ' · at PAR'}
                  </p>
                </div>
                <p className={`text-xs ${a === 0 ? 'text-red-500' : 'text-zinc-500'}`}>{a} in storeroom</p>
                {blocked(l) ? (
                  <span className="text-xs text-amber-700">Controlled — officer</span>
                ) : (
                  <label className="flex items-center gap-1 text-xs text-zinc-500">Move
                    <input type="number" min="0" max={a} value={qtyFor(l)} disabled={a === 0}
                      onChange={e => setQty(q => ({ ...q, [key(l)]: e.target.value }))}
                      className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm disabled:bg-zinc-50" />
                    {l.unit}
                  </label>
                )}
              </div>
            )
          })}
        </div>

        <button disabled={busy || toMove.length === 0} onClick={submit}
          className="mt-4 w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
          {busy ? 'Moving…' : toMove.length === 0 ? 'Nothing to move' : `Move ${toMove.reduce((n, l) => n + (parseInt(qtyFor(l)) || 0), 0)} onto ${apparatus.unit_number}`}
        </button>
      </>)}
    </div>
  )
}
