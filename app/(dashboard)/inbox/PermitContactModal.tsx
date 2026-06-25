'use client'

import { useState, useTransition } from 'react'
import { contactPermitHolder } from '@/app/actions/public-site'

export default function PermitContactModal({
  permitId,
  contactName,
  contactEmail,
  confirmationCode,
  onClose,
}: {
  permitId: string
  contactName: string
  contactEmail: string
  confirmationCode: string
  onClose: () => void
}) {
  const [subject, setSubject] = useState(`Regarding your burn permit (${confirmationCode})`)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSend() {
    if (!message.trim()) { setError('Please enter a message.'); return }
    setError(null)
    const fd = new FormData()
    fd.set('permit_id', permitId)
    fd.set('subject', subject)
    fd.set('message', message)
    startTransition(async () => {
      const result = await contactPermitHolder(fd)
      if (result?.error) { setError(result.error); return }
      setSent(true)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white border border-zinc-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Contact Permit Holder</p>
          <p className="text-lg font-bold text-zinc-900 mt-0.5">{contactName}</p>
          <p className="text-xs text-zinc-500">{contactEmail}</p>
        </div>

        {sent ? (
          <div className="px-5 py-8 text-center">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-sm font-semibold text-green-800">Email sent to {contactEmail}</p>
          </div>
        ) : (
          <div className="px-5 py-4 flex flex-col gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Message</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={5}
                placeholder="e.g. Due to current weather conditions, the burn ban has been reinstated. Please do not burn under this permit until further notice."
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50 flex justify-end gap-2">
          <button onClick={onClose} disabled={isPending}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50">
            {sent ? 'Close' : 'Cancel'}
          </button>
          {!sent && (
            <button onClick={handleSend} disabled={isPending}
              className="rounded-lg bg-red-700 px-5 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
              {isPending ? 'Sending...' : 'Send Email'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
