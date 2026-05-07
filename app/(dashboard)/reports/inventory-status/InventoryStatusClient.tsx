'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Location {
  apparatus_id: string
  unit_number: string
  apparatus_name: string | null
  compartment_code: string
  compartment_name: string | null
  expected_quantity: number
}

interface ReportItem {
  item_id: string
  item_name: string
  category_name: string
  storage_qty: number
  storage_par: number
  compartment_total: number
  department_quantity: number | null
  accounted_for: number
  variance: number | null
  locations: Location[]
}

type Filter = 'all' | 'issues'

export default function InventoryStatusClient({ items }: { items: ReportItem[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function hasIssue(item: ReportItem) {
    const belowStoragePar = item.storage_par > 0 && item.storage_qty < item.storage_par
    const missing = item.variance !== null && item.variance < 0
    const unset = item.department_quantity === null
    const standardsMismatch = item.department_quantity !== null &&
      (item.compartment_total + item.storage_par) > 0 &&
      (item.compartment_total + item.storage_par) !== item.department_quantity
    return belowStoragePar || missing || unset || standardsMismatch
  }

  const filteredItems = filter === 'issues' ? items.filter(hasIssue) : items
  const issueCount = items.filter(hasIssue).length

  // Summary stats
  const totalItems = items.length
  const totalDeptQty = items.reduce((s, i) => s + (i.department_quantity ?? 0), 0)
  const totalOnTrucks = items.reduce((s, i) => s + i.compartment_total, 0)
  const totalInStorage = items.reduce((s, i) => s + i.storage_qty, 0)

  return (
    <div>
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Item Types', value: totalItems },
          { label: 'Declared Dept Total', value: totalDeptQty },
          { label: 'On Trucks', value: totalOnTrucks },
          { label: 'In Storage', value: totalInStorage },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl bg-white border border-zinc-200 shadow-sm px-4 py-3">
            <p className="text-xs text-zinc-400">{stat.label}</p>
            <p className="text-2xl font-bold text-zinc-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex rounded-lg border border-zinc-200 bg-white overflow-hidden">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${filter === 'all' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-50'}`}
          >
            All Items ({totalItems})
          </button>
          <button
            onClick={() => setFilter('issues')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${filter === 'issues' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-50'}`}
          >
            Needs Attention {issueCount > 0 && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-bold ${filter === 'issues' ? 'bg-white text-zinc-900' : 'bg-red-600 text-white'}`}>{issueCount}</span>}
          </button>
        </div>
        <Link href="/equipment/storage" className="text-xs font-semibold text-red-600 hover:text-red-800">
          Manage Storage →
        </Link>
      </div>

      {filteredItems.length === 0 ? (
        <div className="rounded-xl bg-white border border-zinc-200 px-6 py-12 text-center text-sm text-zinc-400">
          {filter === 'issues' ? 'No items need attention.' : 'No quantity-tracked items found.'}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredItems.map(item => {
            const belowStoragePar = item.storage_par > 0 && item.storage_qty < item.storage_par
            const deptStatus = item.variance === null ? null
              : item.variance === 0 ? 'balanced'
              : item.variance < 0 ? 'missing'
              : 'surplus'
            const standardsNeeded = item.compartment_total + item.storage_par
            const standardsMismatch = item.department_quantity !== null && standardsNeeded > 0 && standardsNeeded !== item.department_quantity
            const isExpanded = expandedId === item.item_id

            return (
              <div key={item.item_id} className="rounded-xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
                {/* Main row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.item_id)}
                  className="w-full text-left px-4 py-3 hover:bg-zinc-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-zinc-900">{item.item_name}</span>
                        {item.category_name && (
                          <span className="text-xs text-zinc-400">{item.category_name}</span>
                        )}
                        {deptStatus === 'missing' && (
                          <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-semibold">
                            ⚠ {Math.abs(item.variance!)} missing
                          </span>
                        )}
                        {belowStoragePar && (
                          <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-semibold">
                            Below PAR
                          </span>
                        )}
                        {standardsMismatch && (
                          <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-xs font-semibold">
                            Standards changed
                          </span>
                        )}
                        {item.department_quantity === null && (
                          <span className="rounded-full bg-zinc-100 text-zinc-500 px-2 py-0.5 text-xs font-medium">
                            Dept total unset
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Compact stats */}
                    <div className="flex items-center gap-4 shrink-0 text-right">
                      <div className="hidden sm:block">
                        <p className="text-xs text-zinc-400">Storage</p>
                        <p className="text-sm font-bold text-zinc-900">{item.storage_qty}</p>
                      </div>
                      <div className="hidden sm:block">
                        <p className="text-xs text-zinc-400">Trucks</p>
                        <p className="text-sm font-bold text-zinc-900">{item.compartment_total}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400">Total</p>
                        <p className={`text-sm font-bold ${
                          deptStatus === 'missing' ? 'text-red-600'
                          : deptStatus === 'balanced' ? 'text-green-700'
                          : 'text-zinc-900'
                        }`}>
                          {item.department_quantity !== null
                            ? `${item.accounted_for}/${item.department_quantity}`
                            : item.accounted_for}
                        </p>
                      </div>
                      <span className="text-zinc-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>
                </button>

                {/* Expanded location detail */}
                {isExpanded && (
                  <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Location Breakdown</p>

                    {item.locations.length === 0 && item.storage_qty === 0 ? (
                      <p className="text-sm text-zinc-400 italic">No assignments or storage quantity recorded.</p>
                    ) : (
                      <div className="rounded-lg border border-zinc-200 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-zinc-50 border-b border-zinc-200">
                              <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500">Location</th>
                              <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500">Compartment</th>
                              <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-500">Qty</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {item.locations.map((loc, idx) => (
                              <tr key={idx}>
                                <td className="px-3 py-2 font-medium text-zinc-900">
                                  <Link
                                    href={`/equipment/${loc.apparatus_id}`}
                                    className="hover:text-red-600 hover:underline"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    Unit {loc.unit_number}{loc.apparatus_name ? ` — ${loc.apparatus_name}` : ''}
                                  </Link>
                                </td>
                                <td className="px-3 py-2 text-zinc-600">
                                  {loc.compartment_code}{loc.compartment_name ? ` — ${loc.compartment_name}` : ''}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-zinc-900">{loc.expected_quantity}</td>
                              </tr>
                            ))}
                            {item.storage_qty > 0 && (
                              <tr className="bg-blue-50">
                                <td className="px-3 py-2 font-medium text-blue-800">
                                  <Link href="/equipment/storage" className="hover:underline" onClick={e => e.stopPropagation()}>
                                    Storage
                                  </Link>
                                </td>
                                <td className="px-3 py-2 text-blue-600">
                                  {item.storage_par > 0 && (
                                    <span className={`text-xs font-medium ${item.storage_qty >= item.storage_par ? 'text-green-600' : 'text-amber-600'}`}>
                                      PAR {item.storage_par} {item.storage_qty >= item.storage_par ? '✓' : '↓'}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-blue-800">{item.storage_qty}</td>
                              </tr>
                            )}
                          </tbody>
                          <tfoot>
                            <tr className="bg-zinc-50 border-t border-zinc-200">
                              <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-zinc-500">Total accounted for</td>
                              <td className="px-3 py-2 text-right font-bold text-zinc-900">
                                {item.accounted_for}
                                {item.department_quantity !== null && (
                                  <span className={`ml-1.5 text-xs font-medium ${
                                    deptStatus === 'balanced' ? 'text-green-600'
                                    : deptStatus === 'missing' ? 'text-red-600'
                                    : 'text-zinc-500'
                                  }`}>
                                    / {item.department_quantity} declared
                                    {deptStatus === 'balanced' && ' ✓'}
                                    {deptStatus === 'missing' && ` (${Math.abs(item.variance!)} missing)`}
                                    {deptStatus === 'surplus' && ` (+${item.variance} surplus)`}
                                  </span>
                                )}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
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
}
