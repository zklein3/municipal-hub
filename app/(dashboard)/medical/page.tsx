import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MedicalStoreClient from './MedicalStoreClient'

export default async function MedicalPage() {
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

  const isOfficerOrAbove = myDept.system_role === 'admin' || myDept.system_role === 'officer' || me.is_sys_admin
  if (!isOfficerOrAbove) redirect('/equipment')

  const isAdmin = myDept.system_role === 'admin' || me.is_sys_admin
  const department_id = myDept.department_id

  // Storerooms
  const { data: storerooms } = await adminClient
    .from('medical_storerooms')
    .select('id, name, station_id')
    .eq('department_id', department_id)
    .eq('active', true)
    .order('name')

  const storeroomIds = (storerooms ?? []).map(s => s.id)

  // Inventory (supply types per storeroom)
  const { data: inventory } = storeroomIds.length > 0
    ? await adminClient
        .from('medical_storeroom_inventory')
        .select('id, storeroom_id, supply_type_id, par_level')
        .in('storeroom_id', storeroomIds)
    : { data: [] }

  // Supply types
  const supplyTypeIds = [...new Set((inventory ?? []).map(i => i.supply_type_id))]
  const { data: supplyTypes } = supplyTypeIds.length > 0
    ? await adminClient
        .from('medical_supply_types')
        .select('id, name, category, unit_of_measure, is_controlled, tracks_expiration, required_signatures')
        .in('id', supplyTypeIds)
    : { data: [] }

  // Lots (active stock)
  const inventoryIds = (inventory ?? []).map(i => i.id)
  const { data: lots } = inventoryIds.length > 0
    ? await adminClient
        .from('medical_stock_lots')
        .select('id, storeroom_inventory_id, lot_number, expiration_date, quantity_received, quantity_remaining, received_date')
        .in('storeroom_inventory_id', inventoryIds)
        .eq('active', true)
        .gt('quantity_remaining', 0)
        .order('expiration_date', { ascending: true, nullsFirst: false })
    : { data: [] }

  // Personnel for signer dropdowns
  const { data: deptPersonnel } = await adminClient
    .from('department_personnel')
    .select('personnel_id, personnel(id, first_name, last_name)')
    .eq('department_id', department_id)
    .eq('active', true)

  const personnel = (deptPersonnel ?? [])
    .map(dp => ({
      id: (dp.personnel as any)?.id ?? dp.personnel_id,
      name: [(dp.personnel as any)?.first_name, (dp.personnel as any)?.last_name].filter(Boolean).join(' '),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Stations for display
  const stationIds = [...new Set((storerooms ?? []).map(s => s.station_id).filter(Boolean))] as string[]
  const { data: stations } = stationIds.length > 0
    ? await adminClient.from('stations').select('id, station_name, station_number').in('id', stationIds)
    : { data: [] }

  return (
    <MedicalStoreClient
      storerooms={storerooms ?? []}
      inventory={inventory ?? []}
      supplyTypes={supplyTypes ?? []}
      lots={lots ?? []}
      personnel={personnel}
      stations={stations ?? []}
      isAdmin={isAdmin}
      myPersonnelId={me.id}
    />
  )
}
