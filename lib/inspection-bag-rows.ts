import type { SupabaseClient } from '@supabase/supabase-js'

// Make sure the session has a row for every active bag on the truck, parented to the row of the
// compartment or bag it sits in. Safe to call repeatedly.
export async function ensureBagSessionRows(
  adminClient: SupabaseClient,
  session_id: string,
  apparatus_id: string,
  department_id: string,
) {
  const [{ data: bags }, { data: rows }] = await Promise.all([
    adminClient.from('medical_storerooms')
      .select('id, compartment_id, parent_storeroom_id')
      .eq('department_id', department_id).eq('apparatus_id', apparatus_id).eq('container_kind', 'bag').eq('active', true),
    adminClient.from('inspection_session_compartments')
      .select('id, compartment_id, storeroom_id').eq('session_id', session_id),
  ])
  const rowByCompartment = new Map<string, string>()
  const rowByBag = new Map<string, string>()
  for (const r of rows ?? []) {
    if (r.compartment_id) rowByCompartment.set(r.compartment_id, r.id)
    if (r.storeroom_id) rowByBag.set(r.storeroom_id, r.id)
  }
  let pending = (bags ?? []).filter(b => !rowByBag.has(b.id))
  // Insert parents before children; bags with no placeable parent row hang off nothing and are skipped.
  for (let pass = 0; pass < 6 && pending.length > 0; pass++) {
    const ready = pending.filter(b => b.parent_storeroom_id ? rowByBag.has(b.parent_storeroom_id) : (b.compartment_id ? rowByCompartment.has(b.compartment_id) : false))
    if (ready.length === 0) break
    const { data: inserted } = await adminClient.from('inspection_session_compartments').insert(
      ready.map(b => ({
        session_id, storeroom_id: b.id,
        parent_row_id: b.parent_storeroom_id ? rowByBag.get(b.parent_storeroom_id)! : rowByCompartment.get(b.compartment_id!)!,
      }))).select('id, storeroom_id')
    for (const r of inserted ?? []) if (r.storeroom_id) rowByBag.set(r.storeroom_id, r.id)
    const doneIds = new Set(ready.map(b => b.id))
    pending = pending.filter(b => !doneIds.has(b.id))
  }
}
