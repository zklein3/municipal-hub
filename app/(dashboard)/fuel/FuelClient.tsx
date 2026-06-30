'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { logFuel, updateFuelEntry, deleteFuelEntry } from '@/app/actions/fuel'
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
  fuel_system: string
  aux_description: string | null
  odometer: number | null
  engine_hours: number | null
  vendor: string | null
  notes: string | null
  logged_by_name: string | null
  fuel_tank_id: string | null
  tank_name: string | null
}

interface Apparatus {
  id: string
  unit_number: string
  apparatus_name: string | null
}

interface FuelTank {
  id: string
  name: string
  fuel_type: string
}

export default function FuelClient({
  entries: initialEntries,
  apparatus,
  fuelTanks = [],
  fixedApparatusId,
  isOfficerOrAbove,
}: {
  entries: FuelEntry[]
  apparatus: Apparatus[]
  fuelTanks?: FuelTank[]
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [fuelSource, setFuelSource] = useState<'external' | 'tank'>('external')
  const fileRef = useRef<HTMLInputElement>(null)

  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState<{
    apparatus_id: string
    fuel_date: string
    gallons: string
    cost_per_gallon: string
    total_cost: string
    fuel_type: string
    fuel_system: string
    aux_description: string
    odometer: string
    engine_hours: string
    vendor: string
    notes: string
    fuel_tank_id: string
  }>({
    apparatus_id: fixedApparatusId ?? '',
    fuel_date: today,
    gallons: '',
    cost_per_gallon: '',
    total_cost: '',
    fuel_type: 'diesel',
    fuel_system: 'main',
    aux_description: '',
    odometer: '',
    engine_hours: '',
    vendor: '',
    notes: '',
    fuel_tank_id: '',
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

  function handleEdit(entry: FuelEntry) {
    setEditingId(entry.id)
    setFuelSource(entry.fuel_tank_id ? 'tank' : 'external')
    setForm({
      apparatus_id: entry.apparatus_id,
      fuel_date: entry.fuel_date,
      gallons: String(entry.gallons),
      cost_per_gallon: entry.cost_per_gallon != null ? String(entry.cost_per_gallon) : '',
      total_cost: entry.total_cost != null ? String(entry.total_cost) : '',
      fuel_type: entry.fuel_type,
      fuel_system: entry.fuel_system,
      aux_description: entry.aux_description ?? '',
      odometer: entry.odometer != null ? String(entry.odometer) : '',
      engine_hours: entry.engine_hours != null ? String(entry.engine_hours) : '',
      vendor: entry.vendor ?? '',
      notes: entry.notes ?? '',
      fuel_tank_id: entry.fuel_tank_id ?? '',
    })
    setShowForm(true)
    setError(null)
    setSuccess(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCancelForm() {
    setShowForm(false)
    setEditingId(null)
    setFuelSource('external')
    setError(null)
    setSuccess(null)
    setForm(prev => ({ ...prev, gallons: '', cost_per_gallon: '', total_cost: '', fuel_system: 'main', aux_description: '', odometer: '', engine_hours: '', vendor: '', notes: '', fuel_date: today, apparatus_id: fixedApparatusId ?? '', fuel_tank_id: '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)
    const fd = new FormData()
    // Don't send fuel_tank_id via the catch-all — handle it explicitly below
    const { fuel_tank_id: _ftid, ...regularFields } = form
    Object.entries(regularFields).forEach(([k, v]) => { if (v) fd.set(k, v) })
    if (fuelSource === 'tank' && form.fuel_tank_id) {
      fd.set('fuel_tank_id', form.fuel_tank_id)
    }

    if (editingId) {
      const result = await updateFuelEntry(editingId, fd)
      if (result?.error) { setError(result.error); setLoading(false); return }
      setEntries(prev => prev.map(e => e.id === editingId ? {
        ...e,
        fuel_date: form.fuel_date,
        gallons: parseFloat(form.gallons),
        cost_per_gallon: form.cost_per_gallon ? parseFloat(form.cost_per_gallon) : null,
        total_cost: form.total_cost ? parseFloat(form.total_cost) : null,
        fuel_type: form.fuel_type,
        fuel_system: form.fuel_system,
        aux_description: form.aux_description || null,
        odometer: form.odometer ? parseInt(form.odometer) : null,
        engine_hours: form.engine_hours ? parseFloat(form.engine_hours) : null,
        vendor: form.vendor || null,
        notes: form.notes || null,
      } : e))
      setSuccess('Fuel entry updated.')
    } else {
      const result = await logFuel(fd)
      if (result?.error) { setError(result.error); setLoading(false); return }
      setSuccess('Fuel entry saved.')
      router.refresh()
    }

    setShowForm(false)
    setEditingId(null)
    setFuelSource('external')
    setForm(prev => ({ ...prev, gallons: '', cost_per_gallon: '', total_cost: '', fuel_system: 'main', aux_description: '', odometer: '', engine_hours: '', vendor: '', notes: '', fuel_date: today, apparatus_id: fixedApparatusId ?? '', fuel_tank_id: '' }))
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
        <button onClick={() => showForm ? handleCancelForm() : setShowForm(true)}
          className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800">
          {showForm ? 'Cancel' : '+ Log Fuel'}
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">{success}</div>}

      {showForm && (
        <div className="mb-6 rounded-xl bg-white border border-zinc-200 p-5 shadow-sm">
          <p className="text-sm font-semibold text-zinc-700 mb-4">{editingId ? 'Edit Fuel Entry' : 'New Fuel Entry'}</p>
          {/* Receipt scan */}
          <div className="mb-4 flex items-center gap-3">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={scanning}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-colors">
              {scanning ? 'Scanning…' : '📷 Scan Receipt'}
            </button>
            <p className="text-xs text-zinc-400">Photo a receipt to auto-fill fields</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleScan} />
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

            {/* Fuel source — only shown when dept has on-site tanks */}
            {fuelTanks.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Fuel Source</label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="fuel_source"
                      checked={fuelSource === 'external'}
                      onChange={() => {
                        setFuelSource('external')
                        setForm(p => ({ ...p, fuel_tank_id: '' }))
                      }}
                      className="accent-red-600"
                    />
                    External (vendor)
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="fuel_source"
                      checked={fuelSource === 'tank'}
                      onChange={() => {
                        setFuelSource('tank')
                        const matching = fuelTanks.filter(t => t.fuel_type === form.fuel_type)
                        setForm(p => ({ ...p, fuel_tank_id: matching.length === 1 ? matching[0].id : '' }))
                      }}
                      className="accent-red-600"
                    />
                    Department Tank
                  </label>
                </div>
                {fuelSource === 'tank' && (
                  <select
                    value={form.fuel_tank_id}
                    onChange={e => setForm(p => ({ ...p, fuel_tank_id: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">Select tank…</option>
                    {fuelTanks
                      .filter(t => t.fuel_type === form.fuel_type)
                      .map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                    }
                    {fuelTanks.filter(t => t.fuel_type === form.fuel_type).length === 0 && (
                      <option disabled>No {form.fuel_type} tanks configured</option>
                    )}
                  </select>
                )}
              </div>
            )}

            {/* Fuel system */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-zinc-700">Fuel System</label>
                <select value={form.fuel_system} onChange={e => setForm(p => ({ ...p, fuel_system: e.target.value, aux_description: '' }))} className={inputCls}>
                  <option value="main">Main Tank</option>
                  <option value="auxiliary">Auxiliary System</option>
                </select>
              </div>
              {form.fuel_system === 'auxiliary' && (
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-zinc-700">System Name</label>
                  <input type="text" value={form.aux_description} onChange={e => setForm(p => ({ ...p, aux_description: e.target.value }))}
                    className={inputCls} placeholder="e.g. Grass pump, Generator" />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-zinc-700">Gallons <span className="text-red-500">*</span></label>
                <input type="number" step="0.001" min="0.001" value={form.gallons}
                  onChange={e => setForm(p => ({ ...p, gallons: e.target.value }))} required className={inputCls} placeholder="25.431" />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-zinc-700">Price/Gal <span className="text-zinc-400 font-normal">(optional)</span></label>
                <input type="number" step="0.001" min="0" value={form.cost_per_gallon}
                  onChange={e => autoCalc('cost_per_gallon', e.target.value)} className={inputCls} placeholder="3.459" />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-zinc-700">Total $ <span className="text-zinc-400 font-normal">(optional)</span></label>
                <input type="number" step="0.01" min="0" value={form.total_cost}
                  onChange={e => autoCalc('total_cost', e.target.value)} className={inputCls} placeholder="87.95" />
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-zinc-700">Vendor</label>
                <input type="text" value={form.vendor} onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))} className={inputCls} placeholder="Casey's General Store" />
              </div>
              {form.fuel_system === 'main' && (
                <div className="w-28">
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Odometer</label>
                  <input type="number" min="0" value={form.odometer} onChange={e => setForm(p => ({ ...p, odometer: e.target.value }))} className={inputCls} placeholder="12500" />
                </div>
              )}
              <div className="w-28">
                <label className="mb-1 block text-xs font-medium text-zinc-700">Eng. Hours</label>
                <input type="number" step="0.1" min="0" value={form.engine_hours} onChange={e => setForm(p => ({ ...p, engine_hours: e.target.value }))} className={inputCls} placeholder="1250.5" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className={inputCls} placeholder="Optional" />
            </div>

            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
              {loading ? 'Saving…' : editingId ? 'Update Fuel Entry' : 'Save Fuel Entry'}
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
                    {entry.fuel_system === 'auxiliary' && (
                      <span className="text-xs rounded-full bg-purple-100 text-purple-700 px-2 py-0.5">
                        Aux{entry.aux_description ? ` — ${entry.aux_description}` : ''}
                      </span>
                    )}
                    {entry.tank_name && (
                      <span className="text-xs rounded-full bg-green-100 text-green-700 px-2 py-0.5">
                        Dept Tank — {entry.tank_name}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 mt-0.5 text-xs text-zinc-500 flex-wrap">
                    <span className="font-semibold text-zinc-700">{entry.gallons.toFixed(3)} gal</span>
                    {entry.cost_per_gallon && <span>${entry.cost_per_gallon.toFixed(3)}/gal</span>}
                    {entry.total_cost && <span className="font-semibold text-zinc-700">${entry.total_cost.toFixed(2)}</span>}
                    {entry.vendor && <span>{entry.vendor}</span>}
                    {entry.odometer && <span>{entry.odometer.toLocaleString()} mi</span>}
                    {entry.engine_hours && <span>{entry.engine_hours} hrs</span>}
                  </div>
                  {entry.notes && <p className="text-xs text-zinc-400 mt-0.5 italic">{entry.notes}</p>}
                  {entry.logged_by_name && <p className="text-xs text-zinc-400 mt-0.5">Logged by {entry.logged_by_name}</p>}
                </div>
                {isOfficerOrAbove && (
                  <div className="shrink-0 flex gap-3">
                    <button onClick={() => handleEdit(entry)}
                      className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(entry.id)} disabled={deletingId === entry.id}
                      className="text-xs text-zinc-400 hover:text-red-600 disabled:opacity-50 transition-colors">
                      {deletingId === entry.id ? '…' : 'Delete'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
