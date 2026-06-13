'use client'

import { useState } from 'react'
import { updatePublicFeedbackStatus, replyToPublicFeedback, deletePublicFeedback } from '@/app/actions/public-site'

type Status = 'new' | 'reviewed' | 'resolved'

interface Feedback {
  id: string
  feedback_type: 'feedback' | 'bug_report'
  contact_name: string | null
  contact_email: string | null
  message: string
  page_url: string | null
  status: Status
  reviewer_notes: string | null
  reply_message: string | null
  replied_at: string | null
  replied_by_name?: string | null
  created_at: string
}

const STATUS_STYLES: Record<Status, string> = {
  new:      'bg-yellow-100 text-yellow-700',
  reviewed: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
}

const STATUS_LABELS: Record<Status, string> = {
  new:      'New',
  reviewed: 'Reviewed',
  resolved: 'Resolved',
}

const TYPE_LABELS: Record<string, string> = {
  feedback:   'Feedback',
  bug_report: 'Problem Report',
}

type Filter = 'active' | 'new' | 'reviewed' | 'archived'

const FILTER_LABELS: Record<Filter, string> = {
  active:   'Active',
  new:      'New',
  reviewed: 'Reviewed',
  archived: 'Archived',
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function isArchivedFeedback(item: Feedback) {
  return item.status === 'resolved'
}

export default function FeedbackTab({ items: initialItems }: { items: Feedback[] }) {
  const [items, setItems] = useState(initialItems)
  const [filter, setFilter] = useState<Filter>('active')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewerNotes, setReviewerNotes] = useState('')
  const [replyMessage, setReplyMessage] = useState('')
  const [replying, setReplying] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)
  const [replySent, setReplySent] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const filtered = items.filter(i => {
    switch (filter) {
      case 'active':   return !isArchivedFeedback(i)
      case 'new':      return i.status === 'new'
      case 'reviewed': return i.status === 'reviewed'
      case 'archived': return isArchivedFeedback(i)
    }
  })

  const counts = {
    active:   items.filter(i => !isArchivedFeedback(i)).length,
    new:      items.filter(i => i.status === 'new').length,
    reviewed: items.filter(i => i.status === 'reviewed').length,
    archived: items.filter(isArchivedFeedback).length,
  }

  function openExpand(item: Feedback) {
    if (expandedId === item.id) {
      setExpandedId(null)
    } else {
      setExpandedId(item.id)
      setReviewerNotes(item.reviewer_notes ?? '')
      setReplyMessage('')
      setReplyError(null)
      setReplySent(false)
    }
    setError(null)
    setDeletingId(null)
    setDeleteError(null)
  }

  async function handleDelete(id: string) {
    setDeleting(true); setDeleteError(null)
    const fd = new FormData()
    fd.set('feedback_id', id)
    const result = await deletePublicFeedback(fd)
    if (result.error) {
      setDeleteError(result.error)
      setDeleting(false)
    } else {
      setItems(prev => prev.filter(i => i.id !== id))
      setExpandedId(null)
      setDeletingId(null)
      setDeleting(false)
    }
  }

  async function handleReply(item: Feedback) {
    if (!replyMessage.trim()) return
    setReplying(true); setReplyError(null)
    const fd = new FormData()
    fd.set('feedback_id', item.id)
    fd.set('reply_message', replyMessage.trim())
    const result = await replyToPublicFeedback(fd)
    if (result.error) {
      setReplyError(result.error)
    } else {
      setItems(prev => prev.map(i => i.id === item.id
        ? { ...i, status: 'resolved', reply_message: replyMessage.trim(), replied_at: new Date().toISOString(), replied_by_name: 'You' }
        : i
      ))
      setReplySent(true)
      setReplyMessage('')
    }
    setReplying(false)
  }

  async function handleAction(id: string, status: Status) {
    setLoading(true); setError(null)
    const fd = new FormData()
    fd.set('feedback_id', id)
    fd.set('status', status)
    fd.set('reviewer_notes', reviewerNotes)
    const result = await updatePublicFeedbackStatus(fd)
    if (result.error) {
      setError(result.error)
    } else {
      setItems(prev => prev.map(i => i.id === id
        ? { ...i, status, reviewer_notes: reviewerNotes || null }
        : i
      ))
      setExpandedId(null)
    }
    setLoading(false)
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['active', 'new', 'reviewed', 'archived'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
              filter === f ? 'bg-red-700 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300'
            }`}>
            {FILTER_LABELS[f]} ({counts[f]})
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {filtered.length === 0 ? (
        <div className="rounded-xl bg-white border border-zinc-200 px-6 py-12 text-center">
          <p className="text-sm text-zinc-400">No {filter === 'active' ? '' : FILTER_LABELS[filter].toLowerCase() + ' '}feedback.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(item => {
            const isExpanded = expandedId === item.id

            return (
              <div key={item.id} className="rounded-xl bg-white border border-zinc-200 overflow-hidden">
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-bold text-zinc-900">{item.contact_name || 'Anonymous'}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[item.status]}`}>
                          {STATUS_LABELS[item.status]}
                        </span>
                        <span className="rounded-full bg-zinc-100 text-zinc-500 px-2 py-0.5 text-xs font-medium">
                          {TYPE_LABELS[item.feedback_type] ?? item.feedback_type}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 line-clamp-1">{item.message}</p>
                    </div>
                    <button onClick={() => openExpand(item)}
                      className="text-xs font-semibold text-zinc-500 hover:text-zinc-700 shrink-0">
                      {isExpanded ? 'Close' : 'Review'}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">Submitted {formatDateTime(item.created_at)}</p>
                </div>

                {isExpanded && (
                  <div className="border-t border-zinc-100 px-5 py-4 flex flex-col gap-4 bg-zinc-50">
                    {(item.contact_name || item.contact_email) && (
                      <div className="text-xs">
                        <p className="text-zinc-400 font-semibold uppercase tracking-wide mb-1">Contact</p>
                        {item.contact_name && <p className="text-zinc-700">{item.contact_name}</p>}
                        {item.contact_email && <p className="text-zinc-700">{item.contact_email}</p>}
                      </div>
                    )}

                    <div>
                      <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wide mb-1">Message</p>
                      <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line">{item.message}</p>
                    </div>

                    {item.page_url && (
                      <div className="text-xs">
                        <p className="text-zinc-400 font-semibold uppercase tracking-wide mb-1">Page</p>
                        <p className="text-zinc-500 break-all">{item.page_url}</p>
                      </div>
                    )}

                    {/* Reply */}
                    <div>
                      <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wide mb-1">Reply</p>
                      {item.reply_message && (
                        <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 mb-2">
                          <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line">{item.reply_message}</p>
                          <p className="text-xs text-zinc-400 mt-1">
                            Sent {item.replied_at ? formatDateTime(item.replied_at) : ''}
                            {item.replied_by_name ? ` by ${item.replied_by_name}` : ''}
                          </p>
                        </div>
                      )}
                      {!item.contact_email ? (
                        <p className="text-xs text-zinc-400 italic">No email address on file — a reply cannot be sent.</p>
                      ) : (
                        <>
                          {replyError && expandedId === item.id && (
                            <div className="mb-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{replyError}</div>
                          )}
                          {replySent && expandedId === item.id && (
                            <div className="mb-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">Reply sent to {item.contact_email}.</div>
                          )}
                          <textarea
                            value={replyMessage}
                            onChange={e => setReplyMessage(e.target.value)}
                            rows={3}
                            placeholder={`Write a reply to ${item.contact_email}…`}
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 resize-none"
                          />
                          <button
                            onClick={() => handleReply(item)}
                            disabled={replying || !replyMessage.trim()}
                            className="mt-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
                          >
                            {replying ? 'Sending…' : `Send reply to ${item.contact_email}`}
                          </button>
                        </>
                      )}
                    </div>

                    <div>
                      <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wide mb-1">Reviewer Notes</p>
                      <textarea
                        value={reviewerNotes}
                        onChange={e => setReviewerNotes(e.target.value)}
                        rows={2}
                        placeholder="Internal notes (optional)"
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 resize-none"
                      />
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {item.status !== 'reviewed' && (
                        <button
                          onClick={() => handleAction(item.id, 'reviewed')}
                          disabled={loading}
                          className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                        >
                          Mark Reviewed
                        </button>
                      )}
                      {item.status !== 'resolved' && (
                        <button
                          onClick={() => handleAction(item.id, 'resolved')}
                          disabled={loading}
                          className="rounded-lg border border-green-200 bg-white px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50 transition-colors"
                        >
                          Mark Resolved
                        </button>
                      )}
                      {item.status !== 'new' && (
                        <button
                          onClick={() => handleAction(item.id, 'new')}
                          disabled={loading}
                          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
                        >
                          Reopen
                        </button>
                      )}
                    </div>

                    {/* Delete */}
                    <div className="pt-2 border-t border-zinc-200">
                      {deletingId === item.id ? (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex flex-col gap-3 mt-3">
                          <p className="text-xs font-semibold text-red-800">Permanently delete this feedback?</p>
                          <p className="text-xs text-red-700">This cannot be undone.</p>
                          {deleteError && <p className="text-xs text-red-700 font-medium">{deleteError}</p>}
                          <div className="flex gap-2">
                            <button onClick={() => handleDelete(item.id)} disabled={deleting}
                              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                              {deleting ? 'Deleting...' : 'Confirm Delete'}
                            </button>
                            <button onClick={() => { setDeletingId(null); setDeleteError(null) }}
                              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setDeletingId(item.id); setDeleteError(null) }}
                          className="mt-3 text-xs font-semibold text-red-500 hover:text-red-700">
                          Delete feedback
                        </button>
                      )}
                    </div>
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
