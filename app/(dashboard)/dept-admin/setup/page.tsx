import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { getPermissionSnapshot } from '@/lib/permissions'
import SetupFlowClient from './SetupFlowClient'

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  // Medical setup moved to the one Medical page (mode buttons) — keep old links working.
  if (tab === 'medical') redirect('/medical?mode=types')
  // The Inventory tab was a duplicate of the truck screen — send old links there.
  if (tab === 'inventory') redirect('/equipment')

  const adminClient = createAdminClient()

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (!ctx.departmentId) redirect('/dashboard')
  const perms = await getPermissionSnapshot(ctx)
  const canManageDeptSetup = perms.manage_dept_setup
  if (!canManageDeptSetup) redirect(perms.manage_medical_supply_setup ? '/medical?mode=types' : '/dashboard')

  const department_id = ctx.departmentId

  // Round 1: everything that only needs the department id, in one trip
  const [
    { data: deptData },
    { data: medicalSupplyTypesFull },
    { data: stations },
    { data: apparatusRaw },
    { data: apparatusTypes },
    { data: compartmentsRaw },
    { data: apparatusForCompartments },
    { data: categories },
    { data: items },
    { data: deptPersonnelRaw },
    { data: roles },
    { data: presets },
    { data: customFieldDefsRaw },
  ] = await Promise.all([
    adminClient.from('departments')
      .select('id, name, module_iso, module_medical, module_medical_controlled')
      .eq('id', department_id)
      .single(),
    // Only used when the medical module is on (decided once the department row is back)
    adminClient.from('medical_supply_types')
      .select('id, name, category, unit_of_measure, is_controlled, tracks_expiration, required_signatures, notes, active')
      .eq('department_id', department_id)
      .order('category')
      .order('name'),
    adminClient.from('stations')
      .select('id, station_number, station_name, address_line_1, city, state, postal_code, active, notes')
      .eq('department_id', department_id)
      .order('station_number'),
    adminClient.from('apparatus')
      .select('id, unit_number, apparatus_name, make, model, model_year, vin, license_plate, active, in_service_date, apparatus_type_id, station_id')
      .eq('department_id', department_id)
      .order('unit_number'),
    adminClient.from('apparatus_types')
      .select('id, name, sort_order')
      .eq('active', true)
      .order('sort_order'),
    adminClient.from('compartment_names')
      .select('id, compartment_code, compartment_name, sort_order, active')
      .eq('department_id', department_id)
      .order('sort_order', { ascending: true, nullsFirst: false }),
    adminClient.from('apparatus')
      .select('id, unit_number, apparatus_name')
      .eq('department_id', department_id)
      .eq('active', true)
      .order('unit_number'),
    adminClient.from('item_categories')
      .select('id, category_name, active, sort_order')
      .eq('department_id', department_id)
      .order('sort_order'),
    adminClient.from('items')
      .select('id, item_name, item_description, category_id, tracks_quantity, tracks_assets, requires_presence_check, requires_inspection, tracks_expiration, active')
      .eq('department_id', department_id)
      .order('item_name'),
    adminClient.from('department_personnel')
      .select('id, system_role, signup_status, active, employee_number, hire_date, role_id, personnel_id')
      .eq('department_id', department_id)
      .order('system_role'),
    adminClient.from('personnel_roles')
      .select('id, name, is_officer, sort_order')
      .eq('active', true)
      .order('sort_order'),
    // Compartment presets (their contents come in round 2)
    adminClient.from('compartment_presets')
      .select('id, name, default_code, description, sort_order, active')
      .eq('department_id', department_id),
    adminClient.from('item_custom_field_definitions')
      .select('id, item_id, field_label, field_order')
      .eq('department_id', department_id)
      .order('field_order'),
  ])

  const department = { id: deptData?.id ?? department_id, name: deptData?.name ?? 'Your Department' }
  const moduleMedical = deptData?.module_medical ?? false
  const medicalSupplyTypes = moduleMedical ? (medicalSupplyTypesFull ?? []).filter(s => s.active) : []

  // Build apparatus with type + station lookups
  const typeMap = Object.fromEntries((apparatusTypes ?? []).map(t => [t.id, t.name]))
  const stationMap = Object.fromEntries((stations ?? []).map(s => [s.id, s]))
  const apparatus = (apparatusRaw ?? []).map(a => ({
    ...a,
    type_name: a.apparatus_type_id ? (typeMap[a.apparatus_type_id] ?? null) : null,
    station: a.station_id ? (stationMap[a.station_id] ?? null) : null,
  }))

  // Round 2: everything that needs an id list from round 1
  const apparatusIds = (apparatusRaw ?? []).map(a => a.id)
  const presetIds = (presets ?? []).map(p => p.id)
  const personnelIds = (deptPersonnelRaw ?? []).map(dp => dp.personnel_id).filter(Boolean)
  const assetItemIds = (items ?? []).filter(i => i.tracks_assets).map(i => i.id)
  const inspectionItemIds = (items ?? []).filter(i => i.requires_inspection).map(i => i.id)
  const [
    { data: truckCompartmentLinks },
    { data: presetItems }, { data: presetMeds }, { data: presetTypes },
    { data: personnelData },
    { data: assets },
    { data: templates },
  ] = await Promise.all([
    // Every truck's compartments (deploy targets) — also what the compartment usage counts come from
    apparatusIds.length > 0
      ? adminClient.from('apparatus_compartments').select('id, apparatus_id, compartment_name_id').in('apparatus_id', apparatusIds).eq('active', true)
      : Promise.resolve({ data: [] as { id: string; apparatus_id: string; compartment_name_id: string }[] }),
    presetIds.length > 0
      ? adminClient.from('compartment_preset_items').select('preset_id, item_id, expected_quantity, minimum_quantity').in('preset_id', presetIds)
      : Promise.resolve({ data: [] as { preset_id: string; item_id: string; expected_quantity: number; minimum_quantity: number | null }[] }),
    presetIds.length > 0
      ? adminClient.from('compartment_preset_medications').select('preset_id, supply_type_id, par_level').in('preset_id', presetIds)
      : Promise.resolve({ data: [] as { preset_id: string; supply_type_id: string; par_level: number }[] }),
    presetIds.length > 0
      ? adminClient.from('compartment_preset_types').select('preset_id, apparatus_type_id').in('preset_id', presetIds)
      : Promise.resolve({ data: [] as { preset_id: string; apparatus_type_id: string }[] }),
    // Personnel names
    personnelIds.length > 0
      ? adminClient.from('personnel').select('id, first_name, last_name, email, signup_status').in('id', personnelIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string | null; last_name: string | null; email: string | null; signup_status: string | null }[] }),
    // Assets for tracks_assets items
    assetItemIds.length > 0
      ? adminClient.from('item_assets')
          .select('id, item_id, asset_tag, serial_number, in_service_date, status, active, notes, apparatus_id, custom_field_values')
          .eq('department_id', department_id)
          .in('item_id', assetItemIds)
          .order('asset_tag')
      : Promise.resolve({ data: [] as any[] }),
    // Inspection templates for inspectable items
    inspectionItemIds.length > 0
      ? adminClient.from('item_inspection_templates')
          .select('id, item_id, template_name, template_description, active')
          .eq('department_id', department_id)
          .in('item_id', inspectionItemIds)
          .order('template_name')
      : Promise.resolve({ data: [] as any[] }),
  ])

  const compartmentNameById = Object.fromEntries((compartmentsRaw ?? []).map(c => [c.id, c]))
  const truckCompartments = (truckCompartmentLinks ?? []).map(c => ({
    id: c.id,
    apparatus_id: c.apparatus_id,
    code: compartmentNameById[c.compartment_name_id]?.compartment_code ?? '—',
    name: compartmentNameById[c.compartment_name_id]?.compartment_name ?? null,
  }))

  // Compartment assignment maps (which trucks use each compartment name)
  const usageMap: Record<string, number> = {}
  const assignmentMap: Record<string, string[]> = {}
  for (const a of truckCompartmentLinks ?? []) {
    usageMap[a.compartment_name_id] = (usageMap[a.compartment_name_id] ?? 0) + 1
    if (!assignmentMap[a.compartment_name_id]) assignmentMap[a.compartment_name_id] = []
    assignmentMap[a.compartment_name_id].push(a.apparatus_id)
  }

  const personnelMap = Object.fromEntries((personnelData ?? []).map(p => [p.id, p]))
  const roleMap = Object.fromEntries((roles ?? []).map(r => [r.id, r]))
  const personnel = (deptPersonnelRaw ?? []).map(dp => ({
    id: dp.id,
    system_role: dp.system_role,
    signup_status: dp.signup_status,
    active: dp.active,
    employee_number: dp.employee_number,
    hire_date: dp.hire_date,
    role_id: dp.role_id,
    personnel_id: dp.personnel_id,
    personnel: personnelMap[dp.personnel_id] ?? null,
    personnel_roles: dp.role_id ? (roleMap[dp.role_id] ?? null) : null,
  }))

  // Group custom field defs by item_id
  const customFieldDefs: Record<string, { id: string; item_id: string; field_label: string; field_order: number }[]> = {}
  for (const def of customFieldDefsRaw ?? []) {
    if (!customFieldDefs[def.item_id]) customFieldDefs[def.item_id] = []
    customFieldDefs[def.item_id].push(def)
  }

  // Round 3: inspection template steps (need the template ids)
  const templateIds = (templates ?? []).map(t => t.id)
  const { data: steps } = templateIds.length > 0
    ? await adminClient
        .from('item_inspection_template_steps')
        .select('id, template_id, step_text, step_type, required, fail_if_negative, sort_order, active')
        .in('template_id', templateIds)
        .eq('active', true)
        .order('sort_order')
    : { data: [] }

  return (
    <SetupFlowClient
      department={department}
      stations={stations ?? []}
      apparatus={apparatus}
      apparatusTypes={apparatusTypes ?? []}
      personnel={personnel}
      roles={roles ?? []}
      compartments={compartmentsRaw ?? []}
      usageMap={usageMap}
      assignmentMap={assignmentMap}
      apparatusForCompartments={apparatusForCompartments ?? []}
      categories={categories ?? []}
      items={items ?? []}
      assets={assets ?? []}
      templates={templates ?? []}
      steps={steps ?? []}
      departmentId={department_id}
      moduleIso={deptData?.module_iso ?? false}
      customFieldDefs={customFieldDefs}
      medicalSupplyTypes={medicalSupplyTypes ?? []}
      presetData={{
        presets: presets ?? [],
        presetItems: presetItems ?? [],
        presetMeds: presetMeds ?? [],
        presetTypes: presetTypes ?? [],
        truckCompartments,
      }}
      canManageDeptSetup={canManageDeptSetup}
      moduleMedical={moduleMedical}
    />
  )
}
