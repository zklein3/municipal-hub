import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import InboxClient from './InboxClient'

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: meList } = await adminClient
    .from('personnel').select('id, first_name, last_name, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) redirect('/login')

  const { data: myDeptList } = await adminClient
    .from('department_personnel').select('department_id, system_role').eq('personnel_id', me.id).eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept) redirect('/dashboard')

  const department_id = myDept.department_id
  const isOfficerOrAbove = myDept.system_role === 'admin' || myDept.system_role === 'officer'

  // Pending signatures — all members
  const { data: pendingSigs } = await adminClient
    .from('incident_signatures')
    .select('id, incident_id, created_at')
    .eq('personnel_id', me.id)
    .is('signed_at', null)
    .order('created_at', { ascending: false })

  let signatureRows: any[] = []
  if ((pendingSigs ?? []).length > 0) {
    const incidentIds = (pendingSigs ?? []).map(s => s.incident_id)
    const { data: sigIncidents } = await adminClient
      .from('incidents')
      .select('id, incident_number, incident_date, incident_type, address, city, state')
      .in('id', incidentIds)
    const incidentMap = Object.fromEntries((sigIncidents ?? []).map(i => [i.id, i]))
    signatureRows = (pendingSigs ?? []).map(s => ({
      sig_id: s.id,
      incident_id: s.incident_id,
      created_at: s.created_at,
      incident: incidentMap[s.incident_id] ?? null,
    }))
  }

  // Officer+ data
  let permits: any[] = []
  let requestsRaw: any[] = []
  let deptConfig: any = null

  if (isOfficerOrAbove) {
    const [deptRes, permitsRes, recordsRes] = await Promise.all([
      adminClient.from('departments').select('name, burn_permit_county_info, burn_permit_restrictions').eq('id', department_id).single(),
      adminClient.from('burn_permits')
        .select('id, confirmation_code, contact_name, contact_email, contact_phone, burn_address, burn_date, burn_description, status, reviewer_notes, permit_expiry_date, issued_date, approved_by_personnel_id, officer_signed_at, created_at')
        .eq('department_id', department_id).order('created_at', { ascending: false }),
      adminClient.from('public_record_requests')
        .select('id, confirmation_code, contact_name, contact_email, contact_phone, request_type, description, incident_date, incident_address, status, reviewer_notes, created_at')
        .eq('department_id', department_id).order('created_at', { ascending: false }),
    ])
    deptConfig = deptRes.data
    const permitsRaw = permitsRes.data ?? []
    requestsRaw = recordsRes.data ?? []

    const approverIds = [...new Set(permitsRaw.map((p: any) => p.approved_by_personnel_id).filter(Boolean))]
    const { data: approverData } = approverIds.length > 0
      ? await adminClient.from('personnel').select('id, first_name, last_name').in('id', approverIds)
      : { data: [] }
    const approverMap = Object.fromEntries(
      (approverData ?? []).map((p: any) => [p.id, `${p.first_name} ${p.last_name}`])
    )
    permits = permitsRaw.map((p: any) => ({
      ...p,
      approved_by_name: p.approved_by_personnel_id ? (approverMap[p.approved_by_personnel_id] ?? null) : null,
    }))
  }

  const validTabs = ['permits', 'records', 'signatures']
  const initialTab = validTabs.includes(tab ?? '') ? tab! : (isOfficerOrAbove ? 'permits' : 'signatures')

  return (
    <InboxClient
      permits={permits}
      requests={requestsRaw}
      signatureRows={signatureRows}
      memberName={`${me.first_name} ${me.last_name}`.trim()}
      initialTab={initialTab as any}
      isOfficerOrAbove={isOfficerOrAbove}
      deptName={deptConfig?.name ?? null}
      burnPermitCountyInfo={deptConfig?.burn_permit_county_info ?? null}
      burnPermitRestrictions={deptConfig?.burn_permit_restrictions ?? null}
    />
  )
}
