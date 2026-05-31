'use client'

import { useState } from 'react'
import {
  addVehicleCheckItem,
  updateVehicleCheckItem,
  toggleVehicleCheckItem,
  resetVehicleCheckItemsToDefaults,
} from '@/app/actions/inspections'

interface CheckItem {
  id: string
  label: string
  group_name: string
  sort_order: number
  has_amount_field: boolean
  requires_air_brakes: boolean
  active: boolean
  instructions?: string | null
}

const GROUP_OPTIONS = [
  'Fluids',
  'Mechanical',
  'Lights',
  'Communications',
  'Emergency Equipment',
  'Cleaning',
  'Air Brakes',
]

export default function VehicleCheckItemsClient({
  departmentId,
  initialItems,
}: {
  departmentId: string
  initialItems: CheckItem[]
}) {
  const [items, setItems] = useState<CheckItem[]>(initialItems)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  // Group items
  const grouped = items.reduce<Record<string, CheckItem[]>>((acc, item) => {
    ;(acc[item.group_name] ??= []).push(item)
    return acc
  }, {})
  const groupNames = Object.keys(grouped).sort()

  async function handleToggle(item: CheckItem) {
    setLoading(true); setError(null); setSuccess(null)
    const res = await toggleVehicleCheckItem(item.id, !item.active)
    if (res.error) { setError(res.error) } else {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, active: !item.active } : i))
    }
    setLoading(false)
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault()
    setLoading(true); setError(null); setSuccess(null)
    const fd = new FormData(e.currentTarget)
    const res = await updateVehicleCheckItem(fd)
    if (res.error) { setError(res.error) } else {
      setSuccess('Item updated.')
      setEditingId(null)
      // optimistic update
      setItems(prev => prev.map(i => i.id === id ? {
        ...i,
        label: fd.get('label') as string,
        group_name: fd.get('group_name') as string,
        has_amount_field: fd.get('has_amount_field') === 'true',
        requires_air_brakes: fd.get('requires_air_brakes') === 'true',
      } : i))
    }
    setLoading(false)
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true); setError(null); setSuccess(null)
    const fd = new FormData(e.currentTarget)
    const res = await addVehicleCheckItem(fd)
    if (res.error) { setError(res.error) } else {
      setSuccess('Item added. Reload to see updated list.')
      setShowAdd(false)
      ;(e.target as HTMLFormElement).reset()
    }
    setLoading(false)
  }

  async function handleReset() {
    setLoading(true); setError(null); setSuccess(null)
    const res = await resetVehicleCheckItemsToDefaults(departmentId)
    if (res.error) { setError(res.error) } else {
      setSuccess('Items reset to defaults. Reload to see changes.')
      setConfirmReset(false)
    }
    setLoading(false)
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Vehicle Check Items</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Customize the checklist used during vehicle inspections. Toggle items off to hide them without deleting.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setConfirmReset(true)}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            Reset to defaults
          </button>
          <button
            onClick={() => { setShowAdd(v => !v); setError(null) }}
            className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 transition-colors"
          >
            + Add Item
          </button>
        </div>
      </div>

      {error && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-3 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">{success}</div>}

      {confirmReset && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900">Reset all items to system defaults?</p>
            <p className="text-xs text-amber-700 mt-0.5">This will delete your customizations and restore the original checklist.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setConfirmReset(false)} className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700">Cancel</button>
            <button onClick={handleReset} disabled={loading} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50">Confirm Reset</button>
          </div>
        </div>
      )}

      {/* Add item form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="mb-5 rounded-xl bg-white border border-zinc-200 p-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-zinc-900">New Item</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-600 mb-1">Label</label>
              <input name="label" required className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" placeholder="e.g. Check Pump Oil" />
            </div>
            <div>
              <label className="block text-xs text-zinc-600 mb-1">Group</label>
              <select name="group_name" required className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 bg-white">
                {GROUP_OPTIONS.map(g => <option key={g}>{g}</option>)}
                <option value="__custom__">Other (type below)</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
              <input type="checkbox" name="has_amount_field" value="true" className="rounded border-zinc-300 text-red-600 focus:ring-red-500" />
              Has "amount added" field (fluids)
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
              <input type="checkbox" name="requires_air_brakes" value="true" className="rounded border-zinc-300 text-red-600 focus:ring-red-500" />
              Air brakes only
            </label>
          </div>
          <div>
            <label className="block text-xs text-zinc-600 mb-1">Instructions (optional) <span className="text-zinc-400">— shown to inspector in the check form</span></label>
            <textarea name="instructions" rows={4}
              className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-y"
              placeholder={"Procedure: ...\n\nListen for: ...\n\nPass: ...\n\nFail: ..."} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border border-zinc-300 px-4 py-1.5 text-sm font-semibold text-zinc-600">Cancel</button>
            <button type="submit" disabled={loading} className="rounded-lg bg-red-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">{loading ? 'Adding…' : 'Add Item'}</button>
          </div>
        </form>
      )}

      {/* Items by group */}
      <div className="flex flex-col gap-4">
        {groupNames.map(group => (
          <div key={group} className="rounded-xl bg-white border border-zinc-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{group}</h3>
              <span className="text-xs text-zinc-400">
                {grouped[group].filter(i => i.active).length}/{grouped[group].length} active
              </span>
            </div>
            <div className="divide-y divide-zinc-100">
              {grouped[group].map(item => (
                <div key={item.id}>
                  {editingId === item.id ? (
                    <form onSubmit={e => handleUpdate(e, item.id)} className="px-4 py-3 flex flex-col gap-2 bg-zinc-50">
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="active" value={String(item.active)} />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-zinc-600 mb-1">Label</label>
                          <input name="label" defaultValue={item.label} required className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-600 mb-1">Group</label>
                          <select name="group_name" defaultValue={item.group_name} className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 bg-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                            {GROUP_OPTIONS.map(g => <option key={g}>{g}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                          <input type="checkbox" name="has_amount_field" value="true" defaultChecked={item.has_amount_field} className="rounded border-zinc-300 text-red-600" />
                          Amount field (fluids)
                        </label>
                        <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                          <input type="checkbox" name="requires_air_brakes" value="true" defaultChecked={item.requires_air_brakes} className="rounded border-zinc-300 text-red-600" />
                          Air brakes only
                        </label>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-600 mb-1">Instructions</label>
                        <textarea name="instructions" rows={5} defaultValue={item.instructions ?? ''}
                          className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-y"
                          placeholder={"Procedure: ...\n\nListen for: ...\n\nPass: ...\n\nFail: ..."} />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-semibold text-zinc-600">Cancel</button>
                        <button type="submit" disabled={loading} className="rounded-lg bg-red-700 px-3 py-1 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50">Save</button>
                      </div>
                    </form>
                  ) : (
                    <div className={`px-4 py-3 flex items-center justify-between gap-3 ${!item.active ? 'opacity-50' : ''}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm text-zinc-700 truncate">{item.label}</span>
                        {item.has_amount_field && (
                          <span className="rounded-full bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-xs text-blue-600">amount</span>
                        )}
                        {item.requires_air_brakes && (
                          <span className="rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-xs text-amber-600">air brakes</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => setEditingId(item.id)} className="text-xs text-zinc-400 hover:text-zinc-700">Edit</button>
                        <button
                          onClick={() => handleToggle(item)}
                          disabled={loading}
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                            item.active
                              ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                              : 'bg-green-50 text-green-700 hover:bg-green-100'
                          }`}
                        >
                          {item.active ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
