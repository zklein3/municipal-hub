'use client'

import { useState } from 'react'
import { saveDeptInboxSettings } from '@/app/actions/public-site'
import CountyContactsEditor from '@/components/CountyContactsEditor'
import HelpText from '@/components/HelpText'

export default function PublicInboxSettingsClient({
  departmentId,
  publicSlug,
  public_phone,
  public_email,
  public_address,
  public_tagline,
  public_about,
  burn_permit_county_info,
  burn_permit_restrictions,
}: {
  departmentId: string
  publicSlug: string | null
  public_phone: string | null
  public_email: string | null
  public_address: string | null
  public_tagline: string | null
  public_about: string | null
  burn_permit_county_info: string | null
  burn_permit_restrictions: string | null
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSave(formData: FormData) {
    setLoading(true); setError(null); setSuccess(null)
    const result = await saveDeptInboxSettings(formData)
    if (result.error) setError(result.error)
    else setSuccess('Settings saved.')
    setLoading(false)
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Public Site Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">Configure the info residents see on your public site, and its burn permit form.</p>
      </div>

      <HelpText className="mb-4">
        This controls your public site's contact info, about text, burn permit form content, and printable QR codes.
        Submissions themselves are reviewed in the Inbox, not here. To turn the public site on/off or change its URL,
        use the toggle on the main Dept Admin Settings page.
      </HelpText>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">{success}</div>}

      {publicSlug && (
        <div className="rounded-xl bg-white border border-zinc-200 p-5 flex flex-col gap-3 mb-5">
          <h2 className="text-sm font-semibold text-zinc-900">QR Codes</h2>
          <p className="text-xs text-zinc-400">Printable QR codes for flyers, mailers, or posted signage.</p>
          <div className="flex flex-wrap gap-3">
            <a
              href={`/print/qr?type=site&code=${encodeURIComponent(publicSlug)}&title=${encodeURIComponent('Visit Our Website')}&subtitle=${encodeURIComponent('Burn permits, records requests, and more')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors"
            >
              Print Public Site QR ↗
            </a>
            <a
              href={`/print/qr?type=join&code=${encodeURIComponent(publicSlug)}&title=${encodeURIComponent('Join Our Department')}&subtitle=${encodeURIComponent('Scan to apply')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors"
            >
              Print Join QR ↗
            </a>
          </div>
        </div>
      )}

      <form action={handleSave} className="flex flex-col gap-5">
        <input type="hidden" name="department_id" value={departmentId} />

        <div className="rounded-xl bg-white border border-zinc-200 p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-zinc-900">Public Profile</h2>
          <p className="text-xs text-zinc-400 -mt-2">Shown on your public site's home page.</p>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Tagline</label>
            <input
              name="public_tagline"
              type="text"
              defaultValue={public_tagline ?? ''}
              placeholder="Serving our community since 1952"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-700 mb-1">Phone</label>
              <input
                name="public_phone"
                type="tel"
                defaultValue={public_phone ?? ''}
                placeholder="(555) 555-5555"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-700 mb-1">Public Email</label>
              <input
                name="public_email"
                type="email"
                defaultValue={public_email ?? ''}
                placeholder="info@department.org"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Address</label>
            <input
              name="public_address"
              type="text"
              defaultValue={public_address ?? ''}
              placeholder="123 Main St, Winslow, NE 68072"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">About</label>
            <textarea
              name="public_about"
              rows={4}
              defaultValue={public_about ?? ''}
              placeholder="Brief description of the department shown on the public landing page."
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-y"
            />
          </div>
        </div>

        <div className="rounded-xl bg-white border border-zinc-200 p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-zinc-900">Burn Permits</h2>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              County / Sheriff Info <span className="text-red-500">*</span>
            </label>
            <CountyContactsEditor name="burn_permit_county_info" defaultValue={burn_permit_county_info} />
            <p className="mt-1 text-xs text-zinc-400">Printed on approved permits. Required before approving any permit.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Burn Restrictions</label>
            <input
              name="burn_permit_restrictions"
              type="text"
              defaultValue={burn_permit_restrictions ?? ''}
              placeholder="e.g. Brush until 1900 daily, no burning on Red Flag days"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <p className="mt-1 text-xs text-zinc-400">Shown to residents on the public burn permit form and printed on the permit.</p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-red-700 px-5 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
