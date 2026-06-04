'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { receiveStock, dispenseStock, wasteStock, transferStock, adjustStock, submitReorderRequest } from '@/app/actions/medical'

interface Storeroom { id: string; name: string; station_id: string | null; apparatus_id: string | null }
interface InventoryRow { id: string; storeroom_id: string; supply_type_id: string; par_level: number }
interface SupplyType { id: string; name: string; category: string; unit_of_measure: string; is_controlled: boolean; tracks_expiration: boolean; required_signatures: number }
interface Lot { id: string; storeroom_inventory_id: string; lot_number: string | null; expiration_date: string | null; quantity_received: number; quantity_remaining: number; received_date: string }
interface Personnel { id: string; name: string }
interface Station { id: string; station_name: string; station_number: string | null }
interface Transaction {
  id: string
  storeroom_id: string
  supply_type_id: string
  lot_id: string | null
  transaction_type: string
  quantity: number
  performed_by: string | null
  signer_1_id: string | null
  signer_2_id: string | null
  notes: string | null
  created_at: string
}

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

interface DispenseForm {
  inventoryId: string
  supplyName: string
  unitOfMeasure: string
  isControlled: boolean
  requiredSignatures: number
  lotId: string
  quantity: string
  notes: string
  signer1Id: string
  signer2Id: string
}

interface WasteForm {
  inventoryId: string
  lotId: string
  supplyName: string
  unitOfMeasure: string
  isControlled: boolean
  requiredSignatures: number
  lotNumber: string | null
  maxQty: number
  quantity: string
  wasteReason: string
  notes: string
  signer1Id: string
  signer2Id: string
}

interface AdjustForm {
  inventoryId: string
  lotId: string
  supplyName: string
  unitOfMeasure: string
  lotNumber: string | null
  currentQty: number
  newQty: string
  reason: string
  notes: string
}

interface TransferForm {
  inventoryId: string
  lotId: string
  supplyName: string
  supplyTypeId: string
  unitOfMeasure: string
  lotNumber: string | null
  maxQty: number
  quantity: string
  destinationStoreroomId: string
  notes: string
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
  storerooms, inventory, supplyTypes, lots, personnel, stations, apparatusMap, isAdmin, isOfficerOrAbove, myPersonnelId, pendingReorderIds,
  transactions, lotNumberMap, personnelMap,
}: {
  storerooms: Storeroom[]
  inventory: InventoryRow[]
  supplyTypes: SupplyType[]
  lots: Lot[]
  personnel: Personnel[]
  stations: Station[]
  apparatusMap: Record<string, { unit_number: string; type_name: string | null }>
  isAdmin: boolean
  isOfficerOrAbove: boolean
  myPersonnelId: string
  transactions: Transaction[]
  lotNumberMap: Record<string, string | null>
  personnelMap: Record<string, string>
  pendingReorderIds: Set<string>
}) {
  const router = useRouter()
  const [view, setView] = useState<'inventory' | 'history'>('inventory')
  const [selectedStoreroomId, setSelectedStoreroomId] = useState<string>(storerooms[0]?.id ?? '')
  const [expandedInvId, setExpandedInvId] = useState<string | null>(null)
  const [receiveForm, setReceiveForm] = useState<ReceiveForm | null>(null)
  const [historyStoreroomId, setHistoryStoreroomId] = useState<string>('all')
  const [historySupplyId, setHistorySupplyId] = useState<string>('all')
  const [historyTxType, setHistoryTxType] = useState<string>('all')
  const [dispenseForm, setDispenseForm] = useState<DispenseForm | null>(null)
  const [wasteForm, setWasteForm] = useState<WasteForm | null>(null)
  const [transferForm, setTransferForm] = useState<TransferForm | null>(null)
  const [adjustForm, setAdjustForm] = useState<AdjustForm | null>(null)
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

  const storeroomSubLabel = (room: Storeroom) => {
    if (room.apparatus_id) {
      const a = apparatusMap[room.apparatus_id]
      return a ? `${a.unit_number}${a.type_name ? ' — ' + a.type_name : ''}` : null
    }
    return stationLabel(room.station_id)
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

  function openDispense(inv: InventoryRow) {
    const supply = supplyMap[inv.supply_type_id]
    if (!supply) return
    const activeLots = lots.filter(l => l.storeroom_inventory_id === inv.id && l.quantity_remaining > 0)
    if (activeLots.length === 0) { setError('No stock available to dispense.'); return }
    const oldestLot = activeLots.sort((a, b) => a.received_date.localeCompare(b.received_date))[0]
    setError(null)
    setDispenseForm({
      inventoryId: inv.id,
      supplyName: supply.name,
      unitOfMeasure: supply.unit_of_measure,
      isControlled: supply.is_controlled,
      requiredSignatures: supply.required_signatures,
      lotId: oldestLot.id,
      quantity: '1',
      notes: '',
      signer1Id: supply.required_signatures >= 1 ? myPersonnelId : '',
      signer2Id: '',
    })
  }

  async function handleDispenseSubmit() {
    if (!dispenseForm) return
    const qty = parseInt(dispenseForm.quantity)
    if (!qty || qty < 1) { setError('Quantity must be at least 1.'); return }
    if (dispenseForm.requiredSignatures >= 1 && !dispenseForm.signer1Id) { setError('Signer 1 is required.'); return }
    if (dispenseForm.requiredSignatures >= 2 && !dispenseForm.signer2Id) { setError('A second signer is required for controlled substances.'); return }

    setError(null); setLoading(true)
    const result = await dispenseStock({
      storeroom_inventory_id: dispenseForm.inventoryId,
      lot_id: dispenseForm.lotId,
      quantity: qty,
      notes: dispenseForm.notes || null,
      signer_1_id: dispenseForm.signer1Id || null,
      signer_2_id: dispenseForm.signer2Id || null,
    })
    if (result?.error) { setError(result.error) }
    else {
      setSuccess(`Dispensed ${qty} ${dispenseForm.unitOfMeasure} of ${dispenseForm.supplyName}.`)
      setDispenseForm(null)
      router.refresh()
    }
    setLoading(false)
  }

  function openWaste(inv: InventoryRow, lot: Lot) {
    const supply = supplyMap[inv.supply_type_id]
    if (!supply) return
    setError(null)
    setWasteForm({
      inventoryId: inv.id,
      lotId: lot.id,
      supplyName: supply.name,
      unitOfMeasure: supply.unit_of_measure,
      isControlled: supply.is_controlled,
      requiredSignatures: supply.required_signatures,
      lotNumber: lot.lot_number,
      maxQty: lot.quantity_remaining,
      quantity: String(lot.quantity_remaining),
      wasteReason: 'expired',
      notes: '',
      signer1Id: supply.required_signatures >= 1 ? myPersonnelId : '',
      signer2Id: '',
    })
  }

  async function handleWasteSubmit() {
    if (!wasteForm) return
    const qty = parseInt(wasteForm.quantity)
    if (!qty || qty < 1) { setError('Quantity must be at least 1.'); return }
    if (qty > wasteForm.maxQty) { setError(`Only ${wasteForm.maxQty} units available.`); return }
    if (wasteForm.requiredSignatures >= 1 && !wasteForm.signer1Id) { setError('Signer 1 is required.'); return }
    if (wasteForm.requiredSignatures >= 2 && !wasteForm.signer2Id) { setError('A witness is required for controlled substance waste.'); return }

    setError(null); setLoading(true)
    const result = await wasteStock({
      storeroom_inventory_id: wasteForm.inventoryId,
      lot_id: wasteForm.lotId,
      quantity: qty,
      waste_reason: wasteForm.wasteReason,
      notes: wasteForm.notes || null,
      signer_1_id: wasteForm.signer1Id || null,
      signer_2_id: wasteForm.signer2Id || null,
    })
    if (result?.error) { setError(result.error) }
    else {
      setSuccess(`Wasted ${qty} ${wasteForm.unitOfMeasure} of ${wasteForm.supplyName}.`)
      setWasteForm(null)
      router.refresh()
    }
    setLoading(false)
  }

  function openTransfer(inv: InventoryRow, lot: Lot) {
    const supply = supplyMap[inv.supply_type_id]
    if (!supply) return
    // Find valid destination storerooms: have this supply type assigned, not the current storeroom
    const validDestIds = new Set(
      inventory
        .filter(i => i.supply_type_id === inv.supply_type_id && i.storeroom_id !== inv.storeroom_id)
        .map(i => i.storeroom_id)
    )
    const validDests = storerooms.filter(s => validDestIds.has(s.id))
    if (validDests.length === 0) { setError('No other storerooms have this supply type assigned.'); return }
    setError(null)
    setTransferForm({
      inventoryId: inv.id,
      lotId: lot.id,
      supplyName: supply.name,
      supplyTypeId: inv.supply_type_id,
      unitOfMeasure: supply.unit_of_measure,
      lotNumber: lot.lot_number,
      maxQty: lot.quantity_remaining,
      quantity: String(lot.quantity_remaining),
      destinationStoreroomId: validDests[0].id,
      notes: '',
    })
  }

  async function handleTransferSubmit() {
    if (!transferForm) return
    const qty = parseInt(transferForm.quantity)
    if (!qty || qty < 1) { setError('Quantity must be at least 1.'); return }
    if (qty > transferForm.maxQty) { setError(`Only ${transferForm.maxQty} units available.`); return }
    if (!transferForm.destinationStoreroomId) { setError('Select a destination storeroom.'); return }

    setError(null); setLoading(true)
    const result = await transferStock({
      source_inventory_id: transferForm.inventoryId,
      lot_id: transferForm.lotId,
      destination_storeroom_id: transferForm.destinationStoreroomId,
      quantity: qty,
      notes: transferForm.notes || null,
    })
    if (result?.error) { setError(result.error) }
    else {
      setSuccess(`Transferred ${qty} ${transferForm.unitOfMeasure} of ${transferForm.supplyName}.`)
      setTransferForm(null)
      router.refresh()
    }
    setLoading(false)
  }

  function openAdjust(inv: InventoryRow, lot: Lot) {
    const supply = supplyMap[inv.supply_type_id]
    if (!supply) return
    setError(null)
    setAdjustForm({
      inventoryId: inv.id,
      lotId: lot.id,
      supplyName: supply.name,
      unitOfMeasure: supply.unit_of_measure,
      lotNumber: lot.lot_number,
      currentQty: lot.quantity_remaining,
      newQty: String(lot.quantity_remaining),
      reason: 'count_correction',
      notes: '',
    })
  }

  async function handleAdjustSubmit() {
    if (!adjustForm) return
    const newQty = parseInt(adjustForm.newQty)
    if (isNaN(newQty) || newQty < 0) { setError('Enter a valid quantity (0 or more).'); return }

    setError(null); setLoading(true)
    const result = await adjustStock({
      lot_id: adjustForm.lotId,
      storeroom_inventory_id: adjustForm.inventoryId,
      new_quantity: newQty,
      reason: adjustForm.reason,
      notes: adjustForm.notes || null,
    })
    if (result?.error) { setError(result.error) }
    else {
      const delta = newQty - adjustForm.currentQty
      setSuccess(`Adjusted ${adjustForm.supplyName}: ${delta >= 0 ? '+' : ''}${delta} ${adjustForm.unitOfMeasure} (now ${newQty}).`)
      setAdjustForm(null)
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

  const TX_TYPE_LABELS: Record<string, string> = {
    received: 'Received', dispensed: 'Used', wasted: 'Wasted',
    transferred_out: 'Transferred Out', transferred_in: 'Transferred In',
    adjusted: 'Adjusted',
  }
  const TX_TYPE_COLORS: Record<string, string> = {
    received: 'bg-green-100 text-green-700',
    dispensed: 'bg-blue-100 text-blue-700',
    wasted: 'bg-red-100 text-red-700',
    transferred_out: 'bg-orange-100 text-orange-700',
    transferred_in: 'bg-teal-100 text-teal-700',
    adjusted: 'bg-purple-100 text-purple-700',
  }

  const filteredTransactions = transactions.filter(t => {
    if (historyStoreroomId !== 'all' && t.storeroom_id !== historyStoreroomId) return false
    if (historySupplyId !== 'all' && t.supply_type_id !== historySupplyId) return false
    if (historyTxType !== 'all' && t.transaction_type !== historyTxType) return false
    return true
  })

  return (
    <div className="max-w-2xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">Medical Storeroom</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Track medical supply inventory and expiration</p>
        </div>
        <div className="flex rounded-lg border border-zinc-200 overflow-hidden shrink-0">
          <button onClick={() => setView('inventory')}
            className={`px-3 py-1.5 text-xs font-semibold transition-colors ${view === 'inventory' ? 'bg-red-700 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'}`}>
            Inventory
          </button>
          <button onClick={() => setView('history')}
            className={`px-3 py-1.5 text-xs font-semibold transition-colors border-l border-zinc-200 ${view === 'history' ? 'bg-red-700 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'}`}>
            History
          </button>
        </div>
      </div>

      {success && <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 border border-green-200">{success}</div>}
      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}

      {/* History view */}
      {view === 'history' && (
        <div>
          <div className="flex flex-wrap gap-2 mb-4">
            {storerooms.length > 1 && (
              <select value={historyStoreroomId} onChange={e => setHistoryStoreroomId(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 bg-white focus:outline-none focus:border-red-400">
                <option value="all">All Storerooms</option>
                {storerooms.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <select value={historySupplyId} onChange={e => setHistorySupplyId(e.target.value)}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 bg-white focus:outline-none focus:border-red-400">
              <option value="all">All Supplies</option>
              {supplyTypes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={historyTxType} onChange={e => setHistoryTxType(e.target.value)}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 bg-white focus:outline-none focus:border-red-400">
              <option value="all">All Types</option>
              <option value="received">Received</option>
              <option value="dispensed">Used</option>
              <option value="wasted">Wasted</option>
              <option value="transferred_out">Transferred Out</option>
              <option value="transferred_in">Transferred In</option>
              <option value="adjusted">Adjusted</option>
            </select>
            {supplyTypes.some(s => s.is_controlled) && (() => {
              const params = new URLSearchParams()
              if (historyStoreroomId !== 'all') params.set('storeroom_id', historyStoreroomId)
              if (historySupplyId !== 'all') params.set('supply_type_id', historySupplyId)
              const url = `/print/medical-cs-log${params.toString() ? '?' + params.toString() : ''}`
              return (
                <a href={url} target="_blank" rel="noopener noreferrer"
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 whitespace-nowrap">
                  Print CS Log ↗
                </a>
              )
            })()}
          </div>


          {filteredTransactions.length === 0 ? (
            <div className="rounded-xl bg-white border border-zinc-200 px-6 py-12 text-center text-sm text-zinc-400">
              No transactions in the last 90 days.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredTransactions.map(tx => {
                const supply = supplyTypes.find(s => s.id === tx.supply_type_id)
                const storeroom = storerooms.find(s => s.id === tx.storeroom_id)
                const lotNum = tx.lot_id ? lotNumberMap[tx.lot_id] : null
                const performedBy = tx.performed_by ? personnelMap[tx.performed_by] : null
                const signer1 = tx.signer_1_id ? personnelMap[tx.signer_1_id] : null
                const signer2 = tx.signer_2_id ? personnelMap[tx.signer_2_id] : null
                const txDate = new Date(tx.created_at)
                const isOut = ['dispensed', 'wasted', 'transferred_out'].includes(tx.transaction_type)
                return (
                  <div key={tx.id} className="rounded-xl bg-white border border-zinc-200 px-4 py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${TX_TYPE_COLORS[tx.transaction_type] ?? 'bg-zinc-100 text-zinc-600'}`}>
                          {TX_TYPE_LABELS[tx.transaction_type] ?? tx.transaction_type}
                        </span>
                        <p className="text-sm font-semibold text-zinc-900">{supply?.name ?? '—'}</p>
                        {storerooms.length > 1 && storeroom && (
                          <p className="text-xs text-zinc-400">{storeroom.name}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-400 mt-0.5">
                        {lotNum && <span>Lot {lotNum}</span>}
                        {performedBy && <span>By {performedBy}</span>}
                        {signer1 && <span>Sig: {signer1}{signer2 ? ` + ${signer2}` : ''}</span>}
                        {tx.notes && <span className="text-zinc-500 italic">{tx.notes}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-base font-bold ${isOut ? 'text-red-600' : 'text-green-700'}`}>
                        {isOut ? '−' : '+'}{tx.quantity} {supply?.unit_of_measure ?? ''}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {txDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {view === 'inventory' && (<>

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
            {storeroomSubLabel(selectedStoreroom) && (
              <p className="text-xs text-zinc-400">{storeroomSubLabel(selectedStoreroom)}</p>
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
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setExpandedInvId(isExpanded ? null : inv.id)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                      {isExpanded ? 'Hide' : 'Lots'}
                    </button>
                    {(status === 'low' || status === 'empty') && (
                      pendingReorderIds.has(inv.id)
                        ? <span className="text-xs text-amber-600 font-semibold">Restock requested</span>
                        : <button onClick={async () => {
                            setError(null)
                            const r = await submitReorderRequest(inv.id, null)
                            if (r?.error) setError(r.error)
                            else { setSuccess(`Restock request submitted for ${supply.name}.`); router.refresh() }
                          }}
                          className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100">
                          Request Restock
                        </button>
                    )}
                    <button onClick={() => openDispense(inv)}
                      disabled={total === 0}
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed">
                      Use
                    </button>
                    {isOfficerOrAbove && (
                      <button onClick={() => openReceive(inv)}
                        className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800">
                        Receive
                      </button>
                    )}
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
                              <div className="flex items-center gap-3 shrink-0">
                                {supply.tracks_expiration && (
                                  <p className={`text-xs font-semibold ${expStatus === 'expired' ? 'text-red-600' : expStatus === 'expiring' ? 'text-amber-600' : 'text-zinc-500'}`}>
                                    {expStatus === 'expired' ? '⚠ Expired' : expStatus === 'expiring' ? '⚠ Exp soon' : 'Exp'} {fmtDate(lot.expiration_date)}
                                  </p>
                                )}
                                <div className="text-right min-w-[36px]">
                                  <p className="text-lg font-bold text-zinc-900">{lot.quantity_remaining}</p>
                                  <p className="text-xs text-zinc-400">{supply.unit_of_measure}</p>
                                </div>
                                {isOfficerOrAbove && (
                                  <button onClick={() => openWaste(inv, lot)}
                                    className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-500 hover:bg-red-50 hover:border-red-200 hover:text-red-600">
                                    Waste
                                  </button>
                                )}
                                {storerooms.length > 1 && (isOfficerOrAbove || !supply.is_controlled) && (
                                  <button onClick={() => openTransfer(inv, lot)}
                                    className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-500 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600">
                                    Transfer
                                  </button>
                                )}
                                {isAdmin && (
                                  <button onClick={() => openAdjust(inv, lot)}
                                    className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-500 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-600">
                                    Adjust
                                  </button>
                                )}
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
      </>)}

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

      {/* Adjust Modal */}
      {adjustForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6">
            <h2 className="text-base font-bold text-zinc-900 mb-1">Adjust Quantity</h2>
            <p className="text-sm text-zinc-500 mb-1">{adjustForm.supplyName}{adjustForm.lotNumber && <span className="text-zinc-400"> · Lot {adjustForm.lotNumber}</span>}</p>
            <p className="text-xs text-zinc-400 mb-5">Current: <span className="font-semibold text-zinc-700">{adjustForm.currentQty} {adjustForm.unitOfMeasure}</span></p>

            {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}

            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">New Quantity <span className="text-red-500">*</span></label>
                <input type="number" min="0" value={adjustForm.newQty}
                  onChange={e => setAdjustForm(f => f ? { ...f, newQty: e.target.value } : f)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-center focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" autoFocus />
                {adjustForm.newQty !== '' && !isNaN(parseInt(adjustForm.newQty)) && (
                  <p className={`text-xs mt-1 font-medium ${parseInt(adjustForm.newQty) > adjustForm.currentQty ? 'text-green-600' : parseInt(adjustForm.newQty) < adjustForm.currentQty ? 'text-red-600' : 'text-zinc-400'}`}>
                    {parseInt(adjustForm.newQty) > adjustForm.currentQty ? `+${parseInt(adjustForm.newQty) - adjustForm.currentQty}` :
                     parseInt(adjustForm.newQty) < adjustForm.currentQty ? `${parseInt(adjustForm.newQty) - adjustForm.currentQty}` : 'No change'}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Reason <span className="text-red-500">*</span></label>
                <select value={adjustForm.reason}
                  onChange={e => setAdjustForm(f => f ? { ...f, reason: e.target.value } : f)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                  <option value="count_correction">Physical count correction</option>
                  <option value="initial_entry">Initial inventory entry</option>
                  <option value="damage_found">Damage found during inspection</option>
                  <option value="data_entry_error">Data entry error</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Notes</label>
                <input type="text" value={adjustForm.notes} placeholder="Optional"
                  onChange={e => setAdjustForm(f => f ? { ...f, notes: e.target.value } : f)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleAdjustSubmit} disabled={loading}
                className="flex-1 rounded-lg bg-purple-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50">
                {loading ? 'Saving...' : 'Confirm Adjustment'}
              </button>
              <button onClick={() => { setAdjustForm(null); setError(null) }}
                className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {transferForm && (() => {
        const validDestIds = new Set(
          inventory
            .filter(i => i.supply_type_id === transferForm.supplyTypeId && i.storeroom_id !== inventory.find(x => x.id === transferForm.inventoryId)?.storeroom_id)
            .map(i => i.storeroom_id)
        )
        const validDests = storerooms.filter(s => validDestIds.has(s.id))
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6">
              <h2 className="text-base font-bold text-zinc-900 mb-1">Transfer Stock</h2>
              <p className="text-sm text-zinc-500 mb-5">
                {transferForm.supplyName}
                {transferForm.lotNumber && <span className="ml-1 text-zinc-400">· Lot {transferForm.lotNumber}</span>}
              </p>

              {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}

              <div className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Destination Storeroom <span className="text-red-500">*</span></label>
                  <select value={transferForm.destinationStoreroomId}
                    onChange={e => setTransferForm(f => f ? { ...f, destinationStoreroomId: e.target.value } : f)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                    {validDests.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">
                    Quantity <span className="text-red-500">*</span>
                    <span className="ml-1 text-zinc-400 font-normal">({transferForm.maxQty} available)</span>
                  </label>
                  <input type="number" min="1" max={transferForm.maxQty} value={transferForm.quantity}
                    onChange={e => setTransferForm(f => f ? { ...f, quantity: e.target.value } : f)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-center focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Notes</label>
                  <input type="text" value={transferForm.notes} placeholder="Optional"
                    onChange={e => setTransferForm(f => f ? { ...f, notes: e.target.value } : f)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={handleTransferSubmit} disabled={loading}
                  className="flex-1 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                  {loading ? 'Saving...' : 'Confirm Transfer'}
                </button>
                <button onClick={() => { setTransferForm(null); setError(null) }}
                  className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Waste Modal */}
      {wasteForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6">
            <h2 className="text-base font-bold text-zinc-900 mb-1">Log Waste / Disposal</h2>
            <p className="text-sm text-zinc-500 mb-5">
              {wasteForm.supplyName}
              {wasteForm.lotNumber && <span className="ml-1 text-zinc-400">· Lot {wasteForm.lotNumber}</span>}
              {wasteForm.isControlled && <span className="ml-2 text-xs rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 font-medium">Controlled</span>}
            </p>

            {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}

            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Reason <span className="text-red-500">*</span></label>
                <select value={wasteForm.wasteReason}
                  onChange={e => setWasteForm(f => f ? { ...f, wasteReason: e.target.value } : f)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                  <option value="expired">Expired</option>
                  <option value="damaged">Damaged</option>
                  <option value="contaminated">Contaminated</option>
                  <option value="recalled">Recalled</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">
                  Quantity to Waste <span className="text-red-500">*</span>
                  <span className="ml-1 text-zinc-400 font-normal">({wasteForm.maxQty} available)</span>
                </label>
                <input type="number" min="1" max={wasteForm.maxQty} value={wasteForm.quantity}
                  onChange={e => setWasteForm(f => f ? { ...f, quantity: e.target.value } : f)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-center focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Notes</label>
                <input type="text" value={wasteForm.notes} placeholder="Optional"
                  onChange={e => setWasteForm(f => f ? { ...f, notes: e.target.value } : f)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>

              {wasteForm.requiredSignatures >= 1 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Wasted By <span className="text-red-500">*</span></label>
                  <select value={wasteForm.signer1Id}
                    onChange={e => setWasteForm(f => f ? { ...f, signer1Id: e.target.value } : f)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                    <option value="">Select person...</option>
                    {personnel.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {wasteForm.requiredSignatures >= 2 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">
                    Witness <span className="text-red-500">*</span>
                    <span className="ml-1 text-amber-600 font-normal">(controlled substance)</span>
                  </label>
                  <select value={wasteForm.signer2Id}
                    onChange={e => setWasteForm(f => f ? { ...f, signer2Id: e.target.value } : f)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                    <option value="">Select witness...</option>
                    {personnel
                      .filter(p => p.id !== wasteForm.signer1Id)
                      .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleWasteSubmit} disabled={loading}
                className="flex-1 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
                {loading ? 'Saving...' : 'Confirm Waste'}
              </button>
              <button onClick={() => { setWasteForm(null); setError(null) }}
                className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispense Modal */}
      {dispenseForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6">
            <h2 className="text-base font-bold text-zinc-900 mb-1">Use / Dispense</h2>
            <p className="text-sm text-zinc-500 mb-5">
              {dispenseForm.supplyName}
              {dispenseForm.isControlled && <span className="ml-2 text-xs rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 font-medium">Controlled</span>}
            </p>

            {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}

            <div className="flex flex-col gap-3">
              {/* Lot selector — show all active lots with qty */}
              {(() => {
                const activeLots = lots.filter(l => l.storeroom_inventory_id === dispenseForm.inventoryId && l.quantity_remaining > 0)
                if (activeLots.length > 1) return (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700">Lot <span className="text-red-500">*</span></label>
                    <select value={dispenseForm.lotId}
                      onChange={e => setDispenseForm(f => f ? { ...f, lotId: e.target.value } : f)}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                      {activeLots.sort((a, b) => a.received_date.localeCompare(b.received_date)).map(l => (
                        <option key={l.id} value={l.id}>
                          {l.lot_number ? `Lot ${l.lot_number}` : 'No lot #'} — {l.quantity_remaining} {dispenseForm.unitOfMeasure}
                          {l.expiration_date ? ` · Exp ${fmtDate(l.expiration_date)}` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-zinc-400 mt-1">Oldest lot selected by default (FIFO)</p>
                  </div>
                )
                const onlyLot = activeLots[0]
                return (
                  <div className="rounded-lg bg-zinc-50 border border-zinc-200 px-4 py-2.5 text-sm text-zinc-700">
                    {onlyLot.lot_number ? `Lot ${onlyLot.lot_number}` : 'Single active lot'} · {onlyLot.quantity_remaining} {dispenseForm.unitOfMeasure} available
                    {onlyLot.expiration_date && <span className="ml-1 text-zinc-400">· Exp {fmtDate(onlyLot.expiration_date)}</span>}
                  </div>
                )
              })()}

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Quantity <span className="text-red-500">*</span></label>
                <input type="number" min="1" value={dispenseForm.quantity}
                  onChange={e => setDispenseForm(f => f ? { ...f, quantity: e.target.value } : f)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-center focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Notes / Reason</label>
                <input type="text" value={dispenseForm.notes} placeholder="Optional"
                  onChange={e => setDispenseForm(f => f ? { ...f, notes: e.target.value } : f)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>

              {dispenseForm.requiredSignatures >= 1 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Dispensed By <span className="text-red-500">*</span></label>
                  <select value={dispenseForm.signer1Id}
                    onChange={e => setDispenseForm(f => f ? { ...f, signer1Id: e.target.value } : f)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                    <option value="">Select person...</option>
                    {personnel.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {dispenseForm.requiredSignatures >= 2 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">
                    Witness / Second Signer <span className="text-red-500">*</span>
                    <span className="ml-1 text-amber-600 font-normal">(controlled substance)</span>
                  </label>
                  <select value={dispenseForm.signer2Id}
                    onChange={e => setDispenseForm(f => f ? { ...f, signer2Id: e.target.value } : f)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                    <option value="">Select witness...</option>
                    {personnel
                      .filter(p => p.id !== dispenseForm.signer1Id)
                      .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleDispenseSubmit} disabled={loading}
                className="flex-1 rounded-lg bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-900 disabled:opacity-50">
                {loading ? 'Saving...' : 'Confirm Use'}
              </button>
              <button onClick={() => { setDispenseForm(null); setError(null) }}
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
