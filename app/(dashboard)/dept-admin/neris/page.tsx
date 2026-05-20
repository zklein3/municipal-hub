import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import NerisSettingsClient from './NerisSettingsClient'

export default async function DeptNerisSettingsPage() {
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
  if (!myDept || (myDept.system_role !== 'admin' && !me.is_sys_admin)) redirect('/dashboard')

  const { data: deptList } = await adminClient
    .from('departments')
    .select('module_neris, neris_entity_id')
    .eq('id', myDept.department_id)
  const dept = deptList?.[0]

  if (!dept?.module_neris) redirect('/dashboard')

  const clientId = process.env.NERIS_CLIENT_ID ?? null

  return (
    <div className="max-w-2xl">
      <NerisSettingsClient
        departmentId={myDept.department_id}
        nerisEntityId={dept.neris_entity_id ?? null}
        clientId={clientId}
      />
    </div>
  )
}
