'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateBagInventoryMode } from '@/app/actions/medical'
import UseModal from '../../medical/forms/UseModal'
import AdministerModal from '../../medical/forms/AdministerModal'
import WasteModal from '../../medical/forms/WasteModal'
import RestockModal from '../../medical/forms/RestockModal'
import TransferOutModal from '../../medical/forms/TransferOutModal'
import MoveBagPanel from './MoveBagPanel'

interface Bag { id: string; name: string; template_id: string | null; inventory_mode: string | null; location_label?: string | null; qr_code?: string | null; compartment_id?: string | null; parent_storeroom_id?: string | null }
interface BagEquipment { id: string; storeroom_id: string; item_name: string; expected_quantity: number }
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
  bags: allBags, scope, embedded = false, bagEquipment = [], compartmentOptions = [], bagInventory, bagLots, supplyTypes, deptStorerooms,
  storeroomInventory, storeroomLots, units, personnel,
  bagTemplates, apparatusId, isAdmin, isOfficerOrAbove, myPersonnelId,
}: {
  bags: Bag[]
  // Show only the bags inside one compartment (a bag belongs to the compartment its outermost bag is in,
  // so nested bags travel with their box), or only the bags that aren't in any compartment.
  scope?: 'unpinned' | { compartmentId: string }
  // Rendered inside a compartment card instead of as its own card.
  embedded?: boolean
  bagEquipment?: BagEquipment[]
  compartmentOptions?: { id: string; name: string }[]
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

  const byId = Object.fromEntries(allBags.map(b => [b.id, b]))
  const rootOf = (b: Bag): Bag => {
    let cur = b
    const seen = new Set<string>()
    while (cur.parent_storeroom_id && byId[cur.parent_storeroom_id] && !seen.has(cur.id)) { seen.add(cur.id); cur = byId[cur.parent_storeroom_id] }
    return cur
  }
  const rawBags = !scope ? allBags : allBags.filter(b => {
    const root = rootOf(b)
    return scope === 'unpinned' ? !root.compartment_id : root.compartment_id === scope.compartmentId
  })

  // Tab order is the nesting tree: a bag first, then the bags inside it (marked ↳), so the outer
  // bag reads as the primary one. A bag nested inside a bag we don't have is treated as top level.
  const bagDepth: Record<string, number> = {}
  const bags: Bag[] = []
  const nameSet = new Set(rawBags.map(b => b.name))
  const byName = (a: Bag, b: Bag) => a.name.localeCompare(b.name, undefined, { numeric: true })
  const walk = (bag: Bag, depth: number) => {
    if (bagDepth[bag.id] !== undefined) return
    bagDepth[bag.id] = depth
    bags.push(bag)
    rawBags.filter(c => c.location_label === `Inside ${bag.name}`).sort(byName).forEach(c => walk(c, depth + 1))
  }
  rawBags
    .filter(b => !(b.location_label?.startsWith('Inside ') && nameSet.has(b.location_label.slice('Inside '.length))))
    .sort(byName)
    .forEach(b => walk(b, 0))
  rawBags.forEach(b => walk(b, 0)) // anything not reached (e.g. a nesting cycle) still gets a tab

  const [expandedBagId, setExpandedBagId] = useState<string | null>(bags[0]?.id ?? null)

  // One bag per line; the bags inside it sit on the line(s) beneath, indented, so the outer bag
  // reads as primary and you can see at a glance what is in the box.
  const tabCls = (id: string) =>
    `rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${expandedBagId === id ? 'bg-red-700 text-white border-red-700' : 'bg-white text-zinc-600 border-zinc-200 hover:border-red-300'}`
  const childrenOf = (bag: Bag) => bags.filter(c => c.location_label === `Inside ${bag.name}` && bagDepth[c.id] === bagDepth[bag.id] + 1)
  function BagTabGroup({ bag, depth }: { bag: Bag; depth: number }) {
    const kids = childrenOf(bag)
    return (
      <div>
        {depth === 0 && <button onClick={() => setExpandedBagId(bag.id)} className={tabCls(bag.id)}>{bag.name}</button>}
        {kids.length > 0 && (
          <div className="mt-2 ml-4 flex flex-wrap items-center gap-2 border-l-2 border-zinc-200 pl-3">
            <span className="text-xs text-zinc-400">Inside {bag.name}:</span>
            {kids.map(k => <button key={k.id} onClick={() => setExpandedBagId(k.id)} className={tabCls(k.id)}>{k.name}</button>)}
          </div>
        )}
        {kids.filter(k => childrenOf(k).length > 0).map(k => <BagTabGroup key={k.id} bag={k} depth={depth + 1} />)}
      </div>
    )
  }
  const [expandedInvId, setExpandedInvId] = useState<string | null>(null)


  const [modal, setModal] = useState<{ kind: 'use' | 'administer' | 'restock' | 'transferOut'; invId: string } | { kind: 'waste'; invId: string; lotId: string } | null>(null)

  const supplyMap = Object.fromEntries(supplyTypes.map(s => [s.id, s]))
  const lotsFor = (invId: string) => bagLots.filter(l => l.storeroom_inventory_id === invId)
  const totalQty = (invId: string) => lotsFor(invId).reduce((s, l) => s + l.quantity_remaining, 0)

  async function handleModeToggle(bagId: string, currentMode: string | null) {
    const newMode = currentMode === 'standard' ? 'independent' : 'standard'
    setLoading(true)
    const r = await updateBagInventoryMode(bagId, newMode)
    if (r?.error) setError(r.error)
    else router.refresh()
    setLoading(false)
  }

  const inputCls = "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"

  // Nothing to show in this scope (e.g. a compartment with no bags). The "no bags on this truck" card
  // is only for the unscoped view or the truck-level section when the truck truly has none.
  if (scope && rawBags.length === 0 && !(scope === 'unpinned' && allBags.length === 0)) return null

  return (
    <div className={embedded ? 'px-5 py-3 border-t border-zinc-100 bg-zinc-50/50' : 'rounded-xl bg-white shadow-sm border border-zinc-200 p-5 mb-5'}>
      {embedded ? (
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Bags in this compartment</p>
      ) : (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-zinc-900">
            {scope === 'unpinned' && allBags.length > rawBags.length ? 'Bags not in a compartment' : 'Medical Bags'}
          </h2>
          {isAdmin && (
            <a href="/medical?mode=bags" className="text-xs font-semibold text-zinc-400 hover:text-zinc-700">Manage in Medical →</a>
          )}
        </div>
      )}

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
        <div className="flex flex-col gap-3 mb-4">
          {bags.filter(b => bagDepth[b.id] === 0).map(root => <BagTabGroup key={root.id} bag={root} depth={0} />)}
        </div>
      )}

      {bags.map(bag => {
        if (bags.length > 1 && expandedBagId !== bag.id) return null
        const inv = bagInventory.filter(i => i.storeroom_id === bag.id)
        const equipment = bagEquipment.filter(e => e.storeroom_id === bag.id)
        const nestedBags = bags.filter(b => b.location_label === `Inside ${bag.name}`)
        return (
          <div key={bag.id}>
            {isAdmin && (
              <div className="mb-3">
                <MoveBagPanel bag={bag} compartments={compartmentOptions} bags={bags.map(b => ({ id: b.id, name: b.name }))}
                  storerooms={deptStorerooms} members={personnel} />
              </div>
            )}
            {(bag.location_label || equipment.length > 0 || nestedBags.length > 0 || bag.qr_code) && (
              <div className="mb-3 rounded-lg bg-zinc-50 border border-zinc-200 px-4 py-3 text-xs text-zinc-600">
                {bag.location_label && <p className="font-semibold text-zinc-700">{bag.location_label}</p>}
                {bag.qr_code && (
                  <a href={`/print/qr?type=bag&code=${encodeURIComponent(bag.qr_code)}&title=${encodeURIComponent(bag.name)}`} target="_blank" rel="noreferrer"
                    className="mt-1 inline-block font-semibold text-blue-600 hover:underline">Print QR ({bag.qr_code})</a>
                )}
                <a href={`/equipment/bag/${bag.id}`} className="mt-1 ml-3 inline-block font-semibold text-blue-600 hover:underline">Check history →</a>
                {nestedBags.length > 0 && (
                  <p className="mt-1">Contains: {nestedBags.map(b => (
                    <button key={b.id} onClick={() => setExpandedBagId(b.id)} className="mr-2 font-semibold text-blue-600 hover:underline">{b.name}</button>
                  ))}</p>
                )}
                {equipment.length > 0 && (
                  <p className="mt-1">Equipment: {equipment.map(e => `${e.item_name} ×${e.expected_quantity}`).join(', ')}</p>
                )}
              </div>
            )}
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

    </div>
  )
}
