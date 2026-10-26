'use client'

import type { ReactNode } from 'react'

// The overlay + card + error banner + Confirm/Cancel footer shared by every medication form.
export default function ModalShell({
  title, subtitle, error, loading, confirmLabel, confirmDisabled = false, confirmClass = 'bg-red-700 hover:bg-red-800',
  onConfirm, onCancel, children,
}: {
  title: string
  subtitle: ReactNode
  error: string | null
  loading: boolean
  confirmLabel: string
  confirmDisabled?: boolean
  confirmClass?: string
  onConfirm: () => void
  onCancel: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-8">
      <div className="w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-xl p-6">
        <h2 className="text-base font-bold text-zinc-900 mb-1">{title}</h2>
        <p className="text-sm text-zinc-500 mb-5">{subtitle}</p>
        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}
        <div className="flex flex-col gap-3">{children}</div>
        <div className="flex gap-3 mt-6">
          <button onClick={onConfirm} disabled={loading || confirmDisabled}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${confirmClass}`}>
            {loading ? 'Saving…' : confirmLabel}
          </button>
          <button onClick={onCancel}
            className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export function ControlledBadge() {
  return <span className="ml-2 text-xs rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 font-medium">Controlled</span>
}
