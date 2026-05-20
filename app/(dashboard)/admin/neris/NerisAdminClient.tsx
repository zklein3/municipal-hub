'use client'

import { useState } from 'react'
import Link from 'next/link'
import { testNerisConnection } from '@/app/actions/departments'

type DeptStat = {
  id: string
  name: string
  neris_entity_id: string | null
  submitted: number
  drafts: number
  errors: number
  lastSubmitted: string | null
}

type Issue = {
  id: string
  incident_id: string
  neris_status: string
  neris_last_error: string | null
  completed_at: string | null
  updated_at: string | null
  incident: { incident_number: string; incident_date: string; incident_type: string } | null
  dept: { name: string } | null
}

type ErrorLog = {
  id: string
  created_at: string
  log_type: string
  page: string
  message: string
  metadata: unknown
  resolved: boolean
  dept_name: string | null
}

function formatDT(dt: string | null) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    submitted: 'bg-green-100 text-green-700',
    draft: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-zinc-100 text-zinc-600'}`}>
      {status}
    </span>
  )
}

function TestButton({ entityId, deptName }: { entityId: string | null; deptName: string }) {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    if (!entityId) { setResult({ ok: false, message: 'No entity ID configured.' }); return }
    setLoading(true); setResult(null)
    const res = await testNerisConnection(entityId)
    setResult({ ok: res.ok, message: res.ok ? 'Connection verified.' : (res.error ?? 'Failed.') })
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={run}
        disabled={loading}
        className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-40 transition-colors"
      >
        {loading ? 'Testing…' : 'Test'}
      </button>
      {result && (
        <span className={`text-xs ${result.ok ? 'text-green-600' : 'text-red-600'}`}>
          {result.ok ? '✓' : '✗'} {result.message}
        </span>
      )}
    </div>
  )
}

const TABS = ['Departments', 'Issues', 'Error Logs'] as const
type Tab = typeof TABS[number]

export default function NerisAdminClient({
  deptStats,
  issues,
  errorLogs,
}: {
  deptStats: DeptStat[]
  issues: Issue[]
  errorLogs: ErrorLog[]
}) {
  const [tab, setTab] = useState<Tab>('Departments')

  const issueCount = issues.length
  const errorCount = errorLogs.filter(l => !l.resolved).length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">NERIS Troubleshooting</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Monitor department connections, submission issues, and error logs.</p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl bg-white border border-zinc-200 px-5 py-4 text-center">
          <p className="text-2xl font-bold text-zinc-900">{deptStats.length}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Depts Enabled</p>
        </div>
        <div className={`rounded-xl border px-5 py-4 text-center ${issueCount > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-zinc-200'}`}>
          <p className={`text-2xl font-bold ${issueCount > 0 ? 'text-yellow-700' : 'text-zinc-900'}`}>{issueCount}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Open Issues</p>
        </div>
        <div className={`rounded-xl border px-5 py-4 text-center ${errorCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-zinc-200'}`}>
          <p className={`text-2xl font-bold ${errorCount > 0 ? 'text-red-700' : 'text-zinc-900'}`}>{errorCount}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Unresolved Errors</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 mb-5 gap-1">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-red-600 text-red-700'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            {t}
            {t === 'Issues' && issueCount > 0 && (
              <span className="ml-1.5 rounded-full bg-yellow-100 text-yellow-700 text-xs px-1.5 py-0.5 font-semibold">{issueCount}</span>
            )}
            {t === 'Error Logs' && errorCount > 0 && (
              <span className="ml-1.5 rounded-full bg-red-100 text-red-700 text-xs px-1.5 py-0.5 font-semibold">{errorCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Departments */}
      {tab === 'Departments' && (
        <div className="rounded-xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
          {deptStats.length === 0 ? (
            <p className="px-5 py-8 text-sm text-zinc-400 text-center">No departments have NERIS enabled.</p>
          ) : (
            <div className="divide-y divide-zinc-100">
              {deptStats.map(dept => (
                <div key={dept.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{dept.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {dept.neris_entity_id ? (
                          <span className="text-xs font-mono text-zinc-500">{dept.neris_entity_id}</span>
                        ) : (
                          <span className="text-xs text-orange-600 font-medium">⚠ No Entity ID</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-zinc-500 flex-wrap">
                      <span><span className="font-semibold text-green-700">{dept.submitted}</span> submitted</span>
                      <span><span className={`font-semibold ${dept.drafts > 0 ? 'text-yellow-600' : 'text-zinc-500'}`}>{dept.drafts}</span> draft</span>
                      {dept.errors > 0 && (
                        <span><span className="font-semibold text-red-600">{dept.errors}</span> error</span>
                      )}
                      <span>Last: {formatDT(dept.lastSubmitted)}</span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <TestButton entityId={dept.neris_entity_id} deptName={dept.name} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Issues */}
      {tab === 'Issues' && (
        <div className="rounded-xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
          {issues.length === 0 ? (
            <p className="px-5 py-8 text-sm text-zinc-400 text-center">No open issues — all submissions are clear.</p>
          ) : (
            <div className="divide-y divide-zinc-100">
              {issues.map(issue => (
                <div key={issue.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={issue.neris_status} />
                        {issue.dept && <span className="text-xs text-zinc-400">{issue.dept.name}</span>}
                      </div>
                      {issue.incident && (
                        <p className="text-sm font-semibold text-zinc-900 mt-1">
                          {issue.incident.incident_number} — {issue.incident.incident_type}
                          <span className="text-xs font-normal text-zinc-400 ml-2">{formatDT(issue.incident.incident_date)}</span>
                        </p>
                      )}
                      {issue.neris_status === 'error' && issue.neris_last_error && (
                        <p className="mt-1 text-xs text-red-600 bg-red-50 rounded px-2 py-1 font-mono break-words">
                          {issue.neris_last_error}
                        </p>
                      )}
                      {issue.neris_status === 'draft' && issue.completed_at && (
                        <p className="mt-1 text-xs text-yellow-700">Marked ready {formatDT(issue.completed_at)} — not yet submitted</p>
                      )}
                    </div>
                    {issue.incident_id && (
                      <Link
                        href={`/incidents/${issue.incident_id}/neris`}
                        className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-800 transition-colors"
                      >
                        Open NERIS Form →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Error Logs */}
      {tab === 'Error Logs' && (
        <div className="rounded-xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
          {errorLogs.length === 0 ? (
            <p className="px-5 py-8 text-sm text-zinc-400 text-center">No NERIS-related error logs.</p>
          ) : (
            <div className="divide-y divide-zinc-100">
              {errorLogs.map(log => (
                <div key={log.id} className={`px-5 py-4 ${log.resolved ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                          log.log_type === 'error' ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-600'
                        }`}>
                          {log.log_type}
                        </span>
                        <span className="text-xs text-zinc-400">{log.page}</span>
                        {log.dept_name && <span className="text-xs text-zinc-400">· {log.dept_name}</span>}
                        <span className="text-xs text-zinc-400">{formatDT(log.created_at)}</span>
                        {log.resolved && <span className="text-xs text-green-600 font-medium">resolved</span>}
                      </div>
                      <p className="mt-1 text-sm text-zinc-800 break-words">{log.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
