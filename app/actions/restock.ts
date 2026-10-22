'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { transferStock } from '@/app/actions/medical'
import { revalidatePath } from 'next/cache'

// "Restock this truck" — move several items from one storeroom onto a truck in one go. Each line is
// filled oldest-expiration-first across the storeroom's lots, using the normal transferStock path
// (so the ledger gets the usual transferred_out / transferred_in pair per lot, and controlled
// substances keep their officer check).
export async function restockFromStoreroom(
  source_storeroom_id: string,
  lines: { destination_storeroom_id: string; supply_type_id: string; quantity: number }[],
  apparatus_id?: string
): Promise<{ results?: { supply_type_id: string; moved: number; error?: string }[]; error?: string }> {
  const ctx = await getCurrentDepartmentContext()
  if (!ctx?.departmentId) return { error: 'Not authorized.' }
  const adminClient = createAdminClient()

  const { data: src } = await adminClient.from('medical_storerooms')
    .select('department_id').eq('id', source_storeroom_id).single()
  if (src?.department_id !== ctx.departmentId) return { error: 'Storeroom not found.' }

  const results: { supply_type_id: string; moved: number; error?: string }[] = []
  for (const line of lines) {
    if (!line.quantity || line.quantity < 1) continue
    const { data: srcInv } = await adminClient.from('medical_storeroom_inventory')
      .select('id').eq('storeroom_id', source_storeroom_id).eq('supply_type_id', line.supply_type_id).maybeSingle()
    if (!srcInv) { results.push({ supply_type_id: line.supply_type_id, moved: 0, error: 'Not stocked in that storeroom.' }); continue }

    const { data: lots } = await adminClient.from('medical_stock_lots')
      .select('id, quantity_remaining, expiration_date, received_date')
      .eq('storeroom_inventory_id', srcInv.id).eq('active', true).gt('quantity_remaining', 0)
      .order('expiration_date', { ascending: true, nullsFirst: false })
      .order('received_date', { ascending: true })

    let remaining = line.quantity
    let moved = 0
    let error: string | undefined
    for (const lot of lots ?? []) {
      if (remaining <= 0) break
      const take = Math.min(remaining, lot.quantity_remaining)
      const r = await transferStock({
        source_inventory_id: srcInv.id, lot_id: lot.id,
        destination_storeroom_id: line.destination_storeroom_id, quantity: take, notes: 'Truck restock',
      })
      if (r?.error) { error = r.error; break }
      moved += take
      remaining -= take
    }
    if (!error && remaining > 0) error = `Only ${moved} available in that storeroom.`
    results.push({ supply_type_id: line.supply_type_id, moved, error })
  }

  revalidatePath('/medical')
  if (apparatus_id) revalidatePath(`/equipment/${apparatus_id}`)
  return { results }
}
