'use client'

import { useState } from 'react'
import { savePublicSiteSettings, toggleEventSeriesPublic } from '@/app/actions/public-site'

interface EventSeries {
  id: string
  title: string
  event_type: string | null
  is_public: boolean
  active: boolean
}

interface PublicSiteData {
  public_slug: string | null
  public_site_enabled: boolean
  public_phone: string | null
  public_email: string | null
  public_address: string | null
  public_tagline: string | null
  public_about: string | null
  burn_permit_restrictions: string | null
  burn_permit_county_info: string | null
}

export default function PublicSiteTab({
  departmentId,
  publicSite,
  eventSeries,
}: {
  departmentId: string
  publicSite: PublicSiteData
  eventSeries: EventSeries[]
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(publicSite.public_site_enabled)
  const [slug, setSlug] = useState(publicSite.public_slug ?? '')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [eventPublicState, setEventPublicState] = useState<Record<string, boolean>>(
    Object.fromEntries(eventSeries.map(e => [e.id, e.is_public]))
  )

  async function handleSave(formData: FormData) {
    setLoading(true); setError(null); setSuccess(null)
    formData.set('department_id', departmentId)
    formData.set('public_site_enabled', enabled ? 'true' : 'false')
    const result = await savePublicSiteSettings(formData)
    if (result.error) setError(result.error)
    else {
      setSuccess('Public site settings saved.')
      if (result.slug) setSlug(result.slug)
    }
    setLoading(false)
  }

  async function handleToggleEvent(eventSeriesId: string, current: boolean) {
    setTogglingId(eventSeriesId)
    const next = !current
    const result = await toggleEventSeriesPublic(eventSeriesId, next, departmentId)
    if (result.error) setError(result.error)
    else setEventPublicState(prev => ({ ...prev, [eventSeriesId]: next }))
    setTogglingId(null)
  }

  const siteUrl = slug ? `/dept/${slug}` : null

  return (
    <div className="flex flex-col gap-6">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">{success}</div>}

      {/* Enable + slug */}
      <div className="rounded-xl bg-white border border-zinc-200 p-5">
        <h3 className="text-sm font-semibold text-zinc-900 mb-4">Site Settings</h3>

        <form action={handleSave} className="flex flex-col gap-4">
          {/* Enable toggle */}
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-zinc-700">Enable Public Site</p>
              <p className="text-xs text-zinc-400">When off, the URL returns a not-found page.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled(v => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                enabled ? 'bg-red-700' : 'bg-zinc-300'
              }`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </label>

          {/* Slug */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              URL Slug {enabled && <span className="text-red-500">*</span>}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400 shrink-0">fireops7.com/dept/</span>
              <input
                name="public_slug"
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value)}
                placeholder="winslow-fire-ne"
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <p className="mt-1 text-xs text-zinc-400">Lowercase letters, numbers, and hyphens only. Auto-cleaned on save.</p>
            {siteUrl && (
              <a
                href={siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-xs text-red-700 hover:underline font-medium"
              >
                View public site ↗
              </a>
            )}
          </div>

          <hr className="border-zinc-100" />

          {/* Public profile fields */}
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Public Profile</h4>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-700 mb-1">Tagline</label>
              <input
                name="public_tagline"
                type="text"
                defaultValue={publicSite.public_tagline ?? ''}
                placeholder="Serving our community since 1952"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-700 mb-1">Phone</label>
              <input
                name="public_phone"
                type="tel"
                defaultValue={publicSite.public_phone ?? ''}
                placeholder="(555) 555-5555"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-700 mb-1">Public Email</label>
              <input
                name="public_email"
                type="email"
                defaultValue={publicSite.public_email ?? ''}
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
              defaultValue={publicSite.public_address ?? ''}
              placeholder="123 Main St, Winslow, NE 68072"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">About</label>
            <textarea
              name="public_about"
              rows={4}
              defaultValue={publicSite.public_about ?? ''}
              placeholder="Brief description of the department shown on the public landing page."
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-y"
            />
          </div>

          <hr className="border-zinc-100" />
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Burn Permit Settings</h4>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Burn Restrictions</label>
            <input
              name="burn_permit_restrictions"
              type="text"
              defaultValue={publicSite.burn_permit_restrictions ?? ''}
              placeholder="e.g. Brush until 1900 daily"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <p className="mt-1 text-xs text-zinc-400">Printed on the permit: &quot;Permit holder can burn [restrictions]&quot;</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">County / Sheriff Info</label>
            <textarea
              name="burn_permit_county_info"
              rows={3}
              defaultValue={publicSite.burn_permit_county_info ?? ''}
              placeholder={"Dodge County    (402) 727-2677\nWashington County    (402) 426-6866"}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-y font-mono"
            />
            <p className="mt-1 text-xs text-zinc-400">Printed on the permit under the Sheriff notification section.</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors self-start"
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>

      {/* Public events */}
      <div className="rounded-xl bg-white border border-zinc-200 p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-zinc-900">Public Events</h3>
          <span className="text-xs text-zinc-400">
            {Object.values(eventPublicState).filter(Boolean).length} of {eventSeries.length} public
          </span>
        </div>
        <p className="text-xs text-zinc-400 mb-4">Toggle which event series appear on the public events page.</p>

        {eventSeries.length === 0 ? (
          <p className="text-sm text-zinc-400 py-4 text-center">No active event series for this department.</p>
        ) : (
          <div className="flex flex-col divide-y divide-zinc-100">
            {eventSeries.map(ev => {
              const isPublic = eventPublicState[ev.id] ?? false
              return (
                <div key={ev.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-800 truncate">{ev.title}</p>
                    {ev.event_type && (
                      <p className="text-xs text-zinc-400 capitalize">{ev.event_type.replace('_', ' ')}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isPublic}
                    disabled={togglingId === ev.id}
                    onClick={() => handleToggleEvent(ev.id, isPublic)}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
                      isPublic ? 'bg-red-700' : 'bg-zinc-300'
                    }`}
                  >
                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
