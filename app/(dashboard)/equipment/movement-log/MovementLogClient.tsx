'use client'

import { useState } from 'react'

interface LogEntry {
  id: string
  created_at: string
  item_name: string
  asset_tag: string | null
  asset_sn: string | null
  quantity: number
  from: string
  to: string
  moved_by: string
  source: string
  reason: string | null
}

const SOURCE_COLORS: Record<string, string> = {
  Inspection: 'bg-blue-100 text-blue-700',
  Manual: 'bg-zinc-100 text-zinc-600',
}

export default function MovementLogClient({ logs }: { logs: LogEntry[] }) {
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const sources = ['all', ...Array.from(new Set(logs.map(l => l.source)))]

  const filtered = logs.filter(l => {
    if (sourceFilter !== 'all' && l.source !== sourceFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      if (
        !l.item_name.toLowerCase().includes(q) &&
        !l.asset_tag?.toLowerCase().includes(q) &&
        !l.moved_by.toLowerCase().includes(q) &&
        !l.from.toLowerCase().includes(q) &&
        !l.to.toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search item, asset, person..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
        <div className="flex gap-1.5 flex-wrap">
          {sources.map(s => (
            <button
              key={s}
              onClick={() => setSourceFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                sourceFilter === s
                  ? 'bg-red-700 border-red-700 text-white'
                  : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              {s === 'all' ? 'All Sources' : s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl bg-white border border-zinc-200 px-6 py-10 text-center text-sm text-zinc-400">
          No movements match your filters.
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <div className="divide-y divide-zinc-100">
            {filtered.map(log => (
              <div key={log.id} className="px-4 py-3 flex items-start gap-4">
                {/* Date/time */}
                <div className="shrink-0 text-right w-24">
                  <p className="text-xs font-medium text-zinc-700">
                    {new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {new Date(log.created_at).toLocaleTimeString([], { timeStyle: 'short' })}
                  </p>
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-sm font-semibold text-zinc-900">{log.item_name}</p>
                    {log.asset_tag && (
                      <span className="text-xs rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-zinc-600">
                        {log.asset_tag}{log.asset_sn ? ` · ${log.asset_sn}` : ''}
                      </span>
                    )}
                    {!log.asset_tag && log.quantity !== 1 && (
                      <span className="text-xs text-zinc-400">× {log.quantity}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <span className="font-medium text-zinc-700">{log.from}</span>
                    <span>→</span>
                    <span className="font-medium text-zinc-700">{log.to}</span>
                  </div>
                  {log.reason && (
                    <p className="text-xs text-zinc-400 mt-0.5">Reason: {log.reason}</p>
                  )}
                </div>

                {/* Right side: source + who */}
                <div className="shrink-0 text-right space-y-1">
                  <span className={`inline-block text-xs rounded-full px-2 py-0.5 font-medium ${SOURCE_COLORS[log.source] ?? 'bg-zinc-100 text-zinc-500'}`}>
                    {log.source}
                  </span>
                  <p className="text-xs text-zinc-400">{log.moved_by}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
