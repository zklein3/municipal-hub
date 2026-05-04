'use client'

import { useState } from 'react'
import { submitRecordRequest } from '@/app/actions/public-site'

const REQUEST_TYPES = [
  { value: 'incident_report', label: 'Incident Report', description: 'Fire, rescue, or EMS incident records' },
  { value: 'inspection_record', label: 'Inspection Record', description: 'Property or equipment inspection results' },
  { value: 'other', label: 'Other', description: 'Any other public records request' },
]

export default function RecordRequestForm({ departmentId, slug }: { departmentId: string; slug: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null)
  const [requestType, setRequestType] = useState('')

  const showIncidentFields = requestType === 'incident_report'

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    formData.set('department_id', departmentId)
    const result = await submitRecordRequest(formData)
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
          Your records request has been received. A department representative will review it and contact you at the email you provided.
        </p>
        <div className="rounded-lg bg-zinc-50 border border-zinc-200 px-6 py-4 inline-block mb-6">
          <p className="text-xs text-zinc-400 mb-1 font-medium uppercase tracking-wide">Confirmation Code</p>
          <p className="text-2xl font-bold text-zinc-900 font-mono tracking-widest">{confirmationCode}</p>
        </div>
        <p className="text-xs text-zinc-400 mb-6">Save this code for your records.</p>
        <a
          href={`/dept/${slug}`}
          className="inline-block rounded-lg bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-800 transition-colors"
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

      {/* Contact info */}
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

      {/* Request details */}
      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold text-zinc-700 mb-1">Request Details</legend>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            Request Type <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-col gap-2">
            {REQUEST_TYPES.map(rt => (
              <label
                key={rt.value}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                  requestType === rt.value
                    ? 'border-red-400 bg-red-50'
                    : 'border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <input
                  type="radio"
                  name="request_type"
                  value={rt.value}
                  required
                  checked={requestType === rt.value}
                  onChange={() => setRequestType(rt.value)}
                  className="mt-0.5 h-4 w-4 text-red-700 focus:ring-red-500"
                />
                <div>
                  <p className="text-sm font-medium text-zinc-800">{rt.label}</p>
                  <p className="text-xs text-zinc-400">{rt.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Incident fields — shown only for incident_report */}
        {showIncidentFields && (
          <div className="flex flex-col gap-3 rounded-lg bg-zinc-50 border border-zinc-100 p-4">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Incident Details (if known)</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-700 mb-1">Incident Date</label>
                <input
                  name="incident_date"
                  type="date"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-700 mb-1">Incident Address</label>
                <input
                  name="incident_address"
                  type="text"
                  placeholder="Street address"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Description of Request <span className="text-red-500">*</span>
          </label>
          <textarea
            name="description"
            required
            rows={4}
            placeholder="Please describe the records you are requesting and any other relevant details."
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-y"
          />
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={loading || !requestType}
        className="w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Submitting...' : 'Submit Records Request'}
      </button>

      <p className="text-xs text-zinc-400 text-center">
        Requests are subject to applicable public records laws. Some records may not be releasable.
      </p>
    </form>
  )
}
