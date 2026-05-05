'use client'

import { useState } from 'react'
import { updateBurnPermitStatus } from '@/app/actions/public-site'

type Status = 'pending' | 'approved' | 'denied' | 'cancelled'

interface Permit {
  id: string
  confirmation_code: string
  contact_name: string
  contact_email: string
  contact_phone: string | null
  burn_address: string
  burn_date: string
  burn_description: string
  status: Status
  reviewer_notes: string | null
  permit_expiry_date: string | null
  issued_date: string | null
  approved_by_name: string | null
  created_at: string
}

const STATUS_STYLES: Record<Status, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  approved:  'bg-green-100 text-green-700',
  denied:    'bg-red-100 text-red-700',
  cancelled: 'bg-zinc-100 text-zinc-400',
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function BurnPermitsTab({
  permits: initialPermits,
  deptName,
  burnPermitCountyInfo,
  burnPermitRestrictions,
}: {
  permits: Permit[]
  deptName: string | null
  burnPermitCountyInfo: string | null
  burnPermitRestrictions: string | null
}) {
  const [permits, setPermits] = useState(initialPermits)
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expiryDate, setExpiryDate] = useState('')
  const [reviewerNotes, setReviewerNotes] = useState('')
  const [denyingId, setDenyingId] = useState<string | null>(null)

  const filtered = filter === 'all' ? permits : permits.filter(p => p.status === filter)

  const counts = {
    all: permits.length,
    pending: permits.filter(p => p.status === 'pending').length,
    approved: permits.filter(p => p.status === 'approved').length,
    denied: permits.filter(p => p.status === 'denied').length,
  }

  function openExpand(id: string) {
    setExpandedId(expandedId === id ? null : id)
    setError(null)
    setExpiryDate('')
    setReviewerNotes('')
    setDenyingId(null)
  }

  async function handleAction(permitId: string, status: 'approved' | 'denied') {
    setLoading(true); setError(null)
    const fd = new FormData()
    fd.set('permit_id', permitId)
    fd.set('status', status)
    fd.set('reviewer_notes', reviewerNotes)
    if (status === 'approved' && expiryDate) fd.set('permit_expiry_date', expiryDate)
    const result = await updateBurnPermitStatus(fd)
    if (result.error) {
      setError(result.error)
    } else {
      setPermits(prev => prev.map(p => p.id === permitId ? {
        ...p,
        status,
        reviewer_notes: reviewerNotes || null,
        issued_date: status === 'approved' ? new Date().toISOString().split('T')[0] : p.issued_date,
        permit_expiry_date: status === 'approved' && expiryDate ? expiryDate : p.permit_expiry_date,
      } : p))
      setExpandedId(null)
      setDenyingId(null)
    }
    setLoading(false)
  }

  const missingConfig: string[] = []
  if (!deptName) missingConfig.push('department name')
  if (!burnPermitCountyInfo) missingConfig.push('county / sheriff info')

  return (
    <div>
      {/* Config warning */}
      {missingConfig.length > 0 && (
        <div className="mb-4 rounded-xl bg-yellow-50 border border-yellow-200 px-5 py-4">
          <p className="text-sm font-semibold text-yellow-800 mb-1">
            Burn permit setup incomplete — permits cannot be approved yet
          </p>
          <p className="text-xs text-yellow-700 mb-2">
            Missing: <span className="font-medium">{missingConfig.join(', ')}</span>
          </p>
          <a
            href="/admin/departments"
            className="text-xs font-semibold text-yellow-800 hover:underline"
          >
            Go to Admin → Department → Public Site tab to configure →
          </a>
        </div>
      )}
      {!burnPermitRestrictions && (
        <div className="mb-4 rounded-xl bg-blue-50 border border-blue-200 px-5 py-3">
          <p className="text-xs text-blue-700">
            <span className="font-semibold">Note:</span> Burn restrictions not set — permits will print with default &quot;Brush&quot;. Set in Admin → Department → Public Site tab.
          </p>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', 'pending', 'approved', 'denied'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
              filter === f ? 'bg-red-700 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300'
            }`}>
            {f} {f !== 'all' && counts[f] > 0 && `(${counts[f]})`}
            {f === 'all' && `(${counts.all})`}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {filtered.length === 0 ? (
        <div className="rounded-xl bg-white border border-zinc-200 px-6 py-12 text-center">
          <p className="text-sm text-zinc-400">No {filter === 'all' ? '' : filter} burn permit requests.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(permit => {
            const isExpanded = expandedId === permit.id
            const isPending = permit.status === 'pending'

            return (
              <div key={permit.id} className="rounded-xl bg-white border border-zinc-200 overflow-hidden">
                {/* Card header */}
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-bold text-zinc-900">{permit.contact_name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[permit.status]}`}>
                          {permit.status}
                        </span>
                        <span className="text-xs font-mono text-zinc-400">{permit.confirmation_code}</span>
                      </div>
                      <p className="text-xs text-zinc-500 mb-0.5">📍 {permit.burn_address}</p>
                      <p className="text-xs text-zinc-500">🔥 Burn date: <span className="font-medium text-zinc-700">{formatDate(permit.burn_date)}</span></p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {permit.status === 'approved' && (
                        <a
                          href={`/print/burn-permit?id=${permit.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-red-600 hover:text-red-800"
                        >
                          Print ↗
                        </a>
                      )}
                      <button onClick={() => openExpand(permit.id)}
                        className="text-xs font-semibold text-zinc-500 hover:text-zinc-700">
                        {isExpanded ? 'Close' : isPending ? 'Review' : 'Details'}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">Submitted {formatDateTime(permit.created_at)}</p>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-zinc-100 px-5 py-4 flex flex-col gap-4 bg-zinc-50">
                    {/* Contact + description */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-zinc-400 font-semibold uppercase tracking-wide mb-1">Contact</p>
                        <p className="text-zinc-700">{permit.contact_email}</p>
                        {permit.contact_phone && <p className="text-zinc-700">{permit.contact_phone}</p>}
                      </div>
                      {permit.status === 'approved' && (
                        <div>
                          <p className="text-zinc-400 font-semibold uppercase tracking-wide mb-1">Permit Info</p>
                          <p className="text-zinc-700">Issued: {formatDate(permit.issued_date)}</p>
                          <p className="text-zinc-700">Expires: {formatDate(permit.permit_expiry_date)}</p>
                          {permit.approved_by_name && <p className="text-zinc-700">Officer: {permit.approved_by_name}</p>}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wide mb-1">Description of Burn</p>
                      <p className="text-sm text-zinc-700 leading-relaxed">{permit.burn_description}</p>
                    </div>

                    {permit.reviewer_notes && !isPending && (
                      <div>
                        <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wide mb-1">Reviewer Notes</p>
                        <p className="text-sm text-zinc-700">{permit.reviewer_notes}</p>
                      </div>
                    )}

                    {/* Pending actions */}
                    {isPending && (
                      <div className="flex flex-col gap-3">
                        {/* Approve flow */}
                        {denyingId !== permit.id && (
                          <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex flex-col gap-3">
                            <p className="text-xs font-semibold text-green-800">Approve Permit</p>
                            <div className="flex flex-col sm:flex-row gap-3">
                              <div className="flex-1">
                                <label className="block text-xs font-medium text-zinc-600 mb-1">Expiry Date</label>
                                <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
                                  min={permit.burn_date}
                                  className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500" />
                              </div>
                              <div className="flex-1">
                                <label className="block text-xs font-medium text-zinc-600 mb-1">Notes (optional)</label>
                                <input type="text" value={reviewerNotes} onChange={e => setReviewerNotes(e.target.value)}
                                  placeholder="Any conditions or notes"
                                  className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500" />
                              </div>
                            </div>
                            <button onClick={() => handleAction(permit.id, 'approved')} disabled={loading}
                              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors self-start">
                              {loading ? 'Saving...' : 'Approve & Issue Permit'}
                            </button>
                          </div>
                        )}

                        {/* Deny flow */}
                        {denyingId === permit.id ? (
                          <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex flex-col gap-3">
                            <p className="text-xs font-semibold text-red-800">Deny Permit</p>
                            <textarea value={reviewerNotes} onChange={e => setReviewerNotes(e.target.value)}
                              rows={2} placeholder="Reason for denial (recommended)"
                              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none" />
                            <div className="flex gap-2">
                              <button onClick={() => handleAction(permit.id, 'denied')} disabled={loading}
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                                {loading ? 'Saving...' : 'Confirm Denial'}
                              </button>
                              <button onClick={() => { setDenyingId(null); setReviewerNotes('') }}
                                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => { setDenyingId(permit.id); setReviewerNotes('') }}
                            className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors self-start">
                            Deny Request
                          </button>
                        )}
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
