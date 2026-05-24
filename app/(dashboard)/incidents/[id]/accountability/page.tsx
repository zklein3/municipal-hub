import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'

export default async function IncidentAccountabilityRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: meList } = await adminClient.from('personnel').select('id').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) redirect('/login')

  const { data: myDeptList } = await adminClient
    .from('department_personnel').select('department_id')
    .eq('personnel_id', me.id).eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept) redirect('/dashboard')

  // Verify incident belongs to this dept
  const { data: incList } = await adminClient
    .from('incidents').select('id').eq('id', id).eq('department_id', myDept.department_id)
  if (!incList?.[0]) notFound()

  // Look for an existing board linked to this incident
  const { data: boards } = await adminClient
    .from('accountability_boards')
    .select('id')
    .eq('department_id', myDept.department_id)
    .eq('linked_incident_id', id)
    .order('created_at', { ascending: false })
    .limit(1)

  if (boards?.[0]) {
    redirect(`/accountability/${boards[0].id}`)
  } else {
    redirect(`/accountability/new?incident_id=${id}`)
  }
}
