'use client'

import { useState } from 'react'
import { updateRecordRequestStatus } from '@/app/actions/public-site'

type Status = 'pending' | 'in_review' | 'fulfilled' | 'denied'

interface RecordRequest {
  id: string
  confirmation_code: string
  contact_name: string
  contact_email: string
  contact_phone: string | null
  request_type: string
  description: string
  incident_date: string | null
  incident_address: string | null
  status: Status
  reviewer_notes: string | null
  created_at: string
}

const STATUS_STYLES: Record<Status, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  in_review: 'bg-blue-100 text-blue-700',
  fulfilled: 'bg-green-100 text-green-700',
  denied:    'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<Status, string> = {
  pending:   'Pending',
  in_review: 'In Review',
  fulfilled: 'Fulfilled',
  denied:    'Denied',
}

const TYPE_LABELS: Record<string, string> = {
  incident_report:   'Incident Report',
  inspection_record: 'Inspection Record',
  other:             'Other',
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function RecordRequestsTab({ requests: initialRequests }: { requests: RecordRequest[] }) {
  const [requests, setRequests] = useState(initialRequests)
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewerNotes, setReviewerNotes] = useState('')
  const [confirmingAction, setConfirmingAction] = useState<{ id: string; status: 'fulfilled' | 'denied' } | null>(null)

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)

  const counts = {
    all:       requests.length,
    pending:   requests.filter(r => r.status === 'pending').length,
    in_review: requests.filter(r => r.status === 'in_review').length,
    fulfilled: requests.filter(r => r.status === 'fulfilled').length,
    denied:    requests.filter(r => r.status === 'denied').length,
  }

  function openExpand(id: string) {
    setExpandedId(expandedId === id ? null : id)
    setError(null)
    setReviewerNotes('')
    setConfirmingAction(null)
  }

  async function handleAction(requestId: string, status: Status) {
    setLoading(true); setError(null)
    const fd = new FormData()
    fd.set('request_id', requestId)
    fd.set('status', status)
    fd.set('reviewer_notes', reviewerNotes)
    const result = await updateRecordRequestStatus(fd)
    if (result.error) {
      setError(result.error)
    } else {
      setRequests(prev => prev.map(r => r.id === requestId
        ? { ...r, status, reviewer_notes: reviewerNotes || null }
        : r
      ))
      setExpandedId(null)
      setConfirmingAction(null)
    }
    setLoading(false)
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', 'pending', 'in_review', 'fulfilled', 'denied'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
              filter === f ? 'bg-red-700 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300'
            }`}>
            {f === 'in_review' ? 'In Review' : f.charAt(0).toUpperCase() + f.slice(1)}
            {' '}({counts[f]})
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {filtered.length === 0 ? (
        <div className="rounded-xl bg-white border border-zinc-200 px-6 py-12 text-center">
          <p className="text-sm text-zinc-400">No {filter === 'all' ? '' : STATUS_LABELS[filter as Status]?.toLowerCase()} record requests.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(req => {
            const isExpanded = expandedId === req.id
            const isPending  = req.status === 'pending'
            const isInReview = req.status === 'in_review'
            const canAct     = isPending || isInReview

            return (
              <div key={req.id} className="rounded-xl bg-white border border-zinc-200 overflow-hidden">
                {/* Card header */}
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-bold text-zinc-900">{req.contact_name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[req.status]}`}>
                          {STATUS_LABELS[req.status]}
                        </span>
                        <span className="rounded-full bg-zinc-100 text-zinc-500 px-2 py-0.5 text-xs font-medium">
                          {TYPE_LABELS[req.request_type] ?? req.request_type}
                        </span>
                        <span className="text-xs font-mono text-zinc-400">{req.confirmation_code}</span>
                      </div>
                      <p className="text-xs text-zinc-500 line-clamp-1">{req.description}</p>
                    </div>
                    <button onClick={() => openExpand(req.id)}
                      className="text-xs font-semibold text-zinc-500 hover:text-zinc-700 shrink-0">
                      {isExpanded ? 'Close' : canAct ? 'Review' : 'Details'}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">Submitted {formatDateTime(req.created_at)}</p>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-zinc-100 px-5 py-4 flex flex-col gap-4 bg-zinc-50">

                    {/* Contact */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-zinc-400 font-semibold uppercase tracking-wide mb-1">Contact</p>
                        <p className="text-zinc-700">{req.contact_email}</p>
                        {req.contact_phone && <p className="text-zinc-700">{req.contact_phone}</p>}
                      </div>
                      {(req.incident_date || req.incident_address) && (
                        <div>
                          <p className="text-zinc-400 font-semibold uppercase tracking-wide mb-1">Incident Details</p>
                          {req.incident_date && <p className="text-zinc-700">Date: {formatDate(req.incident_date)}</p>}
                          {req.incident_address && <p className="text-zinc-700">Address: {req.incident_address}</p>}
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    <div>
                      <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wide mb-1">Request Description</p>
                      <p className="text-sm text-zinc-700 leading-relaxed">{req.description}</p>
                    </div>

                    {/* Reviewer notes (closed requests) */}
                    {req.reviewer_notes && !canAct && (
                      <div>
                        <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wide mb-1">Reviewer Notes</p>
                        <p className="text-sm text-zinc-700">{req.reviewer_notes}</p>
                      </div>
                    )}

                    {/* Actions */}
                    {canAct && (
                      <div className="flex flex-col gap-3">
                        {/* Mark In Review */}
                        {isPending && confirmingAction?.id !== req.id && (
                          <button
                            onClick={() => handleAction(req.id, 'in_review')}
                            disabled={loading}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors self-start"
                          >
                            Mark In Review
                          </button>
                        )}

                        {/* Fulfill / Deny */}
                        {confirmingAction?.id === req.id ? (
                          <div className={`rounded-lg border p-4 flex flex-col gap-3 ${
                            confirmingAction.status === 'fulfilled'
                              ? 'border-green-200 bg-green-50'
                              : 'border-red-200 bg-red-50'
                          }`}>
                            <p className={`text-xs font-semibold ${
                              confirmingAction.status === 'fulfilled' ? 'text-green-800' : 'text-red-800'
                            }`}>
                              {confirmingAction.status === 'fulfilled' ? 'Mark as Fulfilled' : 'Deny Request'}
                            </p>
                            <textarea
                              value={reviewerNotes}
                              onChange={e => setReviewerNotes(e.target.value)}
                              rows={2}
                              placeholder={confirmingAction.status === 'fulfilled' ? 'Notes on fulfillment (optional)' : 'Reason for denial (recommended)'}
                              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAction(req.id, confirmingAction.status)}
                                disabled={loading}
                                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-colors ${
                                  confirmingAction.status === 'fulfilled' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                                }`}
                              >
                                {loading ? 'Saving...' : `Confirm ${confirmingAction.status === 'fulfilled' ? 'Fulfillment' : 'Denial'}`}
                              </button>
                              <button
                                onClick={() => { setConfirmingAction(null); setReviewerNotes('') }}
                                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setConfirmingAction({ id: req.id, status: 'fulfilled' }); setReviewerNotes('') }}
                              className="rounded-lg border border-green-200 bg-white px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 transition-colors"
                            >
                              Mark Fulfilled
                            </button>
                            <button
                              onClick={() => { setConfirmingAction({ id: req.id, status: 'denied' }); setReviewerNotes('') }}
                              className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
                            >
                              Deny
                            </button>
                          </div>
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
