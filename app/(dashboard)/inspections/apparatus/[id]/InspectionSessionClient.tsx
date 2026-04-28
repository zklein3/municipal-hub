'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { claimCompartment, releaseCompartment, closeInspectionSession } from '@/app/actions/inspections'

interface SessionCompartment {
  id: string
  compartment_id: string
  compartment_name: string
  status: 'pending' | 'in_progress' | 'completed'
  claimed_by: string | null
  claimed_by_name: string | null
  completed_by_name: string | null
  completed_at: string | null
}

interface Session {
  id: string
  status: string
  started_at: string
  expires_at: string
}

export default function InspectionSessionClient({
  session,
  compartments,
  apparatus_id,
  personnel_id,
  isOfficerOrAdmin,
}: {
  session: Session
  compartments: SessionCompartment[]
  apparatus_id: string
  personnel_id: string
  isOfficerOrAdmin: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const done = compartments.filter(c => c.status === 'completed').length
  const total = compartments.length
  const sessionComplete = session.status === 'completed' || done === total

  async function handleInspect(sc: SessionCompartment) {
    setLoadingId(sc.id)
    setError(null)
    const res = await claimCompartment(sc.id)
    if (res?.error) {
      setError(res.error)
      setLoadingId(null)
      return
    }
    router.push(
      `/inspections/run?apparatus_id=${apparatus_id}&compartment_id=${sc.compartment_id}&session_id=${session.id}&session_compartment_id=${sc.id}`
    )
  }

  async function handleRelease(sc: SessionCompartment) {
    setLoadingId(sc.id)
    setError(null)
    startTransition(async () => {
      const res = await releaseCompartment(sc.id)
      if (res?.error) setError(res.error)
      setLoadingId(null)
      router.refresh()
    })
  }

  async function handleCloseSession() {
    setError(null)
    startTransition(async () => {
      const res = await closeInspectionSession(session.id)
      if (res?.error) setError(res.error)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: total > 0 ? `${(done / total) * 100}%` : '0%' }}
          />
        </div>
        <span className="text-sm font-medium text-zinc-600 whitespace-nowrap">
          {done} / {total} complete
        </span>
      </div>

      {sessionComplete && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm font-medium text-green-700">
          Session complete — all compartments inspected.
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Compartment list */}
      <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white overflow-hidden">
        {compartments.length === 0 && (
          <div className="px-4 py-6 text-sm text-zinc-500 text-center">
            No compartments assigned to this apparatus.
          </div>
        )}
        {compartments.map(sc => (
          <div key={sc.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-900 truncate">{sc.compartment_name}</p>
              {sc.status === 'in_progress' && sc.claimed_by_name && (
                <p className="text-xs text-amber-600 mt-0.5">In progress — {sc.claimed_by_name}</p>
              )}
              {sc.status === 'completed' && (
                <p className="text-xs text-green-600 mt-0.5">
                  Completed by {sc.completed_by_name ?? 'Unknown'}
                  {sc.completed_at ? ` · ${new Date(sc.completed_at).toLocaleTimeString([], { timeStyle: 'short' })}` : ''}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {sc.status === 'pending' && (
                <button
                  onClick={() => handleInspect(sc)}
                  disabled={loadingId === sc.id || isPending}
                  className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
                >
                  {loadingId === sc.id ? 'Starting…' : 'Inspect'}
                </button>
              )}
              {sc.status === 'in_progress' && (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    In Progress
                  </span>
                  {isOfficerOrAdmin && (
                    <button
                      onClick={() => handleRelease(sc)}
                      disabled={loadingId === sc.id || isPending}
                      className="text-xs text-zinc-500 hover:text-red-700 underline disabled:opacity-50"
                    >
                      Release
                    </button>
                  )}
                </>
              )}
              {sc.status === 'completed' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  ✓ Done
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Officer/Admin controls */}
      {isOfficerOrAdmin && !sessionComplete && (
        <div className="flex justify-end pt-2">
          <button
            onClick={handleCloseSession}
            disabled={isPending}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
          >
            Close Session
          </button>
        </div>
      )}
    </div>
  )
}
