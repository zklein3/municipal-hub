'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { hasPermission } from '@/lib/permissions'
import { logError } from '@/lib/logger'
import { deployPreset, addStandardCompartments, type DeployResult } from '@/lib/preset-deploy'
import { revalidatePath } from 'next/cache'

// Compartment presets — department-owned, reusable compartment definitions (items + medication
// type/PAR + apparatus-type tags). See PLAN_INVENTORY_STREAMLINE.md and lib/preset-deploy.ts.
//
// Permissions: editing presets and deploying them = manage_dept_setup. "Add standard compartments"
// on a truck = manage_apparatus OR manage_dept_setup (it only uses already-approved presets).

type Ctx = { department_id: string; personnel_id: string }

async function requireSetup(): Promise<Ctx | { error: string }> {
  const ctx = await getCurrentDepartmentContext()
  if (!ctx) return { error: 'Not authenticated.' }
  if (!ctx.departmentId) return { error: 'No department selected.' }
  if (!ctx.isSysAdmin && !(await hasPermission(ctx, 'manage_dept_setup'))) {
    return { error: 'You do not have permission to manage compartment presets.' }
  }
  return { department_id: ctx.departmentId, personnel_id: ctx.personnelId }
}

async function requireApparatusOrSetup(): Promise<Ctx | { error: string }> {
  const ctx = await getCurrentDepartmentContext()
  if (!ctx) return { error: 'Not authenticated.' }
  if (!ctx.departmentId) return { error: 'No department selected.' }
  if (!ctx.isSysAdmin
    && !(await hasPermission(ctx, 'manage_apparatus'))
    && !(await hasPermission(ctx, 'manage_dept_setup'))) {
    return { error: 'You do not have permission to add compartments to apparatus.' }
  }
  return { department_id: ctx.departmentId, personnel_id: ctx.personnelId }
}

async function ownsPreset(adminClient: ReturnType<typeof createAdminClient>, preset_id: string, department_id: string) {
  const { data } = await adminClient.from('compartment_presets').select('department_id').eq('id', preset_id)
  return data?.[0]?.department_id === department_id
}

function revalidatePresets(apparatus_id?: string) {
  revalidatePath('/dept-admin/setup')
  revalidatePath('/equipment')
  revalidatePath('/apparatus')
  if (apparatus_id) {
    revalidatePath(`/apparatus/${apparatus_id}`)
    revalidatePath(`/equipment/${apparatus_id}`)
  }
}

function friendlyDbError(message: string, what: string) {
  if (message.includes('uq_compartment_presets_dept_name')) return `A ${what} with that name already exists.`
  return message
}

// ─── Create / update / delete ─────────────────────────────────────────────────
export async function createPreset(formData: FormData) {
  const ctx = await requireSetup()
  if ('error' in ctx) return ctx
  const name = (formData.get('name') as string)?.trim()
  const default_code = (formData.get('default_code') as string)?.trim().toUpperCase()
  const description = (formData.get('description') as string)?.trim() || null
  if (!name) return { error: 'Preset name is required.' }
  if (!default_code) return { error: 'Compartment code is required.' }

  const adminClient = createAdminClient()
  const { data, error: dbErr } = await adminClient.from('compartment_presets')
    .insert({ department_id: ctx.department_id, name, default_code, description, active: true })
    .select('id').single()
  if (dbErr) { await logError(dbErr.message, '/dept-admin/setup', { department_id: ctx.department_id }); return { error: friendlyDbError(dbErr.message, 'preset') } }
  revalidatePresets()
  return { success: true, id: data.id as string }
}

export async function updatePreset(formData: FormData) {
  const ctx = await requireSetup()
  if ('error' in ctx) return ctx
  const id = formData.get('id') as string
  const name = (formData.get('name') as string)?.trim()
  const default_code = (formData.get('default_code') as string)?.trim().toUpperCase()
  const description = (formData.get('description') as string)?.trim() || null
  const sort_order = formData.get('sort_order') as string | null
  const activeRaw = formData.get('active') as string | null
  if (!id || !name || !default_code) return { error: 'Name and compartment code are required.' }

  const adminClient = createAdminClient()
  if (!(await ownsPreset(adminClient, id, ctx.department_id))) return { error: 'Preset not found.' }
  const update: Record<string, unknown> = { name, default_code, description }
  if (sort_order !== null) update.sort_order = sort_order ? parseInt(sort_order) : null
  if (activeRaw !== null) update.active = activeRaw === 'true'
  const { error: dbErr } = await adminClient.from('compartment_presets').update(update).eq('id', id)
  if (dbErr) { await logError(dbErr.message, '/dept-admin/setup', { department_id: ctx.department_id }); return { error: friendlyDbError(dbErr.message, 'preset') } }
  revalidatePresets()
  return { success: true }
}

// Deleting a preset never touches trucks or history: nothing references a preset after deploy.
export async function deletePreset(preset_id: string) {
  const ctx = await requireSetup()
  if ('error' in ctx) return ctx
  const adminClient = createAdminClient()
  if (!(await ownsPreset(adminClient, preset_id, ctx.department_id))) return { error: 'Preset not found.' }
  const { error: dbErr } = await adminClient.from('compartment_presets').delete().eq('id', preset_id)
  if (dbErr) { await logError(dbErr.message, '/dept-admin/setup', { department_id: ctx.department_id }); return { error: dbErr.message } }
  revalidatePresets()
  return { success: true }
}

// ─── Contents ─────────────────────────────────────────────────────────────────
export async function setPresetItem(preset_id: string, item_id: string, expected_quantity: number, minimum_quantity: number | null) {
  const ctx = await requireSetup()
  if ('error' in ctx) return ctx
  if (!expected_quantity || expected_quantity < 1) return { error: 'Quantity must be at least 1.' }
  if (minimum_quantity !== null && (minimum_quantity < 0 || minimum_quantity > expected_quantity)) {
    return { error: 'Minimum must be between 0 and the expected quantity.' }
  }
  const adminClient = createAdminClient()
  if (!(await ownsPreset(adminClient, preset_id, ctx.department_id))) return { error: 'Preset not found.' }
  const { data: itemRows } = await adminClient.from('items').select('department_id').eq('id', item_id)
  if (itemRows?.[0]?.department_id !== ctx.department_id) return { error: 'Item not found.' }
  const { error: dbErr } = await adminClient.from('compartment_preset_items')
    .upsert({ preset_id, item_id, expected_quantity, minimum_quantity }, { onConflict: 'preset_id,item_id' })
  if (dbErr) { await logError(dbErr.message, '/dept-admin/setup', { department_id: ctx.department_id }); return { error: dbErr.message } }
  revalidatePresets()
  return { success: true }
}

export async function removePresetItem(preset_id: string, item_id: string) {
  const ctx = await requireSetup()
  if ('error' in ctx) return ctx
  const adminClient = createAdminClient()
  if (!(await ownsPreset(adminClient, preset_id, ctx.department_id))) return { error: 'Preset not found.' }
  const { error: dbErr } = await adminClient.from('compartment_preset_items').delete().eq('preset_id', preset_id).eq('item_id', item_id)
  if (dbErr) return { error: dbErr.message }
  revalidatePresets()
  return { success: true }
}

export async function setPresetMedication(preset_id: string, supply_type_id: string, par_level: number) {
  const ctx = await requireSetup()
  if ('error' in ctx) return ctx
  if (par_level < 0) return { error: 'PAR cannot be negative.' }
  const adminClient = createAdminClient()
  if (!(await ownsPreset(adminClient, preset_id, ctx.department_id))) return { error: 'Preset not found.' }
  const { data: medRows } = await adminClient.from('medical_supply_types').select('department_id').eq('id', supply_type_id)
  if (medRows?.[0]?.department_id !== ctx.department_id) return { error: 'Medication not found.' }
  const { error: dbErr } = await adminClient.from('compartment_preset_medications')
    .upsert({ preset_id, supply_type_id, par_level }, { onConflict: 'preset_id,supply_type_id' })
  if (dbErr) { await logError(dbErr.message, '/dept-admin/setup', { department_id: ctx.department_id }); return { error: dbErr.message } }
  revalidatePresets()
  return { success: true }
}

export async function removePresetMedication(preset_id: string, supply_type_id: string) {
  const ctx = await requireSetup()
  if ('error' in ctx) return ctx
  const adminClient = createAdminClient()
  if (!(await ownsPreset(adminClient, preset_id, ctx.department_id))) return { error: 'Preset not found.' }
  const { error: dbErr } = await adminClient.from('compartment_preset_medications').delete().eq('preset_id', preset_id).eq('supply_type_id', supply_type_id)
  if (dbErr) return { error: dbErr.message }
  revalidatePresets()
  return { success: true }
}

// Replaces the set of apparatus types this preset is "standard" for.
export async function setPresetTypes(preset_id: string, apparatus_type_ids: string[]) {
  const ctx = await requireSetup()
  if ('error' in ctx) return ctx
  const adminClient = createAdminClient()
  if (!(await ownsPreset(adminClient, preset_id, ctx.department_id))) return { error: 'Preset not found.' }
  const { data: current } = await adminClient.from('compartment_preset_types').select('apparatus_type_id').eq('preset_id', preset_id)
  const have = new Set((current ?? []).map(r => r.apparatus_type_id))
  const want = new Set(apparatus_type_ids)
  const toAdd = [...want].filter(t => !have.has(t)).map(apparatus_type_id => ({ preset_id, apparatus_type_id }))
  const toRemove = [...have].filter(t => !want.has(t))
  if (toAdd.length) {
    const { error: dbErr } = await adminClient.from('compartment_preset_types').insert(toAdd)
    if (dbErr) return { error: dbErr.message }
  }
  if (toRemove.length) {
    const { error: dbErr } = await adminClient.from('compartment_preset_types').delete().eq('preset_id', preset_id).in('apparatus_type_id', toRemove)
    if (dbErr) return { error: dbErr.message }
  }
  revalidatePresets()
  return { success: true }
}

// ─── Save a truck's compartment as a preset ───────────────────────────────────
// Copies the compartment's active items (qty/min) and assigned medication types (PAR only — never
// lots or stock). If a preset with the same name exists: mode 'replace' swaps its contents,
// 'merge' adds what's missing; without a mode the caller is told it exists.
export async function saveCompartmentAsPreset(
  apparatus_compartment_id: string,
  name?: string,
  mode?: 'replace' | 'merge'
): Promise<{ success?: boolean; id?: string; exists?: boolean; error?: string }> {
  const ctx = await requireSetup()
  if ('error' in ctx) return ctx
  const adminClient = createAdminClient()

  const { data: acRows } = await adminClient.from('apparatus_compartments')
    .select('id, apparatus_id, compartment_name_id').eq('id', apparatus_compartment_id)
  const ac = acRows?.[0]
  if (!ac) return { error: 'Compartment not found.' }
  const [{ data: appRows }, { data: cnRows }] = await Promise.all([
    adminClient.from('apparatus').select('department_id').eq('id', ac.apparatus_id),
    adminClient.from('compartment_names').select('compartment_code, compartment_name, sort_order').eq('id', ac.compartment_name_id),
  ])
  if (appRows?.[0]?.department_id !== ctx.department_id) return { error: 'Compartment not found.' }
  const cn = cnRows?.[0]
  const presetName = (name?.trim() || cn?.compartment_name || cn?.compartment_code || 'Compartment').trim()

  const { data: existingRows } = await adminClient.from('compartment_presets')
    .select('id, name').eq('department_id', ctx.department_id)
  const existing = (existingRows ?? []).find(p => p.name.trim().toLowerCase() === presetName.toLowerCase())
  if (existing && !mode) return { exists: true, id: existing.id }

  let preset_id: string
  if (existing) {
    preset_id = existing.id
    if (mode === 'replace') {
      await adminClient.from('compartment_preset_items').delete().eq('preset_id', preset_id)
      await adminClient.from('compartment_preset_medications').delete().eq('preset_id', preset_id)
    }
  } else {
    const { data: created, error: dbErr } = await adminClient.from('compartment_presets').insert({
      department_id: ctx.department_id, name: presetName,
      default_code: (cn?.compartment_code ?? presetName).trim().toUpperCase(),
      sort_order: cn?.sort_order ?? null, active: true,
    }).select('id').single()
    if (dbErr) return { error: friendlyDbError(dbErr.message, 'preset') }
    preset_id = created.id
  }

  const { data: standards } = await adminClient.from('item_location_standards')
    .select('item_id, expected_quantity, minimum_quantity, notes')
    .eq('apparatus_compartment_id', apparatus_compartment_id).eq('active', true)
  if ((standards ?? []).length) {
    const { error: dbErr } = await adminClient.from('compartment_preset_items').upsert(
      (standards ?? []).map(s => ({ preset_id, item_id: s.item_id, expected_quantity: s.expected_quantity, minimum_quantity: s.minimum_quantity, notes: s.notes })),
      { onConflict: 'preset_id,item_id', ignoreDuplicates: true }
    )
    if (dbErr) return { error: dbErr.message }
  }

  const { data: rooms } = await adminClient.from('medical_storerooms')
    .select('id').eq('compartment_id', apparatus_compartment_id).eq('active', true)
  if ((rooms ?? []).length) {
    const { data: inv } = await adminClient.from('medical_storeroom_inventory')
      .select('supply_type_id, par_level').in('storeroom_id', (rooms ?? []).map(r => r.id))
    if ((inv ?? []).length) {
      const { error: dbErr } = await adminClient.from('compartment_preset_medications').upsert(
        (inv ?? []).map(i => ({ preset_id, supply_type_id: i.supply_type_id, par_level: i.par_level ?? 0 })),
        { onConflict: 'preset_id,supply_type_id', ignoreDuplicates: true }
      )
      if (dbErr) return { error: dbErr.message }
    }
  }

  revalidatePresets(ac.apparatus_id)
  return { success: true, id: preset_id }
}

// ─── Deploy ───────────────────────────────────────────────────────────────────
// Each target: a truck, plus optionally an existing compartment on it to stock. Without a
// compartment, the truck gets a compartment from the preset's code/name.
export async function deployPresetToApparatus(
  preset_id: string,
  targets: { apparatus_id: string; compartment_id?: string | null }[]
): Promise<{ results?: { apparatus_id: string; result?: DeployResult; error?: string }[]; error?: string }> {
  const ctx = await requireSetup()
  if ('error' in ctx) return ctx
  if (targets.length === 0) return { error: 'Choose at least one apparatus.' }
  const adminClient = createAdminClient()
  const results: { apparatus_id: string; result?: DeployResult; error?: string }[] = []
  for (const t of targets) {
    const r = await deployPreset(adminClient, { department_id: ctx.department_id, preset_id, apparatus_id: t.apparatus_id, compartment_id: t.compartment_id ?? null })
    if (r.error) await logError(r.error, '/dept-admin/setup', { department_id: ctx.department_id, metadata: { preset_id, apparatus_id: t.apparatus_id } })
    results.push({ apparatus_id: t.apparatus_id, ...r })
    revalidatePresets(t.apparatus_id)
  }
  return { results }
}

// "Add standard compartments" for a truck — every preset tagged with its apparatus type.
export async function addStandardCompartmentsToApparatus(apparatus_id: string) {
  const ctx = await requireApparatusOrSetup()
  if ('error' in ctx) return ctx
  const adminClient = createAdminClient()
  const r = await addStandardCompartments(adminClient, { department_id: ctx.department_id, apparatus_id })
  if (r.error) { await logError(r.error, '/apparatus', { department_id: ctx.department_id, metadata: { apparatus_id } }); return { error: r.error } }
  for (const x of r.results ?? []) {
    if (x.error) await logError(x.error, '/apparatus', { department_id: ctx.department_id, metadata: { apparatus_id, preset: x.preset } })
  }
  revalidatePresets(apparatus_id)
  return r
}
