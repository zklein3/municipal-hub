import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ApplicantSignatureSection from '../permit-status/ApplicantSignatureSection'

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
function formatDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const PERMIT_STATUS_STYLES: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved:  'bg-green-100 text-green-800 border-green-200',
  denied:    'bg-red-100 text-red-800 border-red-200',
  cancelled: 'bg-zinc-100 text-zinc-600 border-zinc-200',
}
const PERMIT_STATUS_LABELS: Record<string, string> = {
  pending: 'Under Review', approved: 'Approved', denied: 'Denied', cancelled: 'Cancelled',
}
const RECORD_STATUS_STYLES: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-800 border-yellow-200',
  in_review: 'bg-blue-100 text-blue-800 border-blue-200',
  fulfilled: 'bg-green-100 text-green-800 border-green-200',
  denied:    'bg-red-100 text-red-800 border-red-200',
}
const RECORD_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending Review', in_review: 'Under Review', fulfilled: 'Fulfilled', denied: 'Denied',
}
const REQUEST_TYPE_LABELS: Record<string, string> = {
  incident_report: 'Incident Report', inspection_record: 'Inspection Record', other: 'Other',
}

export default async function RequestStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ q?: string; code?: string }>
}) {
  const { slug } = await params
  const sp = await searchParams
  // q is the unified search param; code is legacy (from approval email links)
  const q = sp.q ?? sp.code ?? ''

  const adminClient = createAdminClient()

  const { data: deptList } = await adminClient
    .from('departments')
    .select('id, name, public_site_enabled')
    .eq('public_slug', slug)
    .limit(1)

  const dept = deptList?.[0]
  if (!dept || !dept.public_site_enabled) notFound()

  const base = `/dept/${slug}`

  // ── Empty form ────────────────────────────────────────────────────────────
  if (!q.trim()) {
    return (
      <div className="max-w-md">
        <div className="mb-6">
          <Link href={base} className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">← Back</Link>
          <h1 className="text-2xl font-bold text-zinc-900 mt-2">Status Center</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{dept.name}</p>
        </div>

        <form method="GET" className="rounded-xl bg-white border border-zinc-200 p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Confirmation Code or Your Name
            </label>
            <input
              name="q"
              type="text"
              required
              autoComplete="off"
              placeholder="e.g. A3F92B1C or John Smith"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <p className="mt-1 text-xs text-zinc-400">
              Enter your confirmation code for an exact match, or type your name to see all matching requests.
            </p>
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 transition-colors"
          >
            Check Status
          </button>
        </form>
      </div>
    )
  }

  const normalizedCode = q.toUpperCase().trim()
  const nameQuery = q.trim()

  // ── Step 1: try exact code match ──────────────────────────────────────────
  const [{ data: permit }, { data: recordRequest }] = await Promise.all([
    adminClient
      .from('burn_permits')
      .select('id, contact_name, burn_address, burn_date, status, reviewer_notes, permit_expiry_date, issued_date, confirmation_code, department_id, officer_signed_at, applicant_signed_at, applicant_acknowledged_at')
      .eq('confirmation_code', normalizedCode)
      .eq('department_id', dept.id)
      .maybeSingle(),
    adminClient
      .from('public_record_requests')
      .select('id, contact_name, contact_email, request_type, description, incident_date, incident_address, status, reviewer_notes, confirmation_code, created_at')
      .eq('confirmation_code', normalizedCode)
      .eq('department_id', dept.id)
      .maybeSingle(),
  ])

  // ── Step 2: if no code match, try name search ─────────────────────────────
  let namePermits: any[] = []
  let nameRecords: any[] = []
  const isNameSearch = !permit && !recordRequest

  if (isNameSearch) {
    // Split into words so "Zachary Klein" matches "Zachary Adam Klein" — each word must appear
    const words = nameQuery.trim().split(/\s+/).filter(Boolean)

    let permitsQuery = adminClient
      .from('burn_permits')
      .select('id, contact_name, burn_address, burn_date, status, confirmation_code, created_at')
      .eq('department_id', dept.id)
      .order('created_at', { ascending: false })
      .limit(15)
    for (const word of words) permitsQuery = permitsQuery.ilike('contact_name', `%${word}%`)

    let recordsQuery = adminClient
      .from('public_record_requests')
      .select('id, contact_name, request_type, description, status, confirmation_code, created_at')
      .eq('department_id', dept.id)
      .order('created_at', { ascending: false })
      .limit(15)
    for (const word of words) recordsQuery = recordsQuery.ilike('contact_name', `%${word}%`)

    const [{ data: np }, { data: nr }] = await Promise.all([permitsQuery, recordsQuery])
    namePermits = np ?? []
    nameRecords = nr ?? []
  }

  const hasNameResults = namePermits.length > 0 || nameRecords.length > 0

  // ── Header ────────────────────────────────────────────────────────────────
  const header = (
    <div className="mb-6">
      <Link href={`${base}/request-status`} className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">← Search Again</Link>
      <h1 className="text-2xl font-bold text-zinc-900 mt-2">Status Center</h1>
      <p className="text-sm text-zinc-500 mt-0.5">{dept.name}</p>
    </div>
  )

  // ── Nothing found ─────────────────────────────────────────────────────────
  if (!permit && !recordRequest && !hasNameResults) {
    return (
      <div className="max-w-lg">
        {header}
        <div className="rounded-xl bg-white border border-zinc-200 p-8 text-center">
          <p className="text-sm font-medium text-zinc-700 mb-1">Nothing found</p>
          <p className="text-xs text-zinc-400">
            No burn permits or records requests matched <span className="font-mono">{q}</span>.
          </p>
          <p className="text-xs text-zinc-400 mt-1">Double-check your spelling or confirmation code and try again.</p>
        </div>
      </div>
    )
  }

  // ── Name search results list ───────────────────────────────────────────────
  if (isNameSearch && hasNameResults) {
    const totalResults = namePermits.length + nameRecords.length
    return (
      <div className="max-w-lg">
        {header}
        <p className="text-xs text-zinc-500 mb-3">
          {totalResults} result{totalResults !== 1 ? 's' : ''} matching <span className="font-medium text-zinc-700">&ldquo;{nameQuery}&rdquo;</span>
        </p>
        <div className="flex flex-col gap-3">
          {namePermits.map(p => (
            <div key={p.id} className="rounded-xl bg-white border border-zinc-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="rounded-full bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5">Burn Permit</span>
                    <span className={`rounded-full text-xs font-semibold px-2 py-0.5 border ${PERMIT_STATUS_STYLES[p.status] ?? 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
                      {PERMIT_STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-zinc-900">{p.contact_name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{p.burn_address}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Burn date: {formatDate(p.burn_date)} · Submitted {formatDateTime(p.created_at)}</p>
                </div>
                <Link
                  href={`${base}/request-status?q=${p.confirmation_code}`}
                  className="shrink-0 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 transition-colors"
                >
                  View →
                </Link>
              </div>
            </div>
          ))}
          {nameRecords.map(r => (
            <div key={r.id} className="rounded-xl bg-white border border-zinc-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="rounded-full bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5">Records Request</span>
                    <span className={`rounded-full text-xs font-semibold px-2 py-0.5 border ${RECORD_STATUS_STYLES[r.status] ?? 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
                      {RECORD_STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-zinc-900">{r.contact_name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{REQUEST_TYPE_LABELS[r.request_type] ?? r.request_type}</p>
                  <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{r.description}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Submitted {formatDateTime(r.created_at)}</p>
                </div>
                <Link
                  href={`${base}/request-status?q=${r.confirmation_code}`}
                  className="shrink-0 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 transition-colors"
                >
                  View →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Exact code match — detail view ────────────────────────────────────────
  return (
    <div className="max-w-lg">
      {header}

      {permit ? (
        <div className="flex flex-col gap-4">
          <div className={`rounded-xl border p-5 ${PERMIT_STATUS_STYLES[permit.status] ?? 'bg-zinc-50 border-zinc-200'}`}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Burn Permit</p>
              <span className="text-xs font-mono opacity-60">{permit.confirmation_code}</span>
            </div>
            <p className="text-2xl font-bold">{PERMIT_STATUS_LABELS[permit.status] ?? permit.status}</p>
            {permit.status === 'pending' && (
              <p className="text-xs mt-1 opacity-70">Your permit is being reviewed by the department. Check back soon.</p>
            )}
            {permit.status === 'denied' && permit.reviewer_notes && (
              <p className="text-xs mt-2 opacity-80"><strong>Note from department:</strong> {permit.reviewer_notes}</p>
            )}
          </div>

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

          {permit.status === 'approved' && (() => {
            const applicantDone = !!(permit.applicant_signed_at || permit.applicant_acknowledged_at)
            if (!permit.officer_signed_at) {
              return (
                <div className="rounded-xl bg-zinc-50 border border-zinc-200 px-5 py-4 text-center">
                  <p className="text-sm text-zinc-500">Your permit has been approved. The department officer is completing their signature — check back shortly.</p>
                </div>
              )
            }
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

      ) : recordRequest ? (
        <div className="flex flex-col gap-4">
          <div className={`rounded-xl border p-5 ${RECORD_STATUS_STYLES[recordRequest.status] ?? 'bg-zinc-50 border-zinc-200'}`}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Records Request</p>
              <span className="text-xs font-mono opacity-60">{recordRequest.confirmation_code}</span>
            </div>
            <p className="text-2xl font-bold">{RECORD_STATUS_LABELS[recordRequest.status] ?? recordRequest.status}</p>
            {recordRequest.status === 'pending' && (
              <p className="text-xs mt-1 opacity-70">Your request is pending review. A department representative will contact you at the email you provided.</p>
            )}
            {recordRequest.status === 'in_review' && (
              <p className="text-xs mt-1 opacity-70">A department representative is reviewing your request.</p>
            )}
            {(recordRequest.status === 'fulfilled' || recordRequest.status === 'denied') && recordRequest.reviewer_notes && (
              <p className="text-xs mt-2 opacity-80"><strong>Note from department:</strong> {recordRequest.reviewer_notes}</p>
            )}
          </div>

          <div className="rounded-xl bg-white border border-zinc-200 p-5">
            <h2 className="text-sm font-semibold text-zinc-800 mb-3">Request Details</h2>
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Requested By</span>
                <span className="text-zinc-800 font-medium">{recordRequest.contact_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Request Type</span>
                <span className="text-zinc-800">{REQUEST_TYPE_LABELS[recordRequest.request_type] ?? recordRequest.request_type}</span>
              </div>
              {recordRequest.incident_date && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">Incident Date</span>
                  <span className="text-zinc-800">{formatDate(recordRequest.incident_date)}</span>
                </div>
              )}
              {recordRequest.incident_address && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">Incident Address</span>
                  <span className="text-zinc-800 text-right max-w-[60%]">{recordRequest.incident_address}</span>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <span className="text-zinc-400 shrink-0">Description</span>
                <span className="text-zinc-800 text-right">{recordRequest.description}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
