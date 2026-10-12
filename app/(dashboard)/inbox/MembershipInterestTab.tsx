'use client'

import { useState } from 'react'
import { updateMembershipInterestStatus } from '@/app/actions/public-site'
import { formatLocalDateTime } from '@/lib/format-datetime'

type Status = 'pending' | 'contacted' | 'enrolled' | 'not_interested'

export interface MembershipApplication {
  id: string
  confirmation_code: string
  full_name: string
  phone: string
  email: string | null
  community: string | null
  interests: string[]
  ems_cert_level: string | null
  prior_experience: string[]
  availability: string[]
  daytime_coverage: string | null
  work_schedule: string | null
  involvement_level: string
  training_interest: string
  additional_info: string | null
  contact_preference: string
  status: Status
  reviewer_notes: string | null
  created_at: string
}

const STATUS_STYLES: Record<Status, string> = {
  pending:        'bg-yellow-100 text-yellow-700',
  contacted:      'bg-blue-100 text-blue-700',
  enrolled:       'bg-green-100 text-green-700',
  not_interested: 'bg-zinc-100 text-zinc-500',
}

const STATUS_LABELS: Record<Status, string> = {
  pending:        'New',
  contacted:      'Contacted',
  enrolled:       'Enrolled',
  not_interested: 'Not Interested',
}

const INTEREST_LABELS: Record<string, string> = {
  firefighting: 'Firefighting', ems: 'EMS / EMT', both: 'Firefighting & EMS',
  junior_cadet: 'Junior Cadet', learn_more: 'Wants to learn more',
}
const EXPERIENCE_LABELS: Record<string, string> = {
  fire: 'Fire dept. experience', ems: 'EMT/EMS experience', other_response: 'Other emergency-response experience',
  military: 'Military experience', none: 'No previous experience', other: 'Other',
}
const EMS_CERT_LABELS: Record<string, string> = {
  certified_emt: 'Currently certified EMT', certified_other: 'Certified at another EMS level',
  lapsed: 'Previously certified', not_certified: 'Not certified, interested', discuss: 'Wants to discuss options',
}
const AVAILABILITY_LABELS: Record<string, string> = {
  weekday_mornings: 'Weekday mornings', weekday_afternoons: 'Weekday afternoons', weekday_evenings: 'Weekday evenings',
  overnight: 'Overnight', weekends: 'Weekends', varies: 'Varies',
}
const DAYTIME_COVERAGE_LABELS: Record<string, string> = {
  yes_regularly: 'Yes, regularly', yes_occasionally: 'Yes, occasionally', possibly: 'Possibly',
  no: 'No', not_sure: 'Not sure',
}
const INVOLVEMENT_LABELS: Record<string, string> = {
  regular: 'Regularly', as_able: 'When schedule allows', need_info: 'Needs to understand commitment', exploring: 'Just exploring',
}
const TRAINING_LABELS: Record<string, string> = {
  yes: 'Yes', maybe: 'Maybe', no: 'Already trained',
}
const CONTACT_PREF_LABELS: Record<string, string> = {
  phone: 'Phone call', text: 'Text message', email: 'Email',
}

type Filter = 'active' | 'pending' | 'contacted' | 'archived'

const FILTER_LABELS: Record<Filter, string> = {
  active: 'Active', pending: 'New', contacted: 'Contacted', archived: 'Archived',
}

function isArchived(a: MembershipApplication) {
  return a.status === 'enrolled' || a.status === 'not_interested'
}

export default function MembershipInterestTab({ applications: initialApplications, departmentTimezone }: { applications: MembershipApplication[]; departmentTimezone: string }) {
  const [applications, setApplications] = useState(initialApplications)
  const [filter, setFilter] = useState<Filter>('active')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewerNotes, setReviewerNotes] = useState('')
  const [confirmingAction, setConfirmingAction] = useState<{ id: string; status: 'enrolled' | 'not_interested' } | null>(null)

  const filtered = applications.filter(a => {
    switch (filter) {
      case 'active':    return !isArchived(a)
      case 'pending':   return a.status === 'pending'
      case 'contacted': return a.status === 'contacted'
      case 'archived':  return isArchived(a)
    }
  })

  const counts = {
    active:    applications.filter(a => !isArchived(a)).length,
    pending:   applications.filter(a => a.status === 'pending').length,
    contacted: applications.filter(a => a.status === 'contacted').length,
    archived:  applications.filter(isArchived).length,
  }

  function openExpand(id: string) {
    setExpandedId(expandedId === id ? null : id)
    setError(null)
    setReviewerNotes('')
    setConfirmingAction(null)
  }

  async function handleAction(id: string, status: Status) {
    setLoading(true); setError(null)
    const fd = new FormData()
    fd.set('application_id', id)
    fd.set('status', status)
    fd.set('reviewer_notes', reviewerNotes)
    const result = await updateMembershipInterestStatus(fd)
    if (result.error) {
      setError(result.error)
    } else {
      setApplications(prev => prev.map(a => a.id === id
        ? { ...a, status, reviewer_notes: reviewerNotes || null }
        : a
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
        {(['active', 'pending', 'contacted', 'archived'] as const).map(f => (
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
          <p className="text-sm text-zinc-400">No {filter === 'active' ? '' : FILTER_LABELS[filter].toLowerCase() + ' '}membership applications.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(app => {
            const isExpanded = expandedId === app.id
            const canAct = app.status === 'pending' || app.status === 'contacted'

            return (
              <div key={app.id} className="rounded-xl bg-white border border-zinc-200 overflow-hidden">
                {/* Card header */}
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-bold text-zinc-900">{app.full_name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[app.status]}`}>
                          {STATUS_LABELS[app.status]}
                        </span>
                        <span className="text-xs font-mono text-zinc-400">{app.confirmation_code}</span>
                      </div>
                      <p className="text-xs text-zinc-500 line-clamp-1">
                        {app.interests.map(i => INTEREST_LABELS[i] ?? i).join(', ')}
                      </p>
                    </div>
                    <button onClick={() => openExpand(app.id)}
                      className="text-xs font-semibold text-zinc-500 hover:text-zinc-700 shrink-0">
                      {isExpanded ? 'Close' : canAct ? 'Review' : 'Details'}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">Submitted {formatLocalDateTime(app.created_at, departmentTimezone)}</p>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-zinc-100 px-5 py-4 flex flex-col gap-4 bg-zinc-50">

                    {/* Contact */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-zinc-400 font-semibold uppercase tracking-wide mb-1">Contact</p>
                        <p className="text-zinc-700">{app.phone}</p>
                        {app.email && <p className="text-zinc-700">{app.email}</p>}
                        {app.community && <p className="text-zinc-700">Lives in: {app.community}</p>}
                        <p className="text-zinc-700">Prefers: {CONTACT_PREF_LABELS[app.contact_preference] ?? app.contact_preference}</p>
                      </div>
                      <div>
                        <p className="text-zinc-400 font-semibold uppercase tracking-wide mb-1">Interested In</p>
                        <p className="text-zinc-700">{app.interests.map(i => INTEREST_LABELS[i] ?? i).join(', ') || '—'}</p>
                        {app.ems_cert_level && <p className="text-zinc-700">EMS cert: {EMS_CERT_LABELS[app.ems_cert_level] ?? app.ems_cert_level}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-zinc-400 font-semibold uppercase tracking-wide mb-1">Prior Experience</p>
                        <p className="text-zinc-700">
                          {app.prior_experience.length > 0 ? app.prior_experience.map(e => EXPERIENCE_LABELS[e] ?? e).join(', ') : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-400 font-semibold uppercase tracking-wide mb-1">Availability</p>
                        <p className="text-zinc-700">{app.availability.map(a => AVAILABILITY_LABELS[a] ?? a).join(', ') || '—'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-zinc-400 font-semibold uppercase tracking-wide mb-1">Daytime Coverage</p>
                        <p className="text-zinc-700">{app.daytime_coverage ? (DAYTIME_COVERAGE_LABELS[app.daytime_coverage] ?? app.daytime_coverage) : '—'}</p>
                        {app.work_schedule && <p className="text-zinc-700 mt-0.5">Schedule: {app.work_schedule}</p>}
                      </div>
                      <div>
                        <p className="text-zinc-400 font-semibold uppercase tracking-wide mb-1">Involvement &amp; Training</p>
                        <p className="text-zinc-700">{INVOLVEMENT_LABELS[app.involvement_level] ?? app.involvement_level}</p>
                        <p className="text-zinc-700 mt-0.5">Training interest: {TRAINING_LABELS[app.training_interest] ?? app.training_interest}</p>
                      </div>
                    </div>

                    {app.additional_info && (
                      <div>
                        <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wide mb-1">Additional Info</p>
                        <p className="text-sm text-zinc-700 leading-relaxed">{app.additional_info}</p>
                      </div>
                    )}

                    {/* Reviewer notes (closed applications) */}
                    {app.reviewer_notes && !canAct && (
                      <div>
                        <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wide mb-1">Reviewer Notes</p>
                        <p className="text-sm text-zinc-700">{app.reviewer_notes}</p>
                      </div>
                    )}

                    {/* Actions */}
                    {canAct && (
                      <div className="flex flex-col gap-3">
                        {app.status === 'pending' && confirmingAction?.id !== app.id && (
                          <button
                            onClick={() => handleAction(app.id, 'contacted')}
                            disabled={loading}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors self-start"
                          >
                            Mark Contacted
                          </button>
                        )}

                        {confirmingAction?.id === app.id ? (
                          <div className={`rounded-lg border p-4 flex flex-col gap-3 ${
                            confirmingAction.status === 'enrolled' ? 'border-green-200 bg-green-50' : 'border-zinc-200 bg-zinc-100'
                          }`}>
                            <p className={`text-xs font-semibold ${
                              confirmingAction.status === 'enrolled' ? 'text-green-800' : 'text-zinc-700'
                            }`}>
                              {confirmingAction.status === 'enrolled' ? 'Mark as Enrolled' : 'Mark as Not Interested'}
                            </p>
                            <textarea
                              value={reviewerNotes}
                              onChange={e => setReviewerNotes(e.target.value)}
                              rows={2}
                              placeholder="Notes (optional)"
                              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAction(app.id, confirmingAction.status)}
                                disabled={loading}
                                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-colors ${
                                  confirmingAction.status === 'enrolled' ? 'bg-green-600 hover:bg-green-700' : 'bg-zinc-600 hover:bg-zinc-700'
                                }`}
                              >
                                {loading ? 'Saving...' : `Confirm`}
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
                              onClick={() => { setConfirmingAction({ id: app.id, status: 'enrolled' }); setReviewerNotes('') }}
                              className="rounded-lg border border-green-200 bg-white px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 transition-colors"
                            >
                              Mark Enrolled
                            </button>
                            <button
                              onClick={() => { setConfirmingAction({ id: app.id, status: 'not_interested' }); setReviewerNotes('') }}
                              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
                            >
                              Not Interested
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
