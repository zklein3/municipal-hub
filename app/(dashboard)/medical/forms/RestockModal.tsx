'use client'

import { useState } from 'react'
import { transferStock } from '@/app/actions/medical'
import ModalShell, { ControlledBadge } from './ModalShell'
import { fmtDate, inputCls, type SrcLot, type SupplyType } from './types'

// Pull stock from a station storeroom into a truck compartment / bag row.
export default function RestockModal({
  destInventoryId, destStoreroomId, supply, srcInventory, srcLots, deptStorerooms, onClose, onDone,
}: {
  destInventoryId: string          // kept for symmetry with the other forms; the transfer targets the storeroom
  destStoreroomId: string
  supply: SupplyType
  srcInventory: { id: string; storeroom_id: string; supply_type_id: string }[]
  srcLots: SrcLot[]
  deptStorerooms: { id: string; name: string }[]
  onClose: () => void
  onDone: (message: string) => void
}) {
  const srcInvWithLots = srcInventory.filter(i =>
    i.supply_type_id === supply.id && srcLots.some(l => l.storeroom_inventory_id === i.id && l.quantity_remaining > 0))
  const firstInvId = srcInvWithLots[0]?.id ?? ''
  const firstLotId = srcLots.find(l => l.storeroom_inventory_id === firstInvId && l.quantity_remaining > 0)?.id ?? ''

  const [srcInvId, setSrcInvId] = useState(firstInvId)
  const [srcLotId, setSrcLotId] = useState(firstLotId)
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const lotsForSrc = srcLots.filter(l => l.storeroom_inventory_id === srcInvId && l.quantity_remaining > 0)
  const selectedLot = srcLots.find(l => l.id === srcLotId)

  function changeSource(id: string) {
    setSrcInvId(id)
    setSrcLotId(srcLots.find(l => l.storeroom_inventory_id === id && l.quantity_remaining > 0)?.id ?? '')
  }

  async function submit() {
    const qty = parseInt(quantity)
    if (!qty || qty < 1) { setError('Quantity must be at least 1.'); return }
    if (selectedLot && qty > selectedLot.quantity_remaining) { setError(`Only ${selectedLot.quantity_remaining} available in this lot.`); return }
    setError(null); setLoading(true)
    const r = await transferStock({
      source_inventory_id: srcInvId, lot_id: srcLotId, destination_storeroom_id: destStoreroomId, quantity: qty, notes: notes || null,
    })
    setLoading(false)
    if (r?.error) setError(r.error)
    else onDone(`Restocked ${qty} ${supply.unit_of_measure} of ${supply.name} from storeroom.`)
  }

  return (
    <ModalShell title="Restock from Storeroom" subtitle={<>{supply.name}{supply.is_controlled && <ControlledBadge />}</>}
      error={srcInvWithLots.length === 0 && !error ? 'No stock available in any storeroom for this supply.' : error}
      loading={loading} confirmLabel="Confirm Restock" confirmDisabled={!srcLotId}
      confirmClass="bg-amber-600 hover:bg-amber-700" onConfirm={submit} onCancel={onClose}>
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Source Storeroom <span className="text-red-500">*</span></label>
        <select value={srcInvId} onChange={e => changeSource(e.target.value)} className={inputCls}>
          {srcInvWithLots.map(i => (
            <option key={i.id} value={i.id}>{deptStorerooms.find(s => s.id === i.storeroom_id)?.name ?? 'Storeroom'}</option>
          ))}
        </select>
      </div>
      {lotsForSrc.length > 1 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700">Lot</label>
          <select value={srcLotId} onChange={e => setSrcLotId(e.target.value)} className={inputCls}>
            {lotsForSrc.map(l => (
              <option key={l.id} value={l.id}>
                {l.lot_number ? `Lot ${l.lot_number}` : 'No lot #'} · {l.quantity_remaining} available{l.expiration_date ? ` · Exp ${fmtDate(l.expiration_date)}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">
          Quantity <span className="text-red-500">*</span>
          {selectedLot && <span className="ml-1 text-zinc-400 font-normal">({selectedLot.quantity_remaining} available)</span>}
        </label>
        <input type="number" min="1" max={selectedLot?.quantity_remaining ?? undefined} value={quantity}
          onChange={e => setQuantity(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Notes</label>
        <input type="text" value={notes} placeholder="Optional" onChange={e => setNotes(e.target.value)} className={inputCls} />
      </div>
    </ModalShell>
  )
}
