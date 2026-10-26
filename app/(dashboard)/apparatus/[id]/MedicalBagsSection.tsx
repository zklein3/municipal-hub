'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { receiveStock, updateBagInventoryMode } from '@/app/actions/medical'
import SignatureCapture, { SignatureCaptureHandle } from '../../medical/SignatureCapture'
import UseModal from '../../medical/forms/UseModal'
import AdministerModal from '../../medical/forms/AdministerModal'
import WasteModal from '../../medical/forms/WasteModal'
import RestockModal from '../../medical/forms/RestockModal'
import TransferOutModal from '../../medical/forms/TransferOutModal'

interface Bag { id: string; name: string; template_id: string | null; inventory_mode: string | null }
interface InventoryRow { id: string; storeroom_id: string; supply_type_id: string; par_level: number }
interface Lot {
  id: string; storeroom_inventory_id: string; lot_number: string | null; expiration_date: string | null
  quantity_received: number; quantity_remaining: number; received_date: string
  concentration_amount: number | null; concentration_unit: string | null
  volume_per_unit: number | null; volume_unit: string | null
}
interface SupplyType { id: string; name: string; category: string; unit_of_measure: string; is_controlled: boolean; tracks_expiration: boolean; required_signatures: number }
interface Storeroom { id: string; name: string }
interface SrcLot { id: string; storeroom_inventory_id: string; lot_number: string | null; quantity_remaining: number; expiration_date: string | null }
interface ControlUnit { id: string; lot_id: string; control_number: string; status: string }
interface Personnel { id: string; name: string }
interface BagTemplate { id: string; name: string }

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
  storeroomInventory, storeroomLots, units, personnel,
  bagTemplates, apparatusId, isAdmin, isOfficerOrAbove, myPersonnelId,
}: {
  bags: Bag[]
  bagInventory: InventoryRow[]
  bagLots: Lot[]
  supplyTypes: SupplyType[]
  deptStorerooms: Storeroom[]
  storeroomInventory: { id: string; storeroom_id: string; supply_type_id: string }[]
  storeroomLots: SrcLot[]
  units: ControlUnit[]
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

  type ReceiveForm = { invId: string; supplyName: string; tracksExp: boolean; requiredSigs: number; lotNumber: string; expirationDate: string; quantity: string; notes: string; signer1Id: string; signer2Id: string }

  const [modal, setModal] = useState<{ kind: 'use' | 'administer' | 'restock' | 'transferOut'; invId: string } | { kind: 'waste'; invId: string; lotId: string } | null>(null)
  const [receiveForm, setReceiveForm] = useState<ReceiveForm | null>(null)

  const supplyMap = Object.fromEntries(supplyTypes.map(s => [s.id, s]))
  const lotsFor = (invId: string) => bagLots.filter(l => l.storeroom_inventory_id === invId)
  const totalQty = (invId: string) => lotsFor(invId).reduce((s, l) => s + l.quantity_remaining, 0)

  function openReceive(inv: InventoryRow) {
    const supply = supplyMap[inv.supply_type_id]; if (!supply) return
    setError(null)
    setReceiveForm({ invId: inv.id, supplyName: supply.name, tracksExp: supply.tracks_expiration, requiredSigs: supply.required_signatures, lotNumber: '', expirationDate: '', quantity: '', notes: '', signer1Id: supply.required_signatures >= 1 ? myPersonnelId : '', signer2Id: '' })
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
      control_numbers: null,
    })
    if (r?.error) setError(r.error)
    else { setSuccess(`Received ${qty} ${receiveForm.supplyName}.`); setReceiveForm(null); router.refresh() }
    setLoading(false)
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
          <a href="/medical?mode=bags" className="text-xs font-semibold text-zinc-400 hover:text-zinc-700">Manage in Medical →</a>
        )}
      </div>

      {success && <div className="mb-3 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 border border-green-200">{success}</div>}
      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}

      {bags.length === 0 && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-8 text-center text-sm text-zinc-400">
          No bags assigned to this apparatus.
          {isAdmin && <span> <a href="/medical?mode=bags" className="text-red-600 font-semibold hover:underline">Assign one in Medical Admin →</a></span>}
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
                {isAdmin && <span> <a href="/medical?mode=bags" className="text-red-600 hover:underline">Configure →</a></span>}
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
                            <button onClick={() => setModal({ kind: 'restock', invId: item.id })}
                              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors text-center sm:text-left ${(status === 'low' || status === 'empty') ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50'}`}>
                              Restock
                            </button>
                          )}
                          {canAct && total > 0 && destAvailable && (
                            <button onClick={() => setModal({ kind: 'transferOut', invId: item.id })}
                              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 text-center sm:text-left">
                              Transfer
                            </button>
                          )}
                          <button onClick={() => setModal({ kind: supply.is_controlled ? 'administer' : 'use', invId: item.id })} disabled={total === 0}
                            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed text-center sm:text-left">
                            {supply.is_controlled ? 'Administer' : 'Use'}
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
                                      <button onClick={() => setModal({ kind: 'waste', invId: item.id, lotId: lot.id })}
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

      {/* Use / Administer / Waste -- shared forms */}
      {modal && (() => {
        const inv = bagInventory.find(i => i.id === modal.invId)
        const supply = inv ? supplyMap[inv.supply_type_id] : undefined
        if (!inv || !supply) return null
        const done = (msg: string) => { setSuccess(msg); setModal(null); router.refresh() }
        const common = { inventoryId: inv.id, supply, personnel, myPersonnelId, onClose: () => setModal(null), onDone: done }
        if (modal.kind === 'use') return <UseModal {...common} lots={lotsFor(inv.id)} />
        if (modal.kind === 'administer') return <AdministerModal {...common} lots={lotsFor(inv.id)} units={units} />
        if (modal.kind === 'restock') return <RestockModal destInventoryId={inv.id} destStoreroomId={inv.storeroom_id} supply={supply} srcInventory={storeroomInventory} srcLots={storeroomLots} deptStorerooms={deptStorerooms} onClose={common.onClose} onDone={done} />
        if (modal.kind === 'transferOut') return <TransferOutModal srcInventoryId={inv.id} supply={supply} lots={lotsFor(inv.id)} srcInventory={storeroomInventory} deptStorerooms={deptStorerooms} onClose={common.onClose} onDone={done} />
        if (modal.kind !== 'waste') return null
        const lot = bagLots.find(l => l.id === modal.lotId)
        return lot ? <WasteModal {...common} lot={lot} units={units} /> : null
      })()}

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

    </div>
  )
}
