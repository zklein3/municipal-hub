import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function DeptLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const adminClient = createAdminClient()

  const { data: deptList } = await adminClient
    .from('departments')
    .select('id, name, public_site_enabled, public_phone, public_email, public_address, public_tagline, public_about')
    .eq('public_slug', slug)
    .limit(1)

  const dept = deptList?.[0]
  if (!dept || !dept.public_site_enabled) notFound()

  const base = `/dept/${slug}`

  const hasContact = dept.public_phone || dept.public_email || dept.public_address

  return (
    <div>
      {/* Hero */}
      <div className="rounded-2xl bg-red-800 text-white px-8 py-12 mb-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">{dept.name}</h1>
        {dept.public_tagline && (
          <p className="text-red-200 text-lg mt-2">{dept.public_tagline}</p>
        )}
      </div>

      {/* Contact info */}
      {hasContact && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {dept.public_address && (
            <div className="rounded-xl bg-white border border-zinc-200 p-5">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Address</p>
              <p className="text-sm text-zinc-700 whitespace-pre-line">{dept.public_address}</p>
            </div>
          )}
          {dept.public_phone && (
            <div className="rounded-xl bg-white border border-zinc-200 p-5">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Phone</p>
              <a href={`tel:${dept.public_phone}`} className="text-sm text-red-700 hover:underline font-medium">
                {dept.public_phone}
              </a>
            </div>
          )}
          {dept.public_email && (
            <div className="rounded-xl bg-white border border-zinc-200 p-5">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Email</p>
              <a href={`mailto:${dept.public_email}`} className="text-sm text-red-700 hover:underline font-medium break-all">
                {dept.public_email}
              </a>
            </div>
          )}
        </div>
      )}

      {/* About */}
      {dept.public_about && (
        <div className="rounded-xl bg-white border border-zinc-200 p-6 mb-8">
          <h2 className="text-base font-semibold text-zinc-900 mb-3">About Us</h2>
          <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line">{dept.public_about}</p>
        </div>
      )}

      {/* Quick actions */}
      <h2 className="text-base font-semibold text-zinc-700 mb-3">How Can We Help?</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href={`${base}/events`}
          className="rounded-xl bg-white border border-zinc-200 p-6 hover:border-red-300 hover:shadow-md transition-all group"
        >
          <div className="text-2xl mb-2">📅</div>
          <h3 className="font-semibold text-zinc-900 group-hover:text-red-700 transition-colors mb-1">Upcoming Events</h3>
          <p className="text-xs text-zinc-400">View community events and public activities.</p>
        </Link>

        <Link
          href={`${base}/burn-permit`}
          className="rounded-xl bg-white border border-zinc-200 p-6 hover:border-red-300 hover:shadow-md transition-all group"
        >
          <div className="text-2xl mb-2">🔥</div>
          <h3 className="font-semibold text-zinc-900 group-hover:text-red-700 transition-colors mb-1">Burn Permit</h3>
          <p className="text-xs text-zinc-400">Submit a request to conduct a controlled burn.</p>
        </Link>

        <Link
          href={`${base}/records`}
          className="rounded-xl bg-white border border-zinc-200 p-6 hover:border-red-300 hover:shadow-md transition-all group"
        >
          <div className="text-2xl mb-2">📄</div>
          <h3 className="font-semibold text-zinc-900 group-hover:text-red-700 transition-colors mb-1">Records Request</h3>
          <p className="text-xs text-zinc-400">Request incident reports or inspection records.</p>
        </Link>
      </div>
    </div>
  )
}
