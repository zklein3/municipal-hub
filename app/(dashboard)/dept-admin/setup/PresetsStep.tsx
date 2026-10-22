'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createPreset,
  updatePreset,
  deletePreset,
  setPresetItem,
  removePresetItem,
  setPresetMedication,
  removePresetMedication,
  setPresetTypes,
  deployPresetToApparatus,
} from '@/app/actions/presets'
import { addMissingStarters } from '@/app/actions/starters'
import HelpPrompt from './HelpPrompt'

interface Preset {
  id: string
  name: string
  default_code: string
  description: string | null
  sort_order: number | null
  active: boolean
}

interface Props {
  presets: Preset[]
  presetItems: { preset_id: string; item_id: string; expected_quantity: number; minimum_quantity: number | null }[]
  presetMeds: { preset_id: string; supply_type_id: string; par_level: number | null }[]
  presetTypes: { preset_id: string; apparatus_type_id: string }[]
  apparatusTypes: { id: string; name: string }[]
  apparatus: { id: string; unit_number: string; apparatus_name: string | null; apparatus_type_id: string | null; active: boolean }[]
  truckCompartments: { id: string; apparatus_id: string; code: string; name: string | null }[]
  items: { id: string; item_name: string; category_id: string | null; active: boolean }[]
  categories: { id: string; category_name: string }[]
  medicalSupplyTypes: { id: string; name: string; unit_of_measure: string }[]
  moduleMedical: boolean
  showHelp: boolean
  helpResetKey: number
}

type Panel = { id: string; mode: 'edit' | 'contents' | 'types' | 'deploy' | 'delete' } | null

const inputCls = 'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500'
const smallBtn = 'rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors'
const primaryBtn = 'rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors'

export default function PresetsStep({
  presets, presetItems, presetMeds, presetTypes, apparatusTypes, apparatus, truckCompartments,
  items, categories, medicalSupplyTypes, moduleMedical, showHelp, helpResetKey,
}: Props) {
  const router = useRouter()
  const [panel, setPanel] = useState<Panel>(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const itemById = useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items])
  const medById = useMemo(() => Object.fromEntries(medicalSupplyTypes.map(m => [m.id, m])), [medicalSupplyTypes])
  const typeById = useMemo(() => Object.fromEntries(apparatusTypes.map(t => [t.id, t.name])), [apparatusTypes])
  const itemsByPreset = useMemo(() => groupBy(presetItems, r => r.preset_id), [presetItems])
  const medsByPreset = useMemo(() => groupBy(presetMeds, r => r.preset_id), [presetMeds])
  const typesByPreset = useMemo(() => groupBy(presetTypes, r => r.preset_id), [presetTypes])

  const q = search.trim().toLowerCase()
  const visible = presets
    .filter(p => showInactive || p.active)
    .filter(p => !typeFilter || (typesByPreset[p.id] ?? []).some(t => t.apparatus_type_id === typeFilter))
    .filter(p => !q || p.name.toLowerCase().includes(q) || p.default_code.toLowerCase().includes(q))
    .sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || a.name.localeCompare(b.name))
  const usedTypeIds = new Set(presetTypes.map(t => t.apparatus_type_id))

  function open(id: string, mode: NonNullable<Panel>['mode']) {
    setPanel(panel?.id === id && panel.mode === mode ? null : { id, mode })
    setShowForm(false); setError(null); setSuccess(null)
  }

  async function run<T extends object>(fn: () => Promise<T>, ok?: string | ((r: T) => string)) {
    setError(null); setSuccess(null); setLoading(true)
    const r = await fn()
    setLoading(false)
    const err = 'error' in r ? (r as { error?: string }).error : undefined
    if (err) { setError(err); return null }
    if (ok) setSuccess(typeof ok === 'function' ? ok(r) : ok)
    router.refresh()
    return r
  }

  async function handleCreate(formData: FormData) {
    const r = await run(() => createPreset(formData), 'Preset created. Add its contents with Contents.')
    if (r) setShowForm(false)
  }

  async function handleAddMissing() {
    await run(() => addMissingStarters(), r => {
      const s = (r as Awaited<ReturnType<typeof addMissingStarters>>).summary
      if (!s) return 'Done.'
      if (s.skipped) return s.skipped
      const added = s.presets.created + s.items.created + s.categories.created + s.medicationTypes.created
      if (added === 0 && s.presetItems === 0 && s.presetMedications === 0) return 'You already have every starter preset and item.'
      return `Added ${s.presets.created} presets, ${s.items.created} items, ${s.categories.created} categories` +
        (s.medicationTypes.created ? `, ${s.medicationTypes.created} medication types` : '') +
        (s.items.adopted ? ` (matched ${s.items.adopted} items you already had)` : '') + '.'
    })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900">Compartment Presets</h2>
          <p className="text-sm text-zinc-500">{presets.filter(p => p.active).length} active</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleAddMissing} disabled={loading} className={smallBtn}>
            Add missing starters
          </button>
          <button
            onClick={() => { setShowForm(!showForm); setPanel(null); setError(null); setSuccess(null) }}
            className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 transition-colors"
          >
            {showForm ? 'Cancel' : '+ New Preset'}
          </button>
        </div>
      </div>

      <HelpPrompt id="presets" showHelp={showHelp} helpResetKey={helpResetKey}>
        A preset is a ready-made compartment — like Pump Panel or Airway — with the items and medications that belong in it.
        Rename or change any preset. Deploy puts it on a truck, either as a new compartment or into one the truck already has;
        it only adds what&apos;s missing and never changes quantities already set. Presets tagged with a truck&apos;s type are
        added by &quot;Add standard compartments&quot; on that truck.
      </HelpPrompt>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 border border-green-200">{success}</div>}

      {showForm && (
        <div className="mb-4 rounded-xl bg-white p-5 shadow-sm border border-zinc-200">
          <p className="text-sm font-semibold text-zinc-900 mb-4">New Preset</p>
          <form action={handleCreate} className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-zinc-600">Name <span className="text-red-500">*</span></label>
                <input name="name" required placeholder="Pump Panel" className={inputCls} />
              </div>
              <div className="sm:w-36">
                <label className="mb-1 block text-xs font-medium text-zinc-600">Code <span className="text-red-500">*</span></label>
                <input name="default_code" required placeholder="PUMP" className={`${inputCls} font-mono uppercase`}
                  onInput={e => { (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.toUpperCase() }} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Description</label>
              <input name="description" className={inputCls} />
            </div>
            <button type="submit" disabled={loading} className={primaryBtn}>{loading ? 'Adding...' : 'Create Preset'}</button>
          </form>
        </div>
      )}

      {presets.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search presets..." className={inputCls} />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={`${inputCls} sm:w-56`}>
            <option value="">All apparatus types</option>
            {apparatusTypes.filter(t => usedTypeIds.has(t.id)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-xs text-zinc-600 whitespace-nowrap">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded border-zinc-300 text-red-600 focus:ring-red-500" />
            Show inactive
          </label>
        </div>
      )}

      {presets.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-white px-6 py-12 text-center text-sm text-zinc-400">
          No presets yet. Use &quot;Add missing starters&quot; to load the standard set, or create your own.
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-white px-6 py-12 text-center text-sm text-zinc-400">
          No presets match.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map(p => {
            const pItems = itemsByPreset[p.id] ?? []
            const pMeds = medsByPreset[p.id] ?? []
            const pTypes = (typesByPreset[p.id] ?? []).map(t => typeById[t.apparatus_type_id]).filter(Boolean)
            const active = panel?.id === p.id ? panel.mode : null
            return (
              <div key={p.id} className={`rounded-xl bg-white border shadow-sm ${p.active ? 'border-zinc-200' : 'border-zinc-100 opacity-60'}`}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-zinc-900">{p.name}</span>
                      <span className="font-mono text-xs text-zinc-500">{p.default_code}</span>
                      {!p.active && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">Inactive</span>}
                    </div>
                    <p className="text-xs text-zinc-500">
                      {pItems.length} item{pItems.length === 1 ? '' : 's'}
                      {moduleMedical && pMeds.length > 0 ? ` · ${pMeds.length} medication${pMeds.length === 1 ? '' : 's'}` : ''}
                      {p.description ? ` · ${p.description}` : ''}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {pTypes.length === 0
                        ? <span className="text-xs text-zinc-400">Not standard for any apparatus type</span>
                        : pTypes.map(n => <span key={n} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">{n}</span>)}
                    </div>
                  </div>
                  <div className="flex flex-wrap shrink-0 gap-2">
                    <button onClick={() => open(p.id, 'contents')} className={smallBtn}>Contents</button>
                    <button onClick={() => open(p.id, 'types')} className={smallBtn}>Types</button>
                    <button onClick={() => open(p.id, 'deploy')} className={smallBtn}>Deploy</button>
                    <button onClick={() => open(p.id, 'edit')} className={smallBtn}>Edit</button>
                    <button onClick={() => open(p.id, 'delete')} className={`${smallBtn} hover:text-red-700`}>Delete</button>
                  </div>
                </div>

                {active === 'edit' && (
                  <EditPanel preset={p} loading={loading} onCancel={() => setPanel(null)}
                    onSave={async fd => { if (await run(() => updatePreset(fd), 'Preset saved.')) setPanel(null) }} />
                )}
                {active === 'delete' && (
                  <div className="border-t border-zinc-100 p-4 bg-amber-50 rounded-b-xl">
                    <p className="text-sm text-amber-800 mb-3">
                      Delete <span className="font-semibold">{p.name}</span>? Trucks it was deployed to keep their compartments and items.
                    </p>
                    <div className="flex gap-2">
                      <button disabled={loading} className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50"
                        onClick={async () => { if (await run(() => deletePreset(p.id), 'Preset deleted.')) setPanel(null) }}>Delete</button>
                      <button className={smallBtn} onClick={() => setPanel(null)}>Cancel</button>
                    </div>
                  </div>
                )}
                {active === 'types' && (
                  <TypesPanel apparatusTypes={apparatusTypes} selected={(typesByPreset[p.id] ?? []).map(t => t.apparatus_type_id)}
                    loading={loading} onCancel={() => setPanel(null)}
                    onSave={async ids => { if (await run(() => setPresetTypes(p.id, ids), 'Apparatus types saved.')) setPanel(null) }} />
                )}
                {active === 'contents' && (
                  <ContentsPanel
                    pItems={pItems} pMeds={pMeds} itemById={itemById} medById={medById}
                    items={items} categories={categories} medicalSupplyTypes={medicalSupplyTypes} moduleMedical={moduleMedical}
                    loading={loading}
                    onSetItem={(itemId, qty, min) => run(() => setPresetItem(p.id, itemId, qty, min))}
                    onRemoveItem={itemId => run(() => removePresetItem(p.id, itemId))}
                    onSetMed={(medId, par) => run(() => setPresetMedication(p.id, medId, par))}
                    onRemoveMed={medId => run(() => removePresetMedication(p.id, medId))}
                  />
                )}
                {active === 'deploy' && (
                  <DeployPanel preset={p} apparatus={apparatus.filter(a => a.active)} truckCompartments={truckCompartments}
                    typeById={typeById} loading={loading} onCancel={() => setPanel(null)}
                    onDeploy={async targets => {
                      const r = await run(() => deployPresetToApparatus(p.id, targets), res => summarizeDeploy(res, apparatus))
                      if (r) setPanel(null)
                    }} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function groupBy<T>(rows: T[], key: (r: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {}
  for (const r of rows) (out[key(r)] ??= []).push(r)
  return out
}

function summarizeDeploy(
  res: Awaited<ReturnType<typeof deployPresetToApparatus>>,
  apparatus: { id: string; unit_number: string }[]
): string {
  const unit = (id: string) => apparatus.find(a => a.id === id)?.unit_number ?? 'truck'
  return (res.results ?? []).map(r => {
    if (r.error) return `${unit(r.apparatus_id)}: ${r.error}`
    const x = r.result!
    const parts = [
      x.compartmentCreated ? 'compartment created' : 'added to existing compartment',
      `${x.itemsAdded + x.itemsReactivated} items added`,
    ]
    if (x.itemsSkipped) parts.push(`${x.itemsSkipped} already there`)
    if (x.medicationsAdded) parts.push(`${x.medicationsAdded} medications added (count stock in with Receive)`)
    if (x.medicationsSkippedNoModule) parts.push('medications skipped — Medical module is off')
    return `${unit(r.apparatus_id)}: ${parts.join(', ')}`
  }).join(' · ')
}

function EditPanel({ preset, loading, onSave, onCancel }: {
  preset: Preset; loading: boolean; onSave: (fd: FormData) => void; onCancel: () => void
}) {
  return (
    <div className="border-t border-zinc-100 p-4">
      <form action={onSave} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={preset.id} />
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-zinc-600">Name</label>
            <input name="name" required defaultValue={preset.name} className={inputCls} />
          </div>
          <div className="sm:w-36">
            <label className="mb-1 block text-xs font-medium text-zinc-600">Code</label>
            <input name="default_code" required defaultValue={preset.default_code} className={`${inputCls} font-mono uppercase`}
              onInput={e => { (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.toUpperCase() }} />
          </div>
          <div className="sm:w-24">
            <label className="mb-1 block text-xs font-medium text-zinc-600">Sort</label>
            <input name="sort_order" type="number" min="0" defaultValue={preset.sort_order ?? ''} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Description</label>
          <input name="description" defaultValue={preset.description ?? ''} className={inputCls} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-600">Status</span>
          <select name="active" defaultValue={preset.active ? 'true' : 'false'} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm">
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        <p className="text-xs text-zinc-500">The code is used when this preset creates a new compartment on a truck. Trucks it was already deployed to don&apos;t change.</p>
        <div className="flex gap-2">
          <button type="submit" disabled={loading} className={`flex-1 ${primaryBtn}`}>{loading ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={onCancel} className={smallBtn}>Cancel</button>
        </div>
      </form>
    </div>
  )
}

function TypesPanel({ apparatusTypes, selected, loading, onSave, onCancel }: {
  apparatusTypes: { id: string; name: string }[]; selected: string[]; loading: boolean
  onSave: (ids: string[]) => void; onCancel: () => void
}) {
  const [checked, setChecked] = useState(new Set(selected))
  return (
    <div className="border-t border-zinc-100 p-4">
      <p className="text-xs text-zinc-500 mb-3">Standard for these apparatus types — &quot;Add standard compartments&quot; on a truck of a checked type adds this preset.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-4">
        {apparatusTypes.map(t => (
          <label key={t.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm cursor-pointer hover:bg-zinc-50">
            <input type="checkbox" checked={checked.has(t.id)} className="rounded border-zinc-300 text-red-600 focus:ring-red-500"
              onChange={() => setChecked(prev => { const n = new Set(prev); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n })} />
            {t.name}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <button disabled={loading} onClick={() => onSave([...checked])} className={`flex-1 ${primaryBtn}`}>{loading ? 'Saving...' : 'Save Types'}</button>
        <button onClick={onCancel} className={smallBtn}>Cancel</button>
      </div>
    </div>
  )
}

function ContentsPanel({
  pItems, pMeds, itemById, medById, items, categories, medicalSupplyTypes, moduleMedical, loading,
  onSetItem, onRemoveItem, onSetMed, onRemoveMed,
}: {
  pItems: Props['presetItems']; pMeds: Props['presetMeds']
  itemById: Record<string, Props['items'][number]>; medById: Record<string, Props['medicalSupplyTypes'][number]>
  items: Props['items']; categories: Props['categories']; medicalSupplyTypes: Props['medicalSupplyTypes']
  moduleMedical: boolean; loading: boolean
  onSetItem: (itemId: string, qty: number, min: number | null) => unknown
  onRemoveItem: (itemId: string) => unknown
  onSetMed: (medId: string, par: number) => unknown
  onRemoveMed: (medId: string) => unknown
}) {
  const [newItem, setNewItem] = useState('')
  const [newQty, setNewQty] = useState('1')
  const [newMin, setNewMin] = useState('')
  const [newMed, setNewMed] = useState('')
  const [newPar, setNewPar] = useState('1')

  const inPreset = new Set(pItems.map(i => i.item_id))
  const medInPreset = new Set(pMeds.map(m => m.supply_type_id))
  const catName = Object.fromEntries(categories.map(c => [c.id, c.category_name]))
  const available = items.filter(i => i.active && !inPreset.has(i.id))
  const byCat = groupBy(available, i => i.category_id ? (catName[i.category_id] ?? 'Other') : 'Other')
  const sortedItems = [...pItems].sort((a, b) => (itemById[a.item_id]?.item_name ?? '').localeCompare(itemById[b.item_id]?.item_name ?? ''))

  return (
    <div className="border-t border-zinc-100 p-4 flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">Items</p>
        {sortedItems.length === 0 ? (
          <p className="text-sm text-zinc-400 mb-2">No items yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-zinc-100 mb-3">
            {sortedItems.map(pi => (
              <ItemRow key={pi.item_id} name={itemById[pi.item_id]?.item_name ?? 'Unknown item'}
                qty={pi.expected_quantity} min={pi.minimum_quantity} loading={loading}
                onSave={(q, m) => onSetItem(pi.item_id, q, m)} onRemove={() => onRemoveItem(pi.item_id)} />
            ))}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-2">
          <select value={newItem} onChange={e => setNewItem(e.target.value)} className={inputCls}>
            <option value="">Add an item…</option>
            {Object.keys(byCat).sort().map(cat => (
              <optgroup key={cat} label={cat}>
                {byCat[cat].sort((a, b) => a.item_name.localeCompare(b.item_name)).map(i => <option key={i.id} value={i.id}>{i.item_name}</option>)}
              </optgroup>
            ))}
          </select>
          <input type="number" min="1" value={newQty} onChange={e => setNewQty(e.target.value)} className={`${inputCls} sm:w-20`} aria-label="Quantity" placeholder="Qty" />
          <input type="number" min="0" value={newMin} onChange={e => setNewMin(e.target.value)} className={`${inputCls} sm:w-20`} aria-label="Minimum" placeholder="Min" />
          <button disabled={loading || !newItem} className={primaryBtn}
            onClick={async () => {
              await onSetItem(newItem, parseInt(newQty) || 1, newMin === '' ? null : parseInt(newMin))
              setNewItem(''); setNewQty('1'); setNewMin('')
            }}>Add</button>
        </div>
      </div>

      {moduleMedical && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">Medications</p>
          <p className="text-xs text-zinc-500 mb-2">Type and PAR only. Lots and expiration dates are counted in with Receive after the preset is deployed.</p>
          {pMeds.length === 0 ? (
            <p className="text-sm text-zinc-400 mb-2">No medications.</p>
          ) : (
            <div className="flex flex-col divide-y divide-zinc-100 mb-3">
              {pMeds.map(pm => (
                <MedRow key={pm.supply_type_id} name={medById[pm.supply_type_id]?.name ?? 'Unknown medication'}
                  unit={medById[pm.supply_type_id]?.unit_of_measure ?? ''} par={pm.par_level ?? 0} loading={loading}
                  onSave={par => onSetMed(pm.supply_type_id, par)} onRemove={() => onRemoveMed(pm.supply_type_id)} />
              ))}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <select value={newMed} onChange={e => setNewMed(e.target.value)} className={inputCls}>
              <option value="">Add a medication…</option>
              {medicalSupplyTypes.filter(m => !medInPreset.has(m.id)).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <input type="number" min="0" value={newPar} onChange={e => setNewPar(e.target.value)} className={`${inputCls} sm:w-20`} aria-label="PAR" placeholder="PAR" />
            <button disabled={loading || !newMed} className={primaryBtn}
              onClick={async () => { await onSetMed(newMed, parseInt(newPar) || 0); setNewMed(''); setNewPar('1') }}>Add</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ItemRow({ name, qty, min, loading, onSave, onRemove }: {
  name: string; qty: number; min: number | null; loading: boolean
  onSave: (qty: number, min: number | null) => unknown; onRemove: () => unknown
}) {
  const [q, setQ] = useState(String(qty))
  const [m, setM] = useState(min === null ? '' : String(min))
  const dirty = q !== String(qty) || m !== (min === null ? '' : String(min))
  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <span className="flex-1 min-w-[10rem] text-sm text-zinc-800">{name}</span>
      <label className="flex items-center gap-1 text-xs text-zinc-500">Qty
        <input type="number" min="1" value={q} onChange={e => setQ(e.target.value)} className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex items-center gap-1 text-xs text-zinc-500">Min
        <input type="number" min="0" value={m} onChange={e => setM(e.target.value)} className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm" />
      </label>
      {dirty && <button disabled={loading} onClick={() => onSave(parseInt(q) || 1, m === '' ? null : parseInt(m))} className="text-xs font-semibold text-red-700 hover:underline">Save</button>}
      <button disabled={loading} onClick={() => onRemove()} className="text-xs text-zinc-400 hover:text-red-600">Remove</button>
    </div>
  )
}

function MedRow({ name, unit, par, loading, onSave, onRemove }: {
  name: string; unit: string; par: number; loading: boolean; onSave: (par: number) => unknown; onRemove: () => unknown
}) {
  const [p, setP] = useState(String(par))
  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <span className="flex-1 min-w-[10rem] text-sm text-zinc-800">💊 {name}</span>
      <label className="flex items-center gap-1 text-xs text-zinc-500">PAR
        <input type="number" min="0" value={p} onChange={e => setP(e.target.value)} className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm" />
        {unit && <span>{unit}</span>}
      </label>
      {p !== String(par) && <button disabled={loading} onClick={() => onSave(parseInt(p) || 0)} className="text-xs font-semibold text-red-700 hover:underline">Save</button>}
      <button disabled={loading} onClick={() => onRemove()} className="text-xs text-zinc-400 hover:text-red-600">Remove</button>
    </div>
  )
}

function DeployPanel({ preset, apparatus, truckCompartments, typeById, loading, onDeploy, onCancel }: {
  preset: Preset
  apparatus: Props['apparatus']
  truckCompartments: Props['truckCompartments']
  typeById: Record<string, string>
  loading: boolean
  onDeploy: (targets: { apparatus_id: string; compartment_id: string | null }[]) => void
  onCancel: () => void
}) {
  // apparatus_id → '' (new compartment from preset) | existing compartment id
  const [targets, setTargets] = useState<Record<string, string>>({})
  const compsByTruck = groupBy(truckCompartments, c => c.apparatus_id)

  return (
    <div className="border-t border-zinc-100 p-4">
      <p className="text-xs text-zinc-500 mb-3">
        Pick trucks. For each, create a new <span className="font-mono">{preset.default_code}</span> compartment or stock one it already has.
        Only missing items are added; quantities already set are never changed.
      </p>
      {apparatus.length === 0 ? (
        <p className="text-sm text-zinc-400 mb-4">No active apparatus.</p>
      ) : (
        <div className="flex flex-col gap-2 mb-4">
          {apparatus.map(a => {
            const on = a.id in targets
            const comps = (compsByTruck[a.id] ?? []).sort((x, y) => x.code.localeCompare(y.code))
            return (
              <div key={a.id} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2">
                <label className="flex flex-1 items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={on} className="rounded border-zinc-300 text-red-600 focus:ring-red-500"
                    onChange={() => setTargets(prev => { const n = { ...prev }; if (on) delete n[a.id]; else n[a.id] = ''; return n })} />
                  <span className="text-sm font-medium text-zinc-900">
                    {a.unit_number}{a.apparatus_name ? ` — ${a.apparatus_name}` : ''}
                    {a.apparatus_type_id && typeById[a.apparatus_type_id] && <span className="ml-2 text-xs font-normal text-zinc-400">{typeById[a.apparatus_type_id]}</span>}
                  </span>
                </label>
                {on && (
                  <select value={targets[a.id]} onChange={e => setTargets(prev => ({ ...prev, [a.id]: e.target.value }))}
                    className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm sm:w-64">
                    <option value="">New compartment ({preset.default_code})</option>
                    {comps.map(c => <option key={c.id} value={c.id}>Into {c.code}{c.name ? ` — ${c.name}` : ''}</option>)}
                  </select>
                )}
              </div>
            )
          })}
        </div>
      )}
      <div className="flex gap-2">
        <button disabled={loading || Object.keys(targets).length === 0} className={`flex-1 ${primaryBtn}`}
          onClick={() => onDeploy(Object.entries(targets).map(([apparatus_id, c]) => ({ apparatus_id, compartment_id: c || null })))}>
          {loading ? 'Deploying...' : `Deploy to ${Object.keys(targets).length || ''} truck${Object.keys(targets).length === 1 ? '' : 's'}`}
        </button>
        <button onClick={onCancel} className={smallBtn}>Cancel</button>
      </div>
    </div>
  )
}
