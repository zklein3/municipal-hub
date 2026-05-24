import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import IncidentDetailClient from './IncidentDetailClient'
import Link from 'next/link'

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: meList } = await adminClient.from('personnel').select('id, first_name, last_name, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) redirect('/login')

  const { data: myDeptList } = await adminClient.from('department_personnel').select('department_id, system_role').eq('personnel_id', me.id).eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept) redirect('/dashboard')

  const department_id = myDept.department_id
  const isOfficerOrAbove = myDept.system_role === 'admin' || myDept.system_role === 'officer'

  // Incident
  const { data: incident } = await adminClient
    .from('incidents')
    .select('*')
    .eq('id', id)
    .eq('department_id', department_id)
    .single()

  if (!incident) notFound()

  // Apparatus on incident
  const { data: incidentApparatus } = await adminClient
    .from('incident_apparatus')
    .select('id, apparatus_id, role, paged_at, enroute_at, on_scene_at, leaving_scene_at, available_at')
    .eq('incident_id', id)
    .order('created_at')

  // Personnel on incident
  const { data: incidentPersonnel } = await adminClient
    .from('incident_personnel')
    .select('id, personnel_id, apparatus_id, role, status, rejection_reason, submitted_by, verified_by, verified_at')
    .eq('incident_id', id)
    .order('created_at')

  // Fire details
  const { data: fireDetails } = await adminClient
    .from('incident_fire_details')
    .select('*')
    .eq('incident_id', id)
    .maybeSingle()

  // Names for personnel
  const personnelIds = [...new Set([
    ...(incidentPersonnel ?? []).map(p => p.personnel_id),
    ...(incidentPersonnel ?? []).map(p => p.submitted_by).filter(Boolean),
    ...(incidentPersonnel ?? []).map(p => p.verified_by).filter(Boolean),
    incident.created_by,
    incident.finalized_by,
  ].filter(Boolean))]

  const { data: personnelRaw } = personnelIds.length > 0
    ? await adminClient.from('personnel').select('id, first_name, last_name').in('id', personnelIds)
    : { data: [] }
  const personnelNameMap = Object.fromEntries((personnelRaw ?? []).map(p => [p.id, `${p.first_name} ${p.last_name}`]))

  // Apparatus names
  const apparatusIds = [...new Set([
    ...(incidentApparatus ?? []).map(a => a.apparatus_id),
    ...(incidentPersonnel ?? []).map(p => p.apparatus_id).filter(Boolean),
  ])]
  const { data: apparatusRaw } = apparatusIds.length > 0
    ? await adminClient.from('apparatus').select('id, unit_number').in('id', apparatusIds)
    : { data: [] }
  const apparatusNameMap = Object.fromEntries((apparatusRaw ?? []).map(a => [a.id, a.unit_number]))

  // Dept apparatus list for adding
  const { data: deptApparatus } = await adminClient
    .from('apparatus')
    .select('id, unit_number')
    .eq('department_id', department_id)
    .eq('active', true)
    .order('unit_number')

  // Dept personnel list for adding
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

  // Mutual aid entries
  const { data: mutualAid } = await adminClient
    .from('incident_mutual_aid')
    .select('id, external_department_name, role, apparatus_description, personnel_count, arrival_time, departure_time, notes')
    .eq('incident_id', id)
    .order('created_at')

  // NERIS record (if started) + dept NERIS flag
  const [{ data: nerisRecord }, { data: deptFlagsList }] = await Promise.all([
    adminClient.from('incident_neris').select('id, neris_status, completed_at, neris_submission_id').eq('incident_id', id).maybeSingle(),
    adminClient.from('departments').select('module_neris').eq('id', department_id),
  ])
  const moduleNeris = deptFlagsList?.[0]?.module_neris ?? false

  // Signature roster (officers/admins only)
  let signatureRoster: { sig_id: string; personnel_id: string; signed_at: string | null; has_signature: boolean; name: string }[] = []
  if (isOfficerOrAbove) {
    const { data: sigs } = await adminClient
      .from('incident_signatures')
      .select('id, personnel_id, signed_at, signature_data')
      .eq('incident_id', id)
    if (sigs && sigs.length > 0) {
      const sigPersonnelIds = sigs.map(s => s.personnel_id)
      const { data: sigPersonnel } = await adminClient
        .from('personnel')
        .select('id, first_name, last_name')
        .in('id', sigPersonnelIds)
      const sigPersonnelMap = Object.fromEntries((sigPersonnel ?? []).map(p => [p.id, `${p.first_name} ${p.last_name}`.trim()]))
      signatureRoster = sigs.map(s => ({
        sig_id: s.id,
        personnel_id: s.personnel_id,
        signed_at: s.signed_at,
        has_signature: !!s.signature_data,
        name: sigPersonnelMap[s.personnel_id] ?? '—',
      }))
      signatureRoster.sort((a, b) => {
        if (a.signed_at && !b.signed_at) return -1
        if (!a.signed_at && b.signed_at) return 1
        return a.name.localeCompare(b.name)
      })
    }
  }

  // Accountability summary (count only — board is on its own page)
  const { count: acctCount } = await adminClient
    .from('incident_accountability')
    .select('id', { count: 'exact', head: true })
    .eq('incident_id', id)

  return (
    <div>
    <IncidentDetailClient
      incident={incident}
      incidentApparatus={(incidentApparatus ?? []).map(a => ({
        ...a,
        unit_number: apparatusNameMap[a.apparatus_id] ?? '—',
      }))}
      incidentPersonnel={(incidentPersonnel ?? []).map(p => ({
        ...p,
        name: personnelNameMap[p.personnel_id] ?? '—',
        apparatus_unit: p.apparatus_id ? (apparatusNameMap[p.apparatus_id] ?? '—') : null,
        submitted_by_name: p.submitted_by ? (personnelNameMap[p.submitted_by] ?? '—') : null,
      }))}
      fireDetails={fireDetails}
      personnelNameMap={personnelNameMap}
      deptApparatus={deptApparatus ?? []}
      deptPersonnel={deptPersonnel}
      isOfficerOrAbove={isOfficerOrAbove}
      myPersonnelId={me.id}
      mutualAid={mutualAid ?? []}
      nerisRecord={nerisRecord ?? null}
      moduleNeris={moduleNeris}
      signatureRoster={signatureRoster}
    />
    <div className="mt-5 mb-8">
      <Link href={`/incidents/${id}/accountability`}
        className="flex items-center justify-between rounded-xl bg-white border border-zinc-200 px-5 py-4 hover:bg-zinc-50 transition-colors shadow-sm">
        <div>
          <p className="text-sm font-semibold text-zinc-900">Accountability Board</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {(acctCount ?? 0) > 0 ? `${acctCount} on scene` : 'Not started'}
          </p>
        </div>
        <span className="text-zinc-400 text-lg">→</span>
      </Link>
    </div>
    </div>
  )
}
