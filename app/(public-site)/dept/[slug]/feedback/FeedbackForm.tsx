'use client'

import { useState } from 'react'
import { submitPublicFeedback } from '@/app/actions/public-site'

const FEEDBACK_TYPES = [
  { value: 'feedback', label: 'General Feedback', description: 'Comments, suggestions, or compliments' },
  { value: 'bug_report', label: 'Report a Problem', description: 'Something on this website isn’t working right' },
]

export default function FeedbackForm({ departmentId, slug }: { departmentId: string; slug: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [feedbackType, setFeedbackType] = useState('feedback')

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    formData.set('department_id', departmentId)
    formData.set('page_url', typeof window !== 'undefined' ? window.location.href : '')
    const result = await submitPublicFeedback(formData)
    if (result.error) setError(result.error)
    else setSubmitted(true)
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="rounded-xl bg-white border border-zinc-200 p-8 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h2 className="text-xl font-bold text-zinc-900 mb-2">Thank You</h2>
        <p className="text-sm text-zinc-500 mb-6">
          Your message has been sent to the department. If you provided an email address, they may follow up with you.
        </p>
        <a
          href={`/dept/${slug}`}
          className="inline-block rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          Back to Home
        </a>
      </div>
    )
  }

  return (
    <form action={handleSubmit} className="rounded-xl bg-white border border-zinc-200 p-6 flex flex-col gap-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">Type</label>
        <div className="flex flex-col gap-2">
          {FEEDBACK_TYPES.map(ft => (
            <label
              key={ft.value}
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                feedbackType === ft.value
                  ? 'border-red-400 bg-red-50'
                  : 'border-zinc-200 hover:border-zinc-300'
              }`}
            >
              <input
                type="radio"
                name="feedback_type"
                value={ft.value}
                checked={feedbackType === ft.value}
                onChange={() => setFeedbackType(ft.value)}
                className="mt-0.5 h-4 w-4 text-red-700 focus:ring-red-500"
              />
              <div>
                <p className="text-sm font-medium text-zinc-800">{ft.label}</p>
                <p className="text-xs text-zinc-400">{ft.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-zinc-700 mb-1">Name</label>
          <input
            name="contact_name"
            type="text"
            autoComplete="name"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
          <input
            name="contact_email"
            type="email"
            autoComplete="email"
            placeholder="Optional — for a reply"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Message <span className="text-red-500">*</span>
        </label>
        <textarea
          name="message"
          required
          rows={5}
          placeholder="Let us know what's on your mind..."
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-y"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Sending...' : 'Send'}
      </button>

      <p className="text-xs text-zinc-400 text-center">
        This message goes only to {`this department`} — not to other departments or the general public.
      </p>
    </form>
  )
}
