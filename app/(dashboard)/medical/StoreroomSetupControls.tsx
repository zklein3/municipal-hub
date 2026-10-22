'use client'

// Admin controls that used to live only in Setup → Medical → Storerooms, now right on the storeroom
// screen ("fix it where you see it"): stock medications here (one, or all at once), and create a new
// storeroom. Receiving stock (lot #, expiration) stays on each medication's Receive button.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { assignSupplyToStoreroom, createMedicalStoreroom, updateMedicalStoreroom } from '@/app/actions/medical'

const inputCls = 'rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500'

export function StockMedicationsPanel({
  storeroomId, stockedTypeIds, catalogTypes, emphasize,
}: {
  storeroomId: string
  stockedTypeIds: Set<string>
  catalogTypes: { id: string; name: string; unit_of_measure: string }[]
  emphasize?: boolean
}) {
  const router = useRouter()
  const [typeId, setTypeId] = useState('')
  const [par, setPar] = useState('1')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const available = catalogTypes.filter(t => !stockedTypeIds.has(t.id))

  async function stock(ids: { id: string; par: number }[]) {
    setBusy(true); setError(null)
    for (const { id, par } of ids) {
      const fd = new FormData()
      fd.set('storeroom_id', storeroomId)
      fd.set('supply_type_id', id)
      fd.set('par_level', String(par))
      const r = await assignSupplyToStoreroom(fd)
      if (r?.error) { setError(r.error); break }
    }
    setBusy(false)
    setTypeId(''); setPar('1')
    router.refresh()
  }

  if (catalogTypes.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Your department has no medication types yet. <a href="/medical?mode=types" className="text-red-600 font-semibold hover:underline">Add medication types →</a>
      </p>
    )
  }
  if (available.length === 0) return null

  return (
    <div className={`rounded-xl border px-4 py-3 ${emphasize ? 'border-red-200 bg-red-50/40' : 'border-zinc-200 bg-white'}`}>
      <p className="text-sm font-semibold text-zinc-900 mb-0.5">Stock medications here</p>
      <p className="text-xs text-zinc-500 mb-2">
        Pick from your department&apos;s medications and set how many this storeroom should keep (PAR). Then use
        Receive on each one to count stock in with its lot and expiration.
      </p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="flex flex-col sm:flex-row gap-2">
        <select value={typeId} onChange={e => setTypeId(e.target.value)} className={`${inputCls} flex-1`}>
          <option value="">Choose a medication…</option>
          {available.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input type="number" min="0" value={par} onChange={e => setPar(e.target.value)} className={`${inputCls} sm:w-24`} aria-label="PAR" placeholder="PAR" />
        <button disabled={busy || !typeId} onClick={() => stock([{ id: typeId, par: parseInt(par) || 0 }])}
          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
          {busy ? 'Adding…' : 'Add'}
        </button>
      </div>
      {available.length > 1 && (
        <button disabled={busy} onClick={() => stock(available.map(t => ({ id: t.id, par: 0 })))}
          className="mt-2 text-xs font-semibold text-zinc-600 underline hover:text-zinc-900 disabled:opacity-50">
          Add all {available.length} remaining medications (PAR 0 — adjust after)
        </button>
      )}
    </div>
  )
}

export function NewStoreroomForm({
  stations, onDone,
}: {
  stations: { id: string; station_name: string; station_number: string | null }[]
  onDone?: () => void
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handle(fd: FormData) {
    setBusy(true); setError(null)
    const r = await createMedicalStoreroom(fd)
    setBusy(false)
    if (r?.error) { setError(r.error); return }
    router.refresh()
    onDone?.()
  }

  return (
    <form action={handle} className="rounded-xl border border-zinc-200 bg-white px-4 py-3 flex flex-col gap-2">
      <p className="text-sm font-semibold text-zinc-900">New storeroom</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex flex-col sm:flex-row gap-2">
        <input name="name" required placeholder="e.g. Station 1 Med Vault" className={`${inputCls} flex-1`} />
        <select name="station_id" className={`${inputCls} sm:w-56`} defaultValue="">
          <option value="">No station</option>
          {stations.map(s => <option key={s.id} value={s.id}>{s.station_number ? `Station ${s.station_number} — ` : ''}{s.station_name}</option>)}
        </select>
        <button type="submit" disabled={busy} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
          {busy ? 'Creating…' : 'Create'}
        </button>
      </div>
    </form>
  )
}

export function EditStoreroomForm({
  storeroom, stations, onDone,
}: {
  storeroom: { id: string; name: string; station_id: string | null }
  stations: { id: string; station_name: string; station_number: string | null }[]
  onDone: () => void
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState(true)

  async function handle(fd: FormData) {
    setBusy(true); setError(null)
    fd.set('id', storeroom.id)
    fd.set('active', active ? 'true' : 'false')
    const r = await updateMedicalStoreroom(fd)
    setBusy(false)
    if (r?.error) { setError(r.error); return }
    router.refresh()
    onDone()
  }

  return (
    <form action={handle} className="rounded-xl border border-zinc-200 bg-white px-4 py-3 flex flex-col gap-2">
      <p className="text-sm font-semibold text-zinc-900">Edit storeroom</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex flex-col sm:flex-row gap-2">
        <input name="name" required defaultValue={storeroom.name} className={`${inputCls} flex-1`} />
        <select name="station_id" className={`${inputCls} sm:w-56`} defaultValue={storeroom.station_id ?? ''}>
          <option value="">No station</option>
          {stations.map(s => <option key={s.id} value={s.id}>{s.station_number ? `Station ${s.station_number} — ` : ''}{s.station_name}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="rounded border-zinc-300 text-red-600 focus:ring-red-500" />
        Active {!active && <span className="text-xs text-zinc-500">(hides it from this page and from transfers)</span>}
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50">Cancel</button>
      </div>
    </form>
  )
}
