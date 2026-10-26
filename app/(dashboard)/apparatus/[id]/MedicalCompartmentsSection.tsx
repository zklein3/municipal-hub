'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { transferStock, updateStoreroomPar } from '@/app/actions/medical'
import { MEDICAL_STATUS_COLORS, MEDICAL_STATUS_LABELS, getMedicalSupplyStatus } from '@/lib/medical-status'
import UseModal from '../../medical/forms/UseModal'
import AdministerModal from '../../medical/forms/AdministerModal'
import WasteModal from '../../medical/forms/WasteModal'

interface CompStoreroom { id: string; name: string; compartment_id: string; compartment_code: string; compartment_name: string | null }
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

const STATUS_COLORS = MEDICAL_STATUS_COLORS
const STATUS_LABELS = MEDICAL_STATUS_LABELS

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getStatus(total: number, par: number, lots: Lot[]) {
  return getMedicalSupplyStatus(total, par, lots)
}

export default function MedicalCompartmentsSection({
  compartmentStorerooms, compInventory, compLots, compSupplyTypes,
  deptStorerooms, srcInventory, srcLots, units, personnel,
  apparatusId, isAdmin, isOfficerOrAbove, myPersonnelId,
  onlyCompartmentId, embedded = false,
}: {
  // Embedded inside a truck compartment card: show just that compartment's medical rows (with their
  // Use / Restock / Transfer buttons), no outer card, header or tabs.
  onlyCompartmentId?: string
  embedded?: boolean
  compartmentStorerooms: CompStoreroom[]
  compInventory: InventoryRow[]
  compLots: Lot[]
  compSupplyTypes: SupplyType[]
  deptStorerooms: Storeroom[]
  srcInventory: { id: string; storeroom_id: string; supply_type_id: string }[]
  srcLots: SrcLot[]
  units: ControlUnit[]
  personnel: Personnel[]
  apparatusId: string
  isAdmin: boolean
  isOfficerOrAbove: boolean
  myPersonnelId: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [editingParId, setEditingParId] = useState<string | null>(null)
  const [parDraft, setParDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [expandedStoreroomId, setExpandedStoreroomId] = useState<string | null>(compartmentStorerooms[0]?.id ?? null)
  const [expandedInvId, setExpandedInvId] = useState<string | null>(null)

  type RestockForm = {
    destInvId: string; supplyTypeId: string; supplyName: string; unitOfMeasure: string
    isControlled: boolean; destStoreroomId: string; srcInvId: string; srcLotId: string
    quantity: string; notes: string
  }
  type TransferOutForm = {
    srcInvId: string; supplyTypeId: string; supplyName: string; unitOfMeasure: string
    isControlled: boolean; srcLotId: string; destStoreroomId: string
    maxQty: number; quantity: string; notes: string
  }

  const [modal, setModal] = useState<{ kind: 'use' | 'administer'; invId: string } | { kind: 'waste'; invId: string; lotId: string } | null>(null)
  const [restockForm, setRestockForm] = useState<RestockForm | null>(null)
  const [transferOutForm, setTransferOutForm] = useState<TransferOutForm | null>(null)

  const supplyMap = Object.fromEntries(compSupplyTypes.map(s => [s.id, s]))
  const lotsFor = (invId: string) => compLots.filter(l => l.storeroom_inventory_id === invId)
  const totalQty = (invId: string) => lotsFor(invId).reduce((s, l) => s + l.quantity_remaining, 0)

  function openRestock(inv: InventoryRow) {
    const supply = supplyMap[inv.supply_type_id]; if (!supply) return
    const srcInvRows = srcInventory.filter(i => i.supply_type_id === inv.supply_type_id)
    const availableLots = srcLots.filter(l => srcInvRows.some(i => i.id === l.storeroom_inventory_id) && l.quantity_remaining > 0)
    if (availableLots.length === 0) { setError('No stock available in any storeroom for this supply.'); return }
    const firstLot = availableLots[0]
    const firstSrcInv = srcInvRows.find(i => i.id === firstLot.storeroom_inventory_id)
    setError(null)
    setRestockForm({
      destInvId: inv.id, supplyTypeId: inv.supply_type_id, supplyName: supply.name,
      unitOfMeasure: supply.unit_of_measure, isControlled: supply.is_controlled,
      destStoreroomId: inv.storeroom_id,
      srcInvId: firstSrcInv?.id ?? '',
      srcLotId: firstLot.id,
      quantity: '1', notes: '',
    })
  }

  function openTransferOut(inv: InventoryRow) {
    const supply = supplyMap[inv.supply_type_id]; if (!supply) return
    const activeLots = lotsFor(inv.id).filter(l => l.quantity_remaining > 0)
    if (activeLots.length === 0) { setError('No stock available to transfer.'); return }
    const oldest = [...activeLots].sort((a, b) => a.received_date.localeCompare(b.received_date))[0]
    const validDests = deptStorerooms.filter(s => srcInventory.some(i => i.storeroom_id === s.id && i.supply_type_id === inv.supply_type_id))
    if (validDests.length === 0) { setError('No storeroom has this supply type assigned — transfer cannot be completed.'); return }
    setError(null)
    setTransferOutForm({
      srcInvId: inv.id, supplyTypeId: inv.supply_type_id, supplyName: supply.name,
      unitOfMeasure: supply.unit_of_measure, isControlled: supply.is_controlled,
      srcLotId: oldest.id, destStoreroomId: validDests[0].id,
      maxQty: oldest.quantity_remaining, quantity: '1', notes: '',
    })
  }

  async function handleRestockSubmit() {
    if (!restockForm) return
    const qty = parseInt(restockForm.quantity)
    if (!qty || qty < 1) { setError('Quantity must be at least 1.'); return }
    setError(null); setLoading(true)
    const r = await transferStock({
      source_inventory_id: restockForm.srcInvId,
      lot_id: restockForm.srcLotId,
      destination_storeroom_id: restockForm.destStoreroomId,
      quantity: qty,
      notes: restockForm.notes || null,
    })
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

  function handleRestockSrcChange(srcInvId: string) {
    if (!restockForm) return
    const lot = srcLots.find(l => l.storeroom_inventory_id === srcInvId && l.quantity_remaining > 0)
    setRestockForm(f => f ? { ...f, srcInvId, srcLotId: lot?.id ?? '' } : f)
  }

  function handleTransferOutLotChange(lotId: string) {
    if (!transferOutForm) return
    const lot = compLots.find(l => l.id === lotId)
    setTransferOutForm(f => f ? { ...f, srcLotId: lotId, maxQty: lot?.quantity_remaining ?? 0 } : f)
  }

  const inputCls = "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"

  const shownStorerooms = onlyCompartmentId
    ? compartmentStorerooms.filter(cs => cs.compartment_id === onlyCompartmentId)
    : compartmentStorerooms
  if (embedded && !shownStorerooms.some(cs => compInventory.some(i => i.storeroom_id === cs.id))) return null

  return (
    <div className={embedded ? 'px-5 py-3' : 'rounded-xl bg-white shadow-sm border border-zinc-200 p-5 mb-5'}>
      {!embedded && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-zinc-900">Compartment Medical Supplies</h2>
          {isAdmin && (
            <a href="/medical?mode=types" className="text-xs font-semibold text-zinc-400 hover:text-zinc-700">Manage →</a>
          )}
        </div>
      )}

      {success && <div className="mb-3 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 border border-green-200">{success}</div>}
      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}

      {/* Compartment tabs */}
      {!embedded && shownStorerooms.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {shownStorerooms.map(cs => (
            <button key={cs.id} onClick={() => setExpandedStoreroomId(cs.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${expandedStoreroomId === cs.id ? 'bg-red-700 text-white border-red-700' : 'bg-white text-zinc-600 border-zinc-200 hover:border-red-300'}`}>
              {cs.compartment_code}{cs.compartment_name ? ` — ${cs.compartment_name}` : ''}
            </button>
          ))}
        </div>
      )}

      {shownStorerooms.map(cs => {
        if (!embedded && shownStorerooms.length > 1 && expandedStoreroomId !== cs.id) return null
        const inv = compInventory.filter(i => i.storeroom_id === cs.id)
        return (
          <div key={cs.id}>
            {!embedded && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-zinc-700">
                  {cs.compartment_code}{cs.compartment_name ? ` — ${cs.compartment_name}` : ''}
                </span>
                <span className="text-xs text-zinc-400">{cs.name}</span>
              </div>
            )}

            {inv.length === 0 ? (
              <p className="text-sm text-zinc-400 py-4 text-center">
                No supplies assigned to this compartment.
                {isAdmin && <span> <a href="/medical?mode=types" className="text-red-600 hover:underline">Configure →</a></span>}
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
                  const srcAvailable = srcLots.some(l =>
                    srcInventory.find(i => i.id === l.storeroom_inventory_id && i.supply_type_id === item.supply_type_id) && l.quantity_remaining > 0
                  )
                  const destAvailable = deptStorerooms.some(s => srcInventory.some(i => i.storeroom_id === s.id && i.supply_type_id === item.supply_type_id))

                  return (
                    <div key={item.id} className="rounded-xl border border-zinc-200 overflow-hidden">
                      <div className="flex items-center px-4 py-3 gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="text-sm font-semibold text-zinc-900">{supply.name}</p>
                            {supply.is_controlled && <span className="text-xs rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 font-medium">Controlled</span>}
                            <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span>
                          </div>
                          <p className="text-xs text-zinc-400">
                            {total} {supply.unit_of_measure} · {editingParId === item.id ? (
                              <span className="inline-flex items-center gap-1">PAR
                                <input type="number" min="0" value={parDraft} onChange={e => setParDraft(e.target.value)} autoFocus className="w-14 rounded border border-zinc-300 px-1 py-0.5 text-xs" />
                                <button onClick={async () => { setLoading(true); const r = await updateStoreroomPar(item.id, parseInt(parDraft) || 0); setLoading(false); if (r?.error) { setError(r.error); return } setEditingParId(null); router.refresh() }} className="font-semibold text-red-700 hover:underline">Save</button>
                                <button onClick={() => setEditingParId(null)} className="hover:underline">Cancel</button>
                              </span>
                            ) : isAdmin ? (
                              <button onClick={() => { setEditingParId(item.id); setParDraft(String(item.par_level)) }} className="underline decoration-dotted hover:text-zinc-700" title="Change PAR">PAR {item.par_level}</button>
                            ) : <>PAR {item.par_level}</>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {lots.length > 0 && (
                            <button onClick={() => setExpandedInvId(isExpanded ? null : item.id)} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                              {isExpanded ? 'Hide' : 'Lots'}
                            </button>
                          )}
                          {canAct && srcAvailable && (
                            <button onClick={() => openRestock(item)}
                              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${(status === 'low' || status === 'empty') ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50'}`}>
                              Restock
                            </button>
                          )}
                          {canAct && total > 0 && destAvailable && (
                            <button onClick={() => openTransferOut(item)}
                              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-50">
                              Transfer
                            </button>
                          )}
                          <button onClick={() => setModal({ kind: supply.is_controlled ? 'administer' : 'use', invId: item.id })} disabled={total === 0}
                            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed">
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
                                  <div className="flex items-center gap-3 shrink-0 text-right">
                                    {supply.tracks_expiration && (
                                      <p className={`text-xs font-semibold ${expired ? 'text-red-600' : expiring ? 'text-amber-600' : 'text-zinc-500'}`}>
                                        {expired ? '⚠ Exp' : expiring ? '⚠ Exp soon' : 'Exp'} {fmtDate(lot.expiration_date)}
                                      </p>
                                    )}
                                    <div className="text-right">
                                      <p className="text-lg font-bold text-zinc-900">{lot.quantity_remaining}</p>
                                      <p className="text-xs text-zinc-400">{supply.unit_of_measure}</p>
                                    </div>
                                    {isOfficerOrAbove && (
                                      <button onClick={() => setModal({ kind: 'waste', invId: item.id, lotId: lot.id })}
                                        className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100">
                                        Waste
                                      </button>
                                    )}
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
        const inv = compInventory.find(i => i.id === modal.invId)
        const supply = inv ? supplyMap[inv.supply_type_id] : undefined
        if (!inv || !supply) return null
        const done = (msg: string) => { setSuccess(msg); setModal(null); router.refresh() }
        const common = { inventoryId: inv.id, supply, personnel, myPersonnelId, onClose: () => setModal(null), onDone: done }
        if (modal.kind === 'use') return <UseModal {...common} lots={lotsFor(inv.id)} />
        if (modal.kind === 'administer') return <AdministerModal {...common} lots={lotsFor(inv.id)} units={units} />
        if (modal.kind !== 'waste') return null
        const lot = compLots.find(l => l.id === modal.lotId)
        return lot ? <WasteModal {...common} lot={lot} units={units} /> : null
      })()}
      {/* Restock Modal */}
      {restockForm && (() => {
        const srcInvForType = srcInventory.filter(i => i.supply_type_id === restockForm.supplyTypeId)
        const srcInvWithLots = srcInvForType.filter(i => srcLots.some(l => l.storeroom_inventory_id === i.id && l.quantity_remaining > 0))
        const lotsForSrcInv = srcLots.filter(l => l.storeroom_inventory_id === restockForm.srcInvId && l.quantity_remaining > 0)
        const selectedLot = srcLots.find(l => l.id === restockForm.srcLotId)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-8">
            <div className="w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-xl p-6">
              <h2 className="text-base font-bold text-zinc-900 mb-1">Restock from Storeroom</h2>
              <p className="text-sm text-zinc-500 mb-5">{restockForm.supplyName}</p>
              {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}
              <div className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Source Storeroom <span className="text-red-500">*</span></label>
                  <select value={restockForm.srcInvId} onChange={e => handleRestockSrcChange(e.target.value)} className={inputCls}>
                    {srcInvWithLots.map(i => {
                      const room = deptStorerooms.find(s => s.id === i.storeroom_id)
                      return <option key={i.id} value={i.id}>{room?.name ?? 'Storeroom'}</option>
                    })}
                  </select>
                </div>
                {lotsForSrcInv.length > 1 && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700">Lot</label>
                    <select value={restockForm.srcLotId} onChange={e => setRestockForm(f => f ? { ...f, srcLotId: e.target.value } : f)} className={inputCls}>
                      {lotsForSrcInv.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.lot_number ? `Lot ${l.lot_number}` : 'No lot #'} · {l.quantity_remaining} available
                          {l.expiration_date ? ` · Exp ${fmtDate(l.expiration_date)}` : ''}
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
                  <input type="number" min="1" max={selectedLot?.quantity_remaining ?? undefined} value={restockForm.quantity}
                    onChange={e => setRestockForm(f => f ? { ...f, quantity: e.target.value } : f)} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Notes</label>
                  <input type="text" value={restockForm.notes} placeholder="Optional"
                    onChange={e => setRestockForm(f => f ? { ...f, notes: e.target.value } : f)} className={inputCls} />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={handleRestockSubmit} disabled={loading || !restockForm.srcLotId}
                  className="flex-1 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
                  {loading ? 'Saving…' : 'Confirm Restock'}
                </button>
                <button onClick={() => { setRestockForm(null); setError(null) }}
                  className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Transfer Out Modal */}
      {transferOutForm && (() => {
        const activeLots = compLots.filter(l => l.storeroom_inventory_id === transferOutForm.srcInvId && l.quantity_remaining > 0)
          .sort((a, b) => a.received_date.localeCompare(b.received_date))
        const selectedLot = compLots.find(l => l.id === transferOutForm.srcLotId)
        const validDests = deptStorerooms.filter(s => srcInventory.some(i => i.storeroom_id === s.id && i.supply_type_id === transferOutForm.supplyTypeId))
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
                  {loading ? 'Saving…' : 'Confirm Transfer'}
                </button>
                <button onClick={() => { setTransferOutForm(null); setError(null) }}
                  className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
