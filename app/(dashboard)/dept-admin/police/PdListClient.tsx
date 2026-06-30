'use client'

import { useState } from 'react'
import {
  addPdContactType, updatePdContactType, togglePdContactType, reorderPdContactTypes, deletePdContactType,
  addPdActionTakenType, updatePdActionTakenType, togglePdActionTakenType, reorderPdActionTakenTypes, deletePdActionTakenType,
} from '@/app/actions/pd-contacts'

interface ListItem {
  id: string
  label: string
  sort_order: number
  active: boolean
  usageCount?: number
}

const ACTIONS = {
  'contact-type': { add: addPdContactType, update: updatePdContactType, toggle: togglePdContactType, reorder: reorderPdContactTypes, delete: deletePdContactType },
  'action-type': { add: addPdActionTakenType, update: updatePdActionTakenType, toggle: togglePdActionTakenType, reorder: reorderPdActionTakenTypes, delete: deletePdActionTakenType },
} as const

export default function PdListClient({
  listKind,
  departmentId,
  initialItems,
  title,
  description,
  addPlaceholder,
}: {
  listKind: keyof typeof ACTIONS
  departmentId: string
  initialItems: ListItem[]
  title: string
  description: string
  addPlaceholder: string
}) {
  const actions = ACTIONS[listKind]
  const [items, setItems] = useState<ListItem[]>(initialItems)
  const [newLabel, setNewLabel] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!newLabel.trim()) return
    setAdding(true)
    setError(null)
    const res = await actions.add(departmentId, newLabel.trim())
    setAdding(false)
    if (res?.error) { setError(res.error); return }
    setItems(prev => [...prev, { id: crypto.randomUUID(), label: newLabel.trim(), sort_order: prev.length, active: true, usageCount: 0 }])
    setNewLabel('')
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this option permanently? This cannot be undone.')) return
    setError(null)
    const res = await actions.delete(id)
    if (res?.error) { setError(res.error); return }
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function handleRename(id: string) {
    if (!editLabel.trim()) return
    setSaving(true)
    setError(null)
    const res = await actions.update(id, editLabel.trim())
    setSaving(false)
    if (res?.error) { setError(res.error); return }
    setItems(prev => prev.map(i => i.id === id ? { ...i, label: editLabel.trim() } : i))
    setEditingId(null)
  }

  async function handleToggle(id: string, active: boolean) {
    const res = await actions.toggle(id, active)
    if (res?.error) { setError(res.error); return }
    setItems(prev => prev.map(i => i.id === id ? { ...i, active } : i))
  }

  async function handleMove(id: string, direction: 'up' | 'down') {
    const idx = items.findIndex(i => i.id === id)
    if (idx === -1) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === items.length - 1) return
    const next = [...items]
    const swap = direction === 'up' ? idx - 1 : idx + 1
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    const reordered = next.map((i, idx2) => ({ ...i, sort_order: idx2 }))
    setItems(reordered)
    await actions.reorder(departmentId, reordered.map(i => i.id))
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        <p className="text-sm text-zinc-500 mt-0.5">{description}</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-xl bg-white shadow-sm border border-zinc-200 divide-y divide-zinc-100 mb-4">
        {items.length === 0 && (
          <p className="px-4 py-6 text-sm text-zinc-400 text-center">None yet.</p>
        )}
        {items.map((item, idx) => (
          <div key={item.id} className={`flex items-center gap-3 px-4 py-3 ${!item.active ? 'opacity-50' : ''}`}>
            <div className="flex flex-col gap-0.5 shrink-0">
              <button type="button" onClick={() => handleMove(item.id, 'up')} disabled={idx === 0}
                className="text-zinc-300 hover:text-zinc-600 disabled:opacity-20 leading-none text-xs">▲</button>
              <button type="button" onClick={() => handleMove(item.id, 'down')} disabled={idx === items.length - 1}
                className="text-zinc-300 hover:text-zinc-600 disabled:opacity-20 leading-none text-xs">▼</button>
            </div>

            <div className="flex-1 min-w-0">
              {editingId === item.id ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(item.id); if (e.key === 'Escape') setEditingId(null) }}
                    className="flex-1 rounded-lg border border-zinc-300 px-2 py-1 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                  <button type="button" disabled={saving} onClick={() => handleRename(item.id)}
                    className="rounded-lg bg-blue-800 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-900 disabled:opacity-50">
                    {saving ? '...' : 'Save'}
                  </button>
                  <button type="button" onClick={() => setEditingId(null)}
                    className="rounded-lg border border-zinc-200 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50">
                    Cancel
                  </button>
                </div>
              ) : (
                <span className="text-sm font-medium text-zinc-900">{item.label}</span>
              )}
            </div>

            {editingId !== item.id && (
              <div className="flex items-center gap-3 shrink-0">
                <button type="button" onClick={() => { setEditingId(item.id); setEditLabel(item.label) }}
                  className="text-xs text-zinc-400 hover:text-zinc-700">Rename</button>
                <button type="button" onClick={() => handleToggle(item.id, !item.active)}
                  className={`text-xs ${item.active ? 'text-zinc-400 hover:text-red-600' : 'text-zinc-400 hover:text-green-600'}`}>
                  {item.active ? 'Deactivate' : 'Activate'}
                </button>
                {(item.usageCount ?? 0) === 0 ? (
                  <button type="button" onClick={() => handleDelete(item.id)}
                    className="text-xs text-zinc-400 hover:text-red-600">Delete</button>
                ) : (
                  <span className="text-xs text-zinc-300" title={`Used by ${item.usageCount} existing contact${item.usageCount === 1 ? '' : 's'} — deactivate instead`}>
                    In use
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          placeholder={addPlaceholder}
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
        />
        <button type="button" disabled={adding || !newLabel.trim()} onClick={handleAdd}
          className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-50 transition-colors">
          {adding ? 'Adding...' : 'Add'}
        </button>
      </div>
      <p className="mt-2 text-xs text-zinc-400">Deactivating hides an option from new contacts but keeps it on existing historical records. Delete is only available for options that have never been used.</p>
    </div>
  )
}
