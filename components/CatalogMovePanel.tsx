'use client'

// "Wrong list?" — move an entry between the equipment catalog and the medical catalog without
// recreating it. Shows a preview of what moves before anything changes.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  previewMoveItemToMedical, moveItemToMedicalCatalog,
  previewMoveMedicalToItem, moveMedicalToItemCatalog,
} from '@/app/actions/catalog-move'
import type { ItemToMedicalPreview, MedicalToItemPreview } from '@/lib/catalog-move'

const box = 'rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3'
const inputCls = 'rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500'

function List({ title, rows }: { title: string; rows: string[] }) {
  if (rows.length === 0) return null
  return (
    <div>
      <p className="text-xs font-semibold text-zinc-600">{title}</p>
      <ul className="text-xs text-zinc-600 list-disc pl-5">{rows.map(r => <li key={r}>{r}</li>)}</ul>
    </div>
  )
}

export function MoveItemToMedical({ itemId, onDone }: { itemId: string; onDone?: () => void }) {
  const router = useRouter()
  const [preview, setPreview] = useState<ItemToMedicalPreview | null>(null)
  const [category, setCategory] = useState<'supply' | 'medication' | 'equipment'>('supply')
  const [unit, setUnit] = useState('each')
  const [openingCounts, setOpeningCounts] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function load() {
    setBusy(true); setError(null)
    const r = await previewMoveItemToMedical(itemId)
    setBusy(false)
    if ('error' in r && r.error) { setError(r.error); return }
    if ('preview' in r && r.preview) setPreview(r.preview)
  }

  async function go() {
    setBusy(true); setError(null)
    const r = await moveItemToMedicalCatalog(itemId, { category, unit_of_measure: unit, openingCounts })
    setBusy(false)
    if (r.error) { setError(r.error); return }
    setDone(`Moved to the medical catalog${'moved' in r ? ` — ${r.moved} placement${r.moved === 1 ? '' : 's'} carried over` : ''}. Find it under Medical → Medication Types.`)
    router.refresh()
    onDone?.()
  }

  if (done) return <div className={`${box} text-sm text-green-700`}>{done}</div>

  return (
    <div className={box}>
      <p className="text-sm font-semibold text-zinc-900">Wrong list?</p>
      <p className="text-xs text-zinc-500 mb-2">
        Equipment items are checked present or missing. Things that get used up and restocked (a non-rebreather,
        gauze, gloves) belong in the medical catalog as a <span className="font-semibold">Supply</span>, which keeps a count
        you can use, restock and transfer.
      </p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      {!preview ? (
        <button type="button" disabled={busy} onClick={load}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50">
          {busy ? 'Checking…' : 'Move to the medical catalog…'}
        </button>
      ) : preview.blockedReason ? (
        <p className="text-xs text-amber-700">{preview.blockedReason}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <List title="Carried over (becomes a counted supply here, PAR = expected):" rows={preview.placements.map(p => `${p.label} — ${p.expected}`)} />
          <List title="Presets updated:" rows={preview.presets} />
          {preview.placements.length === 0 && preview.presets.length === 0 && <p className="text-xs text-zinc-500">Not placed on any truck or preset yet.</p>}
          {preview.mergesInto && <p className="text-xs text-zinc-600">A medical type named “{preview.mergesInto}” already exists — this merges into it.</p>}
          {preview.stationStorageQty > 0 && (
            <p className="text-xs text-zinc-600">Station storage shows {preview.stationStorageQty} — that count isn&apos;t moved; receive it into a medical storeroom afterward.</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {!preview.mergesInto && (<>
              <label className="text-xs text-zinc-600">Kind</label>
              <select value={category} onChange={e => setCategory(e.target.value as typeof category)} className={inputCls}>
                <option value="supply">Supply</option>
                <option value="medication">Medication</option>
                <option value="equipment">Medical equipment</option>
              </select>
              <label className="text-xs text-zinc-600">Unit</label>
              <input value={unit} onChange={e => setUnit(e.target.value)} className={`${inputCls} w-24`} />
            </>)}
          </div>
          {preview.placements.length > 0 && (
            <label className="flex items-start gap-2 text-xs text-zinc-700">
              <input type="checkbox" checked={openingCounts} onChange={e => setOpeningCounts(e.target.checked)} className="mt-0.5 rounded border-zinc-300 text-red-600 focus:ring-red-500" />
              <span>Start each location&apos;s count at its expected quantity (logged as an opening count). Uncheck to start at zero and Receive real counts.</span>
            </label>
          )}
          <p className="text-xs text-zinc-500">The equipment item is hidden afterward (kept for its inspection history).</p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={go}
              className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50">
              {busy ? 'Moving…' : 'Move it'}
            </button>
            <button type="button" onClick={() => setPreview(null)} className="text-xs text-zinc-500 hover:underline">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

export function MoveMedicalToItem({
  supplyTypeId, categories, onDone,
}: {
  supplyTypeId: string
  categories: { id: string; category_name: string }[]
  onDone?: () => void
}) {
  const router = useRouter()
  const [preview, setPreview] = useState<MedicalToItemPreview | null>(null)
  const [categoryId, setCategoryId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function load() {
    setBusy(true); setError(null)
    const r = await previewMoveMedicalToItem(supplyTypeId)
    setBusy(false)
    if ('error' in r && r.error) { setError(r.error); return }
    if ('preview' in r && r.preview) setPreview(r.preview)
  }

  async function go() {
    setBusy(true); setError(null)
    const r = await moveMedicalToItemCatalog(supplyTypeId, { category_id: categoryId || null })
    setBusy(false)
    if (r.error) { setError(r.error); return }
    setDone('Moved to the equipment catalog. Find it under Apparatus & Equipment → Items.')
    router.refresh()
    onDone?.()
  }

  if (done) return <div className={`${box} text-sm text-green-700`}>{done}</div>

  return (
    <div className={box}>
      <p className="text-sm font-semibold text-zinc-900">Wrong list?</p>
      <p className="text-xs text-zinc-500 mb-2">
        Durable equipment that&apos;s checked present or missing (a backboard, a stair chair) belongs in the equipment
        catalog rather than as a counted medical entry.
      </p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      {!preview ? (
        <button type="button" disabled={busy} onClick={load}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50">
          {busy ? 'Checking…' : 'Move to the equipment catalog…'}
        </button>
      ) : preview.blockedReason ? (
        <p className="text-xs text-amber-700">{preview.blockedReason}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <List title="Carried over (becomes an expected item, expected = PAR):" rows={preview.placements.map(p => `${p.label} — ${p.par}`)} />
          <List title="Presets updated:" rows={preview.presets} />
          <List title="Not carried over:" rows={preview.skipped.map(s => `${s.label} — ${s.reason}`)} />
          {preview.mergesInto && <p className="text-xs text-zinc-600">An equipment item named “{preview.mergesInto}” already exists — this merges into it.</p>}
          {!preview.mergesInto && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-600">Category</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={inputCls}>
                <option value="">No category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.category_name}</option>)}
              </select>
            </div>
          )}
          <p className="text-xs text-zinc-500">The medical entry is retired afterward; its history keeps its name.</p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={go}
              className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50">
              {busy ? 'Moving…' : 'Move it'}
            </button>
            <button type="button" onClick={() => setPreview(null)} className="text-xs text-zinc-500 hover:underline">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
