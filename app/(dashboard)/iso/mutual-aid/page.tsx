import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import MutualAidClient from './MutualAidClient'

export default async function MutualAidPage() {
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

  const { data: agreements } = await adminClient
    .from('iso_mutual_aid_agreements')
    .select('id, partner_department, agreement_type, effective_date, expiration_date, active, notes, apparatus')
    .eq('department_id', myDept.department_id)
    .order('active', { ascending: false })
    .order('partner_department')

  return (
    <MutualAidClient
      agreements={agreements ?? []}
      isOfficerOrAbove={isOfficerOrAbove}
    />
  )
}
