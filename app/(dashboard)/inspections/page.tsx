import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentPath } from '@/lib/current-path'
import { redirect } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import InspectionsClient from './InspectionsClient'

export default async function InspectionsPage() {
  const adminClient = createAdminClient()

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (ctx.hasMultipleDepartments && !ctx.departmentId) redirect(`/select-department?next=${encodeURIComponent(await getCurrentPath())}`)
  if (!ctx.departmentId) redirect('/dashboard')

  // Round 1: all active apparatus for this department
  const { data: apparatusRaw } = await adminClient
    .from('apparatus')
    .select('id, unit_number, apparatus_name, station_id, apparatus_type_id')
    .eq('department_id', ctx.departmentId)
    .eq('active', true)
    .order('unit_number')

  const appIds = (apparatusRaw ?? []).map(a => a.id)
  const stationIds = (apparatusRaw ?? []).map((a: { station_id: string | null }) => a.station_id).filter(Boolean)
  const typeIds = (apparatusRaw ?? []).map((a: { apparatus_type_id: string | null }) => a.apparatus_type_id).filter(Boolean)

  // Round 2: everything that needs only the apparatus ids, in one trip
  const [{ data: stations }, { data: apparatusTypes }, { data: compartmentLinks }, { data: activeSessions }, { data: recentVehicleChecks }] = await Promise.all([
    stationIds.length > 0
      ? adminClient.from('stations').select('id, station_name, station_number').in('id', stationIds)
      : Promise.resolve({ data: [] as { id: string; station_name: string; station_number: string | null }[] }),
    typeIds.length > 0
      ? adminClient.from('apparatus_types').select('id, name').in('id', typeIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    appIds.length > 0
      ? adminClient.from('apparatus_compartments').select('id, apparatus_id, compartment_name_id').in('apparatus_id', appIds).eq('active', true)
      : Promise.resolve({ data: [] as { id: string; apparatus_id: string; compartment_name_id: string }[] }),
    // Any in-progress sessions for this department's apparatus
    appIds.length > 0
      ? adminClient.from('inspection_sessions')
          .select('id, apparatus_id')
          .eq('department_id', ctx.departmentId)
          .eq('status', 'in_progress')
          // An expired session is only marked 'expired' when someone next opens it; don't offer
          // "Resume" for one that's already past its window.
          .gt('expires_at', new Date().toISOString())
          .in('apparatus_id', appIds)
      : Promise.resolve({ data: [] as { id: string; apparatus_id: string }[] }),
    // Vehicle check done today (department-local date)? "Start Session" funnels through the vehicle
    // check first unless it's already done.
    appIds.length > 0
      ? adminClient.from('vehicle_inspections')
          .select('apparatus_id, inspected_at')
          .in('apparatus_id', appIds)
          .gte('inspected_at', new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString())
      : Promise.resolve({ data: [] as { apparatus_id: string; inspected_at: string }[] }),
  ])
  const stationMap = Object.fromEntries((stations ?? []).map((s: { id: string; station_name: string; station_number: string | null }) => [s.id, s]))
  const typeMap = Object.fromEntries((apparatusTypes ?? []).map((t: { id: string; name: string }) => [t.id, t.name]))

  // Round 3: compartment names, item counts per compartment, and the compartments of active sessions
  const compNameIds = (compartmentLinks ?? []).map(c => c.compartment_name_id).filter(Boolean)
  const compIds = (compartmentLinks ?? []).map(c => c.id)
  const activeSessionIds = (activeSessions ?? []).map(s => s.id)
  const [{ data: compNames }, { data: locationStandards }, { data: sessionCompartments }] = await Promise.all([
    compNameIds.length > 0
      ? adminClient.from('compartment_names').select('id, compartment_code, compartment_name, sort_order').in('id', compNameIds)
      : Promise.resolve({ data: [] as { id: string; compartment_code: string; compartment_name: string | null; sort_order: number | null }[] }),
    compIds.length > 0
      ? adminClient.from('item_location_standards').select('apparatus_compartment_id').in('apparatus_compartment_id', compIds).eq('active', true)
      : Promise.resolve({ data: [] as { apparatus_compartment_id: string }[] }),
    activeSessionIds.length > 0
      ? adminClient.from('inspection_session_compartments').select('session_id, compartment_id, status').in('session_id', activeSessionIds)
      : Promise.resolve({ data: [] as { session_id: string; compartment_id: string; status: string }[] }),
  ])
  const compNameMap = Object.fromEntries((compNames ?? []).map(c => [c.id, c]))

  const itemCountByComp = (locationStandards ?? []).reduce<Record<string, number>>((acc, ls) => {
    acc[ls.apparatus_compartment_id] = (acc[ls.apparatus_compartment_id] ?? 0) + 1
    return acc
  }, {})

  const sessionByApparatus = Object.fromEntries(
    (activeSessions ?? []).map(s => {
      const comps = (sessionCompartments ?? []).filter(c => c.session_id === s.id)
      return [s.apparatus_id, {
        session_id: s.id,
        done: comps.filter(c => c.status === 'completed').length,
        total: comps.length,
        completedCompartmentIds: new Set(
          comps.filter(c => c.status === 'completed').map(c => c.compartment_id)
        ),
      }]
    })
  )

  const localDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: ctx.departmentTimezone })
  const today = localDate(new Date().toISOString())
  const vehicleCheckedToday = new Set(
    (recentVehicleChecks ?? []).filter(v => localDate(v.inspected_at) === today).map(v => v.apparatus_id)
  )

  // Build apparatus with compartments
  const apparatus = (apparatusRaw ?? []).map((a: { id: string; unit_number: string; apparatus_name: string | null; station_id: string | null; apparatus_type_id: string | null }) => {
    const comps = (compartmentLinks ?? [])
      .filter((c: { apparatus_id: string }) => c.apparatus_id === a.id)
      .map((c: { id: string; compartment_name_id: string; apparatus_id: string }) => {
        const name = compNameMap[c.compartment_name_id]
        return {
          id: c.id,
          compartment_code: name?.compartment_code ?? '—',
          compartment_name: name?.compartment_name ?? null,
          sort_order: name?.sort_order ?? 999,
          item_count: itemCountByComp[c.id] ?? 0,
          apparatusId: a.id,
        }
      })
      .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)

    return {
      id: a.id,
      unit_number: a.unit_number,
      apparatus_name: a.apparatus_name,
      type_name: a.apparatus_type_id ? typeMap[a.apparatus_type_id] ?? null : null,
      station: a.station_id ? stationMap[a.station_id] ?? null : null,
      compartments: comps,
      vehicleCheckedToday: vehicleCheckedToday.has(a.id),
      activeSession: sessionByApparatus[a.id]
        ? {
            session_id: sessionByApparatus[a.id].session_id,
            done: sessionByApparatus[a.id].done,
            total: sessionByApparatus[a.id].total,
            completedCompartmentIds: sessionByApparatus[a.id].completedCompartmentIds,
          }
        : null,
    }
  })

  return <InspectionsClient apparatus={apparatus} />
}
