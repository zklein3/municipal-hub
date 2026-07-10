'use client'

import { useState } from 'react'
import { deleteDebugScan, clearAllDebugScans } from '@/app/actions/qr-debug'

interface Row {
  id: string
  scanned_at: string
  raw_value: string
  source: string
  parses: boolean
  fireOps7Id: string | null
  card: { firstName: string; lastName: string; department: string; title: string | null; certs: string[] } | null
}

function sourceLabel(source: string) {
  return source.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export default function QrDebugScansClient({ rows: initialRows }: { rows: Row[] }) {
  const [rows, setRows] = useState(initialRows)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sourceFilter, setSourceFilter] = useState<string>('all')

  const sources = [...new Set(rows.map(r => r.source))].sort()
  const visibleRows = sourceFilter === 'all' ? rows : rows.filter(r => r.source === sourceFilter)

  async function handleDelete(id: string) {
    setBusy(true)
    const result = await deleteDebugScan(id)
    if (!result?.error) setRows(prev => prev.filter(r => r.id !== id))
    setBusy(false)
  }

  async function handleClearAll() {
    if (!confirm(`Delete all ${visibleRows.length} ${sourceFilter === 'all' ? '' : sourceLabel(sourceFilter) + ' '}captured scans?`)) return
    setBusy(true)
    if (sourceFilter === 'all') {
      const result = await clearAllDebugScans()
      if (!result?.error) setRows([])
    } else {
      const idsToDelete = visibleRows.map(r => r.id)
      await Promise.all(idsToDelete.map(id => deleteDebugScan(id)))
      setRows(prev => prev.filter(r => !idsToDelete.includes(r.id)))
    }
    setBusy(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">QR Debug Scans</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Captured card scans that failed to parse (or were manually saved for review) — {visibleRows.length} of {rows.length} shown.
            Each is re-checked against the current parser so you can see what&apos;s still broken.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {sources.length > 1 && (
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="all">All Sources</option>
              {sources.map(s => <option key={s} value={s}>{sourceLabel(s)}</option>)}
            </select>
          )}
          {visibleRows.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={busy}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
            >
              {sourceFilter === 'all' ? 'Clear All' : `Clear ${sourceLabel(sourceFilter)}`}
            </button>
          )}
        </div>
      </div>

      {visibleRows.length === 0 ? (
        <div className="rounded-xl bg-white border border-zinc-200 px-6 py-12 text-center text-sm text-zinc-400">
          {rows.length === 0
            ? <>No captured scans. They&apos;ll show up here when a card scan fails to parse, or when someone pastes a raw scan into a debug panel.</>
            : <>No captured scans for this source.</>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleRows.map(row => {
            const isExpanded = expandedId === row.id
            return (
              <div key={row.id} className="rounded-xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        row.parses ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {row.parses ? '✓ Parses now' : '✗ Still fails'}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                        {sourceLabel(row.source)}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {new Date(row.scanned_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </span>
                      {row.card && (
                        <span className="text-sm font-medium text-zinc-700">
                          {row.card.firstName} {row.card.lastName} — {row.card.department}
                        </span>
                      )}
                      {row.fireOps7Id && (
                        <span className="text-sm font-medium text-zinc-700">FireOps7 card · personnel {row.fireOps7Id}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button onClick={() => setExpandedId(isExpanded ? null : row.id)} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                      {isExpanded ? 'Hide' : 'View Raw'}
                    </button>
                    <button onClick={() => handleDelete(row.id)} disabled={busy} className="text-xs text-zinc-400 hover:text-red-600 disabled:opacity-50">
                      Delete
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-3">
                    {row.card && (
                      <div className="mb-3 text-xs text-zinc-600">
                        <p><span className="font-semibold">Title:</span> {row.card.title ?? '—'}</p>
                        <p><span className="font-semibold">Certs:</span> {row.card.certs.length > 0 ? row.card.certs.join(', ') : '—'}</p>
                      </div>
                    )}
                    <pre className="whitespace-pre-wrap break-all text-xs font-mono text-zinc-500 bg-white border border-zinc-200 rounded-lg p-3 max-h-64 overflow-y-auto">
                      {row.raw_value}
                    </pre>
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
