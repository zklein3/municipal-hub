'use client'

import { useRouter, usePathname } from 'next/navigation'

const inputCls = 'rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500'

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

interface Apparatus { id: string; unit_number: string; apparatus_name: string | null }

export default function FuelReportClient({
  entries,
  apparatus,
  filters,
}: {
  entries: FuelEntry[]
  apparatus: Apparatus[]
  filters: { from: string; to: string; apparatusId: string }
}) {
  const router = useRouter()
  const pathname = usePathname()

  function applyFilter(key: string, value: string) {
    const params = new URLSearchParams()
    const next = { ...filters, [key]: value }
    if (next.from) params.set('from', next.from)
    if (next.to) params.set('to', next.to)
    if (next.apparatusId) params.set('apparatusId', next.apparatusId)
    router.push(`${pathname}?${params.toString()}`)
  }

  // Totals
  const totalGallons = entries.reduce((s, e) => s + e.gallons, 0)
  const totalCost = entries.reduce((s, e) => s + (e.total_cost ?? 0), 0)
  const avgPriceEntries = entries.filter(e => e.cost_per_gallon)
  const avgPrice = avgPriceEntries.length > 0
    ? avgPriceEntries.reduce((s, e) => s + e.cost_per_gallon!, 0) / avgPriceEntries.length
    : null

  // By apparatus
  const byApparatus = apparatus.map(a => {
    const aEntries = entries.filter(e => e.apparatus_id === a.id)
    return {
      label: `${a.unit_number}${a.apparatus_name ? ` — ${a.apparatus_name}` : ''}`,
      gallons: aEntries.reduce((s, e) => s + e.gallons, 0),
      cost: aEntries.reduce((s, e) => s + (e.total_cost ?? 0), 0),
      count: aEntries.length,
    }
  }).filter(a => a.count > 0).sort((a, b) => b.gallons - a.gallons)

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">Fuel Report</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{entries.length} entries</p>
        </div>
        <button onClick={() => window.print()}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 print:hidden">
          Print
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 print:hidden">
        <input type="date" value={filters.from} onChange={e => applyFilter('from', e.target.value)}
          className={inputCls} placeholder="From" />
        <input type="date" value={filters.to} onChange={e => applyFilter('to', e.target.value)}
          className={inputCls} placeholder="To" />
        <select value={filters.apparatusId} onChange={e => applyFilter('apparatusId', e.target.value)} className={inputCls}>
          <option value="">All Apparatus</option>
          {apparatus.map(a => (
            <option key={a.id} value={a.id}>{a.unit_number}{a.apparatus_name ? ` — ${a.apparatus_name}` : ''}</option>
          ))}
        </select>
        {(filters.from || filters.to || filters.apparatusId) && (
          <button onClick={() => router.push(pathname)} className="text-sm text-red-600 hover:text-red-800 font-medium">Clear</button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl bg-white border border-zinc-200 px-4 py-3 text-center">
          <p className="text-2xl font-bold text-zinc-900">{totalGallons.toFixed(1)}</p>
          <p className="text-xs text-zinc-400 mt-0.5">Total Gallons</p>
        </div>
        <div className="rounded-xl bg-white border border-zinc-200 px-4 py-3 text-center">
          <p className="text-2xl font-bold text-zinc-900">${totalCost.toFixed(2)}</p>
          <p className="text-xs text-zinc-400 mt-0.5">Total Cost</p>
        </div>
        <div className="rounded-xl bg-white border border-zinc-200 px-4 py-3 text-center">
          <p className="text-2xl font-bold text-zinc-900">{avgPrice != null ? `$${avgPrice.toFixed(3)}` : '—'}</p>
          <p className="text-xs text-zinc-400 mt-0.5">Avg Price/Gal</p>
        </div>
      </div>

      {/* By apparatus */}
      {byApparatus.length > 1 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-zinc-700 mb-2">By Apparatus</h2>
          <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden divide-y divide-zinc-100">
            {byApparatus.map(a => (
              <div key={a.label} className="flex items-center justify-between px-4 py-3">
                <p className="text-sm font-medium text-zinc-900">{a.label}</p>
                <div className="flex gap-6 text-sm text-zinc-600">
                  <span>{a.gallons.toFixed(1)} gal</span>
                  {a.cost > 0 && <span>${a.cost.toFixed(2)}</span>}
                  <span className="text-zinc-400">{a.count} fill{a.count !== 1 ? 's' : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail table */}
      <h2 className="text-sm font-semibold text-zinc-700 mb-2">All Entries</h2>
      {entries.length === 0 ? (
        <div className="rounded-xl bg-white border border-zinc-200 px-6 py-12 text-center text-sm text-zinc-400">
          No fuel entries found for the selected filters.
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden divide-y divide-zinc-100">
          {entries.map(entry => (
            <div key={entry.id} className="flex items-start justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-zinc-900">
                    {new Date(entry.fuel_date + 'T12:00:00').toLocaleDateString()}
                  </span>
                  <span className="text-xs rounded-full bg-zinc-100 text-zinc-600 px-2 py-0.5">{entry.apparatus_label}</span>
                  <span className={`text-xs rounded-full px-2 py-0.5 ${entry.fuel_type === 'diesel' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                    {entry.fuel_type}
                  </span>
                </div>
                <div className="flex gap-4 mt-0.5 text-xs text-zinc-500 flex-wrap">
                  {entry.vendor && <span>{entry.vendor}</span>}
                  {entry.odometer && <span>{entry.odometer.toLocaleString()} mi</span>}
                  {entry.logged_by_name && <span>by {entry.logged_by_name}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-zinc-900">{entry.gallons.toFixed(3)} gal</p>
                {entry.total_cost && <p className="text-sm text-zinc-700">${entry.total_cost.toFixed(2)}</p>}
                {entry.cost_per_gallon && <p className="text-xs text-zinc-400">${entry.cost_per_gallon.toFixed(3)}/gal</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
