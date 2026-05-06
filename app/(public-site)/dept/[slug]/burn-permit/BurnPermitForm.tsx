'use client'

import { useState } from 'react'
import { submitBurnPermit } from '@/app/actions/public-site'

export default function BurnPermitForm({ departmentId, slug }: { departmentId: string; slug: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    formData.set('department_id', departmentId)
    const result = await submitBurnPermit(formData)
    if (result.error) setError(result.error)
    else if (result.confirmationCode) setConfirmationCode(result.confirmationCode)
    setLoading(false)
  }

  if (confirmationCode) {
    return (
      <div className="rounded-xl bg-white border border-zinc-200 p-8 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h2 className="text-xl font-bold text-zinc-900 mb-2">Request Submitted</h2>
        <p className="text-sm text-zinc-500 mb-6">
          Your burn permit request has been received. A department representative will review it and may contact you.
        </p>
        <div className="rounded-lg bg-zinc-50 border border-zinc-200 px-6 py-4 inline-block mb-6">
          <p className="text-xs text-zinc-400 mb-1 font-medium uppercase tracking-wide">Confirmation Code</p>
          <p className="text-2xl font-bold text-zinc-900 font-mono tracking-widest">{confirmationCode}</p>
        </div>
        <p className="text-xs text-zinc-400 mb-6">Save this code for your records.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href={`/dept/${slug}/request-status?code=${confirmationCode}`}
            className="inline-block rounded-lg bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-800 transition-colors"
          >
            Check Permit Status
          </a>
          <a
            href={`/dept/${slug}`}
            className="inline-block rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            Back to Home
          </a>
        </div>
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

      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold text-zinc-700 mb-1">Contact Information</legend>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            name="contact_name"
            type="text"
            required
            autoComplete="name"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              name="contact_email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>
          <div className="sm:w-40">
            <label className="block text-sm font-medium text-zinc-700 mb-1">Phone</label>
            <input
              name="contact_phone"
              type="tel"
              autoComplete="tel"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>
        </div>
      </fieldset>

      <hr className="border-zinc-100" />

      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold text-zinc-700 mb-1">Burn Details</legend>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Burn Address <span className="text-red-500">*</span>
          </label>
          <input
            name="burn_address"
            type="text"
            required
            placeholder="Street address where the burn will occur"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Planned Burn Date <span className="text-red-500">*</span>
          </label>
          <input
            name="burn_date"
            type="date"
            required
            min={new Date().toISOString().split('T')[0]}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Description of Burn <span className="text-red-500">*</span>
          </label>
          <textarea
            name="burn_description"
            required
            rows={4}
            placeholder="Describe what you plan to burn, estimated size, and any other relevant details."
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-y"
          />
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Submitting...' : 'Submit Burn Permit Request'}
      </button>

      <p className="text-xs text-zinc-400 text-center">
        By submitting, you agree that all information provided is accurate.
        Submitting a permit request does not guarantee approval.
      </p>
    </form>
  )
}
