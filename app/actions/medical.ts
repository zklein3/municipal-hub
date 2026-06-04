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

  const { data: newRow, error: dbErr } = await adminClient.from('medical_supply_types').insert({
    department_id: ctx.department_id,
    name: formData.get('name') as string,
    category: formData.get('category') as string,
    unit_of_measure: (formData.get('unit_of_measure') as string) || 'each',
    is_controlled,
    tracks_expiration: formData.get('tracks_expiration') === 'true',
    required_signatures: enforced_sigs,
    notes: (formData.get('notes') as string) || null,
    active: true,
  }).select('id').single()

  if (dbErr) { await logError(dbErr.message, '/dept-admin/medical'); return { error: dbErr.message } }
  revalidatePath('/dept-admin/medical')
  return { success: true, id: newRow.id }
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
    apparatus_id: (formData.get('apparatus_id') as string) || null,
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
    apparatus_id: (formData.get('apparatus_id') as string) || null,
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

export async function dispenseStock(data: {
  storeroom_inventory_id: string
  lot_id: string
  quantity: number
  notes: string | null
  signer_1_id: string | null
  signer_2_id: string | null
}) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove) return { error: 'Officers and admins only.' }
  const adminClient = createAdminClient()

  if (!data.lot_id || data.quantity < 1)
    return { error: 'Lot and quantity are required.' }

  // Fetch lot to verify quantity and get storeroom/supply context
  const { data: lot } = await adminClient
    .from('medical_stock_lots')
    .select('quantity_remaining, storeroom_inventory_id')
    .eq('id', data.lot_id)
    .single()
  if (!lot) return { error: 'Lot not found.' }
  if (lot.quantity_remaining < data.quantity)
    return { error: `Only ${lot.quantity_remaining} units available in this lot.` }

  // Fetch inventory row for storeroom + supply type
  const { data: invRow } = await adminClient
    .from('medical_storeroom_inventory')
    .select('storeroom_id, supply_type_id, department_id')
    .eq('id', data.storeroom_inventory_id)
    .single()
  if (!invRow) return { error: 'Inventory record not found.' }

  // Check signature requirements
  const { data: supplyType } = await adminClient
    .from('medical_supply_types')
    .select('required_signatures')
    .eq('id', invRow.supply_type_id)
    .single()

  const sigsRequired = supplyType?.required_signatures ?? 0
  if (sigsRequired >= 1 && !data.signer_1_id) return { error: 'Signer 1 is required for this supply type.' }
  if (sigsRequired >= 2 && !data.signer_2_id) return { error: 'A second signer is required for controlled substances.' }

  const now = new Date().toISOString()
  const newQty = lot.quantity_remaining - data.quantity

  // Deduct from lot
  const { error: lotErr } = await adminClient
    .from('medical_stock_lots')
    .update({ quantity_remaining: newQty, active: newQty > 0, updated_at: now })
    .eq('id', data.lot_id)
  if (lotErr) { await logError(lotErr.message, '/medical'); return { error: lotErr.message } }

  // Record transaction
  const { error: txErr } = await adminClient.from('medical_stock_transactions').insert({
    department_id: invRow.department_id,
    storeroom_id: invRow.storeroom_id,
    supply_type_id: invRow.supply_type_id,
    lot_id: data.lot_id,
    transaction_type: 'dispensed',
    quantity: data.quantity,
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

export async function wasteStock(data: {
  storeroom_inventory_id: string
  lot_id: string
  quantity: number
  waste_reason: string
  notes: string | null
  signer_1_id: string | null
  signer_2_id: string | null
}) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove) return { error: 'Officers and admins only.' }
  const adminClient = createAdminClient()

  if (!data.lot_id || data.quantity < 1)
    return { error: 'Lot and quantity are required.' }

  const { data: lot } = await adminClient
    .from('medical_stock_lots')
    .select('quantity_remaining')
    .eq('id', data.lot_id)
    .single()
  if (!lot) return { error: 'Lot not found.' }
  if (lot.quantity_remaining < data.quantity)
    return { error: `Only ${lot.quantity_remaining} units available in this lot.` }

  const { data: invRow } = await adminClient
    .from('medical_storeroom_inventory')
    .select('storeroom_id, supply_type_id, department_id')
    .eq('id', data.storeroom_inventory_id)
    .single()
  if (!invRow) return { error: 'Inventory record not found.' }

  const { data: supplyType } = await adminClient
    .from('medical_supply_types')
    .select('required_signatures, is_controlled')
    .eq('id', invRow.supply_type_id)
    .single()

  const sigsRequired = supplyType?.required_signatures ?? 0
  if (sigsRequired >= 1 && !data.signer_1_id) return { error: 'Signer 1 is required.' }
  if (sigsRequired >= 2 && !data.signer_2_id) return { error: 'A witness is required for controlled substance waste.' }

  const now = new Date().toISOString()
  const newQty = lot.quantity_remaining - data.quantity

  const { error: lotErr } = await adminClient
    .from('medical_stock_lots')
    .update({ quantity_remaining: newQty, active: newQty > 0, updated_at: now })
    .eq('id', data.lot_id)
  if (lotErr) { await logError(lotErr.message, '/medical'); return { error: lotErr.message } }

  const noteText = [data.waste_reason, data.notes].filter(Boolean).join(' — ')
  const { error: txErr } = await adminClient.from('medical_stock_transactions').insert({
    department_id: invRow.department_id,
    storeroom_id: invRow.storeroom_id,
    supply_type_id: invRow.supply_type_id,
    lot_id: data.lot_id,
    transaction_type: 'wasted',
    quantity: data.quantity,
    performed_by: ctx.me.id,
    signer_1_id: data.signer_1_id || null,
    signer_1_at: data.signer_1_id ? now : null,
    signer_2_id: data.signer_2_id || null,
    signer_2_at: data.signer_2_id ? now : null,
    notes: noteText || null,
  })
  if (txErr) { await logError(txErr.message, '/medical'); return { error: txErr.message } }

  revalidatePath('/medical')
  return { success: true }
}

export async function transferStock(data: {
  source_inventory_id: string
  lot_id: string
  destination_storeroom_id: string
  quantity: number
  notes: string | null
}) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove) return { error: 'Officers and admins only.' }
  const adminClient = createAdminClient()

  if (!data.lot_id || data.quantity < 1)
    return { error: 'Lot and quantity are required.' }

  // Fetch source lot
  const { data: lot } = await adminClient
    .from('medical_stock_lots')
    .select('quantity_remaining, lot_number, expiration_date, received_date')
    .eq('id', data.lot_id)
    .single()
  if (!lot) return { error: 'Lot not found.' }
  if (lot.quantity_remaining < data.quantity)
    return { error: `Only ${lot.quantity_remaining} units available in this lot.` }

  // Fetch source inventory row
  const { data: srcInv } = await adminClient
    .from('medical_storeroom_inventory')
    .select('storeroom_id, supply_type_id, department_id')
    .eq('id', data.source_inventory_id)
    .single()
  if (!srcInv) return { error: 'Source inventory record not found.' }
  if (srcInv.storeroom_id === data.destination_storeroom_id)
    return { error: 'Source and destination storeroom must be different.' }

  // Find destination inventory row for same supply type
  const { data: destInvList } = await adminClient
    .from('medical_storeroom_inventory')
    .select('id')
    .eq('storeroom_id', data.destination_storeroom_id)
    .eq('supply_type_id', srcInv.supply_type_id)
  const destInv = destInvList?.[0]
  if (!destInv) return { error: 'Destination storeroom does not have this supply type assigned.' }

  const now = new Date().toISOString()
  const newSrcQty = lot.quantity_remaining - data.quantity

  // Deduct from source lot
  const { error: srcLotErr } = await adminClient
    .from('medical_stock_lots')
    .update({ quantity_remaining: newSrcQty, active: newSrcQty > 0, updated_at: now })
    .eq('id', data.lot_id)
  if (srcLotErr) { await logError(srcLotErr.message, '/medical'); return { error: srcLotErr.message } }

  // Create new lot in destination
  const { data: newLot, error: newLotErr } = await adminClient
    .from('medical_stock_lots')
    .insert({
      storeroom_inventory_id: destInv.id,
      department_id: srcInv.department_id,
      lot_number: lot.lot_number,
      expiration_date: lot.expiration_date,
      quantity_received: data.quantity,
      quantity_remaining: data.quantity,
      received_date: lot.received_date,
      received_by: ctx.me.id,
      notes: data.notes || null,
      active: true,
    })
    .select('id')
    .single()
  if (newLotErr) { await logError(newLotErr.message, '/medical'); return { error: newLotErr.message } }

  // transferred_out transaction
  const { error: txOutErr } = await adminClient.from('medical_stock_transactions').insert({
    department_id: srcInv.department_id,
    storeroom_id: srcInv.storeroom_id,
    supply_type_id: srcInv.supply_type_id,
    lot_id: data.lot_id,
    transaction_type: 'transferred_out',
    quantity: data.quantity,
    performed_by: ctx.me.id,
    notes: data.notes || null,
  })
  if (txOutErr) { await logError(txOutErr.message, '/medical'); return { error: txOutErr.message } }

  // transferred_in transaction
  const { error: txInErr } = await adminClient.from('medical_stock_transactions').insert({
    department_id: srcInv.department_id,
    storeroom_id: data.destination_storeroom_id,
    supply_type_id: srcInv.supply_type_id,
    lot_id: newLot.id,
    transaction_type: 'transferred_in',
    quantity: data.quantity,
    performed_by: ctx.me.id,
    notes: data.notes || null,
  })
  if (txInErr) { await logError(txInErr.message, '/medical'); return { error: txInErr.message } }

  revalidatePath('/medical')
  return { success: true }
}

export async function adjustStock(data: {
  lot_id: string
  storeroom_inventory_id: string
  new_quantity: number
  reason: string
  notes: string | null
}) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admins only.' }
  const adminClient = createAdminClient()

  if (data.new_quantity < 0) return { error: 'Quantity cannot be negative.' }

  const { data: lot } = await adminClient
    .from('medical_stock_lots')
    .select('quantity_remaining')
    .eq('id', data.lot_id)
    .single()
  if (!lot) return { error: 'Lot not found.' }

  const delta = data.new_quantity - lot.quantity_remaining
  if (delta === 0) return { error: 'New quantity is the same as current quantity.' }

  const { data: invRow } = await adminClient
    .from('medical_storeroom_inventory')
    .select('storeroom_id, supply_type_id, department_id')
    .eq('id', data.storeroom_inventory_id)
    .single()
  if (!invRow) return { error: 'Inventory record not found.' }

  const now = new Date().toISOString()
  const noteText = [data.reason, data.notes].filter(Boolean).join(' — ')

  const { error: lotErr } = await adminClient
    .from('medical_stock_lots')
    .update({ quantity_remaining: data.new_quantity, active: data.new_quantity > 0, updated_at: now })
    .eq('id', data.lot_id)
  if (lotErr) { await logError(lotErr.message, '/medical'); return { error: lotErr.message } }

  const { error: txErr } = await adminClient.from('medical_stock_transactions').insert({
    department_id: invRow.department_id,
    storeroom_id: invRow.storeroom_id,
    supply_type_id: invRow.supply_type_id,
    lot_id: data.lot_id,
    transaction_type: 'adjusted',
    quantity: Math.abs(delta),
    performed_by: ctx.me.id,
    notes: `${delta > 0 ? '+' : ''}${delta} — ${noteText}`,
  })
  if (txErr) { await logError(txErr.message, '/medical'); return { error: txErr.message } }

  revalidatePath('/medical')
  return { success: true }
}

export async function submitReorderRequest(inventory_id: string, notes: string | null) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove) return { error: 'Officers and admins only.' }
  const adminClient = createAdminClient()

  const { data: inv } = await adminClient
    .from('medical_storeroom_inventory')
    .select('department_id')
    .eq('id', inventory_id)
    .single()
  if (!inv) return { error: 'Inventory record not found.' }

  // Avoid duplicate pending requests for the same item
  const { data: existing } = await adminClient
    .from('medical_reorder_requests')
    .select('id')
    .eq('storeroom_inventory_id', inventory_id)
    .eq('status', 'pending')
    .limit(1)
  if (existing && existing.length > 0) return { error: 'A pending restock request already exists for this item.' }

  const { error: dbErr } = await adminClient.from('medical_reorder_requests').insert({
    department_id: inv.department_id,
    storeroom_inventory_id: inventory_id,
    requested_by: ctx.me.id,
    notes: notes || null,
    status: 'pending',
  })
  if (dbErr) { await logError(dbErr.message, '/medical'); return { error: dbErr.message } }

  revalidatePath('/medical')
  revalidatePath('/inbox')
  return { success: true }
}

export async function fulfillReorderRequest(request_id: string) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove) return { error: 'Officers and admins only.' }
  const adminClient = createAdminClient()

  const { error: dbErr } = await adminClient
    .from('medical_reorder_requests')
    .update({ status: 'fulfilled', fulfilled_by: ctx.me.id, fulfilled_at: new Date().toISOString() })
    .eq('id', request_id)
  if (dbErr) { await logError(dbErr.message, '/inbox'); return { error: dbErr.message } }

  revalidatePath('/inbox')
  revalidatePath('/medical')
  return { success: true }
}

export async function dismissReorderRequest(request_id: string) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove) return { error: 'Officers and admins only.' }
  const adminClient = createAdminClient()

  const { error: dbErr } = await adminClient
    .from('medical_reorder_requests')
    .update({ status: 'dismissed', fulfilled_by: ctx.me.id, fulfilled_at: new Date().toISOString() })
    .eq('id', request_id)
  if (dbErr) { await logError(dbErr.message, '/inbox'); return { error: dbErr.message } }

  revalidatePath('/inbox')
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
