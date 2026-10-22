import type { SupabaseClient } from '@supabase/supabase-js'
import { getOrCreateCompartmentStoreroom } from './medical-storeroom'

// Deploys a department's compartment preset onto a truck. See PLAN_INVENTORY_STREAMLINE.md.
//
// - Target is either an existing compartment on the truck (stock it), or none (create the truck's
//   compartment from the preset's default code/name — adopting an existing compartment name with the
//   same code, since a code means one thing within a department).
// - Merge-only: adds items/medications the compartment doesn't have. Never overwrites a quantity or
//   PAR already set. An item previously removed from the compartment (inactive row) is reactivated
//   with the preset's quantities, matching assignItemToCompartment.
// - Medications: type + PAR only, zero lots — counted in later via Receive. Skipped when the
//   department doesn't have module_medical on.
// - Nothing references the preset afterward; the truck's compartment is independent.
//
// Takes the admin client; callers are responsible for authorization.

export type DeployResult = {
  compartment_id: string
  compartmentCreated: boolean
  itemsAdded: number
  itemsReactivated: number
  itemsSkipped: number
  medicationsAdded: number
  medicationsSkipped: number
  medicationsSkippedNoModule: boolean
}

// apparatus_compartments.qr_code is unique across every department, so try the same
// `${apparatus qr or unit}-${code}` convention the compartment page suggests, then suffixes.
async function assignCompartmentQr(adminClient: SupabaseClient, compartment_id: string, base: string) {
  const root = base.toUpperCase().replace(/\s+/g, '')
  for (let n = 1; n <= 9; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`
    const { error } = await adminClient.from('apparatus_compartments').update({ qr_code: candidate }).eq('id', compartment_id)
    if (!error) return
    if (error.code !== '23505') return // not a uniqueness collision — leave it for manual setup
  }
}

export async function deployPreset(
  adminClient: SupabaseClient,
  opts: { department_id: string; preset_id: string; apparatus_id: string; compartment_id?: string | null }
): Promise<{ result?: DeployResult; error?: string }> {
  const { department_id, preset_id, apparatus_id } = opts

  const [{ data: presetRows }, { data: appRows }, { data: deptRows }] = await Promise.all([
    adminClient.from('compartment_presets').select('id, name, default_code, sort_order, department_id').eq('id', preset_id),
    adminClient.from('apparatus').select('id, unit_number, qr_code, department_id').eq('id', apparatus_id),
    adminClient.from('departments').select('module_medical').eq('id', department_id),
  ])
  const preset = presetRows?.[0]
  const apparatus = appRows?.[0]
  if (!preset || preset.department_id !== department_id) return { error: 'Preset not found.' }
  if (!apparatus || apparatus.department_id !== department_id) return { error: 'Apparatus not found.' }
  const withMedical = !!deptRows?.[0]?.module_medical

  // ── Resolve or create the truck's compartment ────────────────────────────
  let compartment_id = opts.compartment_id ?? null
  let compartmentCreated = false
  let compartmentCode: string | null = null

  if (compartment_id) {
    const { data: acRows } = await adminClient.from('apparatus_compartments')
      .select('id, apparatus_id, compartment_name_id').eq('id', compartment_id)
    if (!acRows?.[0] || acRows[0].apparatus_id !== apparatus_id) return { error: 'Compartment not found on this apparatus.' }
  } else {
    const code = preset.default_code.trim().toUpperCase()
    const { data: nameRows } = await adminClient.from('compartment_names')
      .select('id, compartment_code').eq('department_id', department_id).eq('compartment_code', code)
    let compartment_name_id = nameRows?.[0]?.id as string | undefined
    if (!compartment_name_id) {
      const { data: newName, error: nameErr } = await adminClient.from('compartment_names')
        .insert({ department_id, compartment_code: code, compartment_name: preset.name, sort_order: preset.sort_order, active: true })
        .select('id').single()
      if (nameErr) return { error: `compartment name: ${nameErr.message}` }
      compartment_name_id = newName.id
    }
    compartmentCode = code

    const { data: existingAc } = await adminClient.from('apparatus_compartments')
      .select('id, active').eq('apparatus_id', apparatus_id).eq('compartment_name_id', compartment_name_id)
    if (existingAc?.[0]) {
      compartment_id = existingAc[0].id
      if (!existingAc[0].active) await adminClient.from('apparatus_compartments').update({ active: true }).eq('id', compartment_id)
    } else {
      const { data: newAc, error: acErr } = await adminClient.from('apparatus_compartments')
        .insert({ apparatus_id, compartment_name_id, active: true }).select('id').single()
      if (acErr) return { error: `compartment: ${acErr.message}` }
      compartment_id = newAc.id as string
      compartmentCreated = true
      await assignCompartmentQr(adminClient, compartment_id, `${apparatus.qr_code ?? apparatus.unit_number}-${code}`)
    }
  }

  // Existing compartments without a QR code get one too (same convention as the compartment page).
  if (!compartmentCreated && compartment_id) {
    const { data: qrRow } = await adminClient.from('apparatus_compartments')
      .select('qr_code, compartment_name_id').eq('id', compartment_id).single()
    if (qrRow && !qrRow.qr_code) {
      if (!compartmentCode && qrRow.compartment_name_id) {
        const { data: cn } = await adminClient.from('compartment_names').select('compartment_code').eq('id', qrRow.compartment_name_id).single()
        compartmentCode = cn?.compartment_code ?? null
      }
      if (compartmentCode) await assignCompartmentQr(adminClient, compartment_id, `${apparatus.qr_code ?? apparatus.unit_number}-${compartmentCode}`)
    }
  }

  const result: DeployResult = {
    compartment_id: compartment_id!,
    compartmentCreated,
    itemsAdded: 0, itemsReactivated: 0, itemsSkipped: 0,
    medicationsAdded: 0, medicationsSkipped: 0,
    medicationsSkippedNoModule: false,
  }

  // ── Items (merge-only) ───────────────────────────────────────────────────
  const [{ data: presetItems }, { data: standards }] = await Promise.all([
    adminClient.from('compartment_preset_items').select('item_id, expected_quantity, minimum_quantity, notes').eq('preset_id', preset_id),
    adminClient.from('item_location_standards').select('id, item_id, active').eq('apparatus_compartment_id', compartment_id),
  ])
  const existingByItem = new Map((standards ?? []).map(s => [s.item_id, s]))
  const inserts: any[] = []
  for (const pi of presetItems ?? []) {
    if (!pi.expected_quantity || pi.expected_quantity < 1) { result.itemsSkipped++; continue }
    const existing = existingByItem.get(pi.item_id)
    if (existing?.active) { result.itemsSkipped++; continue }
    if (existing) {
      const { error } = await adminClient.from('item_location_standards').update({
        expected_quantity: pi.expected_quantity, minimum_quantity: pi.minimum_quantity, notes: pi.notes, active: true,
      }).eq('id', existing.id)
      if (error) return { error: `items: ${error.message}` }
      result.itemsReactivated++
      continue
    }
    inserts.push({
      apparatus_compartment_id: compartment_id, item_id: pi.item_id,
      expected_quantity: pi.expected_quantity, minimum_quantity: pi.minimum_quantity, notes: pi.notes, active: true,
    })
  }
  if (inserts.length) {
    const { error } = await adminClient.from('item_location_standards').insert(inserts)
    if (error) return { error: `items: ${error.message}` }
    result.itemsAdded += inserts.length
  }

  // ── Medications: type + PAR, zero lots (module_medical only) ─────────────
  const { data: presetMeds } = await adminClient.from('compartment_preset_medications')
    .select('supply_type_id, par_level').eq('preset_id', preset_id)
  if ((presetMeds ?? []).length > 0) {
    if (!withMedical) {
      result.medicationsSkippedNoModule = true
    } else {
      const room = await getOrCreateCompartmentStoreroom(adminClient, department_id, compartment_id!)
      if ('error' in room) return { error: `medications: ${room.error}` }
      const { data: inv } = await adminClient.from('medical_storeroom_inventory')
        .select('supply_type_id').eq('storeroom_id', room.storeroom_id)
      const have = new Set((inv ?? []).map(r => r.supply_type_id))
      const medInserts = (presetMeds ?? [])
        .filter(m => !have.has(m.supply_type_id))
        .map(m => ({ storeroom_id: room.storeroom_id, supply_type_id: m.supply_type_id, department_id, par_level: m.par_level ?? 0 }))
      result.medicationsSkipped = (presetMeds ?? []).length - medInserts.length
      if (medInserts.length) {
        const { error } = await adminClient.from('medical_storeroom_inventory').insert(medInserts)
        if (error) return { error: `medications: ${error.message}` }
        result.medicationsAdded = medInserts.length
      }
    }
  }

  return { result }
}

// "Add standard compartments" — deploys every active preset tagged with the truck's apparatus type
// as a new (or existing same-code) compartment. Merge-only, so re-running only fills gaps.
export async function addStandardCompartments(
  adminClient: SupabaseClient,
  opts: { department_id: string; apparatus_id: string }
): Promise<{ results?: { preset: string; result?: DeployResult; error?: string }[]; error?: string }> {
  const { data: appRows } = await adminClient.from('apparatus')
    .select('id, apparatus_type_id, department_id').eq('id', opts.apparatus_id)
  const apparatus = appRows?.[0]
  if (!apparatus || apparatus.department_id !== opts.department_id) return { error: 'Apparatus not found.' }
  if (!apparatus.apparatus_type_id) return { results: [] }

  const { data: tags } = await adminClient.from('compartment_preset_types')
    .select('preset_id').eq('apparatus_type_id', apparatus.apparatus_type_id)
  const presetIds = (tags ?? []).map(t => t.preset_id)
  if (presetIds.length === 0) return { results: [] }

  const { data: presets } = await adminClient.from('compartment_presets')
    .select('id, name, sort_order').eq('department_id', opts.department_id).eq('active', true).in('id', presetIds)
    .order('sort_order', { ascending: true, nullsFirst: false })

  const results: { preset: string; result?: DeployResult; error?: string }[] = []
  for (const p of presets ?? []) {
    const r = await deployPreset(adminClient, { department_id: opts.department_id, preset_id: p.id, apparatus_id: opts.apparatus_id })
    results.push({ preset: p.name, ...r })
  }
  return { results }
}
