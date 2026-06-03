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

// ─── Receive Stock ────────────────────────────────────────────────────────────

export async function receiveStock(data: {
  storeroom_inventory_id: string
  lot_number: string | null
  expiration_date: string | null
  quantity_received: number
  notes: string | null
  signer_1_id: string | null
  signer_2_id: string | null
}) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove) return { error: 'Officers and admins only.' }
  const adminClient = createAdminClient()

  if (!data.storeroom_inventory_id || data.quantity_received < 1)
    return { error: 'Supply type and quantity are required.' }

  // Fetch inventory row to get storeroom + supply type for transaction
  const { data: invRow } = await adminClient
    .from('medical_storeroom_inventory')
    .select('storeroom_id, supply_type_id, department_id')
    .eq('id', data.storeroom_inventory_id)
    .single()
  if (!invRow) return { error: 'Inventory record not found.' }

  // Verify supply type signature requirements are satisfied
  const { data: supplyType } = await adminClient
    .from('medical_supply_types')
    .select('required_signatures, name')
    .eq('id', invRow.supply_type_id)
    .single()

  const sigsRequired = supplyType?.required_signatures ?? 0
  if (sigsRequired >= 1 && !data.signer_1_id) return { error: 'Signer 1 is required for this supply type.' }
  if (sigsRequired >= 2 && !data.signer_2_id) return { error: 'A second signer is required for controlled substances.' }

  const now = new Date().toISOString()

  // Create the lot
  const { data: lot, error: lotErr } = await adminClient.from('medical_stock_lots').insert({
    storeroom_inventory_id: data.storeroom_inventory_id,
    department_id: invRow.department_id,
    lot_number: data.lot_number || null,
    expiration_date: data.expiration_date || null,
    quantity_received: data.quantity_received,
    quantity_remaining: data.quantity_received,
    received_date: now.split('T')[0],
    received_by: ctx.me.id,
    notes: data.notes || null,
    active: true,
  }).select('id').single()

  if (lotErr) { await logError(lotErr.message, '/medical'); return { error: lotErr.message } }

  // Create the transaction record
  const { error: txErr } = await adminClient.from('medical_stock_transactions').insert({
    department_id: invRow.department_id,
    storeroom_id: invRow.storeroom_id,
    supply_type_id: invRow.supply_type_id,
    lot_id: lot.id,
    transaction_type: 'received',
    quantity: data.quantity_received,
    performed_by: ctx.me.id,
    signer_1_id: data.signer_1_id || null,
    signer_1_at: data.signer_1_id ? now : null,
    signer_2_id: data.signer_2_id || null,
    signer_2_at: data.signer_2_id ? now : null,
    notes: data.notes || null,
  })

  if (txErr) { await logError(txErr.message, '/medical'); return { error: txErr.message } }

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
