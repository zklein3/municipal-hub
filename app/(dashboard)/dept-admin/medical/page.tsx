import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MedicalAdminClient from './MedicalAdminClient'

export default async function MedicalAdminPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: meList } = await adminClient.from('personnel').select('id, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) redirect('/login')

  const { data: myDeptList } = await adminClient.from('department_personnel').select('department_id, system_role').eq('personnel_id', me.id).eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept || myDept.system_role !== 'admin') redirect('/dashboard')

  const department_id = myDept.department_id

  const [
    { data: supplyTypes },
    { data: storerooms },
    { data: stations },
  ] = await Promise.all([
    adminClient.from('medical_supply_types')
      .select('id, name, category, unit_of_measure, is_controlled, tracks_expiration, required_signatures, notes, active')
      .eq('department_id', department_id)
      .order('category')
      .order('name'),
    adminClient.from('medical_storerooms')
      .select('id, name, station_id, notes, active')
      .eq('department_id', department_id)
      .order('name'),
    adminClient.from('stations')
      .select('id, station_name, station_number')
      .eq('department_id', department_id)
      .order('station_number'),
  ])

  // Storeroom inventory (supply types assigned to each storeroom)
  const storeroomIds = (storerooms ?? []).map(s => s.id)
  const { data: storeroomInventory } = storeroomIds.length > 0
    ? await adminClient.from('medical_storeroom_inventory')
        .select('id, storeroom_id, supply_type_id, par_level')
        .in('storeroom_id', storeroomIds)
    : { data: [] }

  return (
    <MedicalAdminClient
      supplyTypes={supplyTypes ?? []}
      storerooms={storerooms ?? []}
      stations={stations ?? []}
      storeroomInventory={storeroomInventory ?? []}
      departmentId={department_id}
    />
  )
}
