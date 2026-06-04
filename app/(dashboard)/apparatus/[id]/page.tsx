import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ApparatusDetailClient from './ApparatusDetailClient'

export default async function ApparatusDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

  const systemRole = myDept.system_role
  const isAdmin = systemRole === 'admin' || me.is_sys_admin
  const isOfficerOrAbove = isAdmin || systemRole === 'officer'

  // Fetch apparatus — no nested joins to avoid type issues
  const { data: apparatusList } = await adminClient
    .from('apparatus')
    .select('id, unit_number, apparatus_name, make, model, model_year, vin, license_plate, active, in_service_date, out_of_service_date, notes, apparatus_type_id, station_id, qr_code, exclude_from_iso, has_air_brakes, has_engine_hours')
    .eq('id', id)

  const apparatus = apparatusList?.[0]
  if (!apparatus) redirect('/apparatus')

  // Fetch apparatus type name separately
  const { data: apparatusTypeData } = apparatus.apparatus_type_id
    ? await adminClient.from('apparatus_types').select('id, name').eq('id', apparatus.apparatus_type_id)
    : { data: [] }

  // Fetch station separately
  const { data: stationData } = apparatus.station_id
    ? await adminClient.from('stations').select('id, station_name, station_number').eq('id', apparatus.station_id)
    : { data: [] }

  // Fetch all stations for reassignment dropdown
  const { data: stations } = await adminClient
    .from('stations')
    .select('id, station_number, station_name')
    .eq('department_id', myDept.department_id)
    .eq('active', true)
    .order('station_number')

  // Fetch apparatus types for dropdown
  const { data: apparatusTypes } = await adminClient
    .from('apparatus_types')
    .select('id, name, sort_order')
    .eq('active', true)
    .order('sort_order')

  // Fetch compartments
  const { data: compartmentLinks } = await adminClient
    .from('apparatus_compartments')
    .select('id, active, notes, compartment_name_id')
    .eq('apparatus_id', id)

  // Fetch compartment name details separately
  const compartmentNameIds = (compartmentLinks ?? []).map(c => c.compartment_name_id).filter(Boolean)
  const { data: compartmentNameData } = compartmentNameIds.length > 0
    ? await adminClient.from('compartment_names').select('id, compartment_code, compartment_name, sort_order').in('id', compartmentNameIds)
    : { data: [] }

  const compartmentNameMap = Object.fromEntries((compartmentNameData ?? []).map(c => [c.id, c]))

  // Fetch location standards (items) for all compartments
  const allCompartmentIds = (compartmentLinks ?? []).map(c => c.id)
  const { data: locationStandards } = allCompartmentIds.length > 0
    ? await adminClient
        .from('item_location_standards')
        .select('id, apparatus_compartment_id, item_id, expected_quantity')
        .in('apparatus_compartment_id', allCompartmentIds)
        .eq('active', true)
    : { data: [] as { id: string; apparatus_compartment_id: string; item_id: string; expected_quantity: number }[] }

  const lsItemIds = [...new Set((locationStandards ?? []).map(ls => ls.item_id))]
  const { data: itemData } = lsItemIds.length > 0
    ? await adminClient
        .from('items')
        .select('id, item_name')
        .in('id', lsItemIds)
    : { data: [] as { id: string; item_name: string }[] }

  const itemMap = Object.fromEntries((itemData ?? []).map(i => [i.id, i]))

  // Build compartment items map
  const compartmentItemsMap: Record<string, { item_name: string; expected_quantity: number }[]> = {}
  for (const ls of locationStandards ?? []) {
    const item = itemMap[ls.item_id]
    if (!item) continue
    if (!compartmentItemsMap[ls.apparatus_compartment_id]) compartmentItemsMap[ls.apparatus_compartment_id] = []
    compartmentItemsMap[ls.apparatus_compartment_id]!.push({
      item_name: item.item_name,
      expected_quantity: ls.expected_quantity,
    })
  }

  const compartments = (compartmentLinks ?? []).map(c => ({
    id: c.id,
    active: c.active,
    notes: c.notes,
    compartment_name: compartmentNameMap[c.compartment_name_id] ?? null,
    items: compartmentItemsMap[c.id] ?? [],
  }))

  // Fetch available compartment names for this department
  const { data: compartmentNames } = await adminClient
    .from('compartment_names')
    .select('id, compartment_code, compartment_name, sort_order')
    .eq('department_id', myDept.department_id)
    .eq('active', true)
    .order('sort_order')

  // Fetch ISO specs
  const { data: isoSpecsList } = await adminClient
    .from('apparatus_iso_specs')
    .select('pump_rating_gpm, tank_capacity_gal, foam_capacity_gal, aerial_length_ft, turning_radius_ft, gvwr_lbs, hose_loads')
    .eq('apparatus_id', id)
  const isoSpecs = isoSpecsList?.[0] ?? null

  // Fetch pump tests
  const { data: pumpTests } = await adminClient
    .from('apparatus_pump_tests')
    .select('id, test_date, vendor, passed, notes, document_path, created_at')
    .eq('apparatus_id', id)
    .order('test_date', { ascending: false })

  // Medical bag linked to this apparatus
  const { data: bagStoreroomList } = await adminClient
    .from('medical_storerooms')
    .select('id, name')
    .eq('apparatus_id', id)
    .eq('active', true)
    .limit(1)
  const bagStoreroom = bagStoreroomList?.[0] ?? null

  let medicalBag: { storeroom_id: string; name: string; supply_count: number; alert_count: number } | null = null
  if (bagStoreroom) {
    const { data: bagInv } = await adminClient
      .from('medical_storeroom_inventory')
      .select('id, par_level, supply_type_id')
      .eq('storeroom_id', bagStoreroom.id)
    const invIds = (bagInv ?? []).map(i => i.id)
    const { data: bagLots } = invIds.length > 0
      ? await adminClient
          .from('medical_stock_lots')
          .select('storeroom_inventory_id, quantity_remaining, expiration_date')
          .in('storeroom_inventory_id', invIds)
          .eq('active', true)
      : { data: [] }
    const now = new Date()
    const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    let alertCount = 0
    for (const inv of bagInv ?? []) {
      const invLots = (bagLots ?? []).filter(l => l.storeroom_inventory_id === inv.id)
      const total = invLots.reduce((s, l) => s + l.quantity_remaining, 0)
      if (invLots.some(l => l.expiration_date && new Date(l.expiration_date + 'T00:00:00') < now)) alertCount++
      else if (invLots.some(l => l.expiration_date && new Date(l.expiration_date + 'T00:00:00') <= soon)) alertCount++
      else if (inv.par_level > 0 && total < inv.par_level) alertCount++
    }
    medicalBag = { storeroom_id: bagStoreroom.id, name: bagStoreroom.name, supply_count: (bagInv ?? []).length, alert_count: alertCount }
  }

  // Build clean apparatus object
  const apparatusWithRefs = {
    ...apparatus,
    apparatus_type: (apparatusTypeData ?? [])[0] ?? null,
    station: (stationData ?? [])[0] ?? null,
  }

  return (
    <ApparatusDetailClient
      apparatus={apparatusWithRefs}
      stations={stations ?? []}
      apparatusTypes={apparatusTypes ?? []}
      compartments={compartments}
      compartmentNames={compartmentNames ?? []}
      isAdmin={isAdmin}
      isOfficerOrAbove={isOfficerOrAbove}
      departmentId={myDept.department_id}
      isoSpecs={isoSpecs}
      pumpTests={pumpTests ?? []}
      medicalBag={medicalBag}
    />
  )
}
