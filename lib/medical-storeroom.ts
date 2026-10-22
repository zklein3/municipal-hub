import type { SupabaseClient } from '@supabase/supabase-js'

// Resolves the compartment's own loose-medication storage (container_kind 'compartment_storage'),
// auto-creating it (named from the apparatus unit + compartment code) if this is the first time
// anything medical has touched that compartment. Shared by transferToCompartment (moving physical
// stock), assignMedicalSupplyToCompartment (assigning a supply type with no stock yet) and compartment
// preset deploys so every path converges on the same row instead of creating duplicates.
// Bags placed in the compartment are separate rows (container_kind 'bag') and are never returned here.
export async function getOrCreateCompartmentStoreroom(
  adminClient: SupabaseClient,
  department_id: string,
  compartment_id: string
): Promise<{ storeroom_id: string } | { error: string }> {
  const { data: existingRooms } = await adminClient
    .from('medical_storerooms')
    .select('id')
    .eq('department_id', department_id)
    .eq('compartment_id', compartment_id)
    .eq('container_kind', 'compartment_storage')
    .eq('active', true)

  if (existingRooms && existingRooms.length > 0) return { storeroom_id: existingRooms[0].id as string }

  const { data: acRow } = await adminClient
    .from('apparatus_compartments')
    .select('apparatus_id, compartment_name_id')
    .eq('id', compartment_id)
    .single()
  if (!acRow) return { error: 'Compartment not found.' }

  const [{ data: apRow }, { data: cnRow }] = await Promise.all([
    adminClient.from('apparatus').select('unit_number').eq('id', acRow.apparatus_id).single(),
    acRow.compartment_name_id
      ? adminClient.from('compartment_names').select('compartment_code').eq('id', acRow.compartment_name_id).single()
      : Promise.resolve({ data: null }),
  ])

  const name = `${apRow?.unit_number ?? 'Unit'} — ${(cnRow as any)?.compartment_code ?? 'Compartment'}`
  const { data: newRoom, error: roomErr } = await adminClient
    .from('medical_storerooms')
    .insert({ department_id, apparatus_id: acRow.apparatus_id, compartment_id, name, active: true, container_kind: 'compartment_storage' })
    .select('id')
    .single()
  if (roomErr) return { error: roomErr.message }

  return { storeroom_id: newRoom.id as string }
}
