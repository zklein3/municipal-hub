import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVehicleCheckItems, getVehicleCheckHistory } from '@/app/actions/inspections'
import VehicleCheckClient from './VehicleCheckClient'

export default async function VehicleCheckPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ next?: string }>
}) {
  const { id: apparatus_id } = await params
  const { next } = await searchParams
  const nextPath = next === 'inventory' ? `/inspections/apparatus/${apparatus_id}` : undefined
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: meList } = await adminClient.from('personnel').select('id, first_name, last_name, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) redirect('/login')

  const { data: myDeptList } = await adminClient
    .from('department_personnel')
    .select('department_id, system_role')
    .eq('personnel_id', me.id)
    .eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept) redirect('/dashboard')

  const { data: appList } = await adminClient
    .from('apparatus')
    .select('id, unit_number, apparatus_name, has_air_brakes, has_engine_hours, apparatus_type_id, station_id')
    .eq('id', apparatus_id)
    .eq('department_id', myDept.department_id)
  const apparatus = appList?.[0]
  if (!apparatus) redirect('/inspections')

  const { data: typeList } = apparatus.apparatus_type_id
    ? await adminClient.from('apparatus_types').select('name').eq('id', apparatus.apparatus_type_id)
    : { data: [] }

  const { items } = await getVehicleCheckItems(myDept.department_id)
  const { history } = await getVehicleCheckHistory(apparatus_id, 5)

  return (
    <div className="pt-20 px-4 pb-4 sm:pt-0 sm:p-6 lg:p-8">
      <VehicleCheckClient
        apparatus={{
          id: apparatus.id,
          unit_number: apparatus.unit_number,
          apparatus_name: apparatus.apparatus_name,
          type_name: typeList?.[0]?.name ?? null,
          has_air_brakes: apparatus.has_air_brakes ?? false,
          has_engine_hours: apparatus.has_engine_hours ?? true,
        }}
        items={items}
        history={history}
        personnelId={me.id}
        departmentId={myDept.department_id}
        inspectorName={`${me.first_name} ${me.last_name}`}
        nextPath={nextPath}
      />
    </div>
  )
}
