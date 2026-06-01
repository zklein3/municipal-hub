import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import NewEventClient from './NewEventClient'

export default async function NewEventPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: meList } = await adminClient.from('personnel').select('id, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) redirect('/login')

  const { data: myDeptList } = await adminClient.from('department_personnel').select('department_id, system_role').eq('personnel_id', me.id).eq('active', true)
  const myDept = myDeptList?.[0]
  const isOfficerOrAbove = myDept?.system_role === 'admin' || myDept?.system_role === 'officer' || me.is_sys_admin
  if (!isOfficerOrAbove) redirect('/events')

  const { data: certTypes } = await adminClient
    .from('certification_types')
    .select('id, cert_name')
    .eq('department_id', myDept!.department_id)
    .eq('active', true)
    .order('cert_name')

  return <NewEventClient certTypes={certTypes ?? []} />
}
