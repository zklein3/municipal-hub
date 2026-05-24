import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import HubCard from '@/components/HubCard'

export default async function OperationsPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: meList } = await adminClient.from('personnel').select('id, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) redirect('/login')

  const { data: myDeptList } = await adminClient
    .from('department_personnel')
    .select('department_id, system_role')
    .eq('personnel_id', me.id)
    .eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept) redirect('/dashboard')

  const departmentId = myDept.department_id
  const isOfficerOrAbove = myDept.system_role === 'admin' || myDept.system_role === 'officer'

  const { data: deptFlags } = await adminClient
    .from('departments')
    .select('module_operations, public_site_enabled')
    .eq('id', departmentId)
    .single()

  const moduleOperations = (deptFlags as any)?.module_operations ?? false
  const publicSiteEnabled = (deptFlags as any)?.public_site_enabled ?? false

  const [
    { data: allAnnouncements },
    { data: readIds },
    permitsResult,
    requestsResult,
    incidentsResult,
    { count: pendingSigCount },
  ] = await Promise.all([
    adminClient.from('announcements').select('id').eq('department_id', departmentId),
    adminClient.from('announcement_reads').select('announcement_id').eq('personnel_id', me.id),
    isOfficerOrAbove && publicSiteEnabled
      ? adminClient.from('burn_permits').select('id', { count: 'exact', head: true }).eq('department_id', departmentId).eq('status', 'pending')
      : Promise.resolve({ count: 0, data: null, error: null }),
    isOfficerOrAbove && publicSiteEnabled
      ? adminClient.from('public_record_requests').select('id', { count: 'exact', head: true }).eq('department_id', departmentId).eq('status', 'pending')
      : Promise.resolve({ count: 0, data: null, error: null }),
    moduleOperations
      ? adminClient.from('incidents')
          .select('id, incident_number, incident_type, incident_date, address, city')
          .eq('department_id', departmentId)
          .order('incident_date', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [], error: null }),
    adminClient.from('incident_signatures')
      .select('id', { count: 'exact', head: true })
      .eq('personnel_id', me.id)
      .is('signed_at', null),
  ])

  const readSet = new Set((readIds ?? []).map((r: { announcement_id: string }) => r.announcement_id))
  const unreadCount = (allAnnouncements ?? []).filter(a => !readSet.has(a.id)).length
  const pendingInboxCount = ((permitsResult as any).count ?? 0) + ((requestsResult as any).count ?? 0)
  const pendingSignatures = pendingSigCount ?? 0
  const totalInboxCount = pendingInboxCount + pendingSignatures
  const recentIncidents = (incidentsResult as any).data ?? []

  function formatIncidentDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">Operations</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Incidents, announcements, and daily activity</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {moduleOperations && (
          <HubCard
            title="Incidents"
            description="Log and manage incident reports"
            href="/incidents"
            stat={recentIncidents.length > 0 ? recentIncidents.length : null}
            statLabel="Recent"
          />
        )}
        {moduleOperations && (
          <HubCard
            title="Accountability"
            description="Scan cards, assign lanes, and run PAR checks"
            href="/accountability"
          />
        )}
        <HubCard
          title="Announcements"
          description="Department-wide messages and notices"
          href="/announcements"
          stat={unreadCount > 0 ? unreadCount : null}
          statLabel="Unread"
          alert={unreadCount > 0}
        />
        <HubCard
          title="Fuel Log"
          description="Log and review apparatus fuel entries"
          href="/fuel"
        />
        <HubCard
          title="Inbox"
          description={isOfficerOrAbove ? 'Signatures, burn permits, and records requests' : 'Pending run signatures'}
          href="/inbox"
          stat={totalInboxCount > 0 ? totalInboxCount : null}
          statLabel={pendingSignatures > 0 && !isOfficerOrAbove ? `${pendingSignatures} signature${pendingSignatures !== 1 ? 's' : ''}` : 'Pending'}
          alert={totalInboxCount > 0}
        />
      </div>

      {moduleOperations && recentIncidents.length > 0 && (
        <div className="rounded-xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Recent Incidents</h2>
            <Link href="/incidents" className="text-xs font-semibold text-red-600 hover:text-red-800">
              All Incidents →
            </Link>
          </div>
          <div className="divide-y divide-zinc-100">
            {recentIncidents.map((inc: {
              id: string
              incident_number: string
              incident_type: string
              incident_date: string
              address: string | null
              city: string | null
            }) => (
              <Link
                key={inc.id}
                href={`/incidents/${inc.id}`}
                className="flex items-center px-5 py-3 gap-3 hover:bg-zinc-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">{inc.incident_number}</p>
                  <p className="text-xs text-zinc-400 mt-0.5 truncate">
                    {inc.incident_type}{inc.address ? ` · ${inc.address}` : ''}{inc.city ? `, ${inc.city}` : ''}
                  </p>
                </div>
                <p className="text-xs text-zinc-400 shrink-0">{formatIncidentDate(inc.incident_date)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
