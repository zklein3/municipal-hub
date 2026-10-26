'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { hasPermission } from '@/lib/permissions'
import { logError } from '@/lib/logger'
import { assignCompartmentQr } from '@/lib/preset-deploy'
import { revalidatePath } from 'next/cache'

// A sys-admin-flagged account can also have a real department selected (the
// normal multi-department flow) -- prefer that resolved context over the
// override so every call site works without having to remember to pass one.
// The override only matters for a sys admin acting with no department
// selected at all (e.g. from a sys-admin-only surface).
async function verifyAdmin(override_department_id?: string) {
  const ctx = await getCurrentDepartmentContext()
  if (!ctx) return null

  const department_id = ctx.departmentId ?? (ctx.isSysAdmin ? override_department_id : null)
  if (!department_id) return null
  if (!ctx.isSysAdmin && !(await hasPermission(ctx, 'manage_dept_setup'))) return null

  return { me: { id: ctx.personnelId, is_sys_admin: ctx.isSysAdmin }, department_id }
}

// Every compartment the system creates gets a QR code (<apparatus qr or unit>-<code>), same as preset deploys.
async function autoQr(adminClient: ReturnType<typeof createAdminClient>, compartment_ids: string[]) {
  if (compartment_ids.length === 0) return
  const { data: acs } = await adminClient.from('apparatus_compartments').select('id, apparatus_id, compartment_name_id, qr_code').in('id', compartment_ids)
  for (const ac of acs ?? []) {
    if (ac.qr_code) continue
    const [{ data: app }, { data: cn }] = await Promise.all([
      adminClient.from('apparatus').select('unit_number, qr_code').eq('id', ac.apparatus_id).single(),
      adminClient.from('compartment_names').select('compartment_code').eq('id', ac.compartment_name_id).single(),
    ])
    if (app && cn) await assignCompartmentQr(adminClient, ac.id, `${app.qr_code ?? app.unit_number}-${cn.compartment_code}`)
  }
}

// ─── Create Compartment Name ──────────────────────────────────────────────────
export async function createCompartmentName(formData: FormData) {
  const override_department_id = formData.get('department_id') as string | null
  const ctx = await verifyAdmin(override_department_id ?? undefined)
  if (!ctx) return { error: 'Only admins can manage compartments.' }

  const compartment_code = (formData.get('compartment_code') as string)?.toUpperCase().trim()
  const compartment_name = formData.get('compartment_name') as string
  const sort_order = formData.get('sort_order') as string

  if (!compartment_code) return { error: 'Compartment code is required.' }

  const adminClient = createAdminClient()

  const { data: existing } = await adminClient
    .from('compartment_names')
    .select('id')
    .eq('department_id', ctx.department_id)
    .eq('compartment_code', compartment_code)

  if (existing?.[0]) return { error: `Compartment code ${compartment_code} already exists.` }

  const { data: created, error } = await adminClient.from('compartment_names').insert({
    department_id: ctx.department_id,
    compartment_code,
    compartment_name: compartment_name || null,
    sort_order: sort_order ? parseInt(sort_order) : null,
    active: true,
  }).select('id').single()

  if (error) {
    await logError(error, '/dept-admin/setup')
    return { error: error.message }
  }

  revalidatePath('/dept-admin/setup')
  return { success: true, id: created.id as string }
}

// ─── Update Compartment Name ──────────────────────────────────────────────────
export async function updateCompartmentName(formData: FormData) {
  const override_department_id = formData.get('department_id') as string | null
  const ctx = await verifyAdmin(override_department_id ?? undefined)
  if (!ctx) return { error: 'Only admins can manage compartments.' }

  const id = formData.get('id') as string
  const compartment_code = (formData.get('compartment_code') as string)?.toUpperCase().trim()
  const compartment_name = formData.get('compartment_name') as string
  const sort_order = formData.get('sort_order') as string
  const active = formData.get('active') === 'true'

  if (!compartment_code) return { error: 'Compartment code is required.' }

  const adminClient = createAdminClient()

  const { error } = await adminClient.from('compartment_names').update({
    compartment_code,
    compartment_name: compartment_name || null,
    sort_order: sort_order ? parseInt(sort_order) : null,
    active,
  }).eq('id', id)

  if (error) {
    await logError(error, '/dept-admin/setup')
    return { error: error.message }
  }

  revalidatePath('/apparatus')
  revalidatePath('/dept-admin/setup')
  return { success: true }
}

// ─── Assign Compartment to Apparatus ─────────────────────────────────────────
export async function assignCompartmentToApparatus(apparatus_id: string, compartment_name_id: string, department_id?: string) {
  const ctx = await verifyAdmin(department_id)
  if (!ctx) return { error: 'Only admins can assign compartments.' }

  const adminClient = createAdminClient()

  const { data: existing } = await adminClient
    .from('apparatus_compartments')
    .select('id')
    .eq('apparatus_id', apparatus_id)
    .eq('compartment_name_id', compartment_name_id)

  if (existing?.[0]) return { error: 'This compartment is already assigned to this apparatus.' }

  const { data: created, error } = await adminClient.from('apparatus_compartments').insert({
    apparatus_id,
    compartment_name_id,
    active: true,
  }).select('id').single()

  if (error) {
    await logError(error, '/apparatus/[id]')
    return { error: error.message }
  }

  await autoQr(adminClient, [created.id as string])
  revalidatePath('/equipment')

  revalidatePath(`/apparatus/${apparatus_id}`)
  return { success: true }
}

// ─── Remove Compartment from Apparatus ───────────────────────────────────────
export async function removeCompartmentFromApparatus(compartment_id: string, apparatus_id: string, department_id?: string) {
  const ctx = await verifyAdmin(department_id)
  if (!ctx) return { error: 'Only admins can remove compartments.' }

  const adminClient = createAdminClient()

  // Removing a compartment silently unpins any medical storeroom/bag pointed at it
  // (that FK is ON DELETE SET NULL, by design, so a bag survives as apparatus-level)
  // and hard-deletes any item location standards pointed at it (ON DELETE CASCADE,
  // wiping that compartment's equipment checklist config with no way back). Both are
  // surprising if the admin didn't mean to detach/lose them, so block and name what's there.
  const [{ data: medicalRooms }, { count: itemStandardCount }] = await Promise.all([
    adminClient.from('medical_storerooms').select('name').eq('compartment_id', compartment_id),
    adminClient.from('item_location_standards').select('id', { count: 'exact', head: true }).eq('apparatus_compartment_id', compartment_id),
  ])

  const blockers: string[] = []
  if (medicalRooms && medicalRooms.length > 0) {
    blockers.push(`has a medical storeroom/bag pinned here (${medicalRooms.map(r => r.name).join(', ')}) — unpin or remove it first`)
  }
  if ((itemStandardCount ?? 0) > 0) {
    blockers.push('has equipment items assigned here — remove them from the compartment first')
  }
  if (blockers.length > 0) {
    return { error: `Can't remove this compartment — it ${blockers.join('; ')}.` }
  }

  const { error } = await adminClient
    .from('apparatus_compartments')
    .delete()
    .eq('id', compartment_id)

  if (error) {
    await logError(error, '/apparatus/[id]')
    return { error: error.message }
  }

  revalidatePath(`/apparatus/${apparatus_id}`)
  return { success: true }
}

// ─── Bulk Set Compartment Apparatus Assignments ───────────────────────────────
export async function bulkSetCompartmentApparatus(
  compartment_name_id: string,
  apparatus_ids: string[],
  department_id?: string
) {
  const ctx = await verifyAdmin(department_id)
  if (!ctx) return { error: 'Only admins can assign compartments.' }

  const adminClient = createAdminClient()

  const { data: existing } = await adminClient
    .from('apparatus_compartments')
    .select('id, apparatus_id')
    .eq('compartment_name_id', compartment_name_id)

  const existingMap = new Map((existing ?? []).map(e => [e.apparatus_id, e.id]))
  const newSet = new Set(apparatus_ids)

  const toAdd = apparatus_ids.filter(id => !existingMap.has(id))
  const toRemove = (existing ?? []).filter(e => !newSet.has(e.apparatus_id))

  if (toAdd.length > 0) {
    const { data: createdRows, error } = await adminClient.from('apparatus_compartments').insert(
      toAdd.map(apparatus_id => ({ apparatus_id, compartment_name_id, active: true }))
    ).select('id')
    if (error) { await logError(error, '/dept-admin/setup'); return { error: error.message } }
    await autoQr(adminClient, (createdRows ?? []).map(r => r.id as string))
  }

  if (toRemove.length > 0) {
    const toRemoveIds = toRemove.map(r => r.id)
    const [{ data: medicalRooms }, { count: itemStandardCount }] = await Promise.all([
      adminClient.from('medical_storerooms').select('name').in('compartment_id', toRemoveIds),
      adminClient.from('item_location_standards').select('id', { count: 'exact', head: true }).in('apparatus_compartment_id', toRemoveIds),
    ])
    const blockers: string[] = []
    if (medicalRooms && medicalRooms.length > 0) {
      blockers.push(`a medical storeroom/bag is pinned to one of these compartments (${medicalRooms.map(r => r.name).join(', ')}) — unpin or remove it first`)
    }
    if ((itemStandardCount ?? 0) > 0) {
      blockers.push('one of these compartments has equipment items assigned — remove them first')
    }
    if (blockers.length > 0) {
      return { error: `Can't remove this compartment from those apparatus — ${blockers.join('; ')}.` }
    }

    const { error } = await adminClient
      .from('apparatus_compartments')
      .delete()
      .in('id', toRemoveIds)
    if (error) { await logError(error, '/dept-admin/setup'); return { error: error.message } }
  }

  revalidatePath('/apparatus')
  revalidatePath('/dept-admin/setup')
  const allAffected = new Set([...toAdd, ...toRemove.map(r => r.apparatus_id)])
  for (const id of allAffected) revalidatePath(`/apparatus/${id}`)

  return { success: true }
}

// ─── Set Compartment QR Code ──────────────────────────────────────────────────
export async function setCompartmentQrCode(compartment_id: string, apparatus_id: string, formData: FormData) {
  const ctx = await verifyAdmin()
  if (!ctx) return { error: 'Only admins can set QR codes.' }
  const adminClient = createAdminClient()
  const qr_code = (formData.get('qr_code') as string)?.toUpperCase().trim() || null
  const { error } = await adminClient
    .from('apparatus_compartments')
    .update({ qr_code })
    .eq('id', compartment_id)
  if (error) { await logError(error, `/equipment/${apparatus_id}/${compartment_id}`); return { error: error.message } }
  revalidatePath(`/equipment/${apparatus_id}/${compartment_id}`)
  return { success: true }
}

// ─── Compartment history (shown inline on the truck screen) ───────────────────
export type CompartmentHistory = {
  inspections: { id: string; inspected_at: string; overall_result: string; inspected_by_name: string | null; asset_tag: string }[]
  presence: { id: string; inspected_at: string; inspected_by_name: string | null; present: boolean; item_name: string }[]
}

export async function fetchCompartmentHistory(compartment_id: string): Promise<CompartmentHistory | { error: string }> {
  const ctx = await getCurrentDepartmentContext()
  if (!ctx?.departmentId) return { error: 'Not signed in' }
  const adminClient = createAdminClient()

  // Department ownership: the compartment's truck must belong to the caller's department.
  const { data: acList } = await adminClient.from('apparatus_compartments').select('apparatus_id').eq('id', compartment_id)
  const apparatus_id = acList?.[0]?.apparatus_id
  if (!apparatus_id) return { error: 'Compartment not found' }
  const { data: appList } = await adminClient.from('apparatus').select('department_id').eq('id', apparatus_id)
  if (appList?.[0]?.department_id !== ctx.departmentId && !ctx.isSysAdmin) return { error: 'Not found' }

  const [{ data: insp }, { data: pres }] = await Promise.all([
    adminClient.from('item_asset_inspection_logs')
      .select('id, inspected_at, overall_result, inspected_by_name, asset_id')
      .eq('compartment_id', compartment_id).order('inspected_at', { ascending: false }).limit(6),
    adminClient.from('compartment_presence_check_logs')
      .select('id, inspected_at, inspected_by_name, present, item_id')
      .eq('compartment_id', compartment_id).order('inspected_at', { ascending: false }).limit(6),
  ])

  const assetIds = [...new Set((insp ?? []).map(l => l.asset_id).filter(Boolean) as string[])]
  const itemIds = [...new Set((pres ?? []).map(l => l.item_id).filter(Boolean) as string[])]
  const [{ data: assets }, { data: items }] = await Promise.all([
    assetIds.length ? adminClient.from('item_assets').select('id, asset_tag').in('id', assetIds) : Promise.resolve({ data: [] as { id: string; asset_tag: string | null }[] }),
    itemIds.length ? adminClient.from('items').select('id, item_name').in('id', itemIds) : Promise.resolve({ data: [] as { id: string; item_name: string }[] }),
  ])
  const assetMap = Object.fromEntries((assets ?? []).map(a => [a.id, a.asset_tag ?? '—']))
  const itemMap = Object.fromEntries((items ?? []).map(i => [i.id, i.item_name]))

  return {
    inspections: (insp ?? []).map(l => ({ id: l.id, inspected_at: l.inspected_at, overall_result: l.overall_result, inspected_by_name: l.inspected_by_name, asset_tag: l.asset_id ? (assetMap[l.asset_id] ?? '—') : '—' })),
    presence: (pres ?? []).map(l => ({ id: l.id, inspected_at: l.inspected_at, inspected_by_name: l.inspected_by_name, present: !!l.present, item_name: l.item_id ? (itemMap[l.item_id] ?? '—') : '—' })),
  }
}
