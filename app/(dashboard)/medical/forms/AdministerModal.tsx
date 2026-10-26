'use client'

import { useState } from 'react'
import { administerStock } from '@/app/actions/medical'
import { administeredDoseToVolume } from '@/lib/medical-dose'
import ModalShell, { ControlledBadge } from './ModalShell'
import SignerFields, { useSigners } from './SignerFields'
import { fmtDate, inputCls, type ControlUnit, type Lot, type Personnel, type SupplyType } from './types'

// Administer a dose from one vial of a controlled substance. Records the dose given and the
// remainder wasted.
export default function AdministerModal({
  inventoryId, supply, lots, units, personnel, myPersonnelId, onClose, onDone,
}: {
  inventoryId: string
  supply: SupplyType
  lots: Lot[]            // this inventory row's lots
  units: ControlUnit[]
  personnel: Personnel[]
  myPersonnelId: string
  onClose: () => void
  onDone: (message: string) => void
}) {
  const activeLotIds = new Set(lots.filter(l => l.quantity_remaining > 0 && l.volume_per_unit).map(l => l.id))
  const availableUnits = units.filter(u => activeLotIds.has(u.lot_id) && u.status === 'available')

  const [unitId, setUnitId] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const signers = useSigners(supply.required_signatures, myPersonnelId)

  const unit = availableUnits.find(u => u.id === unitId)
  const lot = unit ? lots.find(l => l.id === unit.lot_id) : undefined
  const volumePerUnit = lot?.volume_per_unit ?? 0
  const volumeUnit = lot?.volume_unit ?? ''
  const concentrationAmount = lot?.concentration_amount ?? null
  const doseUnit = lot && lot.concentration_amount && lot.concentration_unit
    ? lot.concentration_unit.split('/')[0].trim() || null
    : null
  const dose = { doseUnit, concentrationAmount }

  const entryUnit = doseUnit ?? volumeUnit
  const maxEntry = doseUnit && concentrationAmount
    ? Math.round(volumePerUnit * concentrationAmount * 1000) / 1000
    : volumePerUnit
  const entered = amount.trim()
  const enteredNum = parseFloat(entered)
  const hasEntry = entered !== '' && !isNaN(enteredNum)
  const volumeGiven = hasEntry ? administeredDoseToVolume(dose, enteredNum) : null
  const validAmount = !!unitId && volumeGiven !== null && enteredNum > 0 && volumeGiven <= volumePerUnit + 0.0001
  const amountHint = hasEntry && !validAmount
    ? (enteredNum <= 0 ? 'Enter an amount greater than 0.' : `Cannot exceed ${maxEntry} ${entryUnit} per vial.`)
    : null

  const wastePreview = validAmount && volumeGiven !== null
    ? (() => {
        const w = Math.round((volumePerUnit - volumeGiven) * 1000) / 1000
        return doseUnit && concentrationAmount ? `${Math.round(w * concentrationAmount * 1000) / 1000} ${doseUnit}` : `${w} ${volumeUnit}`
      })()
    : null

  async function submit() {
    if (!unitId) { setError('Select which vial is being administered.'); return }
    if (!enteredNum || enteredNum <= 0) { setError('Enter the amount administered.'); return }
    const administered = Math.round(administeredDoseToVolume(dose, enteredNum) * 1000) / 1000
    if (administered > volumePerUnit) { setError(`Cannot exceed ${maxEntry} ${entryUnit} per vial.`); return }
    const sig = signers.collect('witness', 'A witness is required for controlled substance administration.')
    if ('error' in sig) { setError(sig.error); return }
    setError(null); setLoading(true)
    const r = await administerStock({
      storeroom_inventory_id: inventoryId, unit_id: unitId, administered_amount: administered, notes: notes || null, ...sig,
    })
    setLoading(false)
    if (r?.error) { setError(r.error); return }
    const waste = Math.round((volumePerUnit - administered) * 1000) / 1000
    const givenLabel = doseUnit ? `${enteredNum} ${doseUnit}` : `${administered} ${volumeUnit}`
    const wasteLabel = doseUnit && concentrationAmount
      ? `${Math.round(waste * concentrationAmount * 1000) / 1000} ${doseUnit}`
      : `${waste} ${volumeUnit}`
    onDone(`Administered ${givenLabel} of ${supply.name} — ${wasteLabel} wasted.`)
  }

  return (
    <ModalShell title="Administer" subtitle={<>{supply.name}<ControlledBadge /></>}
      error={availableUnits.length === 0 && !error ? 'No vials available to administer. Receive stock (with volume per vial set) first.' : error}
      loading={loading} confirmLabel="Confirm Administration" confirmDisabled={!validAmount} onConfirm={submit} onCancel={onClose}>
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Vial (Control #) <span className="text-red-500">*</span></label>
        <select value={unitId} onChange={e => { setUnitId(e.target.value); setAmount('') }} className={inputCls}>
          <option value="">Select the vial in hand...</option>
          {availableUnits.map(u => {
            const unitLot = lots.find(l => l.id === u.lot_id)
            return (
              <option key={u.id} value={u.id}>
                {u.control_number}{unitLot?.lot_number ? ` — Lot ${unitLot.lot_number}` : ''}{unitLot?.expiration_date ? ` (Exp ${fmtDate(unitLot.expiration_date)})` : ''}
              </option>
            )
          })}
        </select>
      </div>
      {unitId && lot && (
        <div className="rounded-lg bg-zinc-50 border border-zinc-200 px-4 py-2.5 text-sm text-zinc-700">
          This vial: {doseUnit ? `${maxEntry} ${doseUnit} (${volumePerUnit} ${volumeUnit})` : `${volumePerUnit} ${volumeUnit}`} · {lot.quantity_remaining} vial{lot.quantity_remaining === 1 ? '' : 's'} remaining in lot
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Amount Administered <span className="text-red-500">*</span></label>
        <div className="flex items-center gap-2">
          <input type="number" step="any" min="0" max={maxEntry} value={amount} disabled={!unitId}
            onChange={e => setAmount(e.target.value)} className={`${inputCls} text-center disabled:bg-zinc-50 disabled:text-zinc-400`} />
          <span className="text-sm text-zinc-500 shrink-0">{entryUnit}</span>
        </div>
        {amountHint && <p className="mt-1 text-xs text-red-600">{amountHint}</p>}
      </div>
      <div className={`rounded-lg border px-4 py-2.5 text-sm font-medium ${wastePreview ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-zinc-50 border-zinc-200 text-zinc-400'}`}>
        Waste: {wastePreview ?? `— ${entryUnit}`}
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Notes</label>
        <input type="text" value={notes} placeholder="Optional — e.g. patient/run reference" onChange={e => setNotes(e.target.value)} className={inputCls} />
      </div>
      <SignerFields signers={signers} requiredSigs={supply.required_signatures} personnel={personnel}
        firstLabel="Administered By" secondLabel="Witness" />
    </ModalShell>
  )
}
