'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { dispenseStock, receiveStock, wasteStock, transferStock, updateBagInventoryMode } from '@/app/actions/medical'
import SignatureCapture, { SignatureCaptureHandle } from '../../medical/SignatureCapture'

interface Bag { id: string; name: string; template_id: string | null; inventory_mode: string | null }
interface InventoryRow { id: string; storeroom_id: string; supply_type_id: string; par_level: number }
interface Lot { id: string; storeroom_inventory_id: string; lot_number: string | null; expiration_date: string | null; quantity_received: number; quantity_remaining: number; received_date: string }
interface SupplyType { id: string; name: string; category: string; unit_of_measure: string; is_controlled: boolean; tracks_expiration: boolean; required_signatures: number }
interface Storeroom { id: string; name: string }
interface SrcLot { id: string; storeroom_inventory_id: string; lot_number: string | null; quantity_remaining: number; expiration_date: string | null }
interface Personnel { id: string; name: string }
interface BagTemplate { id: string; name: string }

const WASTE_REASONS = ['Expired', 'Damaged', 'Contaminated', 'Administered / Used on Scene', 'Other']

const STATUS_COLORS = {
  expired: 'bg-red-100 text-red-700', expiring: 'bg-amber-100 text-amber-700',
  low: 'bg-orange-100 text-orange-700', good: 'bg-green-100 text-green-700', empty: 'bg-zinc-100 text-zinc-500',
}
const STATUS_LABELS = { expired: 'Expired', expiring: 'Exp Soon', low: 'Below PAR', good: 'Good', empty: 'No Stock' }

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getStatus(total: number, par: number, lots: Lot[]): 'expired' | 'expiring' | 'low' | 'good' | 'empty' {
  if (total === 0) return 'empty'
  const now = new Date(); const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  if (lots.some(l => l.expiration_date && new Date(l.expiration_date + 'T00:00:00') < now)) return 'expired'
  if (par > 0 && total < par) return 'low'
  if (lots.some(l => l.expiration_date && new Date(l.expiration_date + 'T00:00:00') <= soon)) return 'expiring'
  return 'good'
}

export default function MedicalBagsSection({
  bags, bagInventory, bagLots, supplyTypes, deptStorerooms,
  storeroomInventory, storeroomLots, personnel,
  bagTemplates, apparatusId, isAdmin, isOfficerOrAbove, myPersonnelId,
}: {
  bags: Bag[]
  bagInventory: InventoryRow[]
  bagLots: Lot[]
  supplyTypes: SupplyType[]
  deptStorerooms: Storeroom[]
  storeroomInventory: { id: string; storeroom_id: string; supply_type_id: string }[]
  storeroomLots: SrcLot[]
  personnel: Personnel[]
  bagTemplates: BagTemplate[]
  apparatusId: string
  isAdmin: boolean
  isOfficerOrAbove: boolean
  myPersonnelId: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [expandedBagId, setExpandedBagId] = useState<string | null>(bags[0]?.id ?? null)
  // Shared across the use/waste/receive modals — only one is ever open at a time
  const signer1PadRef = useRef<SignatureCaptureHandle>(null)
  const signer2PadRef = useRef<SignatureCaptureHandle>(null)
  const [expandedInvId, setExpandedInvId] = useState<string | null>(null)

  type UseForm = { invId: string; lotId: string; supplyName: string; unitOfMeasure: string; isControlled: boolean; requiredSigs: number; quantity: string; notes: string; signer1Id: string; signer2Id: string }
  type ReceiveForm = { invId: string; supplyName: string; tracksExp: boolean; requiredSigs: number; lotNumber: string; expirationDate: string; quantity: string; notes: string; signer1Id: string; signer2Id: string }
  type RestockForm = { invId: string; supplyTypeId: string; supplyName: string; unitOfMeasure: string; isControlled: boolean; destStoreroomId: string; srcInvId: string; srcLotId: string; quantity: string; notes: string }
  type TransferOutForm = {
    srcInvId: string; supplyTypeId: string; supplyName: string; unitOfMeasure: string
    isControlled: boolean; srcLotId: string; destStoreroomId: string
    maxQty: number; quantity: string; notes: string
  }
  type WasteForm = {
    invId: string; lotId: string; supplyName: string; unitOfMeasure: string
    isControlled: boolean; requiredSigs: number; lotNumber: string | null
    maxQty: number; quantity: string; wasteReason: string; notes: string
    signer1Id: string; signer2Id: string
  }

  const [useForm, setUseForm] = useState<UseForm | null>(null)
  const [receiveForm, setReceiveForm] = useState<ReceiveForm | null>(null)
  const [restockForm, setRestockForm] = useState<RestockForm | null>(null)
  const [transferOutForm, setTransferOutForm] = useState<TransferOutForm | null>(null)
  const [wasteForm, setWasteForm] = useState<WasteForm | null>(null)

  const supplyMap = Object.fromEntries(supplyTypes.map(s => [s.id, s]))
  const lotsFor = (invId: string) => bagLots.filter(l => l.storeroom_inventory_id === invId)
  const totalQty = (invId: string) => lotsFor(invId).reduce((s, l) => s + l.quantity_remaining, 0)

  function openUse(inv: InventoryRow) {
    const supply = supplyMap[inv.supply_type_id]; if (!supply) return
    const activeLots = lotsFor(inv.id)
    if (activeLots.length === 0) { setError('No stock available.'); return }
    const oldest = activeLots.sort((a, b) => a.received_date.localeCompare(b.received_date))[0]
    setError(null)
    setUseForm({ invId: inv.id, lotId: oldest.id, supplyName: supply.name, unitOfMeasure: supply.unit_of_measure, isControlled: supply.is_controlled, requiredSigs: supply.required_signatures, quantity: '1', notes: '', signer1Id: supply.required_signatures >= 1 ? myPersonnelId : '', signer2Id: '' })
  }

  function openReceive(inv: InventoryRow) {
    const supply = supplyMap[inv.supply_type_id]; if (!supply) return
    setError(null)
    setReceiveForm({ invId: inv.id, supplyName: supply.name, tracksExp: supply.tracks_expiration, requiredSigs: supply.required_signatures, lotNumber: '', expirationDate: '', quantity: '', notes: '', signer1Id: supply.required_signatures >= 1 ? myPersonnelId : '', signer2Id: '' })
  }

  function openRestock(inv: InventoryRow) {
    const supply = supplyMap[inv.supply_type_id]; if (!supply) return
    const srcInvRows = storeroomInventory.filter(i => i.supply_type_id === inv.supply_type_id)
    const availableLots = storeroomLots.filter(l => srcInvRows.some(i => i.id === l.storeroom_inventory_id))
    if (availableLots.length === 0) { setError('No stock available in any storeroom for this supply.'); return }
    const firstLot = availableLots[0]
    const firstSrcInv = srcInvRows.find(i => i.id === firstLot.storeroom_inventory_id)
    setError(null)
    setRestockForm({
      invId: inv.id, supplyTypeId: inv.supply_type_id, supplyName: supply.name,
      unitOfMeasure: supply.unit_of_measure, isControlled: supply.is_controlled,
      destStoreroomId: inv.storeroom_id, srcInvId: firstSrcInv?.id ?? '',
      srcLotId: firstLot.id, quantity: '1', notes: '',
    })
  }

  function openTransferOut(inv: InventoryRow) {
    const supply = supplyMap[inv.supply_type_id]; if (!supply) return
    const activeLots = lotsFor(inv.id).filter(l => l.quantity_remaining > 0)
    if (activeLots.length === 0) { setError('No stock available to transfer.'); return }
    const oldest = [...activeLots].sort((a, b) => a.received_date.localeCompare(b.received_date))[0]
    const validDests = deptStorerooms.filter(s => storeroomInventory.some(i => i.storeroom_id === s.id && i.supply_type_id === inv.supply_type_id))
    if (validDests.length === 0) { setError('No storeroom has this supply type assigned — transfer cannot be completed.'); return }
    setError(null)
    setTransferOutForm({
      srcInvId: inv.id, supplyTypeId: inv.supply_type_id, supplyName: supply.name,
      unitOfMeasure: supply.unit_of_measure, isControlled: supply.is_controlled,
      srcLotId: oldest.id, destStoreroomId: validDests[0].id,
      maxQty: oldest.quantity_remaining, quantity: '1', notes: '',
    })
  }

  function openWaste(inv: InventoryRow, lot: Lot) {
    const supply = supplyMap[inv.supply_type_id]; if (!supply) return
    setError(null)
    setWasteForm({
      invId: inv.id, lotId: lot.id, supplyName: supply.name, unitOfMeasure: supply.unit_of_measure,
      isControlled: supply.is_controlled, requiredSigs: supply.required_signatures,
      lotNumber: lot.lot_number, maxQty: lot.quantity_remaining, quantity: String(lot.quantity_remaining),
      wasteReason: WASTE_REASONS[0], notes: '',
      signer1Id: supply.required_signatures >= 1 ? myPersonnelId : '',
      signer2Id: '',
    })
  }

  async function handleWasteSubmit() {
    if (!wasteForm) return
    const qty = parseInt(wasteForm.quantity)
    if (!qty || qty < 1) { setError('Quantity must be at least 1.'); return }
    if (qty > wasteForm.maxQty) { setError(`Only ${wasteForm.maxQty} available in this lot.`); return }
    if (!wasteForm.wasteReason) { setError('Waste reason is required.'); return }
    if (wasteForm.requiredSigs >= 1 && !wasteForm.signer1Id) { setError('Signer 1 is required.'); return }
    const signer1Signature = signer1PadRef.current?.getDataUrl() ?? null
    if (wasteForm.requiredSigs >= 1 && !signer1Signature) { setError('Signer 1 must sign.'); return }
    if (wasteForm.requiredSigs >= 2 && !wasteForm.signer2Id) { setError('A witness is required for controlled substance waste.'); return }
    const signer2Signature = signer2PadRef.current?.getDataUrl() ?? null
    if (wasteForm.requiredSigs >= 2 && !signer2Signature) { setError('The witness must sign.'); return }
    setError(null); setLoading(true)
    const r = await wasteStock({
      storeroom_inventory_id: wasteForm.invId, lot_id: wasteForm.lotId, quantity: qty,
      waste_reason: wasteForm.wasteReason, notes: wasteForm.notes || null,
      signer_1_id: wasteForm.signer1Id || null, signer_2_id: wasteForm.signer2Id || null,
      signer_1_signature: signer1Signature, signer_2_signature: signer2Signature,
    })
    if (r?.error) setError(r.error)
    else { setSuccess(`Wasted ${qty} ${wasteForm.unitOfMeasure} of ${wasteForm.supplyName}.`); setWasteForm(null); router.refresh() }
    setLoading(false)
  }

  async function handleUseSubmit() {
    if (!useForm) return
    const qty = parseInt(useForm.quantity)
    if (!qty || qty < 1) { setError('Quantity must be at least 1.'); return }
    if (useForm.requiredSigs >= 1 && !useForm.signer1Id) { setError('Signer 1 is required.'); return }
    const signer1Signature = signer1PadRef.current?.getDataUrl() ?? null
    if (useForm.requiredSigs >= 1 && !signer1Signature) { setError('Signer 1 must sign.'); return }
    if (useForm.requiredSigs >= 2 && !useForm.signer2Id) { setError('A second signer is required for controlled substances.'); return }
    const signer2Signature = signer2PadRef.current?.getDataUrl() ?? null
    if (useForm.requiredSigs >= 2 && !signer2Signature) { setError('The second signer must sign.'); return }
    setError(null); setLoading(true)
    const r = await dispenseStock({
      storeroom_inventory_id: useForm.invId, lot_id: useForm.lotId, quantity: qty, notes: useForm.notes || null,
      signer_1_id: useForm.signer1Id || null, signer_2_id: useForm.signer2Id || null,
      signer_1_signature: signer1Signature, signer_2_signature: signer2Signature,
    })
    if (r?.error) setError(r.error)
    else { setSuccess(`Used ${qty} ${useForm.unitOfMeasure} of ${useForm.supplyName}.`); setUseForm(null); router.refresh() }
    setLoading(false)
  }

  async function handleReceiveSubmit() {
    if (!receiveForm) return
    const qty = parseInt(receiveForm.quantity)
    if (!qty || qty < 1) { setError('Quantity must be at least 1.'); return }
    if (receiveForm.tracksExp && !receiveForm.expirationDate) { setError('Expiration date required.'); return }
    if (receiveForm.requiredSigs >= 1 && !receiveForm.signer1Id) { setError('Signer 1 is required.'); return }
    const signer1Signature = signer1PadRef.current?.getDataUrl() ?? null
    if (receiveForm.requiredSigs >= 1 && !signer1Signature) { setError('Signer 1 must sign.'); return }
    if (receiveForm.requiredSigs >= 2 && !receiveForm.signer2Id) { setError('A second signer is required for controlled substances.'); return }
    const signer2Signature = signer2PadRef.current?.getDataUrl() ?? null
    if (receiveForm.requiredSigs >= 2 && !signer2Signature) { setError('The second signer must sign.'); return }
    setError(null); setLoading(true)
    const r = await receiveStock({
      storeroom_inventory_id: receiveForm.invId, lot_number: receiveForm.lotNumber || null, expiration_date: receiveForm.expirationDate || null,
      quantity_received: qty, notes: receiveForm.notes || null,
      signer_1_id: receiveForm.signer1Id || null, signer_2_id: receiveForm.signer2Id || null,
      signer_1_signature: signer1Signature, signer_2_signature: signer2Signature,
      concentration_amount: null, concentration_unit: null, volume_per_unit: null, volume_unit: null,
    })
    if (r?.error) setError(r.error)
    else { setSuccess(`Received ${qty} ${receiveForm.supplyName}.`); setReceiveForm(null); router.refresh() }
    setLoading(false)
  }

  async function handleRestockSubmit() {
    if (!restockForm) return
    const qty = parseInt(restockForm.quantity)
    if (!qty || qty < 1) { setError('Quantity must be at least 1.'); return }
    setError(null); setLoading(true)
    const r = await transferStock({ source_inventory_id: restockForm.srcInvId, lot_id: restockForm.srcLotId, destination_storeroom_id: restockForm.destStoreroomId, quantity: qty, notes: restockForm.notes || null })
    if (r?.error) setError(r.error)
    else { setSuccess(`Restocked ${qty} ${restockForm.unitOfMeasure} of ${restockForm.supplyName} from storeroom.`); setRestockForm(null); router.refresh() }
    setLoading(false)
  }

  async function handleTransferOutSubmit() {
    if (!transferOutForm) return
    const qty = parseInt(transferOutForm.quantity)
    if (!qty || qty < 1) { setError('Quantity must be at least 1.'); return }
    if (qty > transferOutForm.maxQty) { setError(`Only ${transferOutForm.maxQty} available in this lot.`); return }
    if (!transferOutForm.destStoreroomId) { setError('Select a destination storeroom.'); return }
    setError(null); setLoading(true)
    const r = await transferStock({
      source_inventory_id: transferOutForm.srcInvId,
      lot_id: transferOutForm.srcLotId,
      destination_storeroom_id: transferOutForm.destStoreroomId,
      quantity: qty,
      notes: transferOutForm.notes || null,
    })
    if (r?.error) setError(r.error)
    else { setSuccess(`Transferred ${qty} ${transferOutForm.unitOfMeasure} of ${transferOutForm.supplyName} to storeroom.`); setTransferOutForm(null); router.refresh() }
    setLoading(false)
  }

  function handleTransferOutLotChange(lotId: string) {
    if (!transferOutForm) return
    const lot = bagLots.find(l => l.id === lotId)
    setTransferOutForm(f => f ? { ...f, srcLotId: lotId, maxQty: lot?.quantity_remaining ?? 0 } : f)
  }

  async function handleModeToggle(bagId: string, currentMode: string | null) {
    const newMode = currentMode === 'standard' ? 'independent' : 'standard'
    setLoading(true)
    const r = await updateBagInventoryMode(bagId, newMode)
    if (r?.error) setError(r.error)
    else router.refresh()
    setLoading(false)
  }

  const inputCls = "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"

  return (
    <div className="rounded-xl bg-white shadow-sm border border-zinc-200 p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-zinc-900">Medical Bags</h2>
        {isAdmin && (
          <a href="/dept-admin/medical" className="text-xs font-semibold text-zinc-400 hover:text-zinc-700">Manage in Medical →</a>
        )}
      </div>

      {success && <div className="mb-3 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 border border-green-200">{success}</div>}
      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}

      {bags.length === 0 && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-8 text-center text-sm text-zinc-400">
          No bags assigned to this apparatus.
          {isAdmin && <span> <a href="/dept-admin/medical" className="text-red-600 font-semibold hover:underline">Assign one in Medical Admin →</a></span>}
        </div>
      )}

      {/* Bag tabs */}
      {bags.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {bags.map(bag => (
            <button key={bag.id} onClick={() => setExpandedBagId(bag.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${expandedBagId === bag.id ? 'bg-red-700 text-white border-red-700' : 'bg-white text-zinc-600 border-zinc-200 hover:border-red-300'}`}>
              {bag.name}
            </button>
          ))}
        </div>
      )}

      {bags.map(bag => {
        if (bags.length > 1 && expandedBagId !== bag.id) return null
        const inv = bagInventory.filter(i => i.storeroom_id === bag.id)
        return (
          <div key={bag.id}>
            {bags.length === 1 && (
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-zinc-700">{bag.name}</p>
                  {bag.template_id && (() => { const tmpl = bagTemplates.find(t => t.id === bag.template_id); return tmpl ? <span className="text-xs text-zinc-400">{tmpl.name}</span> : null })()}
                </div>
                {isAdmin && bag.inventory_mode && (
                  <button onClick={() => handleModeToggle(bag.id, bag.inventory_mode)} disabled={loading}
                    className={`text-xs rounded-full px-2.5 py-1 font-semibold border transition-colors ${bag.inventory_mode === 'standard' ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 'bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100'}`}>
                    {bag.inventory_mode === 'standard' ? 'Standard ↕' : 'Independent ↕'}
                  </button>
                )}
              </div>
            )}
            {inv.length === 0 ? (
              <p className="text-sm text-zinc-400 py-4 text-center">No supplies assigned to this bag.
                {isAdmin && <span> <a href="/dept-admin/medical" className="text-red-600 hover:underline">Configure →</a></span>}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {inv.map(item => {
                  const supply = supplyMap[item.supply_type_id]
                  if (!supply) return null
                  const lots = lotsFor(item.id)
                  const total = totalQty(item.id)
                  const status = getStatus(total, item.par_level, lots)
                  const isExpanded = expandedInvId === item.id
                  const canAct = isOfficerOrAbove || !supply.is_controlled
                  const srcAvailable = storeroomLots.some(l => storeroomInventory.find(i => i.id === l.storeroom_inventory_id && i.supply_type_id === item.supply_type_id))
                  const destAvailable = deptStorerooms.some(s => storeroomInventory.some(i => i.storeroom_id === s.id && i.supply_type_id === item.supply_type_id))

                  return (
                    <div key={item.id} className="rounded-xl border border-zinc-200 overflow-hidden">
                      <div className="flex flex-col sm:flex-row sm:items-center px-4 py-3 gap-2 sm:gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="text-sm font-semibold text-zinc-900">{supply.name}</p>
                            {supply.is_controlled && <span className="text-xs rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 font-medium">Controlled</span>}
                            <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span>
                          </div>
                          <p className="text-xs text-zinc-400">{total} {supply.unit_of_measure} · PAR {item.par_level}</p>
                        </div>
                        <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-2 sm:shrink-0">
                          {lots.length > 0 && (
                            <button onClick={() => setExpandedInvId(isExpanded ? null : item.id)} className="text-xs font-semibold text-blue-600 hover:text-blue-800 text-center sm:text-left">
                              {isExpanded ? 'Hide' : 'Lots'}
                            </button>
                          )}
                          {canAct && srcAvailable && (
                            <button onClick={() => openRestock(item)}
                              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors text-center sm:text-left ${(status === 'low' || status === 'empty') ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50'}`}>
                              Restock
                            </button>
                          )}
                          {canAct && total > 0 && destAvailable && (
                            <button onClick={() => openTransferOut(item)}
                              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 text-center sm:text-left">
                              Transfer
                            </button>
                          )}
                          <button onClick={() => openUse(item)} disabled={total === 0}
                            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed text-center sm:text-left">
                            Use
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-3">
                          <div className="flex flex-col gap-1.5">
                            {lots.map(lot => {
                              const now = new Date()
                              const expDate = lot.expiration_date ? new Date(lot.expiration_date + 'T00:00:00') : null
                              const expired = expDate && expDate < now
                              const expiring = expDate && !expired && expDate <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
                              return (
                                <div key={lot.id} className="flex items-center justify-between bg-white rounded-lg border border-zinc-200 px-4 py-2.5 gap-3">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-zinc-900">{lot.lot_number ? `Lot ${lot.lot_number}` : 'No lot #'}</p>
                                    <p className="text-xs text-zinc-400">Received {fmtDate(lot.received_date)}</p>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    {supply.tracks_expiration && (
                                      <p className={`text-xs font-semibold ${expired ? 'text-red-600' : expiring ? 'text-amber-600' : 'text-zinc-500'}`}>
                                        {expired ? '⚠ Exp' : expiring ? '⚠ Exp soon' : 'Exp'} {fmtDate(lot.expiration_date)}
                                      </p>
                                    )}
                                    {isOfficerOrAbove && lot.quantity_remaining > 0 && (
                                      <button onClick={() => openWaste(item, lot)}
                                        className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors">
                                        Waste
                                      </button>
                                    )}
                                    <div className="text-right">
                                      <p className="text-lg font-bold text-zinc-900">{lot.quantity_remaining}</p>
                                      <p className="text-xs text-zinc-400">{supply.unit_of_measure}</p>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Use Modal */}
      {useForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-8">
          <div className="w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-xl p-6">
            <h2 className="text-base font-bold text-zinc-900 mb-1">Use / Dispense</h2>
            <p className="text-sm text-zinc-500 mb-5">{useForm.supplyName} {useForm.isControlled && <span className="ml-1 text-xs rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">Controlled</span>}</p>
            {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}
            <div className="flex flex-col gap-3">
              {lotsFor(useForm.invId).filter(l => l.quantity_remaining > 0).length > 1 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Lot</label>
                  <select value={useForm.lotId} onChange={e => setUseForm(f => f ? { ...f, lotId: e.target.value } : f)} className={inputCls}>
                    {lotsFor(useForm.invId).filter(l => l.quantity_remaining > 0).sort((a,b) => a.received_date.localeCompare(b.received_date)).map(l => (
                      <option key={l.id} value={l.id}>{l.lot_number ? `Lot ${l.lot_number}` : 'No lot #'} — {l.quantity_remaining} {useForm.unitOfMeasure}{l.expiration_date ? ` · Exp ${fmtDate(l.expiration_date)}` : ''}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Quantity <span className="text-red-500">*</span></label>
                <input type="number" min="1" value={useForm.quantity} onChange={e => setUseForm(f => f ? { ...f, quantity: e.target.value } : f)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Notes</label>
                <input type="text" value={useForm.notes} placeholder="Optional" onChange={e => setUseForm(f => f ? { ...f, notes: e.target.value } : f)} className={inputCls} />
              </div>
              {useForm.requiredSigs >= 1 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Dispensed By <span className="text-red-500">*</span></label>
                  <select value={useForm.signer1Id} onChange={e => setUseForm(f => f ? { ...f, signer1Id: e.target.value } : f)} className={inputCls}>
                    <option value="">Select...</option>
                    {personnel.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <div className="mt-2"><SignatureCapture ref={signer1PadRef} label="Signer 1 Signature" /></div>
                </div>
              )}
              {useForm.requiredSigs >= 2 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Witness <span className="text-red-500">*</span> <span className="text-amber-600 font-normal">(controlled)</span></label>
                  <select value={useForm.signer2Id} onChange={e => setUseForm(f => f ? { ...f, signer2Id: e.target.value } : f)} className={inputCls}>
                    <option value="">Select...</option>
                    {personnel.filter(p => p.id !== useForm.signer1Id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <div className="mt-2"><SignatureCapture ref={signer2PadRef} label="Witness Signature" /></div>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleUseSubmit} disabled={loading} className="flex-1 rounded-lg bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-900 disabled:opacity-50">{loading ? 'Saving...' : 'Confirm Use'}</button>
              <button onClick={() => { setUseForm(null); setError(null) }} className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {receiveForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-8">
          <div className="w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-xl p-6">
            <h2 className="text-base font-bold text-zinc-900 mb-1">Receive Stock</h2>
            <p className="text-sm text-zinc-500 mb-5">{receiveForm.supplyName}</p>
            {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Lot Number</label>
                  <input type="text" value={receiveForm.lotNumber} placeholder="Optional" onChange={e => setReceiveForm(f => f ? { ...f, lotNumber: e.target.value } : f)} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Quantity <span className="text-red-500">*</span></label>
                  <input type="number" min="1" value={receiveForm.quantity} placeholder="0" onChange={e => setReceiveForm(f => f ? { ...f, quantity: e.target.value } : f)} className={`${inputCls} text-center`} />
                </div>
              </div>
              {receiveForm.tracksExp && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Expiration Date <span className="text-red-500">*</span></label>
                  <input type="date" value={receiveForm.expirationDate} onChange={e => setReceiveForm(f => f ? { ...f, expirationDate: e.target.value } : f)} className={inputCls} />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Notes</label>
                <input type="text" value={receiveForm.notes} placeholder="Optional" onChange={e => setReceiveForm(f => f ? { ...f, notes: e.target.value } : f)} className={inputCls} />
              </div>
              {receiveForm.requiredSigs >= 1 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Received By <span className="text-red-500">*</span></label>
                  <select value={receiveForm.signer1Id} onChange={e => setReceiveForm(f => f ? { ...f, signer1Id: e.target.value } : f)} className={inputCls}>
                    <option value="">Select...</option>
                    {personnel.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <div className="mt-2"><SignatureCapture ref={signer1PadRef} label="Signer 1 Signature" /></div>
                </div>
              )}
              {receiveForm.requiredSigs >= 2 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Witness <span className="text-red-500">*</span> <span className="text-amber-600 font-normal">(controlled)</span></label>
                  <select value={receiveForm.signer2Id} onChange={e => setReceiveForm(f => f ? { ...f, signer2Id: e.target.value } : f)} className={inputCls}>
                    <option value="">Select...</option>
                    {personnel.filter(p => p.id !== receiveForm.signer1Id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <div className="mt-2"><SignatureCapture ref={signer2PadRef} label="Witness Signature" /></div>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleReceiveSubmit} disabled={loading} className="flex-1 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">{loading ? 'Saving...' : 'Confirm Receipt'}</button>
              <button onClick={() => { setReceiveForm(null); setError(null) }} className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {restockForm && (() => {
        const srcInvRows = storeroomInventory.filter(i => i.supply_type_id === restockForm.supplyTypeId)
        const availableLots = storeroomLots.filter(l => srcInvRows.some(i => i.id === l.storeroom_inventory_id))
        const selectedLot = availableLots.find(l => l.id === restockForm.srcLotId)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-8">
            <div className="w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-xl p-6">
              <h2 className="text-base font-bold text-zinc-900 mb-1">Restock from Storeroom</h2>
              <p className="text-sm text-zinc-500 mb-5">{restockForm.supplyName}{restockForm.isControlled && <span className="ml-2 text-xs rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">Controlled</span>}</p>
              {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}
              <div className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Source Lot <span className="text-red-500">*</span></label>
                  <select value={restockForm.srcLotId} onChange={e => {
                    const lot = availableLots.find(l => l.id === e.target.value)
                    const srcInv = lot ? srcInvRows.find(i => i.id === lot.storeroom_inventory_id) : null
                    setRestockForm(f => f ? { ...f, srcLotId: e.target.value, srcInvId: srcInv?.id ?? f.srcInvId } : f)
                  }} className={inputCls}>
                    {availableLots.map(l => {
                      const sr = deptStorerooms.find(s => srcInvRows.find(i => i.id === l.storeroom_inventory_id && i.storeroom_id === s.id))
                      return (
                        <option key={l.id} value={l.id}>
                          {sr?.name ?? 'Storeroom'} — {l.lot_number ? `Lot ${l.lot_number}` : 'No lot #'} · {l.quantity_remaining} {restockForm.unitOfMeasure}{l.expiration_date ? ` · Exp ${fmtDate(l.expiration_date)}` : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">
                    Quantity <span className="text-red-500">*</span>
                    {selectedLot && <span className="ml-1 text-zinc-400 font-normal">({selectedLot.quantity_remaining} available)</span>}
                  </label>
                  <input type="number" min="1" max={selectedLot?.quantity_remaining} value={restockForm.quantity} onChange={e => setRestockForm(f => f ? { ...f, quantity: e.target.value } : f)} className={`${inputCls} text-center`} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Notes</label>
                  <input type="text" value={restockForm.notes} placeholder="Optional" onChange={e => setRestockForm(f => f ? { ...f, notes: e.target.value } : f)} className={inputCls} />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={handleRestockSubmit} disabled={loading} className="flex-1 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">{loading ? 'Saving...' : 'Confirm Restock'}</button>
                <button onClick={() => { setRestockForm(null); setError(null) }} className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">Cancel</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Waste Modal */}
      {wasteForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-8">
          <div className="w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-xl p-6">
            <h2 className="text-base font-bold text-zinc-900 mb-1">Waste Stock</h2>
            <p className="text-sm text-zinc-500 mb-1">
              {wasteForm.supplyName}
              {wasteForm.isControlled && <span className="ml-2 text-xs rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">Controlled</span>}
            </p>
            {wasteForm.lotNumber && <p className="text-xs text-zinc-400 mb-4">Lot {wasteForm.lotNumber}</p>}
            {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Reason <span className="text-red-500">*</span></label>
                <select value={wasteForm.wasteReason} onChange={e => setWasteForm(f => f ? { ...f, wasteReason: e.target.value } : f)} className={inputCls}>
                  {WASTE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">
                  Quantity <span className="text-red-500">*</span>
                  <span className="ml-1 text-zinc-400 font-normal">({wasteForm.maxQty} available)</span>
                </label>
                <input type="number" min="1" max={wasteForm.maxQty} value={wasteForm.quantity}
                  onChange={e => setWasteForm(f => f ? { ...f, quantity: e.target.value } : f)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Notes</label>
                <input type="text" value={wasteForm.notes} placeholder="Optional"
                  onChange={e => setWasteForm(f => f ? { ...f, notes: e.target.value } : f)} className={inputCls} />
              </div>
              {wasteForm.requiredSigs >= 1 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Wasted By <span className="text-red-500">*</span></label>
                  <select value={wasteForm.signer1Id} onChange={e => setWasteForm(f => f ? { ...f, signer1Id: e.target.value } : f)} className={inputCls}>
                    <option value="">Select...</option>
                    {personnel.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <div className="mt-2"><SignatureCapture ref={signer1PadRef} label="Signer 1 Signature" /></div>
                </div>
              )}
              {wasteForm.requiredSigs >= 2 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Witness <span className="text-red-500">*</span> <span className="text-amber-600 font-normal">(controlled)</span></label>
                  <select value={wasteForm.signer2Id} onChange={e => setWasteForm(f => f ? { ...f, signer2Id: e.target.value } : f)} className={inputCls}>
                    <option value="">Select...</option>
                    {personnel.filter(p => p.id !== wasteForm.signer1Id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <div className="mt-2"><SignatureCapture ref={signer2PadRef} label="Witness Signature" /></div>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleWasteSubmit} disabled={loading}
                className="flex-1 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
                {loading ? 'Saving...' : 'Confirm Waste'}
              </button>
              <button onClick={() => { setWasteForm(null); setError(null) }} className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Out Modal */}
      {transferOutForm && (() => {
        const activeLots = bagLots.filter(l => l.storeroom_inventory_id === transferOutForm.srcInvId && l.quantity_remaining > 0)
          .sort((a, b) => a.received_date.localeCompare(b.received_date))
        const selectedLot = bagLots.find(l => l.id === transferOutForm.srcLotId)
        const validDests = deptStorerooms.filter(s => storeroomInventory.some(i => i.storeroom_id === s.id && i.supply_type_id === transferOutForm.supplyTypeId))
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-8">
            <div className="w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-xl p-6">
              <h2 className="text-base font-bold text-zinc-900 mb-1">Transfer to Storeroom</h2>
              <p className="text-sm text-zinc-500 mb-5">
                {transferOutForm.supplyName}
                {transferOutForm.isControlled && <span className="ml-2 text-xs rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">Controlled</span>}
              </p>
              {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}
              <div className="flex flex-col gap-3">
                {activeLots.length > 1 && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700">Source Lot</label>
                    <select value={transferOutForm.srcLotId} onChange={e => handleTransferOutLotChange(e.target.value)} className={inputCls}>
                      {activeLots.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.lot_number ? `Lot ${l.lot_number}` : 'No lot #'} · {l.quantity_remaining} available
                          {l.expiration_date ? ` · Exp ${fmtDate(l.expiration_date)}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Destination Storeroom <span className="text-red-500">*</span></label>
                  <select value={transferOutForm.destStoreroomId} onChange={e => setTransferOutForm(f => f ? { ...f, destStoreroomId: e.target.value } : f)} className={inputCls}>
                    <option value="">Select storeroom…</option>
                    {validDests.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">
                    Quantity <span className="text-red-500">*</span>
                    {selectedLot && <span className="ml-1 text-zinc-400 font-normal">({selectedLot.quantity_remaining} available)</span>}
                  </label>
                  <input type="number" min="1" max={transferOutForm.maxQty} value={transferOutForm.quantity}
                    onChange={e => setTransferOutForm(f => f ? { ...f, quantity: e.target.value } : f)} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Notes</label>
                  <input type="text" value={transferOutForm.notes} placeholder="Optional"
                    onChange={e => setTransferOutForm(f => f ? { ...f, notes: e.target.value } : f)} className={inputCls} />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={handleTransferOutSubmit} disabled={loading || !transferOutForm.destStoreroomId}
                  className="flex-1 rounded-lg bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-900 disabled:opacity-50">
                  {loading ? 'Saving...' : 'Confirm Transfer'}
                </button>
                <button onClick={() => { setTransferOutForm(null); setError(null) }} className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">Cancel</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
