'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateStoreroomPar } from '@/app/actions/medical'
import { MEDICAL_STATUS_COLORS, MEDICAL_STATUS_LABELS, getMedicalSupplyStatus } from '@/lib/medical-status'
import UseModal from '../../medical/forms/UseModal'
import AdministerModal from '../../medical/forms/AdministerModal'
import WasteModal from '../../medical/forms/WasteModal'
import RestockModal from '../../medical/forms/RestockModal'
import TransferOutModal from '../../medical/forms/TransferOutModal'

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


  const [modal, setModal] = useState<{ kind: 'use' | 'administer' | 'restock' | 'transferOut'; invId: string } | { kind: 'waste'; invId: string; lotId: string } | null>(null)

  const supplyMap = Object.fromEntries(compSupplyTypes.map(s => [s.id, s]))
  const lotsFor = (invId: string) => compLots.filter(l => l.storeroom_inventory_id === invId)
  const totalQty = (invId: string) => lotsFor(invId).reduce((s, l) => s + l.quantity_remaining, 0)

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
                            <button onClick={() => setModal({ kind: 'restock', invId: item.id })}
                              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${(status === 'low' || status === 'empty') ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50'}`}>
                              Restock
                            </button>
                          )}
                          {canAct && total > 0 && destAvailable && (
                            <button onClick={() => setModal({ kind: 'transferOut', invId: item.id })}
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
        if (modal.kind === 'restock') return <RestockModal destInventoryId={inv.id} destStoreroomId={inv.storeroom_id} supply={supply} srcInventory={srcInventory} srcLots={srcLots} deptStorerooms={deptStorerooms} onClose={common.onClose} onDone={done} />
        if (modal.kind === 'transferOut') return <TransferOutModal srcInventoryId={inv.id} supply={supply} lots={lotsFor(inv.id)} srcInventory={srcInventory} deptStorerooms={deptStorerooms} onClose={common.onClose} onDone={done} />
        if (modal.kind !== 'waste') return null
        const lot = compLots.find(l => l.id === modal.lotId)
        return lot ? <WasteModal {...common} lot={lot} units={units} /> : null
      })()}
    </div>
  )
}
