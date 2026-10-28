'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deployBagToPlace } from '@/app/actions/medical'

const selectCls = 'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500'

type Kind = 'storeroom' | 'bag' | 'member'

// Deploys a bag from a template somewhere that isn't a truck compartment: a station storeroom,
// inside another bag, or assigned to a member (POV bag).
export default function PlaceBagForm({
  templateId, templateName, storerooms, bags, members, placed,
}: {
  placed: { id: string; name: string; where: string }[]
  templateId: string
  templateName: string
  storerooms: { id: string; name: string }[]
  bags: { id: string; name: string }[]
  members: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<Kind>('storeroom')
  const [destId, setDestId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const options = kind === 'storeroom' ? storerooms : kind === 'bag' ? bags : members

  async function submit() {
    if (!destId) return
    setBusy(true); setError(null); setDone(false)
    const r = await deployBagToPlace({
      template_id: templateId, name: templateName, inventory_mode: 'standard',
      destination: { kind, id: destId },
    })
    setBusy(false)
    if (r?.error) { setError(r.error); return }
    setDone(true); setOpen(false); setDestId('')
    router.refresh()
  }

  return (
    <div className="mt-4 border-t border-zinc-100 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Place Somewhere Else</p>
        <button onClick={() => { setOpen(v => !v); setDone(false) }} className="text-xs font-semibold text-red-600 hover:text-red-800">
          {open ? 'Cancel' : '+ Place Bag'}
        </button>
      </div>
      {done && <p className="mt-2 text-xs text-green-700">Bag created — it is listed below.</p>}
      {error && <p className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>}
      {placed.length > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          {placed.map(p => (
            <div key={p.id} className="flex items-center justify-between bg-zinc-50 rounded-lg border border-zinc-200 px-4 py-2.5 gap-3">
              <p className="text-sm font-medium text-zinc-900">{p.name}</p>
              <p className="text-xs text-zinc-500">{p.where}</p>
            </div>
          ))}
        </div>
      )}
      {open && (
        <div className="mt-3 rounded-lg bg-zinc-50 border border-zinc-200 p-4 flex flex-col gap-3">
          <div className="flex gap-2">
            {([['storeroom', 'Storeroom'], ['bag', 'Inside a bag'], ['member', 'Member (POV)']] as [Kind, string][]).map(([k, label]) => (
              <button key={k} onClick={() => { setKind(k); setDestId('') }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold border ${kind === k ? 'bg-red-700 text-white border-red-700' : 'bg-white text-zinc-600 border-zinc-200 hover:border-red-300'}`}>
                {label}
              </button>
            ))}
          </div>
          <select value={destId} onChange={e => setDestId(e.target.value)} className={selectCls}>
            <option value="">{options.length === 0 ? 'None available' : 'Select...'}</option>
            {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button disabled={busy || !destId} onClick={submit}
            className="self-start rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
            {busy ? 'Creating…' : 'Create Bag Here'}
          </button>
        </div>
      )}
    </div>
  )
}
