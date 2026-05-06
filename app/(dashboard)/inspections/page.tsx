import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import InspectionsClient from './InspectionsClient'

export default async function InspectionsPage() {
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

  // Fetch all active apparatus for this department
  const { data: apparatusRaw } = await adminClient
    .from('apparatus')
    .select('id, unit_number, apparatus_name, station_id, apparatus_type_id')
    .eq('department_id', myDept.department_id)
    .eq('active', true)
    .order('unit_number')

  // Fetch station names
  const stationIds = (apparatusRaw ?? []).map((a: { station_id: string | null }) => a.station_id).filter(Boolean)
  const { data: stations } = stationIds.length > 0
    ? await adminClient.from('stations').select('id, station_name, station_number').in('id', stationIds)
    : { data: [] }
  const stationMap = Object.fromEntries((stations ?? []).map((s: { id: string; station_name: string; station_number: string | null }) => [s.id, s]))

  // Fetch apparatus types
  const typeIds = (apparatusRaw ?? []).map((a: { apparatus_type_id: string | null }) => a.apparatus_type_id).filter(Boolean)
  const { data: apparatusTypes } = typeIds.length > 0
    ? await adminClient.from('apparatus_types').select('id, name').in('id', typeIds)
    : { data: [] }
  const typeMap = Object.fromEntries((apparatusTypes ?? []).map((t: { id: string; name: string }) => [t.id, t.name]))

  // Fetch compartments with item counts
  const appIds = (apparatusRaw ?? []).map(a => a.id)
  const { data: compartmentLinks } = appIds.length > 0
    ? await adminClient
        .from('apparatus_compartments')
        .select('id, apparatus_id, compartment_name_id')
        .in('apparatus_id', appIds)
        .eq('active', true)
    : { data: [] }

  const compNameIds = (compartmentLinks ?? []).map(c => c.compartment_name_id).filter(Boolean)
  const { data: compNames } = compNameIds.length > 0
    ? await adminClient.from('compartment_names').select('id, compartment_code, compartment_name, sort_order').in('id', compNameIds)
    : { data: [] }
  const compNameMap = Object.fromEntries((compNames ?? []).map(c => [c.id, c]))

  // Count items per compartment
  const compIds = (compartmentLinks ?? []).map(c => c.id)
  const { data: locationStandards } = compIds.length > 0
    ? await adminClient.from('item_location_standards').select('apparatus_compartment_id').in('apparatus_compartment_id', compIds).eq('active', true)
    : { data: [] }

  const itemCountByComp = (locationStandards ?? []).reduce<Record<string, number>>((acc, ls) => {
    acc[ls.apparatus_compartment_id] = (acc[ls.apparatus_compartment_id] ?? 0) + 1
    return acc
  }, {})

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
    }
  })

  return <InspectionsClient apparatus={apparatus} />
}
