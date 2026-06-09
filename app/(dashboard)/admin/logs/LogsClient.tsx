'use client'

import { useState } from 'react'
import { resolveLog, resolveAllLogs } from '@/app/actions/admin'
import { replyToPublicFeedback } from '@/app/actions/public-site'

interface LogEntry {
  id: string
  created_at: string
  log_type: string
  page: string | null
  message: string
  metadata: Record<string, unknown> | null
  personnel_id: string | null
  department_id: string | null
  resolved: boolean
}

interface FeedbackInfo {
  contact_email: string | null
  contact_name: string | null
  message: string
  feedback_type: string
  reply_message: string | null
  replied_at: string | null
  replied_by_name: string | null
}

interface Props {
  logs: LogEntry[]
  personnelMap: Record<string, string>
  feedbackMap: Record<string, FeedbackInfo>
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const TAB_TYPES = ['all', 'error', 'user_report'] as const
type TabType = (typeof TAB_TYPES)[number]

const TAB_LABELS: Record<TabType, string> = {
  all: 'All',
  error: 'Errors',
  user_report: 'User Reports',
}

const TYPE_BADGE: Record<string, string> = {
  error: 'bg-red-100 text-red-700',
  user_report: 'bg-blue-100 text-blue-700',
  info: 'bg-zinc-100 text-zinc-600',
}

export default function LogsClient({ logs, personnelMap, feedbackMap: initialFeedbackMap }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [showResolved, setShowResolved] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [resolving, setResolving] = useState<string | null>(null)
  const [resolvingAll, setResolvingAll] = useState(false)
  const [feedbackMap, setFeedbackMap] = useState(initialFeedbackMap)
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [replying, setReplying] = useState<string | null>(null)
  const [replyErrors, setReplyErrors] = useState<Record<string, string>>({})

  async function handleReply(feedbackId: string) {
    const message = (replyDrafts[feedbackId] ?? '').trim()
    if (!message) return
    setReplying(feedbackId)
    setReplyErrors(prev => ({ ...prev, [feedbackId]: '' }))
    const fd = new FormData()
    fd.set('feedback_id', feedbackId)
    fd.set('reply_message', message)
    const result = await replyToPublicFeedback(fd)
    if (result.error) {
      setReplyErrors(prev => ({ ...prev, [feedbackId]: result.error as string }))
    } else {
      setFeedbackMap(prev => ({
        ...prev,
        [feedbackId]: {
          ...prev[feedbackId],
          reply_message: message,
          replied_at: new Date().toISOString(),
          replied_by_name: 'You',
        },
      }))
      setReplyDrafts(prev => ({ ...prev, [feedbackId]: '' }))
    }
    setReplying(null)
  }

  const filtered = logs.filter((l) => {
    if (!showResolved && l.resolved) return false
    if (activeTab !== 'all' && l.log_type !== activeTab) return false
    return true
  })

  const unresolvedCount = logs.filter(
    (l) => !l.resolved && (activeTab === 'all' || l.log_type === activeTab)
  ).length

  async function handleResolve(id: string) {
    setResolving(id)
    await resolveLog(id)
    setResolving(null)
  }

  async function handleResolveAll() {
    setResolvingAll(true)
    await resolveAllLogs(activeTab === 'all' ? undefined : activeTab)
    setResolvingAll(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">System Logs</h1>
          <p className="text-sm text-zinc-500 mt-1">{logs.filter((l) => !l.resolved).length} unresolved</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="rounded"
            />
            Show resolved
          </label>
          {unresolvedCount > 0 && (
            <button
              onClick={handleResolveAll}
              disabled={resolvingAll}
              className="text-sm px-3 py-1.5 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50"
            >
              {resolvingAll ? 'Resolving…' : `Resolve all (${unresolvedCount})`}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-zinc-200">
        {TAB_TYPES.map((tab) => {
          const count = logs.filter((l) => !l.resolved && (tab === 'all' || l.log_type === tab)).length
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-red-700 text-red-700'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {TAB_LABELS[tab]}
              {count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Log list */}
      {filtered.length === 0 ? (
        <p className="text-zinc-400 text-sm py-8 text-center">No logs to show.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => {
          const feedbackId = (log.metadata as Record<string, unknown> | null)?.feedback_id
          const feedback = typeof feedbackId === 'string' ? feedbackMap[feedbackId] : undefined
          return (
            <div
              key={log.id}
              className={`rounded-lg border p-4 transition-opacity ${
                log.resolved ? 'opacity-50 bg-zinc-50 border-zinc-200' : 'bg-white border-zinc-200'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className={`mt-0.5 shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                      TYPE_BADGE[log.log_type] ?? TYPE_BADGE.info
                    }`}
                  >
                    {log.log_type.replace('_', ' ')}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">{log.message}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-zinc-400">
                      <span>{new Date(log.created_at).toLocaleString()}</span>
                      {log.page && <span>Page: {log.page}</span>}
                      {log.personnel_id && personnelMap[log.personnel_id] && (
                        <span>User: {personnelMap[log.personnel_id]}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {log.metadata && (
                    <button
                      onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                      className="text-xs text-zinc-400 hover:text-zinc-700 underline"
                    >
                      {expanded === log.id ? 'Hide' : 'Details'}
                    </button>
                  )}
                  {!log.resolved && (
                    <button
                      onClick={() => handleResolve(log.id)}
                      disabled={resolving === log.id}
                      className="text-xs px-2.5 py-1 rounded-md bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 border border-green-200"
                    >
                      {resolving === log.id ? '…' : 'Resolve'}
                    </button>
                  )}
                  {log.resolved && (
                    <span className="text-xs text-zinc-400 italic">Resolved</span>
                  )}
                </div>
              </div>
              {expanded === log.id && log.metadata && (
                <pre className="mt-3 p-3 bg-zinc-50 rounded text-xs text-zinc-600 overflow-x-auto">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              )}
              {expanded === log.id && feedback && (
                <div className="mt-3 p-3 bg-zinc-50 rounded border border-zinc-200">
                  <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wide mb-1">Reply to submitter</p>
                  {feedback.reply_message && (
                    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 mb-2">
                      <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line">{feedback.reply_message}</p>
                      <p className="text-xs text-zinc-400 mt-1">
                        Sent {feedback.replied_at ? formatDateTime(feedback.replied_at) : ''}
                        {feedback.replied_by_name ? ` by ${feedback.replied_by_name}` : ''}
                      </p>
                    </div>
                  )}
                  {!feedback.contact_email ? (
                    <p className="text-xs text-zinc-400 italic">No email address on file — a reply cannot be sent.</p>
                  ) : (
                    <>
                      {replyErrors[feedbackId as string] && (
                        <div className="mb-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                          {replyErrors[feedbackId as string]}
                        </div>
                      )}
                      <textarea
                        value={replyDrafts[feedbackId as string] ?? ''}
                        onChange={(e) => setReplyDrafts(prev => ({ ...prev, [feedbackId as string]: e.target.value }))}
                        rows={3}
                        placeholder={`Write a reply to ${feedback.contact_email}…`}
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 resize-none bg-white"
                      />
                      <button
                        onClick={() => handleReply(feedbackId as string)}
                        disabled={replying === feedbackId || !(replyDrafts[feedbackId as string] ?? '').trim()}
                        className="mt-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
                      >
                        {replying === feedbackId ? 'Sending…' : `Send reply to ${feedback.contact_email}`}
                      </button>
                    </>
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
