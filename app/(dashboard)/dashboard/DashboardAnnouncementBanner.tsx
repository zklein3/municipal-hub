'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { markAnnouncementRead } from '@/app/actions/announcements'

type Announcement = {
  id: string
  title: string
  body: string
  pinned: boolean
  created_at: string
}

export default function DashboardAnnouncementBanner({
  announcements,
  personnelId,
}: {
  announcements: Announcement[]
  personnelId: string
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  const visible = announcements.filter(a => !dismissed.has(a.id))
  if (visible.length === 0) return null

  // Show only the first (most recent / pinned first) on dashboard
  const top = visible[0]
  const remaining = visible.length - 1

  function handleMarkRead(id: string) {
    startTransition(async () => {
      await markAnnouncementRead(id)
      setDismissed(prev => new Set([...prev, id]))
    })
  }

  return (
    <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {remaining > 0 ? `${visible.length} Unread` : 'Unread'}
            </span>
            {top.pinned && (
              <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">Pinned</span>
            )}
            <p className="text-sm font-semibold text-zinc-900">{top.title}</p>
          </div>
          <p className="text-sm text-zinc-700 line-clamp-2">{top.body}</p>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => handleMarkRead(top.id)}
              disabled={isPending}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-50"
            >
              Mark as Read
            </button>
            <Link href="/announcements" className="text-xs font-semibold text-zinc-500 hover:text-zinc-700 transition-colors">
              {remaining > 0 ? `View all (${remaining} more) →` : 'View all →'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
