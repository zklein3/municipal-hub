import { redirect } from 'next/navigation'
import { getCurrentPath } from '@/lib/current-path'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentDepartmentContext } from '@/lib/current-department'
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
  const adminClient = createAdminClient()

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (ctx.hasMultipleDepartments && !ctx.departmentId) redirect(`/select-department?next=${encodeURIComponent(await getCurrentPath())}`)
  if (!ctx.departmentId) redirect('/dashboard')
  const me = { id: ctx.personnelId, first_name: ctx.firstName, last_name: ctx.lastName }

  const { data: appList } = await adminClient
    .from('apparatus')
    .select('id, unit_number, apparatus_name, has_air_brakes, has_engine_hours, apparatus_type_id, station_id')
    .eq('id', apparatus_id)
    .eq('department_id', ctx.departmentId)
  const apparatus = appList?.[0]
  if (!apparatus) redirect('/inspections')

  const { data: typeList } = apparatus.apparatus_type_id
    ? await adminClient.from('apparatus_types').select('name').eq('id', apparatus.apparatus_type_id)
    : { data: [] }

  const { items } = await getVehicleCheckItems(ctx.departmentId)
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
        departmentId={ctx.departmentId}
        inspectorName={`${me.first_name} ${me.last_name}`}
        nextPath={nextPath}
      />
    </div>
  )
}
