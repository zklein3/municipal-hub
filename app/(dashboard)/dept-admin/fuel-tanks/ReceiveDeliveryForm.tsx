'use client'

import { useState, useRef } from 'react'
import { receiveFuelDelivery } from '@/app/actions/fuel-tanks'
import { parseFuelReceipt } from '@/app/actions/parse-fuel-receipt'

const inputCls = 'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500'

export default function ReceiveDeliveryForm({
  tankId,
  tankName,
  fuelType,
  onClose,
  onSuccess,
}: {
  tankId: string
  tankName: string
  fuelType: 'diesel' | 'gasoline' | 'other'
  onClose: () => void
  onSuccess: () => void
}) {
  const today = new Date().toISOString().split('T')[0]
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    delivery_date: today,
    gallons: '',
    cost_per_gallon: '',
    total_cost: '',
    vendor: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanMsg, setScanMsg] = useState<string | null>(null)

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleCPGChange(value: string) {
    const g = parseFloat(form.gallons)
    const cpp = parseFloat(value)
    if (g > 0 && !isNaN(cpp)) {
      setForm(prev => ({ ...prev, cost_per_gallon: value, total_cost: (g * cpp).toFixed(2) }))
    } else {
      set('cost_per_gallon', value)
    }
  }

  function handleTotalChange(value: string) {
    const g = parseFloat(form.gallons)
    const tot = parseFloat(value)
    if (g > 0 && !isNaN(tot)) {
      setForm(prev => ({ ...prev, total_cost: value, cost_per_gallon: (tot / g).toFixed(3) }))
    } else {
      set('total_cost', value)
    }
  }

  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true)
    setError(null)
    setScanMsg(null)
    const fd = new FormData()
    fd.set('receipt', file)
    const result = await parseFuelReceipt(fd)
    if (result.error) {
      setError(result.error)
    } else if (result.data) {
      const d = result.data
      setForm(prev => ({
        ...prev,
        gallons: d.gallons != null ? String(d.gallons) : prev.gallons,
        cost_per_gallon: d.cost_per_gallon != null ? String(d.cost_per_gallon) : prev.cost_per_gallon,
        total_cost: d.total_cost != null ? String(d.total_cost) : prev.total_cost,
        vendor: d.vendor ?? prev.vendor,
        delivery_date: d.fuel_date ?? prev.delivery_date,
      }))
      setScanMsg('Receipt scanned — verify fields below.')
    }
    setScanning(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmit() {
    if (!form.delivery_date) { setError('Date is required.'); return }
    const g = parseFloat(form.gallons)
    if (isNaN(g) || g <= 0) { setError('Gallons must be greater than 0.'); return }

    setSaving(true)
    setError(null)
    const fd = new FormData()
    fd.set('tank_id', tankId)
    fd.set('delivery_date', form.delivery_date)
    fd.set('gallons', String(g))
    if (form.cost_per_gallon) fd.set('cost_per_gallon', form.cost_per_gallon)
    if (form.total_cost) fd.set('total_cost', form.total_cost)
    if (form.vendor) fd.set('vendor', form.vendor)
    if (form.notes) fd.set('notes', form.notes)

    const res = await receiveFuelDelivery(fd)
    setSaving(false)
    if (res?.error) { setError(res.error); return }
    onSuccess()
  }

  return (
    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-900">Receive Delivery — {tankName}</h3>
        <button onClick={onClose} className="text-xs text-zinc-400 hover:text-zinc-600">Cancel</button>
      </div>

      {/* Receipt scanner */}
      <div className="mb-4">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleScan} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={scanning}
          className="w-full rounded-lg border border-dashed border-zinc-300 bg-white py-2.5 text-xs font-medium text-zinc-500 hover:border-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
        >
          {scanning ? '⏳ Scanning receipt…' : '📷 Scan Receipt (auto-fill)'}
        </button>
        {scanMsg && <p className="mt-1 text-xs text-green-600">{scanMsg}</p>}
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Date *</label>
          <input
            type="date"
            value={form.delivery_date}
            onChange={e => set('delivery_date', e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Gallons Received *</label>
          <input
            type="number"
            min="0.001"
            step="0.001"
            value={form.gallons}
            onChange={e => set('gallons', e.target.value)}
            placeholder="0.000"
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Price / Gal</label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={form.cost_per_gallon}
              onChange={e => handleCPGChange(e.target.value)}
              placeholder="0.000"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Total $</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.total_cost}
              onChange={e => handleTotalChange(e.target.value)}
              placeholder="0.00"
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Vendor</label>
          <input
            type="text"
            value={form.vendor}
            onChange={e => set('vendor', e.target.value)}
            placeholder="Fuel supplier name"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Notes</label>
          <input
            type="text"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Optional"
            className={inputCls}
          />
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={saving || scanning}
          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Log Delivery'}
        </button>
        <button
          onClick={onClose}
          className="rounded-lg bg-white border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
