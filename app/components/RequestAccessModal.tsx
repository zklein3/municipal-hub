'use client'

import { useState, useRef } from 'react'
import { submitContactRequest } from '@/app/actions/contact'

export default function RequestAccessModal() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await submitContactRequest(formData)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      formRef.current?.reset()
    }
  }

  function handleOpen() {
    setOpen(true)
    setError(null)
    setSuccess(false)
  }

  function handleClose() {
    setOpen(false)
    setSuccess(false)
    setError(null)
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="rounded-lg border border-zinc-700 px-8 py-3 text-base font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
      >
        Request Access
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <div className="relative w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700 p-6 shadow-2xl">
            <button
              onClick={handleClose}
              className="absolute right-4 top-4 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="mb-5">
              <h2 className="text-lg font-bold text-white">Request Access</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Tell us about your department and we'll be in touch.
              </p>
            </div>

            {success ? (
              <div className="rounded-xl bg-green-900/40 border border-green-700 px-5 py-6 text-center">
                <p className="text-sm font-semibold text-green-300">Request sent!</p>
                <p className="mt-1 text-sm text-green-500">We'll reach out to you shortly.</p>
                <button
                  onClick={handleClose}
                  className="mt-4 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
                {error && (
                  <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-2.5 text-sm text-red-300">
                    {error}
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-300">Name <span className="text-red-500">*</span></label>
                  <input
                    name="name"
                    type="text"
                    required
                    placeholder="Your name"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-300">Department <span className="text-red-500">*</span></label>
                  <input
                    name="department"
                    type="text"
                    required
                    placeholder="Department name"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-300">Email <span className="text-red-500">*</span></label>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="you@yourdept.org"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-300">Phone <span className="text-zinc-500 font-normal">(optional)</span></label>
                  <input
                    name="phone"
                    type="tel"
                    placeholder="(555) 555-5555"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Sending…' : 'Send Request'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
