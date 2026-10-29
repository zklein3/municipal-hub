'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addMissingStarters } from '@/app/actions/starters'

// One place to load the standard equipment library (categories, items, presets, medication types,
// bags). Safe to run again: it only adds what's missing and never changes quantities already set.
export default function StarterLibraryBanner() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function load() {
    setError(null); setSuccess(null); setLoading(true)
    const r = await addMissingStarters()
    setLoading(false)
    if (r.error) { setError(r.error); return }
    const s = r.summary
    if (!s) { setSuccess('Done.'); return }
    if (s.skipped) { setSuccess(s.skipped); return }
    const added = s.presets.created + s.items.created + s.categories.created + s.medicationTypes.created
    if (added === 0 && s.presetItems === 0 && s.presetMedications === 0) {
      setSuccess('You already have everything in the starter library.')
    } else {
      setSuccess(
        `Added ${s.presets.created} presets, ${s.items.created} items, ${s.categories.created} categories` +
        (s.medicationTypes.created ? `, ${s.medicationTypes.created} medication types` : '') +
        (s.items.adopted ? ` (matched ${s.items.adopted} items you already had)` : '') + '.'
      )
    }
    router.refresh()
  }

  return (
    <div className="mb-4 rounded-xl border border-zinc-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900">Starter library</p>
          <p className="text-xs text-zinc-500">
            Standard categories, items, equipment presets, medications, and bags. Adds only what&apos;s missing — nothing you&apos;ve set up is changed.
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-colors">
          {loading ? 'Loading…' : 'Load starter library'}
        </button>
      </div>
      {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">{error}</div>}
      {success && <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 border border-green-200">{success}</div>}
    </div>
  )
}
