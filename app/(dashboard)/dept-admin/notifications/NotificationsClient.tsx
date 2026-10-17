'use client'

import { useState } from 'react'
import { setNotificationPref, type NotificationField } from '@/app/actions/notifications'
import { saveWeeklyDigestEnabled } from '@/app/actions/departments'

export interface Recipient {
  deptPersonnelId: string
  name: string
  email: string | null
  can: Record<NotificationField, boolean>
  notify_feedback: boolean
  burn_permit_reviewer: boolean
  notify_membership_interest: boolean
}

const TYPES: { field: NotificationField; label: string; description: string }[] = [
  { field: 'notify_feedback', label: 'Feedback & problem reports', description: 'Someone submits feedback or reports a problem on the public site' },
  { field: 'burn_permit_reviewer', label: 'Burn permits', description: 'A new burn permit is submitted for review' },
  { field: 'notify_membership_interest', label: 'Membership interest', description: 'Someone fills out the "interested in joining" form' },
]

export default function NotificationsClient({
  departmentId, recipients: initial, weeklyDigestEnabled: initialDigest, publicSiteEnabled,
}: {
  departmentId: string
  recipients: Recipient[]
  weeklyDigestEnabled: boolean
  publicSiteEnabled: boolean
}) {
  const [recipients, setRecipients] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [digest, setDigest] = useState(initialDigest)
  const [digestBusy, setDigestBusy] = useState(false)

  async function toggle(r: Recipient, field: NotificationField) {
    const next = !r[field]
    const key = `${r.deptPersonnelId}:${field}`
    setBusyKey(key); setError(null)
    setRecipients(prev => prev.map(x => x.deptPersonnelId === r.deptPersonnelId ? { ...x, [field]: next } : x))
    const result = await setNotificationPref(r.deptPersonnelId, field, next)
    if (result?.error) {
      setError(result.error)
      setRecipients(prev => prev.map(x => x.deptPersonnelId === r.deptPersonnelId ? { ...x, [field]: !next } : x))
    }
    setBusyKey(null)
  }

  async function toggleDigest(next: boolean) {
    setDigest(next); setDigestBusy(true); setError(null)
    const result = await saveWeeklyDigestEnabled(departmentId, next)
    if (result?.error) { setError(result.error); setDigest(!next) }
    setDigestBusy(false)
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>}

      {/* Department-wide */}
      <div className="rounded-xl bg-white border border-zinc-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-zinc-900 mb-1">Event Email Reminders</h2>
        <p className="text-xs text-zinc-500 mb-4">
          Emails every active member: a full recap every Monday morning, a heads-up exactly one week before
          each event, and a same-day reminder — silent on days with nothing scheduled.
        </p>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={digest} disabled={digestBusy}
            onChange={e => toggleDigest(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-red-600 focus:ring-red-500" />
          <span className="text-sm text-zinc-700">{digest ? 'Event reminders are on' : 'Event reminders are off'}</span>
        </label>
      </div>

      {/* Per-person */}
      <div className="rounded-xl bg-white border border-zinc-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-zinc-900 mb-1">Public Site &amp; Inbox Alerts</h2>
        <p className="text-xs text-zinc-500 mb-4">
          Choose which officers and admins are emailed for each inbox item.
          {!publicSiteEnabled && ' The public site is currently off for this department, so none of these will fire until it is turned on.'}
        </p>

        {recipients.length === 0 ? (
          <p className="text-sm text-zinc-400">No one in this department has a permission group that handles the public inbox or burn permits.</p>
        ) : (
          <>
            {/* Desktop: matrix */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left">
                    <th className="py-2 pr-3 font-semibold text-zinc-600">Person</th>
                    {TYPES.map(t => (
                      <th key={t.field} className="py-2 px-2 text-center font-semibold text-zinc-600 align-bottom" title={t.description}>
                        {t.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recipients.map(r => (
                    <tr key={r.deptPersonnelId} className="border-b border-zinc-100 last:border-0">
                      <td className="py-2.5 pr-3">
                        <p className="font-medium text-zinc-900">{r.name}</p>
                        <p className={`text-xs ${r.email ? 'text-zinc-400' : 'text-amber-600'}`}>{r.email ?? 'No email on file — will be skipped'}</p>
                      </td>
                      {TYPES.map(t => (
                        <td key={t.field} className="py-2.5 px-2 text-center">
                          {r.can[t.field] ? (
                            <input type="checkbox" checked={r[t.field]} disabled={busyKey === `${r.deptPersonnelId}:${t.field}`}
                              onChange={() => toggle(r, t.field)}
                              aria-label={`${t.label} for ${r.name}`}
                              className="h-4 w-4 rounded border-zinc-300 text-red-600 focus:ring-red-500" />
                          ) : (
                            <span className="text-zinc-300" title="Their permission group doesn't include this">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: stacked cards */}
            <div className="sm:hidden flex flex-col gap-3">
              {recipients.map(r => (
                <div key={r.deptPersonnelId} className="rounded-lg border border-zinc-200 p-3">
                  <p className="text-sm font-medium text-zinc-900">{r.name}</p>
                  <p className={`text-xs mb-2 ${r.email ? 'text-zinc-400' : 'text-amber-600'}`}>{r.email ?? 'No email on file — will be skipped'}</p>
                  {TYPES.filter(t => r.can[t.field]).map(t => (
                    <label key={t.field} className="flex items-center gap-2 py-1 cursor-pointer">
                      <input type="checkbox" checked={r[t.field]} disabled={busyKey === `${r.deptPersonnelId}:${t.field}`}
                        onChange={() => toggle(r, t.field)}
                        className="h-4 w-4 rounded border-zinc-300 text-red-600 focus:ring-red-500" />
                      <span className="text-sm text-zinc-700">{t.label}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
