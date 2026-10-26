'use client'

import { useState } from 'react'
import { wasteStock } from '@/app/actions/medical'
import ModalShell, { ControlledBadge } from './ModalShell'
import SignerFields, { useSigners } from './SignerFields'
import { inputCls, WASTE_REASONS, type ControlUnit, type Lot, type Personnel, type SupplyType } from './types'

// Waste / dispose of stock from one lot. Controlled substances waste specific vials.
export default function WasteModal({
  inventoryId, supply, lot, units, personnel, myPersonnelId, onClose, onDone,
}: {
  inventoryId: string
  supply: SupplyType
  lot: Lot
  units: ControlUnit[]
  personnel: Personnel[]
  myPersonnelId: string
  onClose: () => void
  onDone: (message: string) => void
}) {
  const availableUnits = units.filter(u => u.lot_id === lot.id && u.status === 'available')
  const [reason, setReason] = useState(WASTE_REASONS[0])
  const [quantity, setQuantity] = useState(supply.is_controlled ? '0' : String(lot.quantity_remaining))
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const signers = useSigners(supply.required_signatures, myPersonnelId)

  function toggleUnit(id: string) {
    const next = selectedUnitIds.includes(id) ? selectedUnitIds.filter(u => u !== id) : [...selectedUnitIds, id]
    setSelectedUnitIds(next)
    setQuantity(String(next.length))
  }

  async function submit() {
    const qty = parseInt(quantity)
    if (!qty || qty < 1) { setError(supply.is_controlled ? 'Select which vials are being wasted.' : 'Quantity must be at least 1.'); return }
    if (qty > lot.quantity_remaining) { setError(`Only ${lot.quantity_remaining} available in this lot.`); return }
    if (!reason) { setError('Waste reason is required.'); return }
    const sig = signers.collect('witness', 'A witness is required for controlled substance waste.')
    if ('error' in sig) { setError(sig.error); return }
    setError(null); setLoading(true)
    const r = await wasteStock({
      storeroom_inventory_id: inventoryId, lot_id: lot.id, quantity: qty,
      unit_ids: supply.is_controlled ? selectedUnitIds : null,
      waste_reason: reason, notes: notes || null, ...sig,
    })
    setLoading(false)
    if (r?.error) setError(r.error)
    else onDone(`Wasted ${qty} ${supply.unit_of_measure} of ${supply.name}.`)
  }

  return (
    <ModalShell title="Waste / Dispose"
      subtitle={<>{supply.name}{lot.lot_number && <span className="ml-1 text-zinc-400">· Lot {lot.lot_number}</span>}{supply.is_controlled && <ControlledBadge />}</>}
      error={error} loading={loading} confirmLabel="Confirm Waste" onConfirm={submit} onCancel={onClose}>
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Reason <span className="text-red-500">*</span></label>
        <select value={reason} onChange={e => setReason(e.target.value)} className={inputCls}>
          {WASTE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      {supply.is_controlled ? (
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700">
            Vials to Waste <span className="text-red-500">*</span>
            <span className="ml-1 text-zinc-400 font-normal">({selectedUnitIds.length} selected)</span>
          </label>
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto rounded-lg border border-zinc-200 p-2">
            {availableUnits.length === 0 && <p className="text-xs text-zinc-400 px-1 py-1">No vials on file for this lot.</p>}
            {availableUnits.map(u => (
              <label key={u.id} className="flex items-center gap-2 px-1 py-1 text-sm text-zinc-700 hover:bg-zinc-50 rounded cursor-pointer">
                <input type="checkbox" checked={selectedUnitIds.includes(u.id)} onChange={() => toggleUnit(u.id)} />
                {u.control_number}
              </label>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700">
            Quantity <span className="text-red-500">*</span>
            <span className="ml-1 text-zinc-400 font-normal">({lot.quantity_remaining} available)</span>
          </label>
          <input type="number" min="1" max={lot.quantity_remaining} value={quantity} onChange={e => setQuantity(e.target.value)} className={inputCls} />
        </div>
      )}
      <SignerFields signers={signers} requiredSigs={supply.required_signatures} personnel={personnel}
        firstLabel="Wasted By" secondLabel="Witness" />
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Notes</label>
        <input type="text" value={notes} placeholder="Optional" onChange={e => setNotes(e.target.value)} className={inputCls} />
      </div>
    </ModalShell>
  )
}
