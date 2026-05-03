'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  createItemCategory, updateItemCategory,
  createItem, updateItem,
  createAsset, updateAsset,
} from '@/app/actions/equipment'
import {
  createInspectionTemplate, updateInspectionTemplate,
  addTemplateStep, updateTemplateStep,
  reorderTemplateSteps, deleteTemplateStep,
} from '@/app/actions/inspections'
import HelpPrompt from './HelpPrompt'

type Tab = 'categories' | 'items' | 'assets' | 'templates'

interface Category { id: string; category_name: string; active: boolean; sort_order: number | null }
interface Item {
  id: string; item_name: string; item_description: string | null; category_id: string | null
  tracks_quantity: boolean; tracks_assets: boolean; requires_presence_check: boolean
  requires_inspection: boolean; tracks_expiration: boolean; active: boolean
}
interface Asset {
  id: string; item_id: string; asset_tag: string; serial_number: string | null
  in_service_date: string | null; status: string; active: boolean; notes: string | null
}
interface Template { id: string; item_id: string; template_name: string; template_description: string | null; active: boolean }
interface Step {
  id: string; template_id: string; step_text: string; step_type: string
  required: boolean; fail_if_negative: boolean; sort_order: number; active: boolean
}

const STEP_TYPES = [
  { value: 'BOOLEAN',   label: 'Pass / Fail' },
  { value: 'NUMERIC',   label: 'Number' },
  { value: 'TEXT',      label: 'Short Text' },
  { value: 'LONG_TEXT', label: 'Long Text' },
]

export default function ItemsStep({
  categories, items, assets, templates, steps, departmentId, showHelp, helpResetKey,
}: {
  categories: Category[]
  items: Item[]
  assets: Asset[]
  templates: Template[]
  steps: Step[]
  departmentId: string
  showHelp: boolean
  helpResetKey: number
}) {
  const [activeTab, setActiveTab] = useState<Tab>('categories')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Category state
  const [showCatForm, setShowCatForm] = useState(false)
  const [editingCatId, setEditingCatId] = useState<string | null>(null)

  // Item state
  const [showItemForm, setShowItemForm] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  // Asset state
  const [addingAssetFor, setAddingAssetFor] = useState<string | null>(null)
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null)

  // Template state
  const [addingTemplateFor, setAddingTemplateFor] = useState<string | null>(null)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null)
  const [addingStepFor, setAddingStepFor] = useState<string | null>(null)
  const [editingStepId, setEditingStepId] = useState<string | null>(null)

  function clear() { setError(null); setSuccess(null) }
  const helpProps = { showHelp, helpResetKey }

  // ── Categories ──
  async function handleCreateCategory(formData: FormData) {
    clear(); setLoading(true)
    formData.append('department_id', departmentId)
    const result = await createItemCategory(formData)
    if (result?.error) setError(result.error)
    else { setSuccess('Category added.'); setShowCatForm(false) }
    setLoading(false)
  }
  async function handleUpdateCategory(formData: FormData) {
    clear(); setLoading(true)
    const result = await updateItemCategory(formData)
    if (result?.error) setError(result.error)
    else { setSuccess('Category updated.'); setEditingCatId(null) }
    setLoading(false)
  }

  // ── Items ──
  async function handleCreateItem(formData: FormData) {
    clear(); setLoading(true)
    formData.append('department_id', departmentId)
    const result = await createItem(formData)
    if (result?.error) setError(result.error)
    else { setSuccess('Item added.'); setShowItemForm(false) }
    setLoading(false)
  }
  async function handleUpdateItem(formData: FormData) {
    clear(); setLoading(true)
    const result = await updateItem(formData)
    if (result?.error) setError(result.error)
    else { setSuccess('Item updated.'); setEditingItemId(null) }
    setLoading(false)
  }

  // ── Assets ──
  async function handleCreateAsset(formData: FormData) {
    clear(); setLoading(true)
    formData.append('department_id', departmentId)
    const result = await createAsset(formData)
    if (result?.error) setError(result.error)
    else { setSuccess('Asset added.'); setAddingAssetFor(null) }
    setLoading(false)
  }
  async function handleUpdateAsset(formData: FormData) {
    clear(); setLoading(true)
    const result = await updateAsset(formData)
    if (result?.error) setError(result.error)
    else { setSuccess('Asset updated.'); setEditingAssetId(null) }
    setLoading(false)
  }

  // ── Templates ──
  async function handleCreateTemplate(formData: FormData) {
    clear(); setLoading(true)
    formData.append('department_id', departmentId)
    const result = await createInspectionTemplate(formData)
    if (result?.error) setError(result.error)
    else {
      setSuccess('Template added.')
      setAddingTemplateFor(null)
      if (result.template_id) setExpandedTemplateId(result.template_id)
    }
    setLoading(false)
  }
  async function handleUpdateTemplate(formData: FormData) {
    clear(); setLoading(true)
    const result = await updateInspectionTemplate(formData)
    if (result?.error) setError(result.error)
    else { setSuccess('Template updated.'); setEditingTemplateId(null) }
    setLoading(false)
  }

  // ── Steps ──
  async function handleAddStep(formData: FormData) {
    clear(); setLoading(true)
    const result = await addTemplateStep(formData)
    if (result?.error) setError(result.error)
    else { setSuccess('Step added.'); setAddingStepFor(null) }
    setLoading(false)
  }
  async function handleUpdateStep(formData: FormData) {
    clear(); setLoading(true)
    const result = await updateTemplateStep(formData)
    if (result?.error) setError(result.error)
    else { setSuccess('Step updated.'); setEditingStepId(null) }
    setLoading(false)
  }
  async function handleDeleteStep(stepId: string) {
    clear(); setLoading(true)
    const result = await deleteTemplateStep(stepId)
    if (result?.error) setError(result.error)
    else setSuccess('Step removed.')
    setLoading(false)
  }
  async function handleReorder(idA: string, sortA: number, idB: string, sortB: number) {
    clear(); setLoading(true)
    const result = await reorderTemplateSteps(idA, sortA, idB, sortB)
    if (result?.error) setError(result.error)
    setLoading(false)
  }

  // Derived maps
  const catMap = Object.fromEntries(categories.map(c => [c.id, c.category_name]))
  const assetsByItem: Record<string, Asset[]> = {}
  for (const a of assets) {
    if (!assetsByItem[a.item_id]) assetsByItem[a.item_id] = []
    assetsByItem[a.item_id].push(a)
  }
  const templatesByItem: Record<string, Template[]> = {}
  for (const t of templates) {
    if (!templatesByItem[t.item_id]) templatesByItem[t.item_id] = []
    templatesByItem[t.item_id].push(t)
  }
  const stepsByTemplate: Record<string, Step[]> = {}
  for (const s of steps) {
    if (!stepsByTemplate[s.template_id]) stepsByTemplate[s.template_id] = []
    stepsByTemplate[s.template_id].push(s)
  }
  const trackableItems = items.filter(i => i.tracks_assets)
  const inspectableItems = items.filter(i => i.requires_inspection && i.active)

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'categories', label: 'Categories',           count: categories.filter(c => c.active).length },
    { id: 'items',      label: 'Items',                count: items.filter(i => i.active).length },
    { id: 'assets',     label: 'Assets',               count: assets.filter(a => a.active).length },
    { id: 'templates',  label: 'Inspection Templates', count: templates.filter(t => t.active).length },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900">Items &amp; Assets</h2>
          <p className="text-sm text-zinc-500">
            {items.filter(i => i.active).length} items · {assets.filter(a => a.active).length} assets · {templates.filter(t => t.active).length} templates
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-zinc-100 rounded-lg p-1 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); clear() }}
            className={`shrink-0 flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${
                activeTab === tab.id ? 'bg-red-100 text-red-700' : 'bg-zinc-200 text-zinc-500'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 border border-green-200">{success}</div>}

      {/* ── Categories Tab ── */}
      {activeTab === 'categories' && (
        <div>
          <HelpPrompt id="items-categories" {...helpProps}>
            Categories group your equipment types. Create these first so items have somewhere to live.
          </HelpPrompt>
          <div className="flex justify-end mb-3">
            <button onClick={() => { setShowCatForm(!showCatForm); setEditingCatId(null); clear() }}
              className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 transition-colors">
              {showCatForm ? 'Cancel' : '+ Add Category'}
            </button>
          </div>
          {showCatForm && (
            <div className="mb-4 rounded-xl bg-white p-5 shadow-sm border border-zinc-200">
              <p className="text-sm font-semibold text-zinc-900 mb-3">New Category</p>
              <form action={handleCreateCategory} className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-zinc-600">Name <span className="text-red-500">*</span></label>
                    <input name="category_name" type="text" required placeholder="Rescue Equipment"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                  </div>
                  <div className="w-28">
                    <label className="mb-1 block text-xs font-medium text-zinc-600">Sort Order</label>
                    <input name="sort_order" type="number" min="0"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors">
                  {loading ? 'Adding...' : 'Add Category'}
                </button>
              </form>
            </div>
          )}
          {categories.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-white px-6 py-10 text-center text-sm text-zinc-400">No categories yet — add one above.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {categories.map(cat => (
                <div key={cat.id} className={`rounded-xl bg-white border shadow-sm ${cat.active ? 'border-zinc-200' : 'border-zinc-100 opacity-60'}`}>
                  {editingCatId === cat.id ? (
                    <div className="p-4">
                      <form action={handleUpdateCategory} className="flex flex-col gap-3">
                        <input type="hidden" name="id" value={cat.id} />
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <input name="category_name" type="text" required defaultValue={cat.category_name}
                              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                          </div>
                          <input name="sort_order" type="number" min="0" defaultValue={cat.sort_order ?? ''} placeholder="Order"
                            className="w-24 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                          <select name="active" defaultValue={cat.active ? 'true' : 'false'}
                            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" disabled={loading}
                            className="flex-1 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors">
                            {loading ? 'Saving...' : 'Save'}
                          </button>
                          <button type="button" onClick={() => setEditingCatId(null)}
                            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">Cancel</button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900">{cat.category_name}</span>
                        {!cat.active && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">Inactive</span>}
                        <span className="text-xs text-zinc-400">{items.filter(i => i.category_id === cat.id && i.active).length} items</span>
                      </div>
                      <button onClick={() => { setEditingCatId(cat.id); setShowCatForm(false); clear() }}
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">Edit</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Items Tab ── */}
      {activeTab === 'items' && (
        <div>
          <HelpPrompt id="items-items" {...helpProps}>
            Items are equipment types (Scott Air Pack, Chainsaw). Checking "Requires Inspection" enables individual asset tracking and an inspection checklist for that type.
          </HelpPrompt>
          <div className="flex justify-end mb-3">
            <button onClick={() => { setShowItemForm(!showItemForm); setEditingItemId(null); clear() }}
              className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 transition-colors">
              {showItemForm ? 'Cancel' : '+ Add Item'}
            </button>
          </div>
          {showItemForm && (
            <div className="mb-4 rounded-xl bg-white p-5 shadow-sm border border-zinc-200">
              <p className="text-sm font-semibold text-zinc-900 mb-3">New Item</p>
              <form action={handleCreateItem} className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-zinc-600">Name <span className="text-red-500">*</span></label>
                    <input name="item_name" type="text" required placeholder="Scott Air Pack"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-zinc-600">Category <span className="text-red-500">*</span></label>
                    <select name="category_id" required
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                      <option value="">Select category...</option>
                      {categories.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.category_name}</option>)}
                    </select>
                  </div>
                </div>
                <input name="item_description" type="text" placeholder="Description (optional)"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                    <input name="requires_inspection" type="checkbox" value="true" className="rounded border-zinc-300 text-red-600 focus:ring-red-500" />
                    Requires Inspection
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                    <input name="requires_presence_check" type="checkbox" value="true" className="rounded border-zinc-300 text-red-600 focus:ring-red-500" />
                    Presence Check
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                    <input name="tracks_expiration" type="checkbox" value="true" className="rounded border-zinc-300 text-red-600 focus:ring-red-500" />
                    Tracks Expiration
                  </label>
                </div>
                <button type="submit" disabled={loading}
                  className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors">
                  {loading ? 'Adding...' : 'Add Item'}
                </button>
              </form>
            </div>
          )}
          {items.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-white px-6 py-10 text-center text-sm text-zinc-400">No items yet — add categories first, then add items.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {items.map(item => (
                <div key={item.id} className={`rounded-xl bg-white border shadow-sm ${item.active ? 'border-zinc-200' : 'border-zinc-100 opacity-60'}`}>
                  {editingItemId === item.id ? (
                    <div className="p-5">
                      <p className="text-sm font-semibold text-zinc-900 mb-3">Edit Item</p>
                      <form action={handleUpdateItem} className="flex flex-col gap-3">
                        <input type="hidden" name="id" value={item.id} />
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="mb-1 block text-xs font-medium text-zinc-600">Name <span className="text-red-500">*</span></label>
                            <input name="item_name" type="text" required defaultValue={item.item_name}
                              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                          </div>
                          <div className="flex-1">
                            <label className="mb-1 block text-xs font-medium text-zinc-600">Category</label>
                            <select name="category_id" defaultValue={item.category_id ?? ''}
                              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                              <option value="">No category</option>
                              {categories.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.category_name}</option>)}
                            </select>
                          </div>
                        </div>
                        <input name="item_description" type="text" placeholder="Description" defaultValue={item.item_description ?? ''}
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                        <div className="flex flex-wrap gap-4">
                          <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                            <input name="requires_inspection" type="checkbox" value="true" defaultChecked={item.requires_inspection} className="rounded border-zinc-300 text-red-600 focus:ring-red-500" />
                            Requires Inspection
                          </label>
                          <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                            <input name="requires_presence_check" type="checkbox" value="true" defaultChecked={item.requires_presence_check} className="rounded border-zinc-300 text-red-600 focus:ring-red-500" />
                            Presence Check
                          </label>
                          <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                            <input name="tracks_expiration" type="checkbox" value="true" defaultChecked={item.tracks_expiration} className="rounded border-zinc-300 text-red-600 focus:ring-red-500" />
                            Tracks Expiration
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-zinc-600">Status</span>
                          <select name="active" defaultValue={item.active ? 'true' : 'false'}
                            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" disabled={loading}
                            className="flex-1 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors">
                            {loading ? 'Saving...' : 'Save Changes'}
                          </button>
                          <button type="button" onClick={() => setEditingItemId(null)}
                            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">Cancel</button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-zinc-900">{item.item_name}</span>
                          {item.category_id && catMap[item.category_id] && <span className="text-xs text-zinc-400">{catMap[item.category_id]}</span>}
                          {!item.active && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">Inactive</span>}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {item.requires_inspection && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">Inspection</span>}
                          {item.requires_presence_check && <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-xs text-yellow-600">Presence Check</span>}
                          {item.tracks_assets && <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-600">Asset Tracked</span>}
                          {item.tracks_expiration && <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-600">Expiration</span>}
                        </div>
                      </div>
                      <button onClick={() => { setEditingItemId(item.id); setShowItemForm(false); clear() }}
                        className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">Edit</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Assets Tab ── */}
      {activeTab === 'assets' && (
        <div>
          <HelpPrompt id="items-assets" {...helpProps}>
            Assets are individually tracked units (SCBA-001, SCBA-002). Add one asset per physical piece of equipment for each item that requires inspection.
          </HelpPrompt>
          {trackableItems.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-white px-6 py-10 text-center text-sm text-zinc-400">
              No asset-tracked items yet. In the Items tab, create an item with "Requires Inspection" checked — it will automatically track individual assets.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {trackableItems.map(item => {
                const itemAssets = assetsByItem[item.id] ?? []
                return (
                  <div key={item.id} className="rounded-xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 border-b border-zinc-200">
                      <div>
                        <span className="font-semibold text-zinc-900">{item.item_name}</span>
                        <span className="ml-2 text-xs text-zinc-500">{itemAssets.filter(a => a.active).length} assets</span>
                      </div>
                      <button onClick={() => { setAddingAssetFor(addingAssetFor === item.id ? null : item.id); clear() }}
                        className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 transition-colors">
                        {addingAssetFor === item.id ? 'Cancel' : '+ Add Asset'}
                      </button>
                    </div>
                    {addingAssetFor === item.id && (
                      <div className="p-4 border-b border-zinc-100">
                        <form action={handleCreateAsset} className="flex flex-col gap-3">
                          <input type="hidden" name="item_id" value={item.id} />
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <label className="mb-1 block text-xs font-medium text-zinc-600">Asset Tag <span className="text-red-500">*</span></label>
                              <input name="asset_name" type="text" required placeholder="SCBA-001"
                                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                            </div>
                            <div className="flex-1">
                              <label className="mb-1 block text-xs font-medium text-zinc-600">Serial #</label>
                              <input name="serial_number" type="text"
                                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <label className="mb-1 block text-xs font-medium text-zinc-600">In Service Date</label>
                              <input name="in_service_date" type="date"
                                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                            </div>
                            <div className="w-44">
                              <label className="mb-1 block text-xs font-medium text-zinc-600">Status</label>
                              <select name="status" defaultValue="IN SERVICE"
                                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                                <option value="IN SERVICE">In Service</option>
                                <option value="OUT OF SERVICE">Out of Service</option>
                                <option value="RETIRED">Retired</option>
                              </select>
                            </div>
                          </div>
                          <button type="submit" disabled={loading}
                            className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors">
                            {loading ? 'Adding...' : 'Add Asset'}
                          </button>
                        </form>
                      </div>
                    )}
                    {itemAssets.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-zinc-400">No assets yet.</div>
                    ) : (
                      <div className="divide-y divide-zinc-100">
                        {itemAssets.map(asset => (
                          <div key={asset.id}>
                            {editingAssetId === asset.id ? (
                              <div className="p-4">
                                <form action={handleUpdateAsset} className="flex flex-col gap-3">
                                  <input type="hidden" name="id" value={asset.id} />
                                  <div className="flex gap-3">
                                    <div className="flex-1">
                                      <label className="mb-1 block text-xs font-medium text-zinc-600">Asset Tag <span className="text-red-500">*</span></label>
                                      <input name="asset_name" type="text" required defaultValue={asset.asset_tag}
                                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                                    </div>
                                    <div className="flex-1">
                                      <label className="mb-1 block text-xs font-medium text-zinc-600">Serial #</label>
                                      <input name="serial_number" type="text" defaultValue={asset.serial_number ?? ''}
                                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                                    </div>
                                  </div>
                                  <div className="flex gap-3">
                                    <div className="flex-1">
                                      <label className="mb-1 block text-xs font-medium text-zinc-600">In Service</label>
                                      <input name="in_service_date" type="date" defaultValue={asset.in_service_date ?? ''}
                                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                                    </div>
                                    <div className="w-44">
                                      <label className="mb-1 block text-xs font-medium text-zinc-600">Status</label>
                                      <select name="status" defaultValue={asset.status}
                                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                                        <option value="IN SERVICE">In Service</option>
                                        <option value="OUT OF SERVICE">Out of Service</option>
                                        <option value="RETIRED">Retired</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button type="submit" disabled={loading}
                                      className="flex-1 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors">
                                      {loading ? 'Saving...' : 'Save'}
                                    </button>
                                    <button type="button" onClick={() => setEditingAssetId(null)}
                                      className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">Cancel</button>
                                  </div>
                                </form>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-3 px-4 py-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="font-mono font-semibold text-zinc-900">{asset.asset_tag}</span>
                                  {asset.serial_number && <span className="text-xs text-zinc-500">SN: {asset.serial_number}</span>}
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                    asset.status === 'IN SERVICE' ? 'bg-green-100 text-green-700' :
                                    asset.status === 'OUT OF SERVICE' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-zinc-100 text-zinc-500'
                                  }`}>
                                    {asset.status === 'IN SERVICE' ? 'In Service' : asset.status === 'OUT OF SERVICE' ? 'Out of Service' : 'Retired'}
                                  </span>
                                </div>
                                <button onClick={() => { setEditingAssetId(asset.id); clear() }}
                                  className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">Edit</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Inspection Templates Tab ── */}
      {activeTab === 'templates' && (
        <div>
          <HelpPrompt id="items-templates" {...helpProps}>
            Each inspectable item needs at least one template before it can be inspected in the field. Name it by frequency (Weekly, Monthly), then add the checklist steps below it.
          </HelpPrompt>

          {inspectableItems.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-white px-6 py-10 text-center text-sm text-zinc-400">
              No inspectable items yet. In the Items tab, create an item with "Requires Inspection" checked — it will appear here for template setup.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {inspectableItems.map(item => {
                const itemTemplates = templatesByItem[item.id] ?? []
                const hasTemplates = itemTemplates.length > 0

                return (
                  <div key={item.id} className="rounded-xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
                    {/* Item header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 border-b border-zinc-200">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900">{item.item_name}</span>
                        {hasTemplates ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                            {itemTemplates.length} template{itemTemplates.length !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">No template yet</span>
                        )}
                      </div>
                      <button
                        onClick={() => { setAddingTemplateFor(addingTemplateFor === item.id ? null : item.id); clear() }}
                        className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 transition-colors"
                      >
                        {addingTemplateFor === item.id ? 'Cancel' : '+ Add Template'}
                      </button>
                    </div>

                    {/* Add template form */}
                    {addingTemplateFor === item.id && (
                      <div className="p-4 border-b border-zinc-100 bg-zinc-50/50">
                        <form action={handleCreateTemplate} className="flex flex-col gap-3">
                          <input type="hidden" name="item_id" value={item.id} />
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <label className="mb-1 block text-xs font-medium text-zinc-600">Template Name <span className="text-red-500">*</span></label>
                              <input name="template_name" type="text" required placeholder="Weekly Inspection"
                                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                            </div>
                            <div className="flex-1">
                              <label className="mb-1 block text-xs font-medium text-zinc-600">Description</label>
                              <input name="template_description" type="text" placeholder="Optional"
                                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                            </div>
                          </div>
                          <button type="submit" disabled={loading}
                            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors">
                            {loading ? 'Adding...' : 'Add Template'}
                          </button>
                        </form>
                      </div>
                    )}

                    {/* Templates list */}
                    {itemTemplates.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-zinc-400">No templates yet — add one above to enable field inspections.</div>
                    ) : (
                      <div className="divide-y divide-zinc-100">
                        {itemTemplates.map(tmpl => {
                          const tmplSteps = stepsByTemplate[tmpl.id] ?? []
                          const isExpanded = expandedTemplateId === tmpl.id

                          return (
                            <div key={tmpl.id}>
                              {/* Template row */}
                              {editingTemplateId === tmpl.id ? (
                                <div className="p-4">
                                  <form action={handleUpdateTemplate} className="flex flex-col gap-3">
                                    <input type="hidden" name="id" value={tmpl.id} />
                                    <div className="flex gap-3">
                                      <div className="flex-1">
                                        <input name="template_name" type="text" required defaultValue={tmpl.template_name}
                                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                                      </div>
                                      <div className="flex-1">
                                        <input name="template_description" type="text" placeholder="Description" defaultValue={tmpl.template_description ?? ''}
                                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                                      </div>
                                      <select name="active" defaultValue={tmpl.active ? 'true' : 'false'}
                                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                                        <option value="true">Active</option>
                                        <option value="false">Inactive</option>
                                      </select>
                                    </div>
                                    <div className="flex gap-2">
                                      <button type="submit" disabled={loading}
                                        className="flex-1 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors">
                                        {loading ? 'Saving...' : 'Save'}
                                      </button>
                                      <button type="button" onClick={() => setEditingTemplateId(null)}
                                        className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">Cancel</button>
                                    </div>
                                  </form>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-3 px-4 py-3">
                                  <button
                                    onClick={() => setExpandedTemplateId(isExpanded ? null : tmpl.id)}
                                    className="flex items-center gap-2 text-left min-w-0 flex-1"
                                  >
                                    <span className="text-zinc-400 text-xs">{isExpanded ? '▼' : '▶'}</span>
                                    <span className="font-medium text-zinc-900">{tmpl.template_name}</span>
                                    <span className="text-xs text-zinc-500">{tmplSteps.length} step{tmplSteps.length !== 1 ? 's' : ''}</span>
                                    {!tmpl.active && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">Inactive</span>}
                                  </button>
                                  <button onClick={() => { setEditingTemplateId(tmpl.id); clear() }}
                                    className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">Edit</button>
                                </div>
                              )}

                              {/* Steps (expanded) */}
                              {isExpanded && (
                                <div className="border-t border-zinc-100 bg-zinc-50/50 px-4 py-3">
                                  {tmplSteps.length === 0 ? (
                                    <p className="text-sm text-zinc-400 mb-3">No steps yet — add the first checklist step below.</p>
                                  ) : (
                                    <div className="flex flex-col gap-2 mb-3">
                                      {tmplSteps.map((step, idx) => (
                                        <div key={step.id}>
                                          {editingStepId === step.id ? (
                                            <div className="rounded-lg border border-zinc-200 bg-white p-3">
                                              <form action={handleUpdateStep} className="flex flex-col gap-3">
                                                <input type="hidden" name="id" value={step.id} />
                                                <input name="step_text" type="text" required defaultValue={step.step_text}
                                                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                                                <div className="flex gap-3">
                                                  <select name="step_type" defaultValue={step.step_type}
                                                    className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                                                    {STEP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                                  </select>
                                                  <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                                                    <input name="required" type="checkbox" value="true" defaultChecked={step.required} className="rounded border-zinc-300 text-red-600 focus:ring-red-500" />
                                                    Required
                                                  </label>
                                                  <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                                                    <input name="fail_if_negative" type="checkbox" value="true" defaultChecked={step.fail_if_negative} className="rounded border-zinc-300 text-red-600 focus:ring-red-500" />
                                                    Fail if No
                                                  </label>
                                                </div>
                                                <div className="flex gap-2">
                                                  <button type="submit" disabled={loading}
                                                    className="flex-1 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors">
                                                    {loading ? 'Saving...' : 'Save Step'}
                                                  </button>
                                                  <button type="button" onClick={() => setEditingStepId(null)}
                                                    className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">Cancel</button>
                                                </div>
                                              </form>
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5">
                                              {/* Reorder */}
                                              <div className="flex flex-col shrink-0">
                                                <button
                                                  disabled={idx === 0 || loading}
                                                  onClick={() => handleReorder(step.id, step.sort_order, tmplSteps[idx - 1].id, tmplSteps[idx - 1].sort_order)}
                                                  className="text-zinc-300 hover:text-zinc-600 disabled:opacity-20 text-xs leading-none"
                                                >▲</button>
                                                <button
                                                  disabled={idx === tmplSteps.length - 1 || loading}
                                                  onClick={() => handleReorder(step.id, step.sort_order, tmplSteps[idx + 1].id, tmplSteps[idx + 1].sort_order)}
                                                  className="text-zinc-300 hover:text-zinc-600 disabled:opacity-20 text-xs leading-none"
                                                >▼</button>
                                              </div>
                                              <span className="text-xs font-semibold text-zinc-400 w-5 shrink-0">{idx + 1}.</span>
                                              <span className="flex-1 text-sm text-zinc-800">{step.step_text}</span>
                                              <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                                                {STEP_TYPES.find(t => t.value === step.step_type)?.label ?? step.step_type}
                                              </span>
                                              {step.fail_if_negative && <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">Fail if No</span>}
                                              <button onClick={() => { setEditingStepId(step.id); clear() }}
                                                className="shrink-0 text-xs text-zinc-400 hover:text-zinc-700 transition-colors">Edit</button>
                                              <button onClick={() => handleDeleteStep(step.id)} disabled={loading}
                                                className="shrink-0 text-xs text-red-400 hover:text-red-600 disabled:opacity-30 transition-colors">✕</button>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Add step form */}
                                  {addingStepFor === tmpl.id ? (
                                    <div className="rounded-lg border border-zinc-200 bg-white p-3">
                                      <form action={handleAddStep} className="flex flex-col gap-3">
                                        <input type="hidden" name="template_id" value={tmpl.id} />
                                        <div>
                                          <label className="mb-1 block text-xs font-medium text-zinc-600">Step Text <span className="text-red-500">*</span></label>
                                          <input name="step_text" type="text" required placeholder="Check cylinder pressure gauge"
                                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                                        </div>
                                        <div className="flex gap-3 flex-wrap">
                                          <div className="flex-1 min-w-36">
                                            <label className="mb-1 block text-xs font-medium text-zinc-600">Response Type</label>
                                            <select name="step_type" defaultValue="BOOLEAN"
                                              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                                              {STEP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                            </select>
                                          </div>
                                          <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer self-end pb-2">
                                            <input name="required" type="checkbox" value="true" defaultChecked className="rounded border-zinc-300 text-red-600 focus:ring-red-500" />
                                            Required
                                          </label>
                                          <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer self-end pb-2">
                                            <input name="fail_if_negative" type="checkbox" value="true" className="rounded border-zinc-300 text-red-600 focus:ring-red-500" />
                                            Fail if No
                                          </label>
                                        </div>
                                        <div className="flex gap-2">
                                          <button type="submit" disabled={loading}
                                            className="flex-1 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors">
                                            {loading ? 'Adding...' : 'Add Step'}
                                          </button>
                                          <button type="button" onClick={() => setAddingStepFor(null)}
                                            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">Cancel</button>
                                        </div>
                                      </form>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => { setAddingStepFor(tmpl.id); setEditingStepId(null); clear() }}
                                      className="w-full rounded-lg border-2 border-dashed border-zinc-200 py-2 text-sm text-zinc-400 hover:border-red-300 hover:text-red-600 transition-colors"
                                    >
                                      + Add Step
                                    </button>
                                  )}
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
            </div>
          )}
        </div>
      )}
    </div>
  )
}
