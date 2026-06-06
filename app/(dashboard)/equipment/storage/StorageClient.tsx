'use client'

import { useState } from 'react'
import {
  moveQuantityFromStorage,
  removeFromInventory,
  setDepartmentQuantity,
  setStoragePar,
  assignStorageAssetToApparatus,
} from '@/app/actions/equipment'

interface StorageItem {
  item_id: string
  item_name: string
  category_name: string
  storage_qty: number
  storage_par: number
  compartment_total: number
  department_quantity: number | null
  accounted_for: number
  variance: number | null
}

interface ApparatusOption {
  id: string
  unit_number: string
  apparatus_name: string | null
  compartments: { id: string; compartment_code: string; compartment_name: string | null }[]
}

interface StorageAsset {
  id: string
  asset_tag: string
  serial_number: string | null
  status: string
}

interface StorageAssetGroup {
  item_id: string
  item_name: string
  category_name: string
  assets: StorageAsset[]
}

type ModalType = 'add' | 'remove' | 'dept-qty' | 'storage-par' | null

export default function StorageClient({
  items: initialItems,
  storageAssetGroups: initialAssetGroups,
  allApparatus,
  isAdmin,
  isOfficerOrAbove,
}: {
  items: StorageItem[]
  storageAssetGroups: StorageAssetGroup[]
  allApparatus: ApparatusOption[]
  isAdmin: boolean
  isOfficerOrAbove: boolean
}) {
  const [items, setItems] = useState(initialItems)
  const [assetGroups, setAssetGroups] = useState(initialAssetGroups)
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [activeItem, setActiveItem] = useState<StorageItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Tracked asset assignment state
  const [assigningAsset, setAssigningAsset] = useState<StorageAsset & { item_name: string } | null>(null)
  const [assignApparatusId, setAssignApparatusId] = useState('')
  const [assignLoading, setAssignLoading] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  // Add to compartment state
  const [addApparatusId, setAddApparatusId] = useState('')
  const [addCompartmentId, setAddCompartmentId] = useState('')
  const [addQty, setAddQty] = useState('1')

  // Remove from inventory state
  const [removeQty, setRemoveQty] = useState('1')
  const [removeReason, setRemoveReason] = useState<'retired' | 'lost' | 'damaged'>('retired')

  // Dept qty state
  const [deptQtyInput, setDeptQtyInput] = useState('')

  // Storage PAR state
  const [parInput, setParInput] = useState('')

  function openModal(type: ModalType, item: StorageItem) {
    setActiveModal(type)
    setActiveItem(item)
    setError(null)
    if (type === 'add') {
      setAddApparatusId('')
      setAddCompartmentId('')
      setAddQty(String(item.storage_qty > 0 ? item.storage_qty : 1))
    }
    if (type === 'remove') {
      setRemoveQty(String(item.storage_qty > 0 ? item.storage_qty : 1))
      setRemoveReason('retired')
    }
    if (type === 'dept-qty') {
      const suggested = item.compartment_total + item.storage_par
      setDeptQtyInput(String(item.department_quantity ?? suggested))
    }
    if (type === 'storage-par') {
      setParInput(String(item.storage_par))
    }
  }

  function closeModal() {
    setActiveModal(null)
    setActiveItem(null)
    setError(null)
  }

  function updateItem(item_id: string, patch: Partial<StorageItem>) {
    setItems(prev => prev.map(i => i.item_id === item_id ? { ...i, ...patch } : i))
  }

  async function handleAddToCompartment() {
    if (!activeItem || !addCompartmentId) return
    const qty = parseInt(addQty)
    if (!qty || qty < 1) return
    setLoading(true)
    const result = await moveQuantityFromStorage(activeItem.item_id, addCompartmentId, qty)
    if (result?.error) { setError(result.error); setLoading(false); return }
    const newStorageQty = activeItem.storage_qty - qty
    const newCompartmentTotal = activeItem.compartment_total + qty
    const newAccountedFor = newStorageQty + newCompartmentTotal
    updateItem(activeItem.item_id, {
      storage_qty: newStorageQty,
      compartment_total: newCompartmentTotal,
      accounted_for: newAccountedFor,
      variance: activeItem.department_quantity !== null ? newAccountedFor - activeItem.department_quantity : null,
    })
    closeModal()
    setLoading(false)
  }

  async function handleRemoveFromInventory() {
    if (!activeItem) return
    const qty = parseInt(removeQty)
    if (!qty || qty < 1) return
    setLoading(true)
    const result = await removeFromInventory(activeItem.item_id, qty, removeReason)
    if (result?.error) { setError(result.error); setLoading(false); return }
    const newStorageQty = activeItem.storage_qty - qty
    const newAccountedFor = newStorageQty + activeItem.compartment_total
    updateItem(activeItem.item_id, {
      storage_qty: newStorageQty,
      accounted_for: newAccountedFor,
      variance: activeItem.department_quantity !== null ? newAccountedFor - activeItem.department_quantity : null,
    })
    closeModal()
    setLoading(false)
  }

  async function handleSetDeptQty() {
    if (!activeItem) return
    const qty = parseInt(deptQtyInput)
    if (isNaN(qty) || qty < 0) return
    setLoading(true)
    const result = await setDepartmentQuantity(activeItem.item_id, qty)
    if (result?.error) { setError(result.error); setLoading(false); return }
    updateItem(activeItem.item_id, {
      department_quantity: qty,
      variance: activeItem.accounted_for - qty,
    })
    closeModal()
    setLoading(false)
  }

  async function handleSetStoragePar() {
    if (!activeItem) return
    const par = parseInt(parInput)
    if (isNaN(par) || par < 0) return
    setLoading(true)
    const result = await setStoragePar(activeItem.item_id, par)
    if (result?.error) { setError(result.error); setLoading(false); return }
    updateItem(activeItem.item_id, { storage_par: par })
    closeModal()
    setLoading(false)
  }

  const addApparatus = allApparatus.find(a => a.id === addApparatusId)

  async function handleAssignAsset() {
    if (!assigningAsset || !assignApparatusId) return
    setAssignLoading(true)
    setAssignError(null)
    const result = await assignStorageAssetToApparatus(assigningAsset.id, assignApparatusId)
    if (result?.error) { setAssignError(result.error); setAssignLoading(false); return }
    setAssetGroups(prev => prev
      .map(g => ({ ...g, assets: g.assets.filter(a => a.id !== assigningAsset.id) }))
      .filter(g => g.assets.length > 0)
    )
    setAssigningAsset(null)
    setAssignApparatusId('')
    setAssignLoading(false)
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl bg-white border border-zinc-200 px-6 py-12 text-center text-sm text-zinc-400">
        No quantity-tracked items found for this department.
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {items.map(item => {
          const parStatus = item.storage_par === 0
            ? null
            : item.storage_qty >= item.storage_par ? 'ok' : 'low'

          const deptStatus = item.variance === null
            ? null
            : item.variance === 0 ? 'balanced'
            : item.variance < 0 ? 'missing'
            : 'surplus'

          const standardsNeeded = item.compartment_total + item.storage_par
          const standardsMismatch = item.department_quantity !== null && standardsNeeded > 0 && standardsNeeded !== item.department_quantity

          return (
            <div key={item.item_id} className="rounded-xl bg-white border border-zinc-200 shadow-sm p-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="font-semibold text-zinc-900">{item.item_name}</p>
                  {item.category_name && (
                    <p className="text-xs text-zinc-400">{item.category_name}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {deptStatus === 'missing' && (
                    <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-semibold">
                      ⚠ {Math.abs(item.variance!)} missing
                    </span>
                  )}
                  {parStatus === 'low' && (
                    <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-semibold">
                      Below PAR
                    </span>
                  )}
                  {standardsMismatch && (
                    <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-xs font-semibold">
                      Standards changed
                    </span>
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2">
                  <p className="text-xs text-zinc-400 mb-0.5">In Storage</p>
                  <p className="text-lg font-bold text-zinc-900">{item.storage_qty}</p>
                  {item.storage_par > 0 ? (
                    <p className={`text-xs font-medium ${parStatus === 'ok' ? 'text-green-600' : 'text-amber-600'}`}>
                      PAR {item.storage_par} {parStatus === 'ok' ? '✓' : '↓'}
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-400">No PAR set</p>
                  )}
                </div>

                <div className="rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2">
                  <p className="text-xs text-zinc-400 mb-0.5">On Trucks</p>
                  <p className="text-lg font-bold text-zinc-900">{item.compartment_total}</p>
                  <p className="text-xs text-zinc-400">assigned</p>
                </div>

                <div className="rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2">
                  <p className="text-xs text-zinc-400 mb-0.5">Dept Total</p>
                  {item.department_quantity !== null ? (
                    <>
                      <p className={`text-lg font-bold ${deptStatus === 'missing' ? 'text-red-600' : deptStatus === 'surplus' ? 'text-zinc-600' : 'text-green-700'}`}>
                        {item.accounted_for}/{item.department_quantity}
                      </p>
                      <p className={`text-xs font-medium ${deptStatus === 'balanced' ? 'text-green-600' : deptStatus === 'missing' ? 'text-red-600' : 'text-zinc-500'}`}>
                        {deptStatus === 'balanced' ? '✓ Balanced' : deptStatus === 'missing' ? `${Math.abs(item.variance!)} missing` : `+${item.variance} surplus`}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-bold text-zinc-400">{item.accounted_for}</p>
                      <p className="text-xs text-zinc-400">unset</p>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              {(item.storage_qty > 0 || isAdmin) && (
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 pt-2 border-t border-zinc-100">
                  {item.storage_qty > 0 && (
                    <button
                      onClick={() => openModal('add', item)}
                      className="rounded px-2.5 py-1 text-xs font-semibold border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors text-center sm:text-left"
                    >
                      Add to Compartment
                    </button>
                  )}
                  {isAdmin && item.storage_qty > 0 && (
                    <button
                      onClick={() => openModal('remove', item)}
                      className="rounded px-2.5 py-1 text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors text-center sm:text-left"
                    >
                      Remove from Inventory
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => openModal('storage-par', item)}
                      className="rounded px-2.5 py-1 text-xs font-semibold border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-colors text-center sm:text-left"
                    >
                      {item.storage_par > 0 ? 'Edit PAR' : 'Set PAR'}
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => openModal('dept-qty', item)}
                      className={`rounded px-2.5 py-1 text-xs font-semibold border transition-colors text-center sm:text-left ${
                        item.department_quantity === null
                          ? 'border-blue-200 text-blue-600 hover:bg-blue-50'
                          : standardsMismatch
                          ? 'border-orange-200 text-orange-600 hover:bg-orange-50'
                          : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'
                      }`}
                    >
                      {item.department_quantity === null ? 'Set Dept Total' : standardsMismatch ? 'Update Dept Total' : 'Edit Dept Total'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Tracked Assets — In Storage */}
      {assetGroups.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">Tracked Assets — Unassigned</h2>
          <div className="flex flex-col gap-3">
            {assetGroups.map(group => (
              <div key={group.item_id} className="rounded-xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">{group.item_name}</p>
                    {group.category_name && <p className="text-xs text-zinc-400">{group.category_name}</p>}
                  </div>
                  <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-semibold">
                    {group.assets.length} unassigned
                  </span>
                </div>
                <div className="divide-y divide-zinc-100">
                  {group.assets.map(asset => (
                    <div key={asset.id} className="flex items-center justify-between px-4 py-3 gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900">{asset.asset_tag}</p>
                        {asset.serial_number && (
                          <p className="text-xs text-zinc-400">S/N: {asset.serial_number}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                          asset.status === 'IN SERVICE' ? 'bg-green-100 text-green-700' :
                          asset.status === 'OUT OF SERVICE' ? 'bg-red-100 text-red-700' :
                          'bg-zinc-100 text-zinc-500'
                        }`}>{asset.status}</span>
                        {isOfficerOrAbove && (
                          <button
                            onClick={() => { setAssigningAsset({ ...asset, item_name: group.item_name }); setAssignApparatusId(''); setAssignError(null) }}
                            className="rounded px-2.5 py-1 text-xs font-semibold border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
                          >
                            Assign to Apparatus
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assign Asset to Apparatus modal */}
      {assigningAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl p-6">
            <h2 className="text-base font-semibold text-zinc-900 mb-1">Assign to Apparatus</h2>
            <p className="text-sm text-zinc-500 mb-4">{assigningAsset.asset_tag} — {assigningAsset.item_name}</p>
            {assignError && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{assignError}</div>}
            <div className="mb-4">
              <label className="block text-xs font-medium text-zinc-600 mb-1">Apparatus</label>
              <select
                value={assignApparatusId}
                onChange={e => setAssignApparatusId(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="">Select apparatus...</option>
                {allApparatus.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.unit_number}{a.apparatus_name ? ` — ${a.apparatus_name}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAssignAsset}
                disabled={assignLoading || !assignApparatusId}
                className="flex-1 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
              >
                {assignLoading ? 'Assigning...' : 'Assign'}
              </button>
              <button
                onClick={() => setAssigningAsset(null)}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add to Compartment modal */}
      {activeModal === 'add' && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl p-6">
            <h2 className="text-base font-semibold text-zinc-900 mb-1">Add to Compartment</h2>
            <p className="text-sm text-zinc-500 mb-4">{activeItem.item_name} — {activeItem.storage_qty} in storage</p>
            {error && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="flex flex-col gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Apparatus</label>
                <select
                  value={addApparatusId}
                  onChange={e => { setAddApparatusId(e.target.value); setAddCompartmentId('') }}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  <option value="">Select apparatus...</option>
                  {allApparatus.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.unit_number}{a.apparatus_name ? ` — ${a.apparatus_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Compartment</label>
                <select
                  value={addCompartmentId}
                  onChange={e => setAddCompartmentId(e.target.value)}
                  disabled={!addApparatusId}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50"
                >
                  <option value="">Select compartment...</option>
                  {(addApparatus?.compartments ?? []).map(c => (
                    <option key={c.id} value={c.id}>
                      {addApparatus?.unit_number} - {c.compartment_code}{c.compartment_name ? ` — ${c.compartment_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Quantity (max {activeItem.storage_qty})</label>
                <input
                  type="number" min={1} max={activeItem.storage_qty} value={addQty}
                  onChange={e => setAddQty(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddToCompartment} disabled={loading || !addCompartmentId || parseInt(addQty) < 1 || parseInt(addQty) > activeItem.storage_qty}
                className="flex-1 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors">
                {loading ? 'Moving...' : 'Add to Compartment'}
              </button>
              <button onClick={closeModal} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Remove from Inventory modal */}
      {activeModal === 'remove' && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl p-6">
            <h2 className="text-base font-semibold text-zinc-900 mb-1">Remove from Inventory</h2>
            <p className="text-sm text-zinc-500 mb-4">{activeItem.item_name} — {activeItem.storage_qty} in storage</p>
            {error && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="flex flex-col gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Quantity (max {activeItem.storage_qty})</label>
                <input
                  type="number" min={1} max={activeItem.storage_qty} value={removeQty}
                  onChange={e => setRemoveQty(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Reason</label>
                <select
                  value={removeReason}
                  onChange={e => setRemoveReason(e.target.value as 'retired' | 'lost' | 'damaged')}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  <option value="retired">Retired</option>
                  <option value="lost">Lost</option>
                  <option value="damaged">Damaged</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleRemoveFromInventory} disabled={loading || parseInt(removeQty) < 1 || parseInt(removeQty) > activeItem.storage_qty}
                className="flex-1 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors">
                {loading ? 'Removing...' : 'Remove from Inventory'}
              </button>
              <button onClick={closeModal} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Set Dept Total modal */}
      {activeModal === 'dept-qty' && activeItem && (() => {
        const activeStandardsNeeded = activeItem.compartment_total + activeItem.storage_par
        const activeMismatch = activeItem.department_quantity !== null && activeStandardsNeeded > 0 && activeStandardsNeeded !== activeItem.department_quantity
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl p-6">
            <h2 className="text-base font-semibold text-zinc-900 mb-1">
              {activeItem.department_quantity === null ? 'Set Department Total' : 'Update Department Total'}
            </h2>
            <p className="text-sm text-zinc-500 mb-2">{activeItem.item_name}</p>

            {activeMismatch && (
              <div className="mb-3 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 text-xs text-orange-800 leading-relaxed">
                Your compartment standards or storage PAR have changed. Previously declared: <span className="font-semibold">{activeItem.department_quantity}</span> — standards now require <span className="font-semibold">{activeStandardsNeeded}</span>.
              </div>
            )}

            <div className="mb-4 rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-2 text-xs text-zinc-500 leading-relaxed">
              Currently accounted for: <span className="font-semibold text-zinc-700">{activeItem.accounted_for}</span>
              <span className="mx-1">·</span>
              Suggested: <span className="font-semibold text-zinc-700">{activeStandardsNeeded}</span>
              <span className="block mt-0.5 text-zinc-400">(compartment standards + storage PAR)</span>
            </div>
            {error && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="mb-4">
              <label className="block text-xs font-medium text-zinc-600 mb-1">Department quantity</label>
              <input
                type="number" min={0} value={deptQtyInput}
                onChange={e => setDeptQtyInput(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSetDeptQty} disabled={loading || deptQtyInput === '' || parseInt(deptQtyInput) < 0}
                className="flex-1 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors">
                {loading ? 'Saving...' : 'Confirm'}
              </button>
              <button onClick={closeModal} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50">Cancel</button>
            </div>
          </div>
        </div>
        )
      })()}

      {/* Set Storage PAR modal */}
      {activeModal === 'storage-par' && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl p-6">
            <h2 className="text-base font-semibold text-zinc-900 mb-1">Set Storage PAR</h2>
            <p className="text-sm text-zinc-500 mb-1">{activeItem.item_name}</p>
            <p className="text-xs text-zinc-400 mb-4">Minimum quantity to keep in storage as a buffer.</p>
            {error && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="mb-4">
              <label className="block text-xs font-medium text-zinc-600 mb-1">PAR quantity</label>
              <input
                type="number" min={0} value={parInput}
                onChange={e => setParInput(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSetStoragePar} disabled={loading || parInput === '' || parseInt(parInput) < 0}
                className="flex-1 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors">
                {loading ? 'Saving...' : 'Save PAR'}
              </button>
              <button onClick={closeModal} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
