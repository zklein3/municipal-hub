import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentPath } from '@/lib/current-path'
import { redirect } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { getPermissionSnapshot } from '@/lib/permissions'
import EquipmentDetailClient from './EquipmentDetailClient'
import { getMedicalSupplyStatus, type MedicalSupplyStatus } from '@/lib/medical-status'

export default async function EquipmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  const { from } = await searchParams
  const adminClient = createAdminClient()

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (ctx.hasMultipleDepartments && !ctx.departmentId) redirect(`/select-department?next=${encodeURIComponent(await getCurrentPath())}`)
  if (!ctx.departmentId) redirect('/dashboard')
  const me = { id: ctx.personnelId }

  const equipmentPermissions = await getPermissionSnapshot(ctx)
  const isAdmin = equipmentPermissions.manage_apparatus
  const isOfficerOrAbove = equipmentPermissions.manage_inventory
  const departmentId = ctx.departmentId
  const canArrange = equipmentPermissions.manage_dept_setup

  // Round 1: everything that only needs this truck's id or the department id — one round trip
  // instead of a chain. (The apparatus lookup is also scoped to the viewer's department.)
  const [
    { data: apparatusList }, { data: compartmentLinks }, { data: allItems }, { data: allCategories },
    { data: allApparatusList }, { data: deptRow }, { data: libraryRaw }, { data: presetRows },
  ] = await Promise.all([
    adminClient.from('apparatus').select('id, unit_number, apparatus_name, apparatus_type_id, station_id')
      .eq('id', id).eq('department_id', departmentId),
    adminClient.from('apparatus_compartments').select('id, compartment_name_id, active, qr_code').eq('apparatus_id', id).eq('active', true),
    // ALL items / categories for the department, for the "+ Add Item" dropdown
    adminClient.from('items').select('id, item_name, category_id').eq('department_id', departmentId).eq('active', true).order('item_name'),
    adminClient.from('item_categories').select('id, category_name, sort_order').eq('department_id', departmentId).eq('active', true).order('sort_order'),
    // All trucks + their compartments, for the move modal (and the bag move picker below)
    adminClient.from('apparatus').select('id, unit_number, apparatus_name').eq('department_id', departmentId).eq('active', true).order('unit_number'),
    adminClient.from('departments').select('module_medical').eq('id', departmentId).single(),
    // Adding compartments right on the truck screen: the compartment library and presets
    canArrange
      ? adminClient.from('compartment_names').select('id, compartment_code, compartment_name, sort_order')
          .eq('department_id', departmentId).eq('active', true).order('sort_order', { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [] as { id: string; compartment_code: string; compartment_name: string | null; sort_order: number | null }[] }),
    canArrange
      ? adminClient.from('compartment_presets').select('id, name, default_code')
          .eq('department_id', departmentId).eq('active', true).order('name')
      : Promise.resolve({ data: [] as { id: string; name: string; default_code: string }[] }),
  ])

  const apparatus = apparatusList?.[0]
  if (!apparatus) redirect('/equipment')
  const moduleMedical = deptRow?.module_medical ?? false

  const compartmentNameIds = (compartmentLinks ?? []).map(c => c.compartment_name_id).filter(Boolean)
  const compartmentIds = (compartmentLinks ?? []).map(c => c.id)
  const allApparatusIds = (allApparatusList ?? []).map(a => a.id)

  // Round 2: three independent chains run side by side.
  //  A) this truck's equipment  B) the move-modal compartments  C) medical (bags + compartment storerooms)
  const loadTruckEquipment = async () => {
    const [{ data: typeData }, { data: stationData }, { data: compartmentNameData }, { data: locationStandards }] = await Promise.all([
      apparatus.apparatus_type_id
        ? adminClient.from('apparatus_types').select('id, name').eq('id', apparatus.apparatus_type_id)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      apparatus.station_id
        ? adminClient.from('stations').select('id, station_name, station_number').eq('id', apparatus.station_id)
        : Promise.resolve({ data: [] as { id: string; station_name: string; station_number: string }[] }),
      compartmentNameIds.length > 0
        ? adminClient.from('compartment_names').select('id, compartment_code, compartment_name, sort_order').in('id', compartmentNameIds)
        : Promise.resolve({ data: [] as { id: string; compartment_code: string; compartment_name: string | null; sort_order: number | null }[] }),
      compartmentIds.length > 0
        ? adminClient.from('item_location_standards')
            .select('id, apparatus_compartment_id, item_id, expected_quantity, minimum_quantity, notes, active')
            .in('apparatus_compartment_id', compartmentIds).eq('active', true)
        : Promise.resolve({ data: [] as { id: string; apparatus_compartment_id: string; item_id: string; expected_quantity: number; minimum_quantity: number | null; notes: string | null; active: boolean }[] }),
    ])

    const itemIds = (locationStandards ?? []).map(ls => ls.item_id).filter(Boolean)
    const { data: itemData } = itemIds.length > 0
      ? await adminClient.from('items').select('id, item_name, item_description, category_id, requires_inspection, tracks_assets').in('id', itemIds)
      : { data: [] }

    // For tracked-asset items, how many are assigned to this apparatus; plus the category names
    const trackedItemIds = (itemData ?? []).filter((i: { tracks_assets: boolean }) => i.tracks_assets).map((i: { id: string }) => i.id)
    const categoryIds = (itemData ?? []).map(i => i.category_id).filter(Boolean)
    const [{ data: assignedAssetsRaw }, { data: categoryData }] = await Promise.all([
      trackedItemIds.length > 0
        ? adminClient.from('item_assets').select('id, item_id').eq('apparatus_id', id).eq('active', true).neq('status', 'RETIRED').in('item_id', trackedItemIds)
        : Promise.resolve({ data: [] as { id: string; item_id: string }[] }),
      categoryIds.length > 0
        ? adminClient.from('item_categories').select('id, category_name').in('id', categoryIds)
        : Promise.resolve({ data: [] as { id: string; category_name: string }[] }),
    ])
    return { typeData, stationData, compartmentNameData, locationStandards, itemData, assignedAssetsRaw, categoryData }
  }

  const loadMoveTargets = async () => {
    const { data: allCompartmentLinks } = allApparatusIds.length > 0
      ? await adminClient.from('apparatus_compartments').select('id, apparatus_id, compartment_name_id').in('apparatus_id', allApparatusIds).eq('active', true)
      : { data: [] as { id: string; apparatus_id: string; compartment_name_id: string }[] }
    const allCompartmentNameIds = [...new Set((allCompartmentLinks ?? []).map(c => c.compartment_name_id).filter(Boolean))]
    const { data: allCompartmentNames } = allCompartmentNameIds.length > 0
      ? await adminClient.from('compartment_names').select('id, compartment_code, compartment_name, sort_order').in('id', allCompartmentNameIds)
      : { data: [] as { id: string; compartment_code: string; compartment_name: string | null; sort_order: number | null }[] }
    return { allCompartmentLinks, allCompartmentNames }
  }

  const loadMedical = async () => {
    if (!moduleMedical) return null

    // Round M1: everything medical that only needs the truck / department id
    const [{ data: bags }, { data: bagTemplates }, { data: deptStorerooms }, { data: deptPersonnel }, { data: compStorerooms }, { data: allSupplyTypes }] = await Promise.all([
      adminClient.from('medical_storerooms').select('id, name, template_id, inventory_mode, compartment_id, parent_storeroom_id, qr_code').eq('apparatus_id', id).eq('active', true).eq('container_kind', 'bag').order('name'),
      adminClient.from('medical_bag_templates').select('id, name').eq('department_id', departmentId).eq('active', true).order('name'),
      adminClient.from('medical_storerooms').select('id, name').eq('department_id', departmentId).eq('active', true).eq('container_kind', 'storeroom').order('name'),
      adminClient.from('department_personnel').select('personnel_id, personnel(id, first_name, last_name)').eq('department_id', departmentId).eq('active', true),
      adminClient.from('medical_storerooms').select('id, name, compartment_id').eq('apparatus_id', id).eq('active', true).eq('container_kind', 'compartment_storage').order('name'),
      // All active supply types for the department, for the unified "+ Add Item" picker
      adminClient.from('medical_supply_types').select('id, name, category, unit_of_measure').eq('department_id', departmentId).eq('active', true).order('name'),
    ])

    const bagIds = (bags ?? []).map(b => b.id)
    const compStoreroomIds = (compStorerooms ?? []).map((s: any) => s.id)
    const storeroomIds = (deptStorerooms ?? []).map((s: any) => s.id)

    // Bags: equipment inside + stock inside, side by side
    const loadBags = async () => {
      const [{ data: bagStandards }, { data: bagInventory }] = await Promise.all([
        bagIds.length > 0
          ? adminClient.from('item_location_standards').select('id, storeroom_id, item_id, expected_quantity').in('storeroom_id', bagIds).eq('active', true)
          : Promise.resolve({ data: [] as { id: string; storeroom_id: string; item_id: string; expected_quantity: number }[] }),
        bagIds.length > 0
          ? adminClient.from('medical_storeroom_inventory').select('id, storeroom_id, supply_type_id, par_level').in('storeroom_id', bagIds)
          : Promise.resolve({ data: [] as { id: string; storeroom_id: string; supply_type_id: string; par_level: number }[] }),
      ])
      const bagItemIds = [...new Set((bagStandards ?? []).map(s => s.item_id))]
      const bagInvIds = (bagInventory ?? []).map(i => i.id)
      const supplyTypeIds = [...new Set((bagInventory ?? []).map((i: any) => i.supply_type_id))] as string[]

      const [{ data: bagItemRows }, { data: bagLots }, { data: supplyTypes }, { data: storeroomInventory }] = await Promise.all([
        bagItemIds.length > 0
          ? adminClient.from('items').select('id, item_name').in('id', bagItemIds)
          : Promise.resolve({ data: [] as { id: string; item_name: string }[] }),
        bagInvIds.length > 0
          ? adminClient.from('medical_stock_lots').select('id, storeroom_inventory_id, lot_number, expiration_date, quantity_received, quantity_remaining, received_date, concentration_amount, concentration_unit, volume_per_unit, volume_unit').in('storeroom_inventory_id', bagInvIds).eq('active', true).gt('quantity_remaining', 0).order('expiration_date', { ascending: true, nullsFirst: false })
          : Promise.resolve({ data: [] }),
        supplyTypeIds.length > 0
          ? adminClient.from('medical_supply_types').select('id, name, category, unit_of_measure, is_controlled, tracks_expiration, required_signatures').in('id', supplyTypeIds)
          : Promise.resolve({ data: [] }),
        storeroomIds.length > 0 && supplyTypeIds.length > 0
          ? adminClient.from('medical_storeroom_inventory').select('id, storeroom_id, supply_type_id').in('storeroom_id', storeroomIds).in('supply_type_id', supplyTypeIds)
          : Promise.resolve({ data: [] as { id: string; storeroom_id: string; supply_type_id: string }[] }),
      ])

      const bagLotIds = (bagLots ?? []).map((l: any) => l.id)
      const srcInvIds = (storeroomInventory ?? []).map((i: any) => i.id)
      const [{ data: bagUnits }, { data: storeroomLots }] = await Promise.all([
        bagLotIds.length > 0
          ? adminClient.from('medical_stock_units').select('id, lot_id, control_number, status').in('lot_id', bagLotIds)
          : Promise.resolve({ data: [] }),
        srcInvIds.length > 0
          ? adminClient.from('medical_stock_lots').select('id, storeroom_inventory_id, lot_number, quantity_remaining, expiration_date').in('storeroom_inventory_id', srcInvIds).eq('active', true).gt('quantity_remaining', 0)
          : Promise.resolve({ data: [] }),
      ])
      return { bagStandards, bagItemRows, bagInventory, bagLots, supplyTypes, storeroomInventory, bagUnits, storeroomLots }
    }

    // Compartment storerooms: stock in them + the source stock for Transfer In
    const loadCompartmentStock = async () => {
      const { data: compInv } = compStoreroomIds.length > 0
        ? await adminClient.from('medical_storeroom_inventory').select('id, storeroom_id, supply_type_id, par_level').in('storeroom_id', compStoreroomIds)
        : { data: [] as { id: string; storeroom_id: string; supply_type_id: string; par_level: number }[] }
      const compInvIds = (compInv ?? []).map((i: any) => i.id)
      const compSupplyTypeIds = [...new Set((compInv ?? []).map((i: any) => i.supply_type_id))] as string[]

      const [{ data: compLots }, { data: compSupplyTypes }, { data: srcInv }] = await Promise.all([
        compInvIds.length > 0
          ? adminClient.from('medical_stock_lots').select('id, storeroom_inventory_id, lot_number, expiration_date, quantity_received, quantity_remaining, received_date, concentration_amount, concentration_unit, volume_per_unit, volume_unit').in('storeroom_inventory_id', compInvIds).eq('active', true).gt('quantity_remaining', 0).order('expiration_date', { ascending: true, nullsFirst: false })
          : Promise.resolve({ data: [] }),
        compSupplyTypeIds.length > 0
          ? adminClient.from('medical_supply_types').select('id, name, category, unit_of_measure, is_controlled, tracks_expiration, required_signatures').in('id', compSupplyTypeIds)
          : Promise.resolve({ data: [] }),
        // Source storerooms for Transfer In (station storerooms that have matching supply types)
        storeroomIds.length > 0 && compSupplyTypeIds.length > 0
          ? adminClient.from('medical_storeroom_inventory').select('id, storeroom_id, supply_type_id').in('storeroom_id', storeroomIds).in('supply_type_id', compSupplyTypeIds)
          : Promise.resolve({ data: [] as { id: string; storeroom_id: string; supply_type_id: string }[] }),
      ])
      const compLotIds = (compLots ?? []).map((l: any) => l.id)
      const compSrcInvIds = (srcInv ?? []).map((i: any) => i.id)
      const [{ data: compUnits }, { data: srcLots }] = await Promise.all([
        compLotIds.length > 0
          ? adminClient.from('medical_stock_units').select('id, lot_id, control_number, status').in('lot_id', compLotIds)
          : Promise.resolve({ data: [] }),
        compSrcInvIds.length > 0
          ? adminClient.from('medical_stock_lots').select('id, storeroom_inventory_id, lot_number, quantity_remaining, expiration_date').in('storeroom_inventory_id', compSrcInvIds).eq('active', true).gt('quantity_remaining', 0)
          : Promise.resolve({ data: [] }),
      ])
      return { compInv, compLots, compSupplyTypes, srcInv, compUnits, srcLots }
    }

    const [bagStuff, compStuff] = await Promise.all([loadBags(), loadCompartmentStock()])
    return { bags, bagTemplates, deptStorerooms, deptPersonnel, compStorerooms, allSupplyTypes, ...bagStuff, ...compStuff }
  }

  const [truck, moveTargets, medical] = await Promise.all([loadTruckEquipment(), loadMoveTargets(), loadMedical()])
  const { typeData, stationData, compartmentNameData, locationStandards, itemData, assignedAssetsRaw, categoryData } = truck
  const { allCompartmentLinks, allCompartmentNames } = moveTargets

  const compartmentNameMap = Object.fromEntries((compartmentNameData ?? []).map(c => [c.id, c]))
  const assignedCountByItem = (assignedAssetsRaw ?? []).reduce<Record<string, number>>((acc, a) => {
    acc[a.item_id] = (acc[a.item_id] ?? 0) + 1
    return acc
  }, {})
  const itemMap = Object.fromEntries((itemData ?? []).map(i => [i.id, i]))
  const categoryMap = Object.fromEntries((categoryData ?? []).map(c => [c.id, c.category_name]))

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
        qr_code: c.qr_code ?? null,
        items,
      }
    })
    .sort((a, b) => a.sort_order - b.sort_order)

  // The department's compartment library (names not already on this truck) and its presets.
  const onTruckNameIds = new Set((compartmentLinks ?? []).map(c => c.compartment_name_id))
  const compartmentLibrary = (libraryRaw ?? []).filter(c => !onTruckNameIds.has(c.id))

  const apparatusWithRefs = {
    id: apparatus.id,
    unit_number: apparatus.unit_number,
    apparatus_name: apparatus.apparatus_name,
    type_name: (typeData ?? [])[0]?.name ?? null,
    station: (stationData ?? [])[0] ?? null,
  }

  // Medical bags + compartment storerooms
  let medicalBagData: any = null
  let medicalCompartmentData: any = null
  let medicalSupplyTypes: { id: string; name: string; category: string; unit_of_measure: string }[] = []
  let medicationsByCompartment: Record<string, {
    storeroom_inventory_id: string
    supply_type_id: string
    supply_name: string
    unit_of_measure: string
    par_level: number
    current_quantity: number
    status: MedicalSupplyStatus
  }[]> = {}
  if (medical) {
    const { bags, bagTemplates, deptStorerooms, deptPersonnel, compStorerooms, allSupplyTypes,
      bagStandards, bagItemRows, bagInventory, bagLots, supplyTypes, storeroomInventory, bagUnits, storeroomLots,
      compInv, compLots, compSupplyTypes, srcInv, compUnits, srcLots } = medical

    // Where each bag sits ("In PC-2" / "Inside Trauma Box 1") and its equipment items (2B)
    const bagNameById = Object.fromEntries((bags ?? []).map(b => [b.id, b.name]))
    const compCodeById = Object.fromEntries(compartments.map(c => [c.id, c.compartment_code]))
    const bagsWithLocation = (bags ?? []).map(b => ({
      ...b,
      location_label: b.parent_storeroom_id
        ? `Inside ${bagNameById[b.parent_storeroom_id] ?? 'another bag'}`
        : b.compartment_id ? `In ${compCodeById[b.compartment_id] ?? 'a compartment'}` : null,
    }))
    const bagItemName = Object.fromEntries((bagItemRows ?? []).map(i => [i.id, i.item_name]))
    const bagEquipment = (bagStandards ?? []).map(s => ({
      id: s.id, storeroom_id: s.storeroom_id as string, item_name: bagItemName[s.item_id] ?? '—', expected_quantity: s.expected_quantity,
    }))

    const personnel = (deptPersonnel ?? [])
      .map((dp: any) => ({ id: (dp.personnel as any)?.id ?? dp.personnel_id, name: [(dp.personnel as any)?.first_name, (dp.personnel as any)?.last_name].filter(Boolean).join(' ') }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name))

    // Every compartment in the department (any truck) as a place to move a bag to.
    const unitById = Object.fromEntries((allApparatusList ?? []).map(a => [a.id, a.unit_number]))
    const codeByNameId = Object.fromEntries((allCompartmentNames ?? []).map(n => [n.id, n.compartment_code]))
    const allCompartmentOptions = (allCompartmentLinks ?? [])
      .map(c => ({ id: c.id, name: `Unit ${unitById[c.apparatus_id] ?? '?'} — ${codeByNameId[c.compartment_name_id] ?? '—'}` }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

    medicalBagData = {
      bags: bagsWithLocation, bagEquipment,
      compartmentOptions: allCompartmentOptions, bagInventory: bagInventory ?? [], bagLots: bagLots ?? [],
      supplyTypes: supplyTypes ?? [], deptStorerooms: deptStorerooms ?? [],
      storeroomInventory: storeroomInventory ?? [], storeroomLots: storeroomLots ?? [],
      units: bagUnits ?? [],
      personnel, bagTemplates: bagTemplates ?? [], apparatusId: id,
    }

    // Enrich compartment storerooms with the compartment's display info (already loaded above)
    const compLinkById = Object.fromEntries((compartmentLinks ?? []).map(c => [c.id, c]))
    const compStoreroomsWithInfo = (compStorerooms ?? []).map((s: any) => {
      const link = compLinkById[s.compartment_id]
      const cn = link ? compartmentNameMap[link.compartment_name_id] : null
      return { ...s, compartment_code: cn?.compartment_code ?? '—', compartment_name: cn?.compartment_name ?? null }
    })

    medicalCompartmentData = {
      compartmentStorerooms: compStoreroomsWithInfo,
      compInventory: compInv ?? [],
      compLots: compLots ?? [],
      compSupplyTypes: compSupplyTypes ?? [],
      deptStorerooms: deptStorerooms ?? [],
      srcInventory: srcInv ?? [],
      srcLots: srcLots ?? [],
      units: compUnits ?? [],
      personnel,
      apparatusId: id,
    }

    medicalSupplyTypes = allSupplyTypes ?? []

    // Summarize each compartment's assigned medications for the merged item list.
    for (const room of compStoreroomsWithInfo) {
      const invRows = (compInv ?? []).filter((i: any) => i.storeroom_id === room.id)
      medicationsByCompartment[room.compartment_id] = invRows.map((inv: any) => {
        const supply = (compSupplyTypes ?? []).find((s: any) => s.id === inv.supply_type_id)
        const lots = (compLots ?? []).filter((l: any) => l.storeroom_inventory_id === inv.id)
        const current_quantity = lots.reduce((sum: number, l: any) => sum + l.quantity_remaining, 0)
        return {
          storeroom_inventory_id: inv.id,
          supply_type_id: inv.supply_type_id,
          supply_name: supply?.name ?? 'Unknown',
          unit_of_measure: supply?.unit_of_measure ?? '',
          par_level: inv.par_level,
          current_quantity,
          status: getMedicalSupplyStatus(current_quantity, inv.par_level, lots),
        }
      })
    }
  }

  return (
    <div>
      <EquipmentDetailClient
        apparatus={apparatusWithRefs}
        compartments={compartments}
        allItems={allItems ?? []}
        allCategories={allCategories ?? []}
        allApparatus={allApparatus}
        isAdmin={isAdmin}
        isOfficerOrAbove={isOfficerOrAbove}
        canManageDeptSetup={equipmentPermissions.manage_dept_setup}
        compartmentLibrary={compartmentLibrary}
        presetOptions={presetRows ?? []}
        backHref={from}
        medicalSupplyTypes={medicalSupplyTypes}
        medicationsByCompartment={medicationsByCompartment}
        bagSection={medicalBagData ? {
          bags: medicalBagData.bags,
          bagEquipment: medicalBagData.bagEquipment,
          compartmentOptions: medicalBagData.compartmentOptions,
          bagInventory: medicalBagData.bagInventory,
          bagLots: medicalBagData.bagLots,
          supplyTypes: medicalBagData.supplyTypes,
          deptStorerooms: medicalBagData.deptStorerooms,
          storeroomInventory: medicalBagData.storeroomInventory,
          storeroomLots: medicalBagData.storeroomLots,
          units: medicalBagData.units,
          personnel: medicalBagData.personnel,
          bagTemplates: medicalBagData.bagTemplates,
          apparatusId: medicalBagData.apparatusId,
          isAdmin,
          isOfficerOrAbove,
          myPersonnelId: me.id,
        } : null}
        // Medical rows (Use / Restock / Transfer) render inside each compartment card now,
        // instead of a separate section at the bottom of the page.
        medicalSection={medicalCompartmentData && medicalCompartmentData.compartmentStorerooms.length > 0 ? {
          ...medicalCompartmentData,
          isAdmin,
          isOfficerOrAbove,
          myPersonnelId: me.id,
        } : null}
      />
    </div>
  )
}
