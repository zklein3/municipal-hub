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

  // Module gate — all dept members can access if module is enabled
  const { data: deptRow } = await adminClient.from('departments').select('module_medical').eq('id', myDept.department_id).single()
  if (!deptRow?.module_medical && !me.is_sys_admin) redirect('/dashboard')

  const isAdmin = myDept.system_role === 'admin' || me.is_sys_admin
  const isOfficerOrAbove = isAdmin || myDept.system_role === 'officer'
  const department_id = myDept.department_id

  // Storerooms
  const { data: storerooms } = await adminClient
    .from('medical_storerooms')
    .select('id, name, station_id, apparatus_id')
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

  // Apparatus for display (apparatus-linked storerooms)
  const apparatusIds = [...new Set((storerooms ?? []).map(s => s.apparatus_id).filter(Boolean))] as string[]
  const { data: apparatusList } = apparatusIds.length > 0
    ? await adminClient.from('apparatus').select('id, unit_number, apparatus_types(name)').in('id', apparatusIds)
    : { data: [] }
  const apparatusMap = Object.fromEntries(
    (apparatusList ?? []).map(a => [a.id, {
      unit_number: a.unit_number,
      type_name: (a.apparatus_types as any)?.name ?? null,
    }])
  )

  // Pending reorder requests for this dept's storerooms
  const { data: reorderRequests } = storeroomIds.length > 0
    ? await adminClient
        .from('medical_reorder_requests')
        .select('id, storeroom_inventory_id, status')
        .in('storeroom_inventory_id',
          (await adminClient.from('medical_storeroom_inventory').select('id').in('storeroom_id', storeroomIds)).data?.map(i => i.id) ?? []
        )
        .eq('status', 'pending')
    : { data: [] }
  const pendingReorderIds = new Set((reorderRequests ?? []).map(r => r.storeroom_inventory_id))

  // Transaction history — last 90 days
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const { data: transactions } = storeroomIds.length > 0
    ? await adminClient
        .from('medical_stock_transactions')
        .select('id, storeroom_id, supply_type_id, lot_id, transaction_type, quantity, performed_by, signer_1_id, signer_2_id, notes, created_at')
        .in('storeroom_id', storeroomIds)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200)
    : { data: [] }

  // Lot number lookup for history (include inactive lots referenced in transactions)
  const txLotIds = [...new Set((transactions ?? []).map(t => t.lot_id).filter(Boolean))] as string[]
  const { data: txLots } = txLotIds.length > 0
    ? await adminClient.from('medical_stock_lots').select('id, lot_number').in('id', txLotIds)
    : { data: [] }
  const lotNumberMap = Object.fromEntries((txLots ?? []).map(l => [l.id, l.lot_number]))

  // Personnel id→name map for history display
  const personnelMap = Object.fromEntries(personnel.map(p => [p.id, p.name]))

  return (
    <MedicalStoreClient
      storerooms={storerooms ?? []}
      inventory={inventory ?? []}
      supplyTypes={supplyTypes ?? []}
      lots={lots ?? []}
      personnel={personnel}
      stations={stations ?? []}
      apparatusMap={apparatusMap}
      isAdmin={isAdmin}
      isOfficerOrAbove={isOfficerOrAbove}
      myPersonnelId={me.id}
      transactions={transactions ?? []}
      lotNumberMap={lotNumberMap}
      personnelMap={personnelMap}
      pendingReorderIds={pendingReorderIds}
    />
  )
}
