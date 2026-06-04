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

  const { data: deptRow } = await adminClient.from('departments').select('module_medical').eq('id', myDept.department_id).single()
  if (!deptRow?.module_medical) redirect('/dept-admin')

  const department_id = myDept.department_id

  const [
    { data: supplyTypes },
    { data: storerooms },
    { data: stations },
    { data: apparatusList },
  ] = await Promise.all([
    adminClient.from('medical_supply_types')
      .select('id, name, category, unit_of_measure, is_controlled, tracks_expiration, required_signatures, notes, active')
      .eq('department_id', department_id)
      .order('category')
      .order('name'),
    adminClient.from('medical_storerooms')
      .select('id, name, station_id, apparatus_id, notes, active')
      .eq('department_id', department_id)
      .order('name'),
    adminClient.from('stations')
      .select('id, station_name, station_number')
      .eq('department_id', department_id)
      .order('station_number'),
    adminClient.from('apparatus')
      .select('id, unit_number, apparatus_types(name)')
      .eq('department_id', department_id)
      .order('unit_number'),
  ])

  // Storeroom inventory (supply types assigned to each storeroom)
  const storeroomIds = (storerooms ?? []).map(s => s.id)
  const { data: storeroomInventory } = storeroomIds.length > 0
    ? await adminClient.from('medical_storeroom_inventory')
        .select('id, storeroom_id, supply_type_id, par_level')
        .in('storeroom_id', storeroomIds)
    : { data: [] }

  const apparatus = (apparatusList ?? []).map(a => ({
    id: a.id,
    unit_number: a.unit_number,
    type_name: (a.apparatus_types as any)?.name ?? null,
  }))

  // Bag templates
  const { data: bagTemplates } = await adminClient
    .from('medical_bag_templates')
    .select('id, name, description, active')
    .eq('department_id', department_id)
    .order('name')

  const templateIds = (bagTemplates ?? []).map(t => t.id)
  const [{ data: templateItems }, { data: bagDeployments }] = await Promise.all([
    templateIds.length > 0
      ? adminClient.from('medical_bag_template_items').select('id, template_id, supply_type_id, par_level').in('template_id', templateIds)
      : Promise.resolve({ data: [] }),
    adminClient.from('medical_storerooms')
      .select('id, name, apparatus_id, template_id, inventory_mode')
      .eq('department_id', department_id)
      .eq('active', true)
      .not('apparatus_id', 'is', null),
  ])

  return (
    <MedicalAdminClient
      supplyTypes={supplyTypes ?? []}
      storerooms={storerooms ?? []}
      stations={stations ?? []}
      apparatus={apparatus}
      storeroomInventory={storeroomInventory ?? []}
      bagTemplates={bagTemplates ?? []}
      templateItems={templateItems ?? []}
      bagDeployments={bagDeployments ?? []}
      departmentId={department_id}
    />
  )
}
