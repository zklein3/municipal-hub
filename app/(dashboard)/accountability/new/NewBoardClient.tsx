'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBoard } from '@/app/actions/accountability'

export default function NewBoardClient({
  incidentOptions,
  prefilledIncident,
}: {
  incidentOptions: { id: string; label: string }[]
  prefilledIncident: { id: string; label: string } | null
}) {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]

  const [title, setTitle] = useState('')
  const [date, setDate] = useState(today)
  const [linkType, setLinkType] = useState<'none' | 'incident'>(prefilledIncident ? 'incident' : 'none')
  const [linkedIncidentId, setLinkedIncidentId] = useState(prefilledIncident?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required.'); return }
    setSaving(true)
    setError(null)
    const res = await createBoard(
      title.trim(),
      date,
      linkType === 'incident' ? (linkedIncidentId || null) : null,
      null,
      null,
    )
    setSaving(false)
    if (res?.error) { setError(res.error); return }
    if (res.boardId) router.push(`/accountability/${res.boardId}`)
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl bg-white border border-zinc-200 shadow-sm p-6 flex flex-col gap-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Board Title</label>
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Structure Fire — 123 Main St, Annual Pump Drill, Training Exercise"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Date</label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Link to (optional)</label>
        <div className="flex gap-2 mb-3">
          {(['none', 'incident'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setLinkType(t)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                linkType === t
                  ? 'border-red-300 bg-red-50 text-red-700'
                  : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              {t === 'none' ? 'None' : 'Incident'}
            </button>
          ))}
        </div>
        {linkType === 'incident' && (
          <select
            value={linkedIncidentId}
            onChange={e => setLinkedIncidentId(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            <option value="">— Select incident —</option>
            {incidentOptions.map(i => (
              <option key={i.id} value={i.id}>{i.label}</option>
            ))}
          </select>
        )}
      </div>

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="flex-1 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Creating...' : 'Create Board'}
        </button>
        <Link href="/accountability"
          className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
          Cancel
        </Link>
      </div>
    </form>
  )
}
