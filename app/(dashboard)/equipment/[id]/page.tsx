import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import EquipmentDetailClient from './EquipmentDetailClient'
import MedicalBagsSection from '@/app/(dashboard)/apparatus/[id]/MedicalBagsSection'

export default async function EquipmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  const { from } = await searchParams
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

  const isAdmin = myDept.system_role === 'admin' || me.is_sys_admin
  const isOfficerOrAbove = isAdmin || myDept.system_role === 'officer'

  // Fetch apparatus
  const { data: apparatusList } = await adminClient
    .from('apparatus')
    .select('id, unit_number, apparatus_name, apparatus_type_id, station_id')
    .eq('id', id)

  const apparatus = apparatusList?.[0]
  if (!apparatus) redirect('/equipment')

  // Fetch type + station
  const { data: typeData } = apparatus.apparatus_type_id
    ? await adminClient.from('apparatus_types').select('id, name').eq('id', apparatus.apparatus_type_id)
    : { data: [] }

  const { data: stationData } = apparatus.station_id
    ? await adminClient.from('stations').select('id, station_name, station_number').eq('id', apparatus.station_id)
    : { data: [] }

  // Fetch compartments for this apparatus
  const { data: compartmentLinks } = await adminClient
    .from('apparatus_compartments')
    .select('id, compartment_name_id, active')
    .eq('apparatus_id', id)
    .eq('active', true)

  const compartmentNameIds = (compartmentLinks ?? []).map(c => c.compartment_name_id).filter(Boolean)
  const { data: compartmentNameData } = compartmentNameIds.length > 0
    ? await adminClient.from('compartment_names').select('id, compartment_code, compartment_name, sort_order').in('id', compartmentNameIds)
    : { data: [] }

  const compartmentNameMap = Object.fromEntries((compartmentNameData ?? []).map(c => [c.id, c]))

  // Fetch item location standards for these compartments
  const compartmentIds = (compartmentLinks ?? []).map(c => c.id)
  const { data: locationStandards } = compartmentIds.length > 0
    ? await adminClient
        .from('item_location_standards')
        .select('id, apparatus_compartment_id, item_id, expected_quantity, minimum_quantity, notes, active')
        .in('apparatus_compartment_id', compartmentIds)
        .eq('active', true)
    : { data: [] }

  // Fetch item details
  const itemIds = (locationStandards ?? []).map(ls => ls.item_id).filter(Boolean)
  const { data: itemData } = itemIds.length > 0
    ? await adminClient.from('items').select('id, item_name, item_description, category_id, requires_inspection, tracks_assets').in('id', itemIds)
    : { data: [] }

  // For tracked-asset items, fetch how many are assigned to this apparatus
  const trackedItemIds = (itemData ?? []).filter((i: { tracks_assets: boolean }) => i.tracks_assets).map((i: { id: string }) => i.id)
  const { data: assignedAssetsRaw } = trackedItemIds.length > 0
    ? await adminClient
        .from('item_assets')
        .select('id, item_id')
        .eq('apparatus_id', id)
        .eq('active', true)
        .neq('status', 'RETIRED')
        .in('item_id', trackedItemIds)
    : { data: [] }

  const assignedCountByItem = (assignedAssetsRaw ?? []).reduce<Record<string, number>>((acc, a) => {
    acc[a.item_id] = (acc[a.item_id] ?? 0) + 1
    return acc
  }, {})

  const categoryIds = (itemData ?? []).map(i => i.category_id).filter(Boolean)
  const { data: categoryData } = categoryIds.length > 0
    ? await adminClient.from('item_categories').select('id, category_name').in('id', categoryIds)
    : { data: [] }

  const itemMap = Object.fromEntries((itemData ?? []).map(i => [i.id, i]))
  const categoryMap = Object.fromEntries((categoryData ?? []).map(c => [c.id, c.category_name]))

  // Fetch ALL items for this department for assignment dropdown
  const { data: allItems } = await adminClient
    .from('items')
    .select('id, item_name, category_id')
    .eq('department_id', myDept.department_id)
    .eq('active', true)
    .order('item_name')

  const { data: allCategories } = await adminClient
    .from('item_categories')
    .select('id, category_name, sort_order')
    .eq('department_id', myDept.department_id)
    .eq('active', true)
    .order('sort_order')

  // Fetch all apparatus + compartments for move modal
  const { data: allApparatusList } = await adminClient
    .from('apparatus')
    .select('id, unit_number, apparatus_name')
    .eq('department_id', myDept.department_id)
    .eq('active', true)
    .order('unit_number')

  const allApparatusIds = (allApparatusList ?? []).map(a => a.id)
  const { data: allCompartmentLinks } = allApparatusIds.length > 0
    ? await adminClient
        .from('apparatus_compartments')
        .select('id, apparatus_id, compartment_name_id')
        .in('apparatus_id', allApparatusIds)
        .eq('active', true)
    : { data: [] }

  const allCompartmentNameIds = (allCompartmentLinks ?? []).map(c => c.compartment_name_id).filter(Boolean)
  const { data: allCompartmentNames } = allCompartmentNameIds.length > 0
    ? await adminClient
        .from('compartment_names')
        .select('id, compartment_code, compartment_name, sort_order')
        .in('id', allCompartmentNameIds)
    : { data: [] }

  const allCompartmentNameMap = Object.fromEntries((allCompartmentNames ?? []).map(c => [c.id, c]))

  const allApparatus = (allApparatusList ?? []).map(a => ({
    id: a.id,
    unit_number: a.unit_number,
    apparatus_name: a.apparatus_name,
    compartments: (allCompartmentLinks ?? [])
      .filter(c => c.apparatus_id === a.id)
      .map(c => {
        const cn = allCompartmentNameMap[c.compartment_name_id]
        return {
          id: c.id,
          compartment_code: cn?.compartment_code ?? '—',
          compartment_name: cn?.compartment_name ?? null,
          sort_order: cn?.sort_order ?? 999,
        }
      })
      .sort((a, b) => a.sort_order - b.sort_order),
  }))

  // Build compartment data with their items
  const compartments = (compartmentLinks ?? [])
    .map(c => {
      const nameData = compartmentNameMap[c.compartment_name_id]
      const items = (locationStandards ?? [])
        .filter(ls => ls.apparatus_compartment_id === c.id)
        .map(ls => ({
          id: ls.id,
          item_id: ls.item_id,
          item_name: itemMap[ls.item_id]?.item_name ?? '—',
          category_name: categoryMap[itemMap[ls.item_id]?.category_id] ?? '—',
          requires_inspection: itemMap[ls.item_id]?.requires_inspection ?? false,
          tracks_assets: itemMap[ls.item_id]?.tracks_assets ?? false,
          expected_quantity: ls.expected_quantity,
          minimum_quantity: ls.minimum_quantity,
          notes: ls.notes,
          assigned_count: itemMap[ls.item_id]?.tracks_assets ? (assignedCountByItem[ls.item_id] ?? 0) : null,
        }))

      return {
        id: c.id,
        compartment_code: nameData?.compartment_code ?? '—',
        compartment_name: nameData?.compartment_name ?? null,
        sort_order: nameData?.sort_order ?? 999,
        items,
      }
    })
    .sort((a, b) => a.sort_order - b.sort_order)

  const apparatusWithRefs = {
    id: apparatus.id,
    unit_number: apparatus.unit_number,
    apparatus_name: apparatus.apparatus_name,
    type_name: (typeData ?? [])[0]?.name ?? null,
    station: (stationData ?? [])[0] ?? null,
  }

  // Medical bags
  const { data: deptRow } = await adminClient.from('departments').select('module_medical').eq('id', myDept.department_id).single()
  const moduleMedical = deptRow?.module_medical ?? false

  let medicalBagData: any = null
  if (moduleMedical) {
    const [{ data: bags }, { data: bagTemplates }, { data: deptStorerooms }, { data: deptPersonnel }] = await Promise.all([
      adminClient.from('medical_storerooms').select('id, name, template_id, inventory_mode').eq('apparatus_id', id).eq('active', true).order('name'),
      adminClient.from('medical_bag_templates').select('id, name').eq('department_id', myDept.department_id).eq('active', true).order('name'),
      adminClient.from('medical_storerooms').select('id, name').eq('department_id', myDept.department_id).eq('active', true).is('apparatus_id', null).order('name'),
      adminClient.from('department_personnel').select('personnel_id, personnel(id, first_name, last_name)').eq('department_id', myDept.department_id).eq('active', true),
    ])

    const bagIds = (bags ?? []).map(b => b.id)
    const { data: bagInventory } = bagIds.length > 0
      ? await adminClient.from('medical_storeroom_inventory').select('id, storeroom_id, supply_type_id, par_level').in('storeroom_id', bagIds)
      : { data: [] }
    const bagInvIds = (bagInventory ?? []).map(i => i.id)
    const supplyTypeIds = [...new Set((bagInventory ?? []).map((i: any) => i.supply_type_id))]

    const [{ data: bagLots }, { data: supplyTypes }] = await Promise.all([
      bagInvIds.length > 0
        ? adminClient.from('medical_stock_lots').select('id, storeroom_inventory_id, lot_number, expiration_date, quantity_received, quantity_remaining, received_date').in('storeroom_inventory_id', bagInvIds).eq('active', true).gt('quantity_remaining', 0).order('expiration_date', { ascending: true, nullsFirst: false })
        : Promise.resolve({ data: [] }),
      supplyTypeIds.length > 0
        ? adminClient.from('medical_supply_types').select('id, name, category, unit_of_measure, is_controlled, tracks_expiration, required_signatures').in('id', supplyTypeIds)
        : Promise.resolve({ data: [] }),
    ])

    const storeroomIds = (deptStorerooms ?? []).map((s: any) => s.id)
    const { data: storeroomInventory } = storeroomIds.length > 0 && supplyTypeIds.length > 0
      ? await adminClient.from('medical_storeroom_inventory').select('id, storeroom_id, supply_type_id').in('storeroom_id', storeroomIds).in('supply_type_id', supplyTypeIds)
      : { data: [] }
    const srcInvIds = (storeroomInventory ?? []).map((i: any) => i.id)
    const { data: storeroomLots } = srcInvIds.length > 0
      ? await adminClient.from('medical_stock_lots').select('id, storeroom_inventory_id, lot_number, quantity_remaining, expiration_date').in('storeroom_inventory_id', srcInvIds).eq('active', true).gt('quantity_remaining', 0)
      : { data: [] }

    const personnel = (deptPersonnel ?? [])
      .map((dp: any) => ({ id: (dp.personnel as any)?.id ?? dp.personnel_id, name: [(dp.personnel as any)?.first_name, (dp.personnel as any)?.last_name].filter(Boolean).join(' ') }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name))

    medicalBagData = {
      bags: bags ?? [], bagInventory: bagInventory ?? [], bagLots: bagLots ?? [],
      supplyTypes: supplyTypes ?? [], deptStorerooms: deptStorerooms ?? [],
      storeroomInventory: storeroomInventory ?? [], storeroomLots: storeroomLots ?? [],
      personnel, bagTemplates: bagTemplates ?? [], apparatusId: id,
    }
  }

  return (
    <div>
      <EquipmentDetailClient
        apparatus={apparatusWithRefs}
        compartments={compartments}
        allItems={[]}
        allCategories={[]}
        allApparatus={allApparatus}
        isAdmin={isAdmin}
        isOfficerOrAbove={isOfficerOrAbove}
        backHref={from}
      />
      {medicalBagData && (
        <div className="max-w-2xl mt-2">
          <MedicalBagsSection
            bags={medicalBagData.bags}
            bagInventory={medicalBagData.bagInventory}
            bagLots={medicalBagData.bagLots}
            supplyTypes={medicalBagData.supplyTypes}
            deptStorerooms={medicalBagData.deptStorerooms}
            storeroomInventory={medicalBagData.storeroomInventory}
            storeroomLots={medicalBagData.storeroomLots}
            personnel={medicalBagData.personnel}
            bagTemplates={medicalBagData.bagTemplates}
            apparatusId={medicalBagData.apparatusId}
            isAdmin={isAdmin}
            isOfficerOrAbove={isOfficerOrAbove}
            myPersonnelId={me.id}
          />
        </div>
      )}
    </div>
  )
}
