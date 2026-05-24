import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import AccountabilityBoard from '../AccountabilityBoard'

export default async function IncidentAccountabilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: meList } = await adminClient.from('personnel').select('id, first_name, last_name').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) redirect('/login')

  const { data: myDeptList } = await adminClient
    .from('department_personnel').select('department_id, system_role')
    .eq('personnel_id', me.id).eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept) redirect('/dashboard')

  const department_id = myDept.department_id
  const isOfficerOrAbove = myDept.system_role === 'admin' || myDept.system_role === 'officer'

  const { data: incident } = await adminClient
    .from('incidents').select('id, incident_number, incident_date, address, city')
    .eq('id', id).eq('department_id', department_id).single()
  if (!incident) notFound()

  // Accountability lanes + roster
  const { data: acctLanes } = await adminClient
    .from('incident_accountability_lanes')
    .select('id, name, sort_order')
    .eq('incident_id', id)
    .order('sort_order')

  const { data: acctEntriesRaw } = await adminClient
    .from('incident_accountability')
    .select('id, lane_id, personnel_id, raw_name, raw_dept, status, checked_in_at')
    .eq('incident_id', id)
    .order('checked_in_at')

  const acctPersonnelIds = [...new Set((acctEntriesRaw ?? []).map(e => e.personnel_id).filter(Boolean))]
  const { data: acctPersonnelRaw } = acctPersonnelIds.length > 0
    ? await adminClient.from('personnel').select('id, first_name, last_name').in('id', acctPersonnelIds)
    : { data: [] }
  const acctNameMap = Object.fromEntries((acctPersonnelRaw ?? []).map(p => [p.id, `${p.first_name} ${p.last_name}`]))

  const acctEntries = (acctEntriesRaw ?? []).map(e => ({
    ...e,
    display_name: e.personnel_id ? (acctNameMap[e.personnel_id] ?? '—') : (e.raw_name ?? '—'),
    display_dept: e.personnel_id ? '' : (e.raw_dept ?? ''),
  }))

  // Dept personnel
  const { data: deptPersonnelRaw } = await adminClient
    .from('department_personnel')
    .select('personnel_id, personnel(id, first_name, last_name)')
    .eq('department_id', department_id)
    .eq('active', true)
  const deptPersonnel = (deptPersonnelRaw ?? [])
    .map(p => ({
      id: (p.personnel as any)?.id ?? p.personnel_id,
      name: [(p.personnel as any)?.first_name, (p.personnel as any)?.last_name].filter(Boolean).join(' '),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // QR tokens for card lookup
  const { data: qrTokensRaw } = await adminClient
    .from('personnel_qr_tokens')
    .select('personnel_id, token_type, token_value')
    .in('personnel_id', deptPersonnel.map(p => p.id))
  const qrTokens = (qrTokensRaw ?? []).map(t => ({
    ...t,
    display_name: deptPersonnel.find(p => p.id === t.personnel_id)?.name ?? '—',
  }))

  const location = [incident.address, incident.city].filter(Boolean).join(', ')

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-4">
        <Link href={`/incidents/${id}`}
          className="rounded-lg bg-white border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm shrink-0">
          ← Incident
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-zinc-900 truncate">
            Accountability — {incident.incident_number}
          </h1>
          {location && <p className="text-xs text-zinc-500 truncate">{location}</p>}
        </div>
      </div>

      <AccountabilityBoard
        incidentId={id}
        initialLanes={acctLanes ?? []}
        initialEntries={acctEntries}
        qrTokens={qrTokens}
        deptPersonnel={deptPersonnel}
        isOfficerOrAbove={isOfficerOrAbove}
      />
    </div>
  )
}
