'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { logFuel, deleteFuelEntry } from '@/app/actions/fuel'
import { parseFuelReceipt, type ParsedFuelReceipt } from '@/app/actions/parse-fuel-receipt'

const inputCls = 'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500'

interface FuelEntry {
  id: string
  apparatus_id: string
  apparatus_label: string
  fuel_date: string
  gallons: number
  cost_per_gallon: number | null
  total_cost: number | null
  fuel_type: string
  odometer: number | null
  vendor: string | null
  notes: string | null
  logged_by_name: string | null
}

interface Apparatus {
  id: string
  unit_number: string
  apparatus_name: string | null
}

export default function FuelClient({
  entries: initialEntries,
  apparatus,
  fixedApparatusId,
  isOfficerOrAbove,
}: {
  entries: FuelEntry[]
  apparatus: Apparatus[]
  fixedApparatusId?: string
  isOfficerOrAbove: boolean
}) {
  const router = useRouter()
  const [entries, setEntries] = useState(initialEntries)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState<{
    apparatus_id: string
    fuel_date: string
    gallons: string
    cost_per_gallon: string
    total_cost: string
    fuel_type: string
    odometer: string
    vendor: string
    notes: string
  }>({
    apparatus_id: fixedApparatusId ?? '',
    fuel_date: today,
    gallons: '',
    cost_per_gallon: '',
    total_cost: '',
    fuel_type: 'diesel',
    odometer: '',
    vendor: '',
    notes: '',
  })

  function applyParsed(data: ParsedFuelReceipt) {
    setForm(prev => ({
      ...prev,
      gallons: data.gallons != null ? String(data.gallons) : prev.gallons,
      cost_per_gallon: data.cost_per_gallon != null ? String(data.cost_per_gallon) : prev.cost_per_gallon,
      total_cost: data.total_cost != null ? String(data.total_cost) : prev.total_cost,
      fuel_type: data.fuel_type ?? prev.fuel_type,
      vendor: data.vendor ?? prev.vendor,
      fuel_date: data.fuel_date ?? prev.fuel_date,
    }))
  }

  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true)
    setError(null)
    const fd = new FormData()
    fd.set('receipt', file)
    const result = await parseFuelReceipt(fd)
    if (result.error) setError(result.error)
    else if (result.data) { applyParsed(result.data); setSuccess('Receipt scanned — verify fields below.') }
    setScanning(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function autoCalc(field: 'cost_per_gallon' | 'total_cost', value: string) {
    const g = parseFloat(form.gallons)
    if (field === 'cost_per_gallon' && g > 0) {
      const cpp = parseFloat(value)
      if (!isNaN(cpp)) setForm(prev => ({ ...prev, cost_per_gallon: value, total_cost: (g * cpp).toFixed(2) }))
      else setForm(prev => ({ ...prev, cost_per_gallon: value }))
    } else if (field === 'total_cost' && g > 0) {
      const tot = parseFloat(value)
      if (!isNaN(tot)) setForm(prev => ({ ...prev, total_cost: value, cost_per_gallon: (tot / g).toFixed(3) }))
      else setForm(prev => ({ ...prev, total_cost: value }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => { if (v) fd.set(k, v) })
    const result = await logFuel(fd)
    if (result?.error) { setError(result.error); setLoading(false); return }
    setSuccess('Fuel entry saved.')
    setShowForm(false)
    setForm(prev => ({ ...prev, gallons: '', cost_per_gallon: '', total_cost: '', odometer: '', vendor: '', notes: '', fuel_date: today }))
    router.refresh()
    setLoading(false)
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    const result = await deleteFuelEntry(id)
    if (result?.error) setError(result.error)
    else setEntries(prev => prev.filter(e => e.id !== id))
    setDeletingId(null)
  }

  const totalGallons = entries.reduce((s, e) => s + e.gallons, 0)
  const totalCost = entries.reduce((s, e) => s + (e.total_cost ?? 0), 0)

  return (
    <div className="max-w-2xl">
      {/* Summary strip */}
      {entries.length > 0 && (
        <div className="flex gap-4 mb-4">
          <div className="flex-1 rounded-xl bg-white border border-zinc-200 px-4 py-3 text-center">
            <p className="text-lg font-bold text-zinc-900">{totalGallons.toFixed(1)}</p>
            <p className="text-xs text-zinc-400">total gallons</p>
          </div>
          <div className="flex-1 rounded-xl bg-white border border-zinc-200 px-4 py-3 text-center">
            <p className="text-lg font-bold text-zinc-900">${totalCost.toFixed(2)}</p>
            <p className="text-xs text-zinc-400">total cost</p>
          </div>
          <div className="flex-1 rounded-xl bg-white border border-zinc-200 px-4 py-3 text-center">
            <p className="text-lg font-bold text-zinc-900">{entries.length}</p>
            <p className="text-xs text-zinc-400">entries</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-zinc-900">Fuel Log</h2>
        <button onClick={() => { setShowForm(!showForm); setError(null); setSuccess(null) }}
          className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800">
          {showForm ? 'Cancel' : '+ Log Fuel'}
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">{success}</div>}

      {showForm && (
        <div className="mb-6 rounded-xl bg-white border border-zinc-200 p-5 shadow-sm">
          {/* Receipt scan */}
          <div className="mb-4 flex items-center gap-3">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={scanning}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-colors">
              {scanning ? 'Scanning…' : '📷 Scan Receipt'}
            </button>
            <p className="text-xs text-zinc-400">Photo a receipt to auto-fill fields</p>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScan} />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {!fixedApparatusId && (
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Apparatus <span className="text-red-500">*</span></label>
                <select value={form.apparatus_id} onChange={e => setForm(p => ({ ...p, apparatus_id: e.target.value }))} required className={inputCls}>
                  <option value="">Select apparatus...</option>
                  {apparatus.map(a => (
                    <option key={a.id} value={a.id}>{a.unit_number}{a.apparatus_name ? ` — ${a.apparatus_name}` : ''}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-zinc-700">Date <span className="text-red-500">*</span></label>
                <input type="date" value={form.fuel_date} onChange={e => setForm(p => ({ ...p, fuel_date: e.target.value }))} required className={inputCls} />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-zinc-700">Fuel Type</label>
                <select value={form.fuel_type} onChange={e => setForm(p => ({ ...p, fuel_type: e.target.value }))} className={inputCls}>
                  <option value="diesel">Diesel</option>
                  <option value="gasoline">Gasoline</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-zinc-700">Gallons <span className="text-red-500">*</span></label>
                <input type="number" step="0.001" min="0.001" value={form.gallons}
                  onChange={e => setForm(p => ({ ...p, gallons: e.target.value }))} required className={inputCls} placeholder="25.431" />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-zinc-700">Price/Gal</label>
                <input type="number" step="0.001" min="0" value={form.cost_per_gallon}
                  onChange={e => autoCalc('cost_per_gallon', e.target.value)} className={inputCls} placeholder="3.459" />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-zinc-700">Total $</label>
                <input type="number" step="0.01" min="0" value={form.total_cost}
                  onChange={e => autoCalc('total_cost', e.target.value)} className={inputCls} placeholder="87.95" />
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-zinc-700">Vendor</label>
                <input type="text" value={form.vendor} onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))} className={inputCls} placeholder="Casey's General Store" />
              </div>
              <div className="w-32">
                <label className="mb-1 block text-xs font-medium text-zinc-700">Odometer</label>
                <input type="number" min="0" value={form.odometer} onChange={e => setForm(p => ({ ...p, odometer: e.target.value }))} className={inputCls} placeholder="12500" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className={inputCls} placeholder="Optional" />
            </div>

            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
              {loading ? 'Saving…' : 'Save Fuel Entry'}
            </button>
          </form>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="rounded-xl bg-white border border-zinc-200 px-6 py-12 text-center text-sm text-zinc-400">
          No fuel entries yet. Click &quot;+ Log Fuel&quot; to add one.
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden divide-y divide-zinc-100">
          {entries.map(entry => (
            <div key={entry.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-zinc-900">
                      {new Date(entry.fuel_date + 'T12:00:00').toLocaleDateString()}
                    </span>
                    {!fixedApparatusId && (
                      <span className="text-xs rounded-full bg-zinc-100 text-zinc-600 px-2 py-0.5">{entry.apparatus_label}</span>
                    )}
                    <span className={`text-xs rounded-full px-2 py-0.5 ${entry.fuel_type === 'diesel' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                      {entry.fuel_type}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-0.5 text-xs text-zinc-500 flex-wrap">
                    <span className="font-semibold text-zinc-700">{entry.gallons.toFixed(3)} gal</span>
                    {entry.cost_per_gallon && <span>${entry.cost_per_gallon.toFixed(3)}/gal</span>}
                    {entry.total_cost && <span className="font-semibold text-zinc-700">${entry.total_cost.toFixed(2)}</span>}
                    {entry.vendor && <span>{entry.vendor}</span>}
                    {entry.odometer && <span>{entry.odometer.toLocaleString()} mi</span>}
                  </div>
                  {entry.notes && <p className="text-xs text-zinc-400 mt-0.5 italic">{entry.notes}</p>}
                  {entry.logged_by_name && <p className="text-xs text-zinc-400 mt-0.5">Logged by {entry.logged_by_name}</p>}
                </div>
                {isOfficerOrAbove && (
                  <button onClick={() => handleDelete(entry.id)} disabled={deletingId === entry.id}
                    className="shrink-0 text-xs text-zinc-400 hover:text-red-600 disabled:opacity-50 transition-colors">
                    {deletingId === entry.id ? '…' : 'Delete'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
