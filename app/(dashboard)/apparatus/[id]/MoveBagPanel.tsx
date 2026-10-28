'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { moveBag } from '@/app/actions/medical'

const selectCls = 'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500'

type Kind = 'compartment' | 'bag' | 'storeroom' | 'member'
type Opt = { id: string; name: string }

// Move a bag (and anything nested in it). Both questions must be answered before it will go.
export default function MoveBagPanel({
  bag, compartments, bags, storerooms, members,
}: {
  bag: { id: string; name: string }
  compartments: Opt[]
  bags: Opt[]
  storerooms: Opt[]
  members: Opt[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<Kind>('compartment')
  const [destId, setDestId] = useState('')
  const [meds, setMeds] = useState<'with' | 'left' | null>(null)
  const [medsDest, setMedsDest] = useState('')
  const [assets, setAssets] = useState<'with' | 'left' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const options = kind === 'compartment' ? compartments : kind === 'bag' ? bags.filter(b => b.id !== bag.id) : kind === 'storeroom' ? storerooms : members
  const ready = destId && meds && assets && (meds === 'with' || medsDest)

  async function submit() {
    if (!ready) return
    setBusy(true); setError(null)
    const r = await moveBag({
      bag_id: bag.id, destination: { kind, id: destId },
      medsMovedWithBag: meds === 'with', medsDestinationStoreroomId: meds === 'left' ? medsDest : null,
      assetsMovedWithBag: assets === 'with',
    })
    setBusy(false)
    if (r?.error) { setError(r.error); return }
    setOpen(false); setDestId(''); setMeds(null); setAssets(null); setMedsDest('')
    router.refresh()
  }

  const choice = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-semibold border ${active ? 'bg-red-700 text-white border-red-700' : 'bg-white text-zinc-600 border-zinc-200 hover:border-red-300'}`

  if (!open) {
    return <button onClick={() => setOpen(true)} className="text-xs font-semibold text-blue-600 hover:underline">Move this bag</button>
  }

  return (
    <div className="mt-2 rounded-lg bg-white border border-zinc-200 p-4 flex flex-col gap-3">
      <p className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Move {bag.name}</p>
      <div className="flex flex-wrap gap-2">
        {([['compartment', 'Compartment'], ['bag', 'Inside a bag'], ['storeroom', 'Storeroom'], ['member', 'Member (POV)']] as [Kind, string][]).map(([k, label]) => (
          <button key={k} onClick={() => { setKind(k); setDestId('') }} className={choice(kind === k)}>{label}</button>
        ))}
      </div>
      <select value={destId} onChange={e => setDestId(e.target.value)} className={selectCls}>
        <option value="">{options.length === 0 ? 'None available' : 'Move to...'}</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>

      <div>
        <p className="text-xs font-medium text-zinc-700 mb-1.5">Do the medications move with the bag?</p>
        <div className="flex gap-2">
          <button onClick={() => setMeds('with')} className={choice(meds === 'with')}>Yes, move with it</button>
          <button onClick={() => setMeds('left')} className={choice(meds === 'left')}>No, just the bag</button>
        </div>
        {meds === 'left' && (
          <select value={medsDest} onChange={e => setMedsDest(e.target.value)} className={`${selectCls} mt-2`}>
            <option value="">Transfer the medications to...</option>
            {storerooms.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-zinc-700 mb-1.5">Does the tracked equipment move with the bag?</p>
        <div className="flex gap-2">
          <button onClick={() => setAssets('with')} className={choice(assets === 'with')}>Yes, move with it</button>
          <button onClick={() => setAssets('left')} className={choice(assets === 'left')}>No, just the bag</button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>}
      <div className="flex gap-3">
        <button disabled={!ready || busy} onClick={submit}
          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
          {busy ? 'Moving…' : 'Move Bag'}
        </button>
        <button onClick={() => setOpen(false)} className="text-sm text-zinc-500 hover:text-zinc-700">Cancel</button>
      </div>
    </div>
  )
}
