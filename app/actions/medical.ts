'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/logger'
import { revalidatePath } from 'next/cache'

async function getContext() {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: meList } = await adminClient.from('personnel').select('id, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) return null
  const { data: myDeptList } = await adminClient.from('department_personnel').select('department_id, system_role').eq('personnel_id', me.id).eq('active', true)
  const myDept = myDeptList?.[0]
  return {
    me,
    department_id: myDept?.department_id ?? null,
    system_role: myDept?.system_role ?? null,
    isAdmin: myDept?.system_role === 'admin' || me.is_sys_admin,
    isOfficerOrAbove: ['admin', 'officer'].includes(myDept?.system_role ?? '') || me.is_sys_admin,
  }
}

// ─── Supply Types ─────────────────────────────────────────────────────────────

export async function createMedicalSupplyType(formData: FormData) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admins only.' }
  const adminClient = createAdminClient()

  const is_controlled = formData.get('is_controlled') === 'true'
  const required_signatures = parseInt(formData.get('required_signatures') as string) || 0
  const enforced_sigs = is_controlled ? Math.max(required_signatures, 2) : required_signatures

  const { error: dbErr } = await adminClient.from('medical_supply_types').insert({
    department_id: ctx.department_id,
    name: formData.get('name') as string,
    category: formData.get('category') as string,
    unit_of_measure: (formData.get('unit_of_measure') as string) || 'each',
    is_controlled,
    tracks_expiration: formData.get('tracks_expiration') === 'true',
    required_signatures: enforced_sigs,
    notes: (formData.get('notes') as string) || null,
    active: true,
  })

  if (dbErr) { await logError(dbErr.message, '/dept-admin/medical'); return { error: dbErr.message } }
  revalidatePath('/dept-admin/medical')
  return { success: true }
}

export async function updateMedicalSupplyType(formData: FormData) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admins only.' }
  const adminClient = createAdminClient()

  const is_controlled = formData.get('is_controlled') === 'true'
  const required_signatures = parseInt(formData.get('required_signatures') as string) || 0
  const enforced_sigs = is_controlled ? Math.max(required_signatures, 2) : required_signatures

  const { error: dbErr } = await adminClient.from('medical_supply_types').update({
    name: formData.get('name') as string,
    category: formData.get('category') as string,
    unit_of_measure: (formData.get('unit_of_measure') as string) || 'each',
    is_controlled,
    tracks_expiration: formData.get('tracks_expiration') === 'true',
    required_signatures: enforced_sigs,
    notes: (formData.get('notes') as string) || null,
    active: formData.get('active') === 'true',
    updated_at: new Date().toISOString(),
  }).eq('id', formData.get('id') as string)

  if (dbErr) { await logError(dbErr.message, '/dept-admin/medical'); return { error: dbErr.message } }
  revalidatePath('/dept-admin/medical')
  return { success: true }
}

// ─── Storerooms ───────────────────────────────────────────────────────────────

export async function createMedicalStoreroom(formData: FormData) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admins only.' }
  const adminClient = createAdminClient()

  const { error: dbErr } = await adminClient.from('medical_storerooms').insert({
    department_id: ctx.department_id,
    station_id: (formData.get('station_id') as string) || null,
    name: formData.get('name') as string,
    notes: (formData.get('notes') as string) || null,
    active: true,
  })

  if (dbErr) { await logError(dbErr.message, '/dept-admin/medical'); return { error: dbErr.message } }
  revalidatePath('/dept-admin/medical')
  return { success: true }
}

export async function updateMedicalStoreroom(formData: FormData) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admins only.' }
  const adminClient = createAdminClient()

  const { error: dbErr } = await adminClient.from('medical_storerooms').update({
    station_id: (formData.get('station_id') as string) || null,
    name: formData.get('name') as string,
    notes: (formData.get('notes') as string) || null,
    active: formData.get('active') === 'true',
    updated_at: new Date().toISOString(),
  }).eq('id', formData.get('id') as string)

  if (dbErr) { await logError(dbErr.message, '/dept-admin/medical'); return { error: dbErr.message } }
  revalidatePath('/dept-admin/medical')
  return { success: true }
}

export async function assignSupplyToStoreroom(formData: FormData) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admins only.' }
  const adminClient = createAdminClient()

  const { error: dbErr } = await adminClient.from('medical_storeroom_inventory').upsert({
    storeroom_id: formData.get('storeroom_id') as string,
    supply_type_id: formData.get('supply_type_id') as string,
    department_id: ctx.department_id,
    par_level: parseInt(formData.get('par_level') as string) || 0,
  }, { onConflict: 'storeroom_id,supply_type_id' })

  if (dbErr) { await logError(dbErr.message, '/dept-admin/medical'); return { error: dbErr.message } }
  revalidatePath('/dept-admin/medical')
  revalidatePath('/medical')
  return { success: true }
}

export async function updateStoreroomPar(inventory_id: string, par_level: number) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admins only.' }
  const adminClient = createAdminClient()

  const { error: dbErr } = await adminClient.from('medical_storeroom_inventory')
    .update({ par_level, updated_at: new Date().toISOString() })
    .eq('id', inventory_id)

  if (dbErr) { await logError(dbErr.message, '/dept-admin/medical'); return { error: dbErr.message } }
  revalidatePath('/dept-admin/medical')
  revalidatePath('/medical')
  return { success: true }
}

export async function removeSupplyFromStoreroom(inventory_id: string) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admins only.' }
  const adminClient = createAdminClient()

  // Only allow removal if no active lots exist
  const { data: lots } = await adminClient
    .from('medical_stock_lots')
    .select('id')
    .eq('storeroom_inventory_id', inventory_id)
    .gt('quantity_remaining', 0)

  if (lots && lots.length > 0) return { error: 'Cannot remove — active stock lots exist. Adjust quantities first.' }

  const { error: dbErr } = await adminClient
    .from('medical_storeroom_inventory')
    .delete()
    .eq('id', inventory_id)

  if (dbErr) { await logError(dbErr.message, '/dept-admin/medical'); return { error: dbErr.message } }
  revalidatePath('/dept-admin/medical')
  revalidatePath('/medical')
  return { success: true }
}
