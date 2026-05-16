import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import PreplansClient from './PreplansClient'

export default async function PreplansPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: meList } = await adminClient.from('personnel').select('id, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) redirect('/login')

  const { data: myDeptList } = await adminClient.from('department_personnel').select('department_id, system_role').eq('personnel_id', me.id).eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept) redirect('/dashboard')

  const { data: deptFlags } = await adminClient.from('departments').select('module_iso').eq('id', myDept.department_id).single()
  if (!deptFlags?.module_iso) redirect('/dashboard')

  const isOfficerOrAbove = myDept.system_role === 'admin' || myDept.system_role === 'officer' || me.is_sys_admin

  const { data: preplans } = await adminClient
    .from('iso_preplans')
    .select('id, location_name, address, surveyed_date, document_path, notes, updated_at')
    .eq('department_id', myDept.department_id)
    .order('location_name')

  return <PreplansClient preplans={preplans ?? []} isOfficerOrAbove={isOfficerOrAbove} />
}
