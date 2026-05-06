import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import PublicInboxSettingsClient from './PublicInboxSettingsClient'

export default async function PublicInboxSettingsPage() {
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
  if (!myDept || myDept.system_role !== 'admin') redirect('/dashboard')

  const { data: dept } = await adminClient
    .from('departments')
    .select('public_site_enabled, burn_permit_county_info, burn_permit_restrictions')
    .eq('id', myDept.department_id)
    .single()

  if (!dept?.public_site_enabled) redirect('/dashboard')

  return (
    <PublicInboxSettingsClient
      departmentId={myDept.department_id}
      burn_permit_county_info={dept.burn_permit_county_info ?? null}
      burn_permit_restrictions={dept.burn_permit_restrictions ?? null}
    />
  )
}
