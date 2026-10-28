'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  addTemplateEquipmentItem, removeTemplateEquipmentItem,
  addTemplateChild, removeTemplateChild,
} from '@/app/actions/medical'

const selectCls = 'flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500'
const qtyCls = 'w-20 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-center focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500'

export interface TemplateEquipment { id: string; template_id: string; item_id: string; expected_qty: number }
export interface TemplateChild { id: string; template_id: string; child_template_id: string; quantity: number }

// Equipment items and nested bags inside one bag template (medications are handled by the
// "Standard Inventory" list above it). Deploying the template creates all of it.
export default function BagTemplateContents({
  templateId, equipment, childBags, catalogItems, bagTemplates,
}: {
  templateId: string
  equipment: TemplateEquipment[]
  childBags: TemplateChild[]
  catalogItems: { id: string; item_name: string }[]
  bagTemplates: { id: string; name: string; active: boolean }[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addingItem, setAddingItem] = useState(false)
  const [addingBag, setAddingBag] = useState(false)
  const [itemId, setItemId] = useState('')
  const [itemQty, setItemQty] = useState('1')
  const [bagId, setBagId] = useState('')
  const [bagQty, setBagQty] = useState('1')

  const itemName = (id: string) => catalogItems.find(i => i.id === id)?.item_name ?? '—'
  const bagName = (id: string) => bagTemplates.find(t => t.id === id)?.name ?? '—'
  const availableItems = catalogItems.filter(i => !equipment.some(e => e.item_id === i.id))
  const availableBags = bagTemplates.filter(t => t.active && t.id !== templateId && !childBags.some(c => c.child_template_id === t.id))

  async function run(fn: () => Promise<{ error?: string } | undefined>) {
    setBusy(true); setError(null)
    const r = await fn()
    setBusy(false)
    if (r?.error) { setError(r.error); return false }
    router.refresh()
    return true
  }

  return (
    <div className="mt-5 flex flex-col gap-5">
      {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>}

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Equipment Items</p>
          {availableItems.length > 0 && (
            <button onClick={() => setAddingItem(v => !v)} className="text-xs font-semibold text-red-600 hover:text-red-800">
              {addingItem ? 'Cancel' : '+ Add Item'}
            </button>
          )}
        </div>
        {addingItem && (
          <div className="flex gap-2 mb-3">
            <select value={itemId} onChange={e => setItemId(e.target.value)} className={selectCls}>
              <option value="">Select item...</option>
              {availableItems.map(i => <option key={i.id} value={i.id}>{i.item_name}</option>)}
            </select>
            <input type="number" min="0" value={itemQty} onChange={e => setItemQty(e.target.value)} className={qtyCls} aria-label="Expected quantity" />
            <button disabled={busy || !itemId} onClick={async () => {
              if (await run(() => addTemplateEquipmentItem(templateId, itemId, parseInt(itemQty) || 1))) { setAddingItem(false); setItemId(''); setItemQty('1') }
            }} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">Add</button>
          </div>
        )}
        {equipment.length === 0 ? (
          <p className="text-xs text-zinc-400">No equipment items. Add gear (tourniquets, trauma shears…) that lives in this bag.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {equipment.map(e => (
              <div key={e.id} className="flex items-center justify-between bg-white rounded-lg border border-zinc-200 px-4 py-2.5 gap-3">
                <p className="text-sm font-medium text-zinc-900 flex-1 min-w-0">{itemName(e.item_id)}</p>
                <span className="text-xs text-zinc-500 shrink-0">Qty: {e.expected_qty}</span>
                <button disabled={busy} onClick={() => run(() => removeTemplateEquipmentItem(e.id))}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 shrink-0">Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Bags Inside This Bag</p>
          {availableBags.length > 0 && (
            <button onClick={() => setAddingBag(v => !v)} className="text-xs font-semibold text-red-600 hover:text-red-800">
              {addingBag ? 'Cancel' : '+ Add Bag'}
            </button>
          )}
        </div>
        {addingBag && (
          <div className="flex gap-2 mb-3">
            <select value={bagId} onChange={e => setBagId(e.target.value)} className={selectCls}>
              <option value="">Select bag template...</option>
              {availableBags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <input type="number" min="1" value={bagQty} onChange={e => setBagQty(e.target.value)} className={qtyCls} aria-label="How many" />
            <button disabled={busy || !bagId} onClick={async () => {
              if (await run(() => addTemplateChild(templateId, bagId, parseInt(bagQty) || 1))) { setAddingBag(false); setBagId(''); setBagQty('1') }
            }} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">Add</button>
          </div>
        )}
        {childBags.length === 0 ? (
          <p className="text-xs text-zinc-400">No bags inside. Add a template (e.g. a Med Bag) to have it created inside this bag on deploy.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {childBags.map(c => (
              <div key={c.id} className="flex items-center justify-between bg-white rounded-lg border border-zinc-200 px-4 py-2.5 gap-3">
                <p className="text-sm font-medium text-zinc-900 flex-1 min-w-0">{bagName(c.child_template_id)}</p>
                <span className="text-xs text-zinc-500 shrink-0">× {c.quantity}</span>
                <button disabled={busy} onClick={() => run(() => removeTemplateChild(c.id))}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 shrink-0">Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
