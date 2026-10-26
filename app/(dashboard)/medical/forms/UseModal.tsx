'use client'

import { useState } from 'react'
import { dispenseStock } from '@/app/actions/medical'
import ModalShell, { ControlledBadge } from './ModalShell'
import SignerFields, { useSigners } from './SignerFields'
import { fmtDate, inputCls, type Lot, type Personnel, type SupplyType } from './types'

// Use / dispense one supply from an inventory row. Draws from the oldest lot (FIFO).
export default function UseModal({
  inventoryId, supply, lots, personnel, myPersonnelId, onClose, onDone,
}: {
  inventoryId: string
  supply: SupplyType
  lots: Lot[]
  personnel: Personnel[]
  myPersonnelId: string
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const signers = useSigners(supply.required_signatures, myPersonnelId)

  const activeLots = [...lots].filter(l => l.quantity_remaining > 0).sort((a, b) => a.received_date.localeCompare(b.received_date))
  const [lotId, setLotId] = useState(activeLots[0]?.id ?? '')   // oldest first (FIFO); choosable when several
  const oldest = activeLots.find(l => l.id === lotId) ?? activeLots[0]

  async function submit() {
    if (!oldest) { setError('No stock available.'); return }
    const qty = parseInt(quantity)
    if (!qty || qty < 1) { setError('Quantity must be at least 1.'); return }
    const sig = signers.collect('second signer')
    if ('error' in sig) { setError(sig.error); return }
    setError(null); setLoading(true)
    const r = await dispenseStock({ storeroom_inventory_id: inventoryId, lot_id: oldest.id, quantity: qty, notes: notes || null, ...sig })
    setLoading(false)
    if (r?.error) setError(r.error)
    else onDone(`Used ${qty} ${supply.unit_of_measure} of ${supply.name}.`)
  }

  return (
    <ModalShell title="Use Supply" subtitle={<>{supply.name}{supply.is_controlled && <ControlledBadge />}</>}
      error={error} loading={loading} confirmLabel="Confirm Use" confirmDisabled={!oldest} onConfirm={submit} onCancel={onClose}>
      {activeLots.length > 1 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700">Lot</label>
          <select value={oldest?.id ?? ''} onChange={e => setLotId(e.target.value)} className={inputCls}>
            {activeLots.map(l => (
              <option key={l.id} value={l.id}>
                {l.lot_number ? `Lot ${l.lot_number}` : 'No lot #'} — {l.quantity_remaining} available{l.expiration_date ? ` · Exp ${fmtDate(l.expiration_date)}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Quantity <span className="text-red-500">*</span></label>
        <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className={inputCls} />
      </div>
      <SignerFields signers={signers} requiredSigs={supply.required_signatures} personnel={personnel}
        firstLabel="Signer 1" secondLabel="Signer 2" secondPad="Signer 2 Signature" />
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Notes</label>
        <input type="text" value={notes} placeholder="Optional" onChange={e => setNotes(e.target.value)} className={inputCls} />
      </div>
    </ModalShell>
  )
}
