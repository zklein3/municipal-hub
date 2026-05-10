import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import HydrantsClient from './HydrantsClient'

export default async function HydrantsPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: meList } = await adminClient.from('personnel').select('id, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) redirect('/login')

  const { data: myDeptList } = await adminClient.from('department_personnel').select('department_id, system_role').eq('personnel_id', me.id).eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept) redirect('/dashboard')

  // Module gate — Bundle B required
  const { data: deptFlags } = await adminClient.from('departments').select('module_iso').eq('id', myDept.department_id).single()
  if (!deptFlags?.module_iso) redirect('/dashboard')

  const department_id = myDept.department_id
  const isOfficerOrAbove = myDept.system_role === 'admin' || myDept.system_role === 'officer'

  // Fetch hydrants
  const { data: hydrantsRaw } = await adminClient
    .from('hydrants')
    .select('id, hydrant_number, location_description, street_address, lat, lng, owner, hydrant_type, main_size_in, out_of_service, notes')
    .eq('department_id', department_id)
    .order('hydrant_number')

  // Fetch all flow tests
  const hydrantIds = (hydrantsRaw ?? []).map(h => h.id)
  const { data: testsRaw } = hydrantIds.length > 0
    ? await adminClient
        .from('hydrant_flow_tests')
        .select('id, hydrant_id, test_date, tested_by, static_pressure_psi, residual_pressure_psi, flow_gpm, pitot_reading_psi, nozzle_diameter_in, notes')
        .in('hydrant_id', hydrantIds)
        .order('test_date', { ascending: false })
    : { data: [] as any[] }

  // Fetch tester names
  const testerIds = [...new Set((testsRaw ?? []).map((t: any) => t.tested_by).filter(Boolean))]
  const { data: testersRaw } = testerIds.length > 0
    ? await adminClient.from('personnel').select('id, first_name, last_name').in('id', testerIds)
    : { data: [] as any[] }
  const testerNameMap = Object.fromEntries((testersRaw ?? []).map((p: any) => [p.id, `${p.first_name} ${p.last_name}`]))

  // Group tests by hydrant
  const testsByHydrant: Record<string, any[]> = {}
  for (const t of testsRaw ?? []) {
    if (!testsByHydrant[t.hydrant_id]) testsByHydrant[t.hydrant_id] = []
    testsByHydrant[t.hydrant_id]!.push({
      id: t.id,
      test_date: t.test_date,
      tested_by_name: t.tested_by ? (testerNameMap[t.tested_by] ?? null) : null,
      static_pressure_psi: t.static_pressure_psi,
      residual_pressure_psi: t.residual_pressure_psi,
      flow_gpm: t.flow_gpm,
      pitot_reading_psi: t.pitot_reading_psi,
      nozzle_diameter_in: t.nozzle_diameter_in,
      notes: t.notes,
    })
  }

  const hydrants = (hydrantsRaw ?? []).map(h => ({
    ...h,
    tests: testsByHydrant[h.id] ?? [],
  }))

  return (
    <HydrantsClient
      hydrants={hydrants}
      isOfficerOrAbove={isOfficerOrAbove}
    />
  )
}
