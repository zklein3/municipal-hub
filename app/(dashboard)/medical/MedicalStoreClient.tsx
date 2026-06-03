'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { receiveStock } from '@/app/actions/medical'

interface Storeroom { id: string; name: string; station_id: string | null }
interface InventoryRow { id: string; storeroom_id: string; supply_type_id: string; par_level: number }
interface SupplyType { id: string; name: string; category: string; unit_of_measure: string; is_controlled: boolean; tracks_expiration: boolean; required_signatures: number }
interface Lot { id: string; storeroom_inventory_id: string; lot_number: string | null; expiration_date: string | null; quantity_received: number; quantity_remaining: number; received_date: string }
interface Personnel { id: string; name: string }
interface Station { id: string; station_name: string; station_number: string | null }

interface ReceiveForm {
  inventoryId: string
  supplyName: string
  tracksExpiration: boolean
  requiredSignatures: number
  lotNumber: string
  expirationDate: string
  quantity: string
  notes: string
  signer1Id: string
  signer2Id: string
  step: 'form' | 'sign'
}

const STATUS_COLORS = {
  expired: 'bg-red-100 text-red-700',
  expiring: 'bg-amber-100 text-amber-700',
  low: 'bg-orange-100 text-orange-700',
  good: 'bg-green-100 text-green-700',
  empty: 'bg-zinc-100 text-zinc-500',
}

function getExpirationStatus(expDate: string | null): 'expired' | 'expiring' | 'good' {
  if (!expDate) return 'good'
  const exp = new Date(expDate + 'T00:00:00')
  const now = new Date()
  const days30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  if (exp < now) return 'expired'
  if (exp <= days30) return 'expiring'
  return 'good'
}

function getInventoryStatus(total: number, par: number, lots: Lot[]): 'expired' | 'expiring' | 'low' | 'good' | 'empty' {
  if (total === 0) return 'empty'
  const hasExpired = lots.some(l => getExpirationStatus(l.expiration_date) === 'expired')
  const hasExpiring = lots.some(l => getExpirationStatus(l.expiration_date) === 'expiring')
  if (hasExpired) return 'expired'
  if (total < par) return 'low'
  if (hasExpiring) return 'expiring'
  return 'good'
}

const STATUS_LABELS = { expired: 'Expired Stock', expiring: 'Expiring Soon', low: 'Below PAR', good: 'Good', empty: 'No Stock' }

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function MedicalStoreClient({
  storerooms, inventory, supplyTypes, lots, personnel, stations, isAdmin, myPersonnelId,
}: {
  storerooms: Storeroom[]
  inventory: InventoryRow[]
  supplyTypes: SupplyType[]
  lots: Lot[]
  personnel: Personnel[]
  stations: Station[]
  isAdmin: boolean
  myPersonnelId: string
}) {
  const router = useRouter()
  const [selectedStoreroomId, setSelectedStoreroomId] = useState<string>(storerooms[0]?.id ?? '')
  const [expandedInvId, setExpandedInvId] = useState<string | null>(null)
  const [receiveForm, setReceiveForm] = useState<ReceiveForm | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const supplyMap = Object.fromEntries(supplyTypes.map(s => [s.id, s]))
  const stationMap = Object.fromEntries(stations.map(s => [s.id, s]))

  const stationLabel = (stationId: string | null) => {
    if (!stationId) return null
    const s = stationMap[stationId]
    return s ? `Station ${s.station_number ? s.station_number + ' — ' : ''}${s.station_name}` : null
  }

  const selectedStoreroom = storerooms.find(s => s.id === selectedStoreroomId)
  const storeroomInv = inventory.filter(i => i.storeroom_id === selectedStoreroomId)

  const lotsForInv = (invId: string) => lots.filter(l => l.storeroom_inventory_id === invId)
  const totalQty = (invId: string) => lotsForInv(invId).reduce((sum, l) => sum + l.quantity_remaining, 0)

  function openReceive(inv: InventoryRow) {
    const supply = supplyMap[inv.supply_type_id]
    if (!supply) return
    setError(null)
    setReceiveForm({
      inventoryId: inv.id,
      supplyName: supply.name,
      tracksExpiration: supply.tracks_expiration,
      requiredSignatures: supply.required_signatures,
      lotNumber: '',
      expirationDate: '',
      quantity: '',
      notes: '',
      signer1Id: supply.required_signatures >= 1 ? myPersonnelId : '',
      signer2Id: '',
      step: 'form',
    })
  }

  async function handleReceiveSubmit() {
    if (!receiveForm) return
    const qty = parseInt(receiveForm.quantity)
    if (!qty || qty < 1) { setError('Quantity must be at least 1.'); return }
    if (receiveForm.tracksExpiration && !receiveForm.expirationDate) { setError('Expiration date is required for this supply type.'); return }
    if (receiveForm.requiredSignatures >= 1 && !receiveForm.signer1Id) { setError('Signer 1 is required.'); return }
    if (receiveForm.requiredSignatures >= 2 && !receiveForm.signer2Id) { setError('A second signer is required for controlled substances.'); return }

    setError(null); setLoading(true)
    const result = await receiveStock({
      storeroom_inventory_id: receiveForm.inventoryId,
      lot_number: receiveForm.lotNumber || null,
      expiration_date: receiveForm.expirationDate || null,
      quantity_received: qty,
      notes: receiveForm.notes || null,
      signer_1_id: receiveForm.signer1Id || null,
      signer_2_id: receiveForm.signer2Id || null,
    })
    if (result?.error) { setError(result.error) }
    else {
      setSuccess(`Received ${qty} ${supplyMap[inventory.find(i => i.id === receiveForm.inventoryId)?.supply_type_id ?? '']?.unit_of_measure ?? 'units'} of ${receiveForm.supplyName}.`)
      setReceiveForm(null)
      router.refresh()
    }
    setLoading(false)
  }

  if (storerooms.length === 0) {
    return (
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">Medical Storeroom</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Track medical supply inventory and expiration</p>
        </div>
        <div className="rounded-xl bg-white border border-zinc-200 px-6 py-12 text-center text-sm text-zinc-400">
          No medical storerooms configured.
          {isAdmin && <span> <a href="/dept-admin/medical" className="text-red-600 font-semibold hover:underline">Set one up in Dept Admin →</a></span>}
        </div>
      </div>
    )
  }

  // Compute alerts across all storerooms
  const now = new Date()
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  type Alert = { level: 'red' | 'amber'; message: string }
  const alerts: Alert[] = []
  for (const inv of inventory) {
    const supply = supplyMap[inv.supply_type_id]
    if (!supply) continue
    const invLots = lots.filter(l => l.storeroom_inventory_id === inv.id)
    const total = invLots.reduce((s, l) => s + l.quantity_remaining, 0)
    const expiredLots = invLots.filter(l => l.expiration_date && new Date(l.expiration_date + 'T00:00:00') < now)
    const expiringLots = invLots.filter(l => l.expiration_date && new Date(l.expiration_date + 'T00:00:00') >= now && new Date(l.expiration_date + 'T00:00:00') <= soon)
    if (expiredLots.length > 0) alerts.push({ level: 'red', message: `${supply.name}: ${expiredLots.length} expired lot${expiredLots.length !== 1 ? 's' : ''}` })
    if (expiringLots.length > 0) alerts.push({ level: 'amber', message: `${supply.name}: expiring within 30 days` })
    if (inv.par_level > 0 && total < inv.par_level) alerts.push({ level: total === 0 ? 'red' : 'amber', message: `${supply.name}: ${total} on hand, PAR is ${inv.par_level}` })
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">Medical Storeroom</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Track medical supply inventory and expiration</p>
      </div>

      {success && <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 border border-green-200">{success}</div>}
      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}

      {/* Alerts panel */}
      {alerts.length > 0 && (
        <div className="mb-5 flex flex-col gap-2">
          {alerts.filter(a => a.level === 'red').map((a, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <span className="text-red-600 font-bold shrink-0">⚠</span>
              <p className="text-sm text-red-700 font-medium">{a.message}</p>
            </div>
          ))}
          {alerts.filter(a => a.level === 'amber').map((a, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
              <span className="text-amber-600 font-bold shrink-0">!</span>
              <p className="text-sm text-amber-700">{a.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Storeroom selector */}
      {storerooms.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {storerooms.map(room => (
            <button key={room.id} onClick={() => setSelectedStoreroomId(room.id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold border transition-colors ${
                selectedStoreroomId === room.id
                  ? 'bg-red-700 text-white border-red-700'
                  : 'bg-white text-zinc-700 border-zinc-200 hover:border-red-300'
              }`}>
              {room.name}
            </button>
          ))}
        </div>
      )}

      {selectedStoreroom && (
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-zinc-900">{selectedStoreroom.name}</p>
            {stationLabel(selectedStoreroom.station_id) && (
              <p className="text-xs text-zinc-400">{stationLabel(selectedStoreroom.station_id)}</p>
            )}
          </div>
          {isAdmin && (
            <a href="/dept-admin/medical" className="text-xs font-semibold text-zinc-400 hover:text-zinc-700">
              Configure →
            </a>
          )}
        </div>
      )}

      {storeroomInv.length === 0 ? (
        <div className="mt-4 rounded-xl bg-white border border-zinc-200 px-6 py-12 text-center text-sm text-zinc-400">
          No supply types assigned to this storeroom.
          {isAdmin && <span> <a href="/dept-admin/medical" className="text-red-600 font-semibold hover:underline">Add supply types →</a></span>}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {storeroomInv.map(inv => {
            const supply = supplyMap[inv.supply_type_id]
            if (!supply) return null
            const invLots = lotsForInv(inv.id)
            const total = totalQty(inv.id)
            const status = getInventoryStatus(total, inv.par_level, invLots)
            const isExpanded = expandedInvId === inv.id

            return (
              <div key={inv.id} className="rounded-xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
                <div className="flex items-center px-5 py-4 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-semibold text-zinc-900">{supply.name}</p>
                      {supply.is_controlled && (
                        <span className="text-xs rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 font-medium">Controlled</span>
                      )}
                      <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[status]}`}>
                        {STATUS_LABELS[status]}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      {total} {supply.unit_of_measure} on hand · PAR {inv.par_level}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button onClick={() => setExpandedInvId(isExpanded ? null : inv.id)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                      {isExpanded ? 'Hide' : 'Lots'}
                    </button>
                    <button onClick={() => openReceive(inv)}
                      className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800">
                      Receive
                    </button>
                  </div>
                </div>

                {/* Lot detail */}
                {isExpanded && (
                  <div className="border-t border-zinc-100 bg-zinc-50 px-5 py-3">
                    {invLots.length === 0 ? (
                      <p className="text-xs text-zinc-400 py-2">No active lots. Use Receive to add stock.</p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Active Lots</p>
                        {invLots.map(lot => {
                          const expStatus = getExpirationStatus(lot.expiration_date)
                          return (
                            <div key={lot.id} className="flex items-center justify-between bg-white rounded-lg border border-zinc-200 px-4 py-2.5 gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-zinc-900">
                                  {lot.lot_number ? `Lot ${lot.lot_number}` : 'No lot number'}
                                </p>
                                <p className="text-xs text-zinc-400">
                                  Received {fmtDate(lot.received_date)}
                                </p>
                              </div>
                              <div className="flex items-center gap-4 shrink-0 text-right">
                                {supply.tracks_expiration && (
                                  <div>
                                    <p className={`text-xs font-semibold ${expStatus === 'expired' ? 'text-red-600' : expStatus === 'expiring' ? 'text-amber-600' : 'text-zinc-500'}`}>
                                      {expStatus === 'expired' ? '⚠ Expired' : expStatus === 'expiring' ? '⚠ Exp soon' : 'Exp'} {fmtDate(lot.expiration_date)}
                                    </p>
                                  </div>
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
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Receive Stock Modal */}
      {receiveForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6">
            <h2 className="text-base font-bold text-zinc-900 mb-1">Receive Stock</h2>
            <p className="text-sm text-zinc-500 mb-5">{receiveForm.supplyName}</p>

            {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}

            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Lot Number</label>
                  <input type="text" value={receiveForm.lotNumber} placeholder="Optional"
                    onChange={e => setReceiveForm(f => f ? { ...f, lotNumber: e.target.value } : f)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <input type="number" min="1" value={receiveForm.quantity} placeholder="0"
                    onChange={e => setReceiveForm(f => f ? { ...f, quantity: e.target.value } : f)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-center focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                </div>
              </div>

              {receiveForm.tracksExpiration && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">
                    Expiration Date <span className="text-red-500">*</span>
                  </label>
                  <input type="date" value={receiveForm.expirationDate}
                    onChange={e => setReceiveForm(f => f ? { ...f, expirationDate: e.target.value } : f)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Notes</label>
                <input type="text" value={receiveForm.notes} placeholder="Optional"
                  onChange={e => setReceiveForm(f => f ? { ...f, notes: e.target.value } : f)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>

              {receiveForm.requiredSignatures >= 1 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">
                    Received By <span className="text-red-500">*</span>
                  </label>
                  <select value={receiveForm.signer1Id}
                    onChange={e => setReceiveForm(f => f ? { ...f, signer1Id: e.target.value } : f)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                    <option value="">Select person...</option>
                    {personnel.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {receiveForm.requiredSignatures >= 2 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">
                    Witness / Second Signer <span className="text-red-500">*</span>
                    <span className="ml-1 text-amber-600 font-normal">(controlled substance)</span>
                  </label>
                  <select value={receiveForm.signer2Id}
                    onChange={e => setReceiveForm(f => f ? { ...f, signer2Id: e.target.value } : f)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                    <option value="">Select witness...</option>
                    {personnel
                      .filter(p => p.id !== receiveForm.signer1Id)
                      .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleReceiveSubmit} disabled={loading}
                className="flex-1 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
                {loading ? 'Saving...' : 'Confirm Receipt'}
              </button>
              <button onClick={() => { setReceiveForm(null); setError(null) }}
                className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
