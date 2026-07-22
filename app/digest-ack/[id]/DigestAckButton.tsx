'use client'

import { useState, useTransition } from 'react'
import { acknowledgeDigestItem } from '@/app/actions/digest-ack'

export default function DigestAckButton({ id, initiallyAcknowledged }: { id: string; initiallyAcknowledged: boolean }) {
  const [done, setDone] = useState(initiallyAcknowledged)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    const fd = new FormData()
    fd.append('id', id)
    startTransition(async () => {
      const result = await acknowledgeDigestItem(fd)
      if (result?.error) { setError(result.error); return }
      setDone(true)
    })
  }

  if (done) {
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 p-5 text-center">
        <p className="text-2xl mb-1">✅</p>
        <p className="text-sm font-semibold text-green-800">Got it — silenced</p>
        <p className="text-xs text-green-700 mt-1">You won&apos;t be reminded about this again until the day it happens.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-white border border-zinc-200 p-5 text-center">
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <button
        onClick={handleClick}
        disabled={isPending}
        className="w-full rounded-xl bg-red-700 px-4 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Saving…' : "Don't remind me again until it's here"}
      </button>
    </div>
  )
}
