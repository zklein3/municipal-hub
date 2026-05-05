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
    .from('personnel').select('id, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) redirect('/login')

  const { data: myDeptList } = await adminClient
    .from('department_personnel').select('department_id, system_role').eq('personnel_id', me.id).eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept) redirect('/dashboard')
  if (myDept.system_role === 'member' && !me.is_sys_admin) redirect('/dashboard')

  const department_id = myDept.department_id

  // Fetch dept burn permit config
  const { data: deptConfig } = await adminClient
    .from('departments')
    .select('name, burn_permit_county_info, burn_permit_restrictions')
    .eq('id', department_id)
    .single()

  // Fetch burn permits for this department
  const { data: permitsRaw } = await adminClient
    .from('burn_permits')
    .select('id, confirmation_code, contact_name, contact_email, contact_phone, burn_address, burn_date, burn_description, status, reviewer_notes, permit_expiry_date, issued_date, approved_by_personnel_id, created_at')
    .eq('department_id', department_id)
    .order('created_at', { ascending: false })

  // Fetch record requests for this department
  const { data: requestsRaw } = await adminClient
    .from('public_record_requests')
    .select('id, confirmation_code, contact_name, contact_email, contact_phone, request_type, description, incident_date, incident_address, status, reviewer_notes, created_at')
    .eq('department_id', department_id)
    .order('created_at', { ascending: false })

  // Fetch approver names for permits that have been approved
  const approverIds = [...new Set((permitsRaw ?? []).map(p => p.approved_by_personnel_id).filter(Boolean))]
  const { data: approverData } = approverIds.length > 0
    ? await adminClient.from('personnel').select('id, first_name, last_name').in('id', approverIds)
    : { data: [] }
  const approverMap = Object.fromEntries(
    (approverData ?? []).map(p => [p.id, `${p.first_name} ${p.last_name}`])
  )

  const permits = (permitsRaw ?? []).map(p => ({
    ...p,
    approved_by_name: p.approved_by_personnel_id ? (approverMap[p.approved_by_personnel_id] ?? null) : null,
  }))

  return (
    <InboxClient
      permits={permits}
      requests={requestsRaw ?? []}
      initialTab={(tab === 'records' ? 'records' : 'permits')}
      deptName={deptConfig?.name ?? null}
      burnPermitCountyInfo={deptConfig?.burn_permit_county_info ?? null}
      burnPermitRestrictions={deptConfig?.burn_permit_restrictions ?? null}
    />
  )
}
