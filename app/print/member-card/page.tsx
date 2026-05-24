import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import MemberCardClient from './MemberCardClient'

export default async function MemberCardPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams

  if (!id) {
    return <p style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Missing member id.</p>
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()

  const { data: meList } = await adminClient
    .from('personnel')
    .select('id, is_sys_admin')
    .eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) redirect('/login')

  const { data: myDeptList } = await adminClient
    .from('department_personnel')
    .select('department_id, system_role')
    .eq('personnel_id', me.id)
    .eq('active', true)
  const myDept = myDeptList?.[0]

  const isOfficerOrAbove = me.is_sys_admin || myDept?.system_role === 'admin' || myDept?.system_role === 'officer'
  const isMe = me.id === id

  if (!isOfficerOrAbove && !isMe) redirect('/personnel')

  const { data: person } = await adminClient
    .from('personnel')
    .select('id, first_name, last_name')
    .eq('id', id)
    .single()
  if (!person) return <p style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Member not found.</p>

  const { data: deptRecordList } = await adminClient
    .from('department_personnel')
    .select('department_id, role_id, employee_number')
    .eq('personnel_id', id)
    .eq('active', true)
    .limit(1)
  const deptRecord = deptRecordList?.[0]

  const [deptResult, roleResult] = await Promise.all([
    deptRecord?.department_id
      ? adminClient.from('departments').select('name').eq('id', deptRecord.department_id).single()
      : Promise.resolve({ data: null }),
    deptRecord?.role_id
      ? adminClient.from('personnel_roles').select('name').eq('id', deptRecord.role_id).single()
      : Promise.resolve({ data: null }),
  ])

  const deptName = deptResult.data?.name ?? 'Fire Department'
  const roleName = roleResult.data?.name ?? 'Member'
  const fullName = `${person.first_name} ${person.last_name}`.trim()

  return (
    <MemberCardClient
      personnelId={person.id}
      name={fullName}
      deptName={deptName}
      role={roleName}
      employeeNumber={deptRecord?.employee_number ?? null}
    />
  )
}
