import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import HosesClient from './HosesClient'

export default async function HosesPage() {
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

  const department_id = myDept.department_id
  const isOfficerOrAbove = myDept.system_role === 'admin' || myDept.system_role === 'officer'

  // Fetch hoses
  const { data: hosesRaw } = await adminClient
    .from('hoses')
    .select('id, hose_identifier, hose_type, diameter_in, length_ft, manufacturer, serial_number, year_placed_in_service, status, notes, apparatus_id')
    .eq('department_id', department_id)
    .order('hose_identifier')

  // Fetch apparatus for assignment dropdown and name lookup
  const { data: deptApparatus } = await adminClient
    .from('apparatus')
    .select('id, unit_number')
    .eq('department_id', department_id)
    .eq('active', true)
    .order('unit_number')

  const apparatusMap = Object.fromEntries((deptApparatus ?? []).map(a => [a.id, a.unit_number]))

  // Fetch all hose tests
  const hoseIds = (hosesRaw ?? []).map(h => h.id)
  const { data: testsRaw } = hoseIds.length > 0
    ? await adminClient
        .from('hose_tests')
        .select('id, hose_id, test_date, tested_by, test_pressure_psi, duration_min, passed, failure_reason, notes')
        .in('hose_id', hoseIds)
        .order('test_date', { ascending: false })
    : { data: [] as any[] }

  // Fetch tester names
  const testerIds = [...new Set((testsRaw ?? []).map(t => t.tested_by).filter(Boolean))]
  const { data: testersRaw } = testerIds.length > 0
    ? await adminClient.from('personnel').select('id, first_name, last_name').in('id', testerIds)
    : { data: [] as any[] }
  const testerNameMap = Object.fromEntries((testersRaw ?? []).map(p => [p.id, `${p.first_name} ${p.last_name}`]))

  // Group tests by hose
  const testsByHose: Record<string, any[]> = {}
  for (const t of testsRaw ?? []) {
    if (!testsByHose[t.hose_id]) testsByHose[t.hose_id] = []
    testsByHose[t.hose_id]!.push({
      id: t.id,
      test_date: t.test_date,
      tested_by_name: t.tested_by ? (testerNameMap[t.tested_by] ?? null) : null,
      test_pressure_psi: t.test_pressure_psi,
      duration_min: t.duration_min,
      passed: t.passed,
      failure_reason: t.failure_reason,
      notes: t.notes,
    })
  }

  const hoses = (hosesRaw ?? []).map(h => ({
    ...h,
    apparatus_unit: h.apparatus_id ? (apparatusMap[h.apparatus_id] ?? null) : null,
    tests: testsByHose[h.id] ?? [],
  }))

  return (
    <HosesClient
      hoses={hoses}
      deptApparatus={deptApparatus ?? []}
      isOfficerOrAbove={isOfficerOrAbove}
    />
  )
}
