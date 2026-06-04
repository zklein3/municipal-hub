'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createMedicalSupplyType, updateMedicalSupplyType,
  createMedicalStoreroom, updateMedicalStoreroom,
  assignSupplyToStoreroom, updateStoreroomPar, removeSupplyFromStoreroom,
} from '@/app/actions/medical'

const inputCls = "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"

const CATEGORIES = ['medication', 'supply', 'equipment'] as const
const CATEGORY_LABELS: Record<string, string> = { medication: 'Medication', supply: 'Supply', equipment: 'Equipment' }
const CATEGORY_COLORS: Record<string, string> = {
  medication: 'bg-red-100 text-red-700',
  supply: 'bg-blue-100 text-blue-700',
  equipment: 'bg-zinc-100 text-zinc-600',
}

interface SupplyType {
  id: string; name: string; category: string; unit_of_measure: string
  is_controlled: boolean; tracks_expiration: boolean; required_signatures: number
  notes: string | null; active: boolean
}
interface Storeroom { id: string; name: string; station_id: string | null; apparatus_id: string | null; notes: string | null; active: boolean }
interface Station { id: string; station_name: string; station_number: string | null }
interface Apparatus { id: string; unit_number: string; type_name: string | null }
interface StoreroomInventory { id: string; storeroom_id: string; supply_type_id: string; par_level: number }

type Tab = 'supplies' | 'storerooms'

export default function MedicalAdminClient({
  supplyTypes, storerooms, stations, apparatus, storeroomInventory, departmentId,
}: {
  supplyTypes: SupplyType[]
  storerooms: Storeroom[]
  stations: Station[]
  apparatus: Apparatus[]
  storeroomInventory: StoreroomInventory[]
  departmentId: string
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('supplies')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Supply type form state
  const [showSupplyForm, setShowSupplyForm] = useState(false)
  const [editingSupplyId, setEditingSupplyId] = useState<string | null>(null)
  const [isControlled, setIsControlled] = useState(false)
  const [tracksExpiration, setTracksExpiration] = useState(false)
  const [requiredSigs, setRequiredSigs] = useState(0)
  const [supplyActive, setSupplyActive] = useState(true)

  // Storeroom assignment state (for supply type form)
  const [assignStoreroomPars, setAssignStoreroomPars] = useState<Record<string, string>>({})

  // Storeroom form state
  const [showStoreroomForm, setShowStoreroomForm] = useState(false)
  const [editingStoreroomId, setEditingStoreroomId] = useState<string | null>(null)
  const [storeroomActive, setStoreroomActive] = useState(true)

  // Storeroom inventory state
  const [expandedStoreroomId, setExpandedStoreroomId] = useState<string | null>(null)
  const [addingSupplyToStoreroom, setAddingSupplyToStoreroom] = useState<string | null>(null)
  const [editingParId, setEditingParId] = useState<string | null>(null)
  const [parDraft, setParDraft] = useState('')

  function reset() { setError(null); setSuccess(null) }

  async function wrap(fn: () => Promise<any>) {
    reset(); setLoading(true)
    const r = await fn()
    if (r?.error) setError(r.error)
    else { router.refresh() }
    setLoading(false)
    return r
  }

  function openNewSupply() {
    setEditingSupplyId(null)
    setIsControlled(false)
    setTracksExpiration(false)
    setRequiredSigs(0)
    setSupplyActive(true)
    setAssignStoreroomPars({})
    setShowSupplyForm(true)
  }

  function openEditSupply(s: SupplyType) {
    setEditingSupplyId(s.id)
    setIsControlled(s.is_controlled)
    setTracksExpiration(s.tracks_expiration)
    setRequiredSigs(s.required_signatures)
    setSupplyActive(s.active)
    setAssignStoreroomPars({})
    setShowSupplyForm(true)
  }

  async function handleSupplySubmit(formData: FormData) {
    formData.set('is_controlled', isControlled ? 'true' : 'false')
    formData.set('tracks_expiration', tracksExpiration ? 'true' : 'false')
    formData.set('required_signatures', String(isControlled ? Math.max(requiredSigs, 2) : requiredSigs))
    formData.set('active', supplyActive ? 'true' : 'false')

    reset(); setLoading(true)
    const r = editingSupplyId
      ? await updateMedicalSupplyType(formData)
      : await createMedicalSupplyType(formData)

    if (r?.error) { setError(r.error); setLoading(false); return }

    // Assign to any checked storerooms
    const supplyTypeId = editingSupplyId ?? (r as any).id
    const checkedEntries = Object.entries(assignStoreroomPars)
    for (const [storeroomId, parStr] of checkedEntries) {
      const fd = new FormData()
      fd.set('storeroom_id', storeroomId)
      fd.set('supply_type_id', supplyTypeId)
      fd.set('par_level', parStr || '0')
      await assignSupplyToStoreroom(fd)
    }

    router.refresh()
    setLoading(false)
    setShowSupplyForm(false)
    setEditingSupplyId(null)
    setAssignStoreroomPars({})
  }

  async function handleStoreroomSubmit(formData: FormData) {
    formData.set('active', storeroomActive ? 'true' : 'false')
    const r = await wrap(() => editingStoreroomId
      ? updateMedicalStoreroom(formData)
      : createMedicalStoreroom(formData)
    )
    if (!r?.error) { setShowStoreroomForm(false); setEditingStoreroomId(null) }
  }

  async function handleAssignSupply(formData: FormData) {
    const r = await wrap(() => assignSupplyToStoreroom(formData))
    if (!r?.error) setAddingSupplyToStoreroom(null)
  }

  const byCategory = CATEGORIES.map(cat => ({
    cat,
    items: supplyTypes.filter(s => s.category === cat),
  })).filter(g => g.items.length > 0 || tab === 'supplies')

  const stationLabel = (stationId: string | null) => {
    if (!stationId) return 'No station'
    const s = stations.find(st => st.id === stationId)
    return s ? `Station ${s.station_number ? s.station_number + ' — ' : ''}${s.station_name}` : '—'
  }

  const apparatusLabel = (apparatusId: string | null) => {
    if (!apparatusId) return null
    const a = apparatus.find(ap => ap.id === apparatusId)
    return a ? `${a.unit_number}${a.type_name ? ' — ' + a.type_name : ''}` : null
  }

  const inventoryForStoreroom = (storeroomId: string) =>
    storeroomInventory.filter(i => i.storeroom_id === storeroomId)

  const supplyName = (supplyTypeId: string) =>
    supplyTypes.find(s => s.id === supplyTypeId)?.name ?? '—'

  const assignedSupplyIds = (storeroomId: string) =>
    new Set(storeroomInventory.filter(i => i.storeroom_id === storeroomId).map(i => i.supply_type_id))

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Medical</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Supply types, storerooms, and medical inventory configuration</p>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 border border-green-200">{success}</div>}

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-zinc-200 p-1 mb-6 w-fit">
        {([['supplies', 'Supply Types'], ['storerooms', 'Storerooms']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${tab === key ? 'bg-red-700 text-white' : 'text-zinc-600 hover:bg-zinc-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── SUPPLY TYPES TAB ──────────────────────────────────────────── */}
      {tab === 'supplies' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-zinc-500">{supplyTypes.length} supply type{supplyTypes.length !== 1 ? 's' : ''}</p>
            <button onClick={openNewSupply}
              className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800">
              + Add Supply Type
            </button>
          </div>

          {/* Create / Edit form */}
          {showSupplyForm && (
            <div className="mb-6 rounded-xl bg-white border border-zinc-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-zinc-900 mb-4">
                {editingSupplyId ? 'Edit Supply Type' : 'New Supply Type'}
              </h2>
              <form action={handleSupplySubmit} className="flex flex-col gap-3">
                {editingSupplyId && <input type="hidden" name="id" value={editingSupplyId} />}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-medium text-zinc-700">Name <span className="text-red-500">*</span></label>
                    <input name="name" required placeholder="e.g. Morphine 10mg/mL" className={inputCls}
                      defaultValue={editingSupplyId ? supplyTypes.find(s => s.id === editingSupplyId)?.name : ''} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700">Category <span className="text-red-500">*</span></label>
                    <select name="category" required className={inputCls}
                      defaultValue={editingSupplyId ? supplyTypes.find(s => s.id === editingSupplyId)?.category : 'supply'}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700">Unit of Measure</label>
                    <input name="unit_of_measure" placeholder="each / mL / mg / box" className={inputCls}
                      defaultValue={editingSupplyId ? supplyTypes.find(s => s.id === editingSupplyId)?.unit_of_measure : 'each'} />
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={isControlled} onChange={e => { setIsControlled(e.target.checked); if (e.target.checked) setRequiredSigs(s => Math.max(s, 2)) }}
                      className="mt-0.5 rounded border-zinc-300 text-red-600 focus:ring-red-500" />
                    <div>
                      <p className="text-sm font-medium text-zinc-800">Controlled substance</p>
                      <p className="text-xs text-zinc-500">Enforces minimum 2-signature verification on all transactions</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={tracksExpiration} onChange={e => setTracksExpiration(e.target.checked)}
                      className="rounded border-zinc-300 text-red-600 focus:ring-red-500" />
                    <span className="text-sm font-medium text-zinc-800">Track expiration dates</span>
                  </label>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">
                    Required Signatures {isControlled && <span className="text-red-600 font-semibold">(minimum 2 — controlled)</span>}
                  </label>
                  <div className="flex gap-2">
                    {[0, 1, 2].map(n => (
                      <button key={n} type="button"
                        disabled={isControlled && n < 2}
                        onClick={() => setRequiredSigs(n)}
                        className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors disabled:opacity-40 ${
                          requiredSigs === n
                            ? 'bg-red-700 text-white border-red-700'
                            : 'bg-white text-zinc-700 border-zinc-300 hover:border-red-300'
                        }`}>
                        {n === 0 ? 'None' : n === 1 ? '1 Signature' : '2 Signatures'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Notes</label>
                  <input name="notes" placeholder="Optional" className={inputCls}
                    defaultValue={editingSupplyId ? (supplyTypes.find(s => s.id === editingSupplyId)?.notes ?? '') : ''} />
                </div>

                {editingSupplyId && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={supplyActive} onChange={e => setSupplyActive(e.target.checked)}
                      className="rounded border-zinc-300 text-red-600 focus:ring-red-500" />
                    <span className="text-sm text-zinc-700">Active</span>
                  </label>
                )}

                {/* Storeroom assignment */}
                {(() => {
                  const alreadyAssigned = editingSupplyId
                    ? new Set(storeroomInventory.filter(i => i.supply_type_id === editingSupplyId).map(i => i.storeroom_id))
                    : new Set<string>()
                  const availableRooms = storerooms.filter(s => s.active && !alreadyAssigned.has(s.id))
                  if (availableRooms.length === 0 && !editingSupplyId) return null
                  return (
                    <div className="border-t border-zinc-100 pt-3 mt-1">
                      <p className="text-xs font-semibold text-zinc-700 mb-2">
                        {editingSupplyId ? 'Also assign to storerooms' : 'Assign to storerooms (optional)'}
                      </p>
                      {availableRooms.length === 0 ? (
                        <p className="text-xs text-zinc-400">Assigned to all active storerooms.</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {availableRooms.map(room => {
                            const checked = room.id in assignStoreroomPars
                            return (
                              <div key={room.id} className="flex items-center gap-3">
                                <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                                  <input type="checkbox" checked={checked}
                                    onChange={e => setAssignStoreroomPars(prev => {
                                      const next = { ...prev }
                                      if (e.target.checked) next[room.id] = '0'
                                      else delete next[room.id]
                                      return next
                                    })}
                                    className="rounded border-zinc-300 text-red-600 focus:ring-red-500 shrink-0" />
                                  <span className="text-sm text-zinc-800 truncate">{room.name}</span>
                                </label>
                                {checked && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <label className="text-xs text-zinc-500">PAR</label>
                                    <input type="number" min="0" value={assignStoreroomPars[room.id] ?? '0'}
                                      onChange={e => setAssignStoreroomPars(prev => ({ ...prev, [room.id]: e.target.value }))}
                                      className="w-16 rounded-lg border border-zinc-300 px-2 py-1 text-xs text-center focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })()}

                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={loading}
                    className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
                    {loading ? 'Saving...' : editingSupplyId ? 'Save Changes' : 'Create'}
                  </button>
                  <button type="button" onClick={() => { setShowSupplyForm(false); setEditingSupplyId(null) }}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Supply type list grouped by category */}
          {supplyTypes.length === 0 ? (
            <div className="rounded-xl bg-white border border-zinc-200 px-6 py-12 text-center text-sm text-zinc-400">
              No supply types yet. Add your first one above.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {byCategory.filter(g => g.items.length > 0).map(({ cat, items }) => (
                <div key={cat}>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">{CATEGORY_LABELS[cat]}</p>
                  <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden divide-y divide-zinc-100">
                    {items.map(s => (
                      <div key={s.id} className={`flex items-center px-5 py-3 gap-3 ${!s.active ? 'opacity-50' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-zinc-900">{s.name}</p>
                            <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${CATEGORY_COLORS[s.category]}`}>
                              {CATEGORY_LABELS[s.category]}
                            </span>
                            {s.is_controlled && (
                              <span className="text-xs rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 font-medium">Controlled</span>
                            )}
                            {s.tracks_expiration && (
                              <span className="text-xs rounded-full bg-purple-100 text-purple-700 px-2 py-0.5">Exp tracked</span>
                            )}
                            {!s.active && <span className="text-xs text-zinc-400">Inactive</span>}
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            {s.unit_of_measure} · {s.required_signatures === 0 ? 'No signatures' : s.required_signatures === 1 ? '1 signature' : '2 signatures'}
                          </p>
                        </div>
                        <button onClick={() => openEditSupply(s)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 shrink-0">
                          Edit
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── STOREROOMS TAB ────────────────────────────────────────────── */}
      {tab === 'storerooms' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-zinc-500">{storerooms.filter(s => s.active).length} active storeroom{storerooms.filter(s => s.active).length !== 1 ? 's' : ''}</p>
            <button onClick={() => { setShowStoreroomForm(true); setEditingStoreroomId(null); setStoreroomActive(true) }}
              className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800">
              + Add Storeroom
            </button>
          </div>

          {/* Create / Edit storeroom form */}
          {showStoreroomForm && (
            <div className="mb-6 rounded-xl bg-white border border-zinc-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-zinc-900 mb-4">
                {editingStoreroomId ? 'Edit Storeroom' : 'New Storeroom'}
              </h2>
              <form action={handleStoreroomSubmit} className="flex flex-col gap-3">
                {editingStoreroomId && <input type="hidden" name="id" value={editingStoreroomId} />}
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Name <span className="text-red-500">*</span></label>
                  <input name="name" required placeholder="e.g. Station 1 Drug Safe" className={inputCls}
                    defaultValue={editingStoreroomId ? storerooms.find(s => s.id === editingStoreroomId)?.name : ''} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700">Station</label>
                    <select name="station_id" className={inputCls}
                      defaultValue={editingStoreroomId ? (storerooms.find(s => s.id === editingStoreroomId)?.station_id ?? '') : ''}>
                      <option value="">No station</option>
                      {stations.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.station_number ? `Stn ${s.station_number} — ` : ''}{s.station_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700">Apparatus (bag)</label>
                    <select name="apparatus_id" className={inputCls}
                      defaultValue={editingStoreroomId ? (storerooms.find(s => s.id === editingStoreroomId)?.apparatus_id ?? '') : ''}>
                      <option value="">Not on apparatus</option>
                      {apparatus.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.unit_number}{a.type_name ? ` — ${a.type_name}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Notes</label>
                  <input name="notes" placeholder="Optional" className={inputCls}
                    defaultValue={editingStoreroomId ? (storerooms.find(s => s.id === editingStoreroomId)?.notes ?? '') : ''} />
                </div>
                {editingStoreroomId && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={storeroomActive} onChange={e => setStoreroomActive(e.target.checked)}
                      className="rounded border-zinc-300 text-red-600 focus:ring-red-500" />
                    <span className="text-sm text-zinc-700">Active</span>
                  </label>
                )}
                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={loading}
                    className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
                    {loading ? 'Saving...' : editingStoreroomId ? 'Save Changes' : 'Create'}
                  </button>
                  <button type="button" onClick={() => { setShowStoreroomForm(false); setEditingStoreroomId(null) }}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {storerooms.length === 0 ? (
            <div className="rounded-xl bg-white border border-zinc-200 px-6 py-12 text-center text-sm text-zinc-400">
              No storerooms yet. Create one above.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {storerooms.map(room => {
                const inv = inventoryForStoreroom(room.id)
                const isExpanded = expandedStoreroomId === room.id
                const unassigned = supplyTypes.filter(s => s.active && !assignedSupplyIds(room.id).has(s.id))
                return (
                  <div key={room.id} className={`rounded-xl bg-white border border-zinc-200 overflow-hidden ${!room.active ? 'opacity-60' : ''}`}>
                    <div className="flex items-center px-5 py-4 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-900">{room.name}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {apparatusLabel(room.apparatus_id)
                            ? `Apparatus ${apparatusLabel(room.apparatus_id)}`
                            : stationLabel(room.station_id)
                          } · {inv.length} supply type{inv.length !== 1 ? 's' : ''} assigned
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button onClick={() => setExpandedStoreroomId(isExpanded ? null : room.id)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                          {isExpanded ? 'Hide' : 'Manage'}
                        </button>
                        <button onClick={() => { setEditingStoreroomId(room.id); setStoreroomActive(room.active); setShowStoreroomForm(true) }}
                          className="text-xs text-zinc-400 hover:text-zinc-700">Edit</button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-zinc-100 bg-zinc-50 px-5 py-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Assigned Supply Types</p>
                          {unassigned.length > 0 && (
                            <button onClick={() => setAddingSupplyToStoreroom(addingSupplyToStoreroom === room.id ? null : room.id)}
                              className="text-xs font-semibold text-red-600 hover:text-red-800">
                              {addingSupplyToStoreroom === room.id ? 'Cancel' : '+ Add Supply Type'}
                            </button>
                          )}
                        </div>

                        {/* Add supply to storeroom form */}
                        {addingSupplyToStoreroom === room.id && (
                          <form action={handleAssignSupply} className="flex gap-2 mb-4">
                            <input type="hidden" name="storeroom_id" value={room.id} />
                            <select name="supply_type_id" required className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                              <option value="">Select supply type...</option>
                              {unassigned.map(s => (
                                <option key={s.id} value={s.id}>
                                  {s.name} {s.is_controlled ? '(Controlled)' : ''}
                                </option>
                              ))}
                            </select>
                            <div className="w-24">
                              <input type="number" name="par_level" min="0" placeholder="PAR" defaultValue="0"
                                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-center focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                            </div>
                            <button type="submit" disabled={loading}
                              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
                              Add
                            </button>
                          </form>
                        )}

                        {inv.length === 0 ? (
                          <p className="text-xs text-zinc-400">No supply types assigned yet.</p>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {inv.map(i => (
                              <div key={i.id} className="flex items-center justify-between bg-white rounded-lg border border-zinc-200 px-4 py-2.5 gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-zinc-900">{supplyName(i.supply_type_id)}</p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  {editingParId === i.id ? (
                                    <div className="flex items-center gap-2">
                                      <input type="number" min="0" value={parDraft} onChange={e => setParDraft(e.target.value)}
                                        className="w-16 rounded-lg border border-zinc-300 px-2 py-1 text-sm text-center focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" autoFocus />
                                      <button onClick={() => wrap(() => updateStoreroomPar(i.id, parseInt(parDraft) || 0)).then(() => setEditingParId(null))}
                                        disabled={loading} className="text-xs font-semibold text-green-700 hover:text-green-900 disabled:opacity-50">Save</button>
                                      <button onClick={() => setEditingParId(null)} className="text-xs text-zinc-400 hover:text-zinc-600">Cancel</button>
                                    </div>
                                  ) : (
                                    <button onClick={() => { setEditingParId(i.id); setParDraft(String(i.par_level)) }}
                                      className="text-xs text-zinc-500 hover:text-zinc-800" title="Click to edit PAR">
                                      PAR: {i.par_level}
                                    </button>
                                  )}
                                  <button onClick={() => wrap(() => removeSupplyFromStoreroom(i.id))} disabled={loading}
                                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50">Remove</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
