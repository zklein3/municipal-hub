import { redirect } from 'next/navigation'
import { getCurrentPath } from '@/lib/current-path'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { hasPermission } from '@/lib/permissions'
import { getOrCreateInspectionSession, getInspectionSessionById } from '@/app/actions/inspections'
import { formatLocalDateTime } from '@/lib/format-datetime'
import { lastVehicleCheck, truckRestockCount } from '@/lib/rig-check-status'
import InspectionSessionClient from './InspectionSessionClient'

export default async function InspectionSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ session?: string }>
}) {
  const { id: apparatus_id } = await params
  const { session: requestedSessionId } = await searchParams
  const adminClient = createAdminClient()

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (ctx.hasMultipleDepartments && !ctx.departmentId) redirect(`/select-department?next=${encodeURIComponent(await getCurrentPath())}`)
  if (!ctx.departmentId) redirect('/dashboard')
  const me = { id: ctx.personnelId }

  const isOfficerOrAdmin = await hasPermission(ctx, 'manage_inspection_sessions')

  const { data: appList } = await adminClient
    .from('apparatus')
    .select('id, unit_number, apparatus_name')
    .eq('id', apparatus_id)
    .eq('department_id', ctx.departmentId)
  const apparatus = appList?.[0]
  if (!apparatus) redirect('/inspections')

  const { data: personnelList } = await adminClient
    .from('department_personnel')
    .select('personnel_id')
    .eq('personnel_id', me.id)
    .eq('department_id', ctx.departmentId)
    .limit(1)
  const personnelId = personnelList?.[0]?.personnel_id ?? me.id

  // Coming back from a compartment submit, show that session — even if the submit just completed it —
  // rather than getOrCreate, which would start a fresh empty session once the last compartment is done.
  const requested = requestedSessionId ? await getInspectionSessionById(requestedSessionId, apparatus_id) : null
  const result = requested && !('error' in requested) ? requested : await getOrCreateInspectionSession(apparatus_id)
  if ('error' in result) redirect('/inspections')
  const [vehicleCheck, restockCount] = await Promise.all([
    lastVehicleCheck(adminClient, apparatus_id, ctx.departmentTimezone),
    truckRestockCount(adminClient, apparatus_id),
  ])

  return (
    <div className="pt-20 px-4 pb-4 sm:pt-0 sm:p-6 lg:p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900">
          Inspection Session — {apparatus.unit_number || apparatus.apparatus_name}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Started {formatLocalDateTime(result.session.started_at, ctx.departmentTimezone, { dateStyle: 'medium', timeStyle: 'short' })}
          {' · '}Expires {formatLocalDateTime(result.session.expires_at, ctx.departmentTimezone, { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      </div>

      <InspectionSessionClient
        session={result.session}
        compartments={result.compartments}
        apparatus_id={apparatus_id}
        apparatus_unit_number={apparatus.unit_number}
        personnel_id={personnelId}
        isOfficerOrAdmin={isOfficerOrAdmin}
        departmentTimezone={ctx.departmentTimezone}
        vehicleCheck={vehicleCheck}
        restockCount={restockCount}
      />
    </div>
  )
}
