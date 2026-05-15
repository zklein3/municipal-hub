import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ApplicantSignatureSection from './ApplicantSignatureSection'

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved:  'bg-green-100 text-green-800 border-green-200',
  denied:    'bg-red-100 text-red-800 border-red-200',
  cancelled: 'bg-zinc-100 text-zinc-600 border-zinc-200',
}
const STATUS_LABELS: Record<string, string> = {
  pending:   'Under Review',
  approved:  'Approved',
  denied:    'Denied',
  cancelled: 'Cancelled',
}

export default async function PermitStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ code?: string }>
}) {
  const { slug } = await params
  const { code } = await searchParams

  const adminClient = createAdminClient()

  const { data: deptList } = await adminClient
    .from('departments')
    .select('id, name, public_site_enabled')
    .eq('public_slug', slug)
    .limit(1)

  const dept = deptList?.[0]
  if (!dept || !dept.public_site_enabled) notFound()

  // If no code submitted yet — show lookup form
  if (!code) {
    return (
      <div className="max-w-md">
        <div className="mb-6">
          <Link href={`/dept/${slug}`} className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">← Back</Link>
          <h1 className="text-2xl font-bold text-zinc-900 mt-2">Check Permit Status</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{dept.name}</p>
        </div>

        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Looking for a <strong>records request</strong>? Use the{' '}
          <Link href={`/dept/${slug}/request-status`} className="font-semibold underline hover:text-blue-600">
            Status Center
          </Link>{' '}
          — it handles both burn permits and records requests.
        </div>

        <form method="GET" className="rounded-xl bg-white border border-zinc-200 p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Burn Permit Confirmation Code <span className="text-red-500">*</span>
            </label>
            <input
              name="code"
              type="text"
              required
              autoComplete="off"
              placeholder="e.g. A3F92B1C"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono uppercase tracking-widest focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <p className="mt-1 text-xs text-zinc-400">This was shown on screen when you submitted your burn permit application.</p>
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 transition-colors"
          >
            Look Up Permit
          </button>
        </form>
      </div>
    )
  }

  // Code provided — look up permit
  const { data: permit } = await adminClient
    .from('burn_permits')
    .select('id, contact_name, burn_address, burn_date, status, reviewer_notes, permit_expiry_date, issued_date, confirmation_code, department_id, officer_signed_at, applicant_signed_at, applicant_acknowledged_at')
    .eq('confirmation_code', code.toUpperCase().trim())
    .eq('department_id', dept.id)
    .single()

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <Link href={`/dept/${slug}/permit-status`} className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">← Look Up Another</Link>
        <h1 className="text-2xl font-bold text-zinc-900 mt-2">Permit Status</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{dept.name}</p>
      </div>

      {!permit ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl bg-white border border-zinc-200 p-8 text-center">
            <p className="text-sm font-medium text-zinc-700 mb-1">No burn permit found</p>
            <p className="text-xs text-zinc-400">Check your confirmation code and try again.</p>
            <p className="text-xs font-mono text-zinc-300 mt-2">{code.toUpperCase()}</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Have a <strong>records request</strong> code?{' '}
            <Link href={`/dept/${slug}/request-status?q=${code.toUpperCase()}`} className="font-semibold underline hover:text-blue-600">
              Try the Status Center →
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Status card */}
          {(() => {
            const isExpired = permit.status === 'approved' &&
              !!permit.permit_expiry_date &&
              new Date(permit.permit_expiry_date + 'T23:59:59') < new Date()
            const cardStyle = isExpired ? 'bg-red-100 text-red-800 border-red-200' : (STATUS_STYLES[permit.status] ?? 'bg-zinc-50 border-zinc-200')
            const label = isExpired ? 'Expired' : (STATUS_LABELS[permit.status] ?? permit.status)
            return (
              <div className={`rounded-xl border p-5 ${cardStyle}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Permit Status</p>
                  <span className="text-xs font-mono opacity-60">{permit.confirmation_code}</span>
                </div>
                <p className="text-2xl font-bold">{label}</p>
                {isExpired && (
                  <p className="text-xs mt-1 opacity-80">This permit expired on {formatDate(permit.permit_expiry_date)}. Contact the department if you need a renewal.</p>
                )}
                {permit.status === 'pending' && (
                  <p className="text-xs mt-1 opacity-70">Your permit is being reviewed by the department. Check back soon.</p>
                )}
                {permit.status === 'denied' && permit.reviewer_notes && (
                  <p className="text-xs mt-2 opacity-80"><strong>Note from department:</strong> {permit.reviewer_notes}</p>
                )}
              </div>
            )
          })()}

          {/* Permit details */}
          <div className="rounded-xl bg-white border border-zinc-200 p-5">
            <h2 className="text-sm font-semibold text-zinc-800 mb-3">Permit Details</h2>
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Issued To</span>
                <span className="text-zinc-800 font-medium">{permit.contact_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Burn Address</span>
                <span className="text-zinc-800 text-right max-w-[60%]">{permit.burn_address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Burn Date</span>
                <span className="text-zinc-800">{formatDate(permit.burn_date)}</span>
              </div>
              {permit.status === 'approved' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Date Issued</span>
                    <span className="text-zinc-800">{formatDate(permit.issued_date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Permit Expires</span>
                    <span className="text-zinc-800 font-semibold">{formatDate(permit.permit_expiry_date)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Approved — signature flow (not shown if expired) */}
          {permit.status === 'approved' && (() => {
            const isExpired = !!permit.permit_expiry_date &&
              new Date(permit.permit_expiry_date + 'T23:59:59') < new Date()

            if (isExpired) {
              return (
                <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-center">
                  <p className="text-sm font-semibold text-red-800">This permit has expired</p>
                  <p className="text-xs text-red-600 mt-1">Expired {formatDate(permit.permit_expiry_date)}. Contact the department if you need a renewal.</p>
                </div>
              )
            }

            const applicantDone = !!(permit.applicant_signed_at || permit.applicant_acknowledged_at)

            // Officer hasn't signed yet
            if (!permit.officer_signed_at) {
              return (
                <div className="rounded-xl bg-zinc-50 border border-zinc-200 px-5 py-4 text-center">
                  <p className="text-sm text-zinc-500">Your permit has been approved. The department officer is completing their signature — check back shortly.</p>
                </div>
              )
            }

            // Applicant still needs to act
            if (!applicantDone) {
              return (
                <ApplicantSignatureSection
                  confirmationCode={permit.confirmation_code}
                  departmentId={dept.id}
                  contactName={permit.contact_name}
                  slug={slug}
                />
              )
            }

            // Both done — show print button
            return (
              <a
                href={`/dept/${slug}/permit-print?code=${permit.confirmation_code}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full rounded-xl bg-red-700 px-4 py-3.5 text-sm font-semibold text-white hover:bg-red-800 transition-colors text-center block"
              >
                Print My Permit ↗
              </a>
            )
          })()}
        </div>
      )}
    </div>
  )
}
