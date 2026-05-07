import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import BackButton from '@/components/BackButton'
import StorageClient from './StorageClient'

export default async function StoragePage() {
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
  const department_id = myDept.department_id

  // Items — quantity-tracked only
  const { data: itemsRaw } = await adminClient
    .from('items')
    .select('id, item_name, category_id, department_quantity')
    .eq('department_id', department_id)
    .eq('active', true)
    .eq('tracks_quantity', true)
    .order('item_name')

  // Categories flat
  const categoryIds = [...new Set((itemsRaw ?? []).map(i => i.category_id).filter(Boolean))]
  const { data: categoriesRaw } = categoryIds.length > 0
    ? await adminClient.from('item_categories').select('id, category_name').in('id', categoryIds)
    : { data: [] }
  const categoryMap = Object.fromEntries((categoriesRaw ?? []).map(c => [c.id, c.category_name]))

  // Storage records
  const { data: storageRaw } = await adminClient
    .from('department_item_storage')
    .select('id, item_id, quantity, par_quantity')
    .eq('department_id', department_id)
  const storageMap = Object.fromEntries((storageRaw ?? []).map(s => [s.item_id, s]))

  // Apparatus for dept
  const { data: apparatusRaw } = await adminClient
    .from('apparatus')
    .select('id, unit_number, apparatus_name')
    .eq('department_id', department_id)
    .eq('active', true)
    .order('unit_number')

  const apparatusIds = (apparatusRaw ?? []).map(a => a.id)

  // Compartments flat
  const { data: compartmentsRaw } = apparatusIds.length > 0
    ? await adminClient
        .from('apparatus_compartments')
        .select('id, apparatus_id, compartment_code, compartment_name')
        .in('apparatus_id', apparatusIds)
        .eq('active', true)
        .order('sort_order')
    : { data: [] }

  const compartmentIds = (compartmentsRaw ?? []).map(c => c.id)

  // Location standards to compute compartment totals
  const { data: locationStandards } = compartmentIds.length > 0
    ? await adminClient
        .from('item_location_standards')
        .select('item_id, expected_quantity')
        .in('apparatus_compartment_id', compartmentIds)
        .eq('active', true)
    : { data: [] }

  // Compartment total per item
  const compartmentTotalMap: Record<string, number> = {}
  for (const ls of locationStandards ?? []) {
    compartmentTotalMap[ls.item_id] = (compartmentTotalMap[ls.item_id] ?? 0) + (ls.expected_quantity ?? 0)
  }

  // Apparatus with compartments for Add to Compartment modal
  const allApparatus = (apparatusRaw ?? []).map(a => ({
    id: a.id,
    unit_number: a.unit_number,
    apparatus_name: a.apparatus_name,
    compartments: (compartmentsRaw ?? [])
      .filter(c => c.apparatus_id === a.id)
      .map(c => ({ id: c.id, compartment_code: c.compartment_code, compartment_name: c.compartment_name })),
  }))

  // Merge into storage items
  const storageItems = (itemsRaw ?? []).map(item => {
    const storageRow = storageMap[item.id] ?? null
    const compartment_total = compartmentTotalMap[item.id] ?? 0
    const storage_qty = storageRow?.quantity ?? 0
    const storage_par = storageRow?.par_quantity ?? 0
    const department_quantity = item.department_quantity ?? null
    const accounted_for = compartment_total + storage_qty
    const variance = department_quantity !== null ? accounted_for - department_quantity : null

    return {
      item_id: item.id,
      item_name: item.item_name,
      category_name: categoryMap[item.category_id] ?? '',
      storage_qty,
      storage_par,
      compartment_total,
      department_quantity,
      accounted_for,
      variance,
    }
  })

  const belowParCount = storageItems.filter(i => i.storage_par > 0 && i.storage_qty < i.storage_par).length
  const missingCount = storageItems.filter(i => i.variance !== null && i.variance < 0).length

  return (
    <div className="max-w-3xl">
      <div className="mb-2">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">Inventory Storage</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Department-wide unassigned item pool and inventory totals</p>
      </div>

      {(belowParCount > 0 || missingCount > 0) && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          {belowParCount > 0 && <span className="font-semibold">{belowParCount} item{belowParCount !== 1 ? 's' : ''} below storage PAR</span>}
          {belowParCount > 0 && missingCount > 0 && ' · '}
          {missingCount > 0 && <span className="font-semibold">{missingCount} item{missingCount !== 1 ? 's' : ''} missing from department total</span>}
        </div>
      )}

      <div className="mb-5">
        <BackButton href="/equipment" />
      </div>

      <StorageClient
        items={storageItems}
        allApparatus={allApparatus}
        isAdmin={isAdmin}
        isOfficerOrAbove={isOfficerOrAbove}
      />
    </div>
  )
}
