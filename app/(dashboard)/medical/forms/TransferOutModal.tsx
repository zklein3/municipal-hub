'use client'

import { useState } from 'react'
import { transferStock } from '@/app/actions/medical'
import ModalShell, { ControlledBadge } from './ModalShell'
import { fmtDate, inputCls, type Lot, type SupplyType } from './types'

// Send stock from a truck compartment / bag row back to a station storeroom that carries the supply.
export default function TransferOutModal({
  srcInventoryId, supply, lots, srcInventory, deptStorerooms, onClose, onDone,
}: {
  srcInventoryId: string
  supply: SupplyType
  lots: Lot[]                                   // this row's lots
  srcInventory: { id: string; storeroom_id: string; supply_type_id: string }[]   // storeroom inventory (to find destinations)
  deptStorerooms: { id: string; name: string }[]
  onClose: () => void
  onDone: (message: string) => void
}) {
  const activeLots = lots.filter(l => l.quantity_remaining > 0).sort((a, b) => a.received_date.localeCompare(b.received_date))
  const validDests = deptStorerooms.filter(s => srcInventory.some(i => i.storeroom_id === s.id && i.supply_type_id === supply.id))

  const [lotId, setLotId] = useState(activeLots[0]?.id ?? '')
  const [destId, setDestId] = useState(validDests[0]?.id ?? '')
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const lot = activeLots.find(l => l.id === lotId)

  async function submit() {
    const qty = parseInt(quantity)
    if (!qty || qty < 1) { setError('Quantity must be at least 1.'); return }
    if (!lot || qty > lot.quantity_remaining) { setError(`Only ${lot?.quantity_remaining ?? 0} available in this lot.`); return }
    if (!destId) { setError('Select a destination storeroom.'); return }
    setError(null); setLoading(true)
    const r = await transferStock({
      source_inventory_id: srcInventoryId, lot_id: lot.id, destination_storeroom_id: destId, quantity: qty, notes: notes || null,
    })
    setLoading(false)
    if (r?.error) setError(r.error)
    else onDone(`Transferred ${qty} ${supply.unit_of_measure} of ${supply.name} to storeroom.`)
  }

  const blocker = activeLots.length === 0
    ? 'No stock available to transfer.'
    : validDests.length === 0 ? 'No storeroom has this supply type assigned — transfer cannot be completed.' : null

  return (
    <ModalShell title="Transfer to Storeroom" subtitle={<>{supply.name}{supply.is_controlled && <ControlledBadge />}</>}
      error={error ?? blocker} loading={loading} confirmLabel="Confirm Transfer" confirmDisabled={!destId || !lot}
      confirmClass="bg-zinc-800 hover:bg-zinc-900" onConfirm={submit} onCancel={onClose}>
      {activeLots.length > 1 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700">Source Lot</label>
          <select value={lotId} onChange={e => setLotId(e.target.value)} className={inputCls}>
            {activeLots.map(l => (
              <option key={l.id} value={l.id}>
                {l.lot_number ? `Lot ${l.lot_number}` : 'No lot #'} · {l.quantity_remaining} available{l.expiration_date ? ` · Exp ${fmtDate(l.expiration_date)}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Destination Storeroom <span className="text-red-500">*</span></label>
        <select value={destId} onChange={e => setDestId(e.target.value)} className={inputCls}>
          <option value="">Select storeroom…</option>
          {validDests.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">
          Quantity <span className="text-red-500">*</span>
          {lot && <span className="ml-1 text-zinc-400 font-normal">({lot.quantity_remaining} available)</span>}
        </label>
        <input type="number" min="1" max={lot?.quantity_remaining} value={quantity} onChange={e => setQuantity(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Notes</label>
        <input type="text" value={notes} placeholder="Optional" onChange={e => setNotes(e.target.value)} className={inputCls} />
      </div>
    </ModalShell>
  )
}
