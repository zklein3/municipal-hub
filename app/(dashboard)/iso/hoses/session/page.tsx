import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import HoseTestSessionClient from './HoseTestSessionClient'

export default async function HoseTestSessionPage() {
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

  const { data: deptFlags } = await adminClient.from('departments').select('module_iso').eq('id', myDept.department_id).single()
  if (!deptFlags?.module_iso) redirect('/dashboard')

  const isOfficerOrAbove = myDept.system_role === 'admin' || myDept.system_role === 'officer' || me.is_sys_admin
  if (!isOfficerOrAbove) redirect('/iso/hoses')

  const { data: hosesRaw } = await adminClient
    .from('hoses')
    .select('id, hose_identifier, hose_type, diameter_in, length_ft, status')
    .eq('department_id', myDept.department_id)
    .eq('status', 'in_service')
    .order('hose_identifier')

  const testerName = `${me.first_name} ${me.last_name}`

  return (
    <HoseTestSessionClient
      hoses={hosesRaw ?? []}
      testerName={testerName}
    />
  )
}
