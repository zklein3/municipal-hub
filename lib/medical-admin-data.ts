import type { SupabaseClient } from '@supabase/supabase-js'

// Everything the Medication Types and Bags sections of the Medical page need (MedicalAdminClient).
// Moved out of the Setup page when Medical setup moved onto /medical (one Medical page, mode buttons).
export async function getMedicalAdminData(adminClient: SupabaseClient, department_id: string) {
  const [
    { data: dept },
    { data: supplyTypes },
    { data: storerooms },
    { data: stations },
    { data: apparatusRaw },
    { data: apparatusTypes },
    { data: bagTemplates },
    { data: bagDeployments },
    { data: itemCategories },
  ] = await Promise.all([
    adminClient.from('departments').select('module_medical_controlled').eq('id', department_id).single(),
    adminClient.from('medical_supply_types')
      .select('id, name, category, unit_of_measure, is_controlled, tracks_expiration, required_signatures, notes, active')
      .eq('department_id', department_id).order('category').order('name'),
    adminClient.from('medical_storerooms')
      .select('id, name, station_id, apparatus_id, compartment_id, notes, active')
      .eq('department_id', department_id).eq('container_kind', 'storeroom').order('name'),
    adminClient.from('stations').select('id, station_name, station_number').eq('department_id', department_id).order('station_number'),
    adminClient.from('apparatus').select('id, unit_number, apparatus_type_id').eq('department_id', department_id).eq('active', true).order('unit_number'),
    adminClient.from('apparatus_types').select('id, name'),
    adminClient.from('medical_bag_templates').select('id, name, description, active').eq('department_id', department_id).order('name'),
    adminClient.from('medical_storerooms')
      .select('id, name, apparatus_id, template_id, inventory_mode, compartment_id')
      .eq('department_id', department_id).eq('active', true).not('apparatus_id', 'is', null).eq('container_kind', 'bag'),
    // For "move to the equipment catalog" (pick its category)
    adminClient.from('item_categories').select('id, category_name').eq('department_id', department_id).eq('active', true).order('sort_order'),
  ])

  const typeName = Object.fromEntries((apparatusTypes ?? []).map(t => [t.id, t.name]))
  const apparatus = (apparatusRaw ?? []).map(a => ({
    id: a.id, unit_number: a.unit_number, type_name: a.apparatus_type_id ? (typeName[a.apparatus_type_id] ?? null) : null,
  }))

  const storeroomIds = (storerooms ?? []).map(s => s.id)
  const templateIds = (bagTemplates ?? []).map(t => t.id)
  const apparatusIds = apparatus.map(a => a.id)
  const [{ data: storeroomInventory }, { data: templateItems }, { data: compLinks }, { data: catalogItems }] = await Promise.all([
    storeroomIds.length > 0
      ? adminClient.from('medical_storeroom_inventory').select('id, storeroom_id, supply_type_id, par_level').in('storeroom_id', storeroomIds)
      : Promise.resolve({ data: [] as { id: string; storeroom_id: string; supply_type_id: string; par_level: number }[] }),
    templateIds.length > 0
      ? adminClient.from('medical_bag_template_items').select('id, template_id, supply_type_id, par_level').in('template_id', templateIds)
      : Promise.resolve({ data: [] as { id: string; template_id: string; supply_type_id: string; par_level: number }[] }),
    apparatusIds.length > 0
      ? adminClient.from('apparatus_compartments').select('id, apparatus_id, compartment_name_id').in('apparatus_id', apparatusIds).eq('active', true)
      : Promise.resolve({ data: [] as { id: string; apparatus_id: string; compartment_name_id: string }[] }),
    adminClient.from('items').select('id, item_name').eq('department_id', department_id).eq('active', true).order('item_name'),
  ])

  // Equipment items and child bags a bag template contains (2B)
  const [{ data: templateEquipment }, { data: templateChildren }] = await Promise.all([
    templateIds.length > 0
      ? adminClient.from('bag_template_items').select('id, template_id, item_id, expected_qty').in('template_id', templateIds)
      : Promise.resolve({ data: [] as { id: string; template_id: string; item_id: string; expected_qty: number }[] }),
    templateIds.length > 0
      ? adminClient.from('bag_template_children').select('id, template_id, child_template_id, quantity').in('template_id', templateIds)
      : Promise.resolve({ data: [] as { id: string; template_id: string; child_template_id: string; quantity: number }[] }),
  ])

  // Destinations for "place a bag elsewhere": existing bags (any location) and department members
  const [{ data: allBagRows }, { data: memberRows }] = await Promise.all([
    adminClient.from('medical_storerooms').select('id, name, template_id, apparatus_id, parent_storeroom_id, assigned_personnel_id').eq('department_id', department_id).eq('active', true).eq('container_kind', 'bag').order('name'),
    adminClient.from('department_personnel').select('personnel_id, personnel(first_name, last_name)').eq('department_id', department_id).eq('active', true),
  ])
  const members = (memberRows ?? [])
    .map((m: any) => ({ id: m.personnel_id as string, name: [m.personnel?.first_name, m.personnel?.last_name].filter(Boolean).join(' ') || 'Unnamed' }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const inventoryIds = (storeroomInventory ?? []).map(i => i.id)
  const nameIds = [...new Set((compLinks ?? []).map(c => c.compartment_name_id))]
  const [{ data: lots }, { data: compNames }] = await Promise.all([
    inventoryIds.length > 0
      ? adminClient.from('medical_stock_lots')
          .select('id, storeroom_inventory_id, lot_number, quantity_remaining, expiration_date')
          .in('storeroom_inventory_id', inventoryIds).eq('active', true).gt('quantity_remaining', 0)
      : Promise.resolve({ data: [] as { id: string; storeroom_inventory_id: string; lot_number: string | null; quantity_remaining: number; expiration_date: string | null }[] }),
    nameIds.length > 0
      ? adminClient.from('compartment_names').select('id, compartment_code, compartment_name, sort_order').in('id', nameIds)
      : Promise.resolve({ data: [] as { id: string; compartment_code: string; compartment_name: string | null; sort_order: number | null }[] }),
  ])

  const nameById = Object.fromEntries((compNames ?? []).map(c => [c.id, c]))
  const apparatusCompartments = (compLinks ?? []).map(c => ({
    id: c.id,
    apparatus_id: c.apparatus_id,
    compartment_code: nameById[c.compartment_name_id]?.compartment_code ?? '—',
    compartment_name: nameById[c.compartment_name_id]?.compartment_name ?? null,
    sort_order: nameById[c.compartment_name_id]?.sort_order ?? 999,
  })).sort((a, b) => a.sort_order - b.sort_order)

  return {
    supplyTypes: supplyTypes ?? [],
    storerooms: storerooms ?? [],
    stations: stations ?? [],
    apparatus,
    apparatusCompartments,
    storeroomInventory: storeroomInventory ?? [],
    lots: lots ?? [],
    bagTemplates: bagTemplates ?? [],
    templateItems: templateItems ?? [],
    templateEquipment: templateEquipment ?? [],
    templateChildren: templateChildren ?? [],
    catalogItems: catalogItems ?? [],
    allBags: allBagRows ?? [],
    members,
    bagDeployments: bagDeployments ?? [],
    moduleMedicalControlled: dept?.module_medical_controlled ?? false,
    itemCategories: itemCategories ?? [],
  }
}

export type MedicalAdminData = Awaited<ReturnType<typeof getMedicalAdminData>>
