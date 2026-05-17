import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import DeptInspectionSettingsClient from './DeptInspectionSettingsClient'

export default async function DeptInspectionSettingsPage() {
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
    .select('inspection_session_duration_hours')
    .eq('id', myDept.department_id)
  const dept = deptList?.[0]

  return (
    <div className="pt-20 px-4 pb-4 sm:pt-0 sm:p-6 lg:p-8 max-w-2xl">
      <DeptInspectionSettingsClient
        departmentId={myDept.department_id}
        inspection_session_duration_hours={dept?.inspection_session_duration_hours ?? 12}
      />
    </div>
  )
}
