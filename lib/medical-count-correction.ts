import type { SupabaseClient } from '@supabase/supabase-js'

// Inventory-check count correction: makes the on-file count of one medical line (a supply type in a
// compartment, bag or storeroom) match what the inspector physically counted, logged as an
// 'adjusted' transaction with the reason. Shortages come off the oldest-expiring stock first (the
// stock that should have been used first); extras are added to the newest lot (or a new lot with no
// lot number/expiration if none exists).
// Controlled substances are never blind-corrected — vials are tracked individually — so they're
// skipped and the caller reports them as flagged for an officer.

export async function correctMedicalCount(
  adminClient: SupabaseClient,
  opts: { department_id: string; storeroom_inventory_id: string; counted: number; reason: string; performed_by: string }
): Promise<{ delta?: number; skipped?: 'controlled' | 'no_change'; error?: string }> {
  const { data: inv } = await adminClient.from('medical_storeroom_inventory')
    .select('id, storeroom_id, supply_type_id, department_id').eq('id', opts.storeroom_inventory_id).single()
  if (!inv || inv.department_id !== opts.department_id) return { error: 'Inventory record not found.' }

  const { data: supply } = await adminClient.from('medical_supply_types')
    .select('name, is_controlled').eq('id', inv.supply_type_id).single()
  if (supply?.is_controlled) return { skipped: 'controlled' }

  const { data: lots } = await adminClient.from('medical_stock_lots')
    .select('id, quantity_remaining, expiration_date, received_date')
    .eq('storeroom_inventory_id', inv.id).eq('active', true).gt('quantity_remaining', 0)
    .order('expiration_date', { ascending: true, nullsFirst: false })
    .order('received_date', { ascending: true })
  const onFile = (lots ?? []).reduce((n, l) => n + l.quantity_remaining, 0)
  const counted = Math.max(0, Math.floor(opts.counted))
  const delta = counted - onFile
  if (delta === 0) return { skipped: 'no_change' }

  const now = new Date().toISOString()
  if (delta < 0) {
    let toRemove = -delta
    for (const l of lots ?? []) {
      if (toRemove <= 0) break
      const take = Math.min(toRemove, l.quantity_remaining)
      const left = l.quantity_remaining - take
      const { error } = await adminClient.from('medical_stock_lots')
        .update({ quantity_remaining: left, active: left > 0, updated_at: now }).eq('id', l.id)
      if (error) return { error: error.message }
      toRemove -= take
    }
  } else {
    const newest = [...(lots ?? [])].sort((a, b) => (b.received_date ?? '').localeCompare(a.received_date ?? ''))[0]
    if (newest) {
      const { error } = await adminClient.from('medical_stock_lots')
        .update({ quantity_remaining: newest.quantity_remaining + delta, updated_at: now }).eq('id', newest.id)
      if (error) return { error: error.message }
    } else {
      const { error } = await adminClient.from('medical_stock_lots').insert({
        storeroom_inventory_id: inv.id, department_id: opts.department_id,
        quantity_received: delta, quantity_remaining: delta, received_date: now.slice(0, 10),
        received_by: opts.performed_by, active: true, notes: 'Found during inventory check',
      })
      if (error) return { error: error.message }
    }
  }

  const { error: txErr } = await adminClient.from('medical_stock_transactions').insert({
    department_id: opts.department_id, storeroom_id: inv.storeroom_id, supply_type_id: inv.supply_type_id,
    supply_type_name: supply?.name ?? null, transaction_type: 'adjusted', quantity: Math.abs(delta),
    performed_by: opts.performed_by,
    notes: `Inventory check correction (${opts.reason}): on file ${onFile}, counted ${counted} (${delta > 0 ? '+' : '−'}${Math.abs(delta)})`,
  })
  if (txErr) return { error: txErr.message }
  return { delta }
}
