import type { SupabaseClient } from '@supabase/supabase-js'

// Snapshot of where a check happened, written onto the log rows so history reads correctly after
// compartments, bags or trucks are renamed, moved or deleted. Path is relative to the truck:
// "PC-2 › Trauma Box 1 › Med Bag".
export async function describeCheckLocation(
  adminClient: SupabaseClient,
  opts: { apparatus_id: string | null; compartment_id: string | null; storeroom_id: string | null },
) {
  const [{ data: app }, { data: comp }] = await Promise.all([
    opts.apparatus_id ? adminClient.from('apparatus').select('unit_number').eq('id', opts.apparatus_id).single() : Promise.resolve({ data: null }),
    opts.compartment_id ? adminClient.from('apparatus_compartments').select('compartment_name_id').eq('id', opts.compartment_id).single() : Promise.resolve({ data: null }),
  ])
  let compartmentName: string | null = null
  if (comp?.compartment_name_id) {
    const { data: n } = await adminClient.from('compartment_names').select('compartment_code').eq('id', comp.compartment_name_id).single()
    compartmentName = n?.compartment_code ?? null
  }
  const chain: string[] = []
  let cur: string | null = opts.storeroom_id
  for (let i = 0; cur && i < 8; i++) {
    const { data: bag } = await adminClient.from('medical_storerooms').select('name, parent_storeroom_id').eq('id', cur).single()
    if (!bag) break
    chain.unshift(bag.name)
    cur = bag.parent_storeroom_id
  }
  return {
    apparatus_name: (app?.unit_number as string | undefined) ?? null,
    compartment_name: compartmentName,
    location_path: [compartmentName, ...chain].filter(Boolean).join(' › ') || null,
  }
}
