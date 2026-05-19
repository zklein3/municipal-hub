'use client'

import { useState } from 'react'
import { submitFireSchoolInquiry } from '@/app/actions/admin'

export default function FireSchoolCoverPage() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    try {
      const res = await submitFireSchoolInquiry(formData)
      if (res?.error) setError(res.error)
      else setSent(true)
    } catch {
      setError('Something went wrong. Please try again or email us directly.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-600 mb-4">
            <span className="text-3xl">🔥</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">FireOps7</h1>
          <p className="text-sm text-zinc-500 mt-1">Fire Department Operations Platform</p>
        </div>

        {/* Message card */}
        <div className="rounded-2xl bg-white shadow-sm border border-zinc-200 p-8 text-center mb-4">
          <h2 className="text-lg font-bold text-zinc-900 mb-3">
            Thanks for checking out FireOps7!
          </h2>
          <p className="text-sm text-zinc-600 leading-relaxed mb-2">
            This fill station is currently offline for the season, but we&apos;re glad you found us.
          </p>
          <p className="text-sm text-zinc-600 leading-relaxed">
            FireOps7 is a full department operations platform — personnel, training, equipment,
            inspections, incidents, and more — built specifically for fire departments.
            If you&apos;d like to learn more or have questions, we&apos;d love to hear from you.
          </p>
        </div>

        {/* Inquiry button / form */}
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            className="w-full rounded-xl bg-orange-600 px-6 py-4 text-base font-bold text-white hover:bg-orange-700 transition-colors shadow-sm"
          >
            Send a Question or Request
          </button>
        ) : sent ? (
          <div className="rounded-2xl bg-white shadow-sm border border-green-200 p-6 text-center">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-sm font-semibold text-zinc-900">Message sent!</p>
            <p className="text-xs text-zinc-500 mt-1">We&apos;ll be in touch soon.</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white shadow-sm border border-zinc-200 p-6">
            <h3 className="text-sm font-semibold text-zinc-900 mb-4">Send a Question or Request</h3>
            {error && (
              <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <form action={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Your Name <span className="text-red-500">*</span></label>
                <input name="name" type="text" required
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Department</label>
                <input name="dept" type="text"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Email</label>
                <input name="email" type="email"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Message <span className="text-red-500">*</span></label>
                <textarea name="message" required rows={3} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm resize-none focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => setOpen(false)}
                  className="flex-1 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50">
                  {loading ? 'Sending...' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
