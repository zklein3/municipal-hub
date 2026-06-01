import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateInspectionSession } from '@/app/actions/inspections'
import InspectionSessionClient from './InspectionSessionClient'

export default async function InspectionSessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: apparatus_id } = await params
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
  if (!myDept) redirect('/dashboard')

  const isOfficerOrAdmin = myDept.system_role === 'admin' || myDept.system_role === 'officer' || me.is_sys_admin

  const { data: appList } = await adminClient
    .from('apparatus')
    .select('id, unit_number, apparatus_name')
    .eq('id', apparatus_id)
  const apparatus = appList?.[0]
  if (!apparatus) redirect('/inspections')

  const { data: personnelList } = await adminClient
    .from('department_personnel')
    .select('personnel_id')
    .eq('personnel_id', me.id)
    .eq('department_id', myDept.department_id)
    .limit(1)
  const personnelId = personnelList?.[0]?.personnel_id ?? me.id

  const result = await getOrCreateInspectionSession(apparatus_id)
  if ('error' in result) redirect('/inspections')

  return (
    <div className="pt-20 px-4 pb-4 sm:pt-0 sm:p-6 lg:p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900">
          Inspection Session — {apparatus.unit_number || apparatus.apparatus_name}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Started {new Date(result.session.started_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
          {' · '}Expires {new Date(result.session.expires_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      </div>

      <InspectionSessionClient
        session={result.session}
        compartments={result.compartments}
        apparatus_id={apparatus_id}
        apparatus_unit_number={apparatus.unit_number}
        personnel_id={personnelId}
        isOfficerOrAdmin={isOfficerOrAdmin}
      />
    </div>
  )
}
