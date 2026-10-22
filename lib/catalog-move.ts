import type { SupabaseClient } from '@supabase/supabase-js'
import { getOrCreateCompartmentStoreroom } from './medical-storeroom'

// Moves a catalog entry between the two lists when it was created in the wrong one — e.g. a
// Non-Rebreather made as an equipment item (presence-checked, no count) that should be a medical
// Supply (counted, used, restocked, transferred). Carries its placements and preset entries across;
// the old entry is hidden (equipment items) or removed (medical placements), never silently lost.
// Takes the admin client; callers are responsible for authorization.

export type MedicalCategory = 'medication' | 'supply' | 'equipment'

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()

// ── Equipment item → medical supply type ───────────────────────────────────

export type ItemToMedicalPreview = {
  itemName: string
  blockedReason?: string
  placements: { label: string; expected: number }[]
  presets: string[]
  stationStorageQty: number
  mergesInto?: string // an existing medical type with the same name
}

async function loadItemMove(adminClient: SupabaseClient, department_id: string, item_id: string) {
  const { data: item } = await adminClient.from('items')
    .select('id, department_id, item_name, item_description, tracks_assets, tracks_expiration, active')
    .eq('id', item_id).single()
  if (!item || item.department_id !== department_id) return { error: 'Item not found.' as const }

  const [{ count: assetCount }, { data: standards }, { data: presetRows }, { data: storage }, { data: medTypes }] = await Promise.all([
    adminClient.from('item_assets').select('id', { count: 'exact', head: true }).eq('item_id', item_id).eq('active', true),
    adminClient.from('item_location_standards').select('id, apparatus_compartment_id, storeroom_id, expected_quantity').eq('item_id', item_id).eq('active', true),
    adminClient.from('compartment_preset_items').select('id, preset_id, expected_quantity').eq('item_id', item_id),
    adminClient.from('department_item_storage').select('quantity').eq('item_id', item_id),
    adminClient.from('medical_supply_types').select('id, name').eq('department_id', department_id),
  ])

  // Labels for the preview: "<unit> — <code>" per compartment placement, preset names.
  const compIds = (standards ?? []).map(s => s.apparatus_compartment_id).filter(Boolean) as string[]
  const { data: comps } = compIds.length > 0
    ? await adminClient.from('apparatus_compartments').select('id, apparatus_id, compartment_name_id').in('id', compIds)
    : { data: [] as { id: string; apparatus_id: string; compartment_name_id: string }[] }
  const [{ data: apps }, { data: names }, { data: presets }] = await Promise.all([
    (comps ?? []).length > 0 ? adminClient.from('apparatus').select('id, unit_number').in('id', (comps ?? []).map(c => c.apparatus_id)) : Promise.resolve({ data: [] as { id: string; unit_number: string }[] }),
    (comps ?? []).length > 0 ? adminClient.from('compartment_names').select('id, compartment_code').in('id', (comps ?? []).map(c => c.compartment_name_id)) : Promise.resolve({ data: [] as { id: string; compartment_code: string }[] }),
    (presetRows ?? []).length > 0 ? adminClient.from('compartment_presets').select('id, name').in('id', (presetRows ?? []).map(p => p.preset_id)) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])
  const unit = Object.fromEntries((apps ?? []).map(a => [a.id, a.unit_number]))
  const code = Object.fromEntries((names ?? []).map(n => [n.id, n.compartment_code]))
  const compLabel = Object.fromEntries((comps ?? []).map(c => [c.id, `${unit[c.apparatus_id] ?? '?'} — ${code[c.compartment_name_id] ?? '?'}`]))

  const existing = (medTypes ?? []).find(t => norm(t.name) === norm(item.item_name))
  return {
    item, standards: standards ?? [], presetRows: presetRows ?? [], existing,
    preview: {
      itemName: item.item_name,
      blockedReason: item.tracks_assets && (assetCount ?? 0) > 0
        ? `${item.item_name} has ${assetCount} individually tracked unit${assetCount === 1 ? '' : 's'} (asset tags). Tracked units can't become a counted supply — retire or reassign them first.`
        : undefined,
      placements: (standards ?? []).map(s => ({
        label: s.apparatus_compartment_id ? (compLabel[s.apparatus_compartment_id] ?? 'Compartment') : 'Bag / storeroom',
        expected: s.expected_quantity,
      })),
      presets: (presets ?? []).map(p => p.name),
      stationStorageQty: (storage ?? []).reduce((n, r) => n + (r.quantity ?? 0), 0),
      mergesInto: existing?.name,
    } as ItemToMedicalPreview,
  }
}

export async function previewItemToMedical(adminClient: SupabaseClient, department_id: string, item_id: string) {
  const r = await loadItemMove(adminClient, department_id, item_id)
  if ('error' in r) return { error: r.error }
  return { preview: r.preview }
}

export async function moveItemToMedical(
  adminClient: SupabaseClient,
  opts: { department_id: string; item_id: string; category: MedicalCategory; unit_of_measure: string; openingCounts: boolean; performed_by: string }
): Promise<{ supply_type_id?: string; moved?: number; error?: string }> {
  const r = await loadItemMove(adminClient, opts.department_id, opts.item_id)
  if ('error' in r) return { error: r.error }
  if (r.preview.blockedReason) return { error: r.preview.blockedReason }
  const { item, standards, presetRows } = r

  // 1. The medical type — reuse one with the same name instead of creating a duplicate.
  let supply_type_id = r.existing?.id
  if (supply_type_id) {
    // May be a type retired by an earlier move the other way — bring it back.
    await adminClient.from('medical_supply_types').update({ active: true }).eq('id', supply_type_id)
  } else {
    const { data: created, error } = await adminClient.from('medical_supply_types').insert({
      department_id: opts.department_id, name: item.item_name.trim(), category: opts.category,
      unit_of_measure: opts.unit_of_measure || 'each', is_controlled: false,
      tracks_expiration: !!item.tracks_expiration, required_signatures: 0,
      notes: item.item_description, active: true,
    }).select('id').single()
    if (error) return { error: error.message }
    supply_type_id = created.id as string
  }
  const supplyName = r.existing?.name ?? item.item_name.trim()
  const today = new Date().toISOString().slice(0, 10)

  // 2. Each placement becomes a stocked supply in that compartment (or bag) at PAR = expected.
  let moved = 0
  for (const s of standards) {
    let storeroom_id: string | null = s.storeroom_id
    if (!storeroom_id && s.apparatus_compartment_id) {
      const room = await getOrCreateCompartmentStoreroom(adminClient, opts.department_id, s.apparatus_compartment_id)
      if ('error' in room) return { error: room.error }
      storeroom_id = room.storeroom_id
    }
    if (!storeroom_id) continue

    const { data: existingInv } = await adminClient.from('medical_storeroom_inventory')
      .select('id').eq('storeroom_id', storeroom_id).eq('supply_type_id', supply_type_id).maybeSingle()
    let inventory_id = existingInv?.id as string | undefined
    if (!inventory_id) {
      const { data: inv, error } = await adminClient.from('medical_storeroom_inventory')
        .insert({ storeroom_id, supply_type_id, department_id: opts.department_id, par_level: s.expected_quantity })
        .select('id').single()
      if (error) return { error: error.message }
      inventory_id = inv.id as string

      // Optional opening count: the expected quantity becomes on-hand stock, logged as an adjustment.
      if (opts.openingCounts && s.expected_quantity > 0) {
        const { data: lot, error: lotErr } = await adminClient.from('medical_stock_lots').insert({
          storeroom_inventory_id: inventory_id, department_id: opts.department_id,
          quantity_received: s.expected_quantity, quantity_remaining: s.expected_quantity,
          received_date: today, received_by: opts.performed_by, active: true,
          notes: 'Opening count — moved from the equipment catalog',
        }).select('id').single()
        if (lotErr) return { error: lotErr.message }
        await adminClient.from('medical_stock_transactions').insert({
          department_id: opts.department_id, storeroom_id, supply_type_id, supply_type_name: supplyName,
          lot_id: lot.id, transaction_type: 'adjusted', quantity: s.expected_quantity, performed_by: opts.performed_by,
          notes: 'Opening count — moved from the equipment catalog',
        })
      }
    }
    await adminClient.from('item_location_standards').update({ active: false }).eq('id', s.id)
    moved++
  }

  // 3. Presets carry it as a medical entry instead of an item.
  for (const p of presetRows) {
    await adminClient.from('compartment_preset_medications')
      .upsert({ preset_id: p.preset_id, supply_type_id, par_level: p.expected_quantity }, { onConflict: 'preset_id,supply_type_id', ignoreDuplicates: true })
    await adminClient.from('compartment_preset_items').delete().eq('id', p.id)
  }

  // 4. Hide the equipment item (kept for its inspection history).
  await adminClient.from('items').update({
    active: false,
    notes: `Moved to the medical catalog on ${today}.`,
  }).eq('id', item.id)

  return { supply_type_id, moved }
}

// ── Medical supply type → equipment item ───────────────────────────────────

export type MedicalToItemPreview = {
  supplyName: string
  blockedReason?: string
  placements: { label: string; par: number }[]
  skipped: { label: string; reason: string }[]
  presets: string[]
  mergesInto?: string
}

async function loadMedicalMove(adminClient: SupabaseClient, department_id: string, supply_type_id: string) {
  const { data: supply } = await adminClient.from('medical_supply_types')
    .select('id, department_id, name, notes, is_controlled, tracks_expiration').eq('id', supply_type_id).single()
  if (!supply || supply.department_id !== department_id) return { error: 'Medical type not found.' as const }

  const [{ data: inv }, { data: presetRows }, { count: templateUses }, { data: items }] = await Promise.all([
    adminClient.from('medical_storeroom_inventory').select('id, storeroom_id, par_level').eq('supply_type_id', supply_type_id),
    adminClient.from('compartment_preset_medications').select('id, preset_id, par_level').eq('supply_type_id', supply_type_id),
    adminClient.from('medical_bag_template_items').select('id', { count: 'exact', head: true }).eq('supply_type_id', supply_type_id),
    adminClient.from('items').select('id, item_name, active').eq('department_id', department_id),
  ])
  const invIds = (inv ?? []).map(i => i.id)
  const roomIds = [...new Set((inv ?? []).map(i => i.storeroom_id))]
  const [{ data: lots }, { data: rooms }, { data: presets }] = await Promise.all([
    invIds.length > 0 ? adminClient.from('medical_stock_lots').select('storeroom_inventory_id, quantity_remaining').in('storeroom_inventory_id', invIds).eq('active', true).gt('quantity_remaining', 0) : Promise.resolve({ data: [] as { storeroom_inventory_id: string; quantity_remaining: number }[] }),
    roomIds.length > 0 ? adminClient.from('medical_storerooms').select('id, name, container_kind, compartment_id').in('id', roomIds) : Promise.resolve({ data: [] as { id: string; name: string; container_kind: string; compartment_id: string | null }[] }),
    (presetRows ?? []).length > 0 ? adminClient.from('compartment_presets').select('id, name').in('id', (presetRows ?? []).map(p => p.preset_id)) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])
  const roomById = Object.fromEntries((rooms ?? []).map(r => [r.id, r]))
  const stockByInv = new Map<string, number>()
  for (const l of lots ?? []) stockByInv.set(l.storeroom_inventory_id, (stockByInv.get(l.storeroom_inventory_id) ?? 0) + l.quantity_remaining)
  const onHand = [...stockByInv.values()].reduce((a, b) => a + b, 0)

  const placements: { label: string; par: number }[] = []
  const skipped: { label: string; reason: string }[] = []
  for (const i of inv ?? []) {
    const room = roomById[i.storeroom_id]
    if (room?.container_kind === 'compartment_storage') placements.push({ label: room.name, par: i.par_level })
    else skipped.push({ label: room?.name ?? 'Storeroom', reason: room?.container_kind === 'bag' ? 'bags hold medical items only for now' : 'station storerooms are medical-only' })
  }

  const existing = (items ?? []).find(it => norm(it.item_name) === norm(supply.name))
  let blockedReason: string | undefined
  if (supply.is_controlled) blockedReason = `${supply.name} is a controlled substance and must stay in the medical catalog.`
  else if (onHand > 0) blockedReason = `${onHand} on hand across ${stockByInv.size} location${stockByInv.size === 1 ? '' : 's'}. Use, waste or adjust that stock to zero first so nothing disappears from the medical log.`
  else if ((templateUses ?? 0) > 0) blockedReason = `${supply.name} is part of ${templateUses} bag template${templateUses === 1 ? '' : 's'}. Remove it from those bags first.`

  return {
    supply, inv: inv ?? [], roomById, presetRows: presetRows ?? [], existing,
    preview: { supplyName: supply.name, blockedReason, placements, skipped, presets: (presets ?? []).map(p => p.name), mergesInto: existing?.item_name } as MedicalToItemPreview,
  }
}

export async function previewMedicalToItem(adminClient: SupabaseClient, department_id: string, supply_type_id: string) {
  const r = await loadMedicalMove(adminClient, department_id, supply_type_id)
  if ('error' in r) return { error: r.error }
  return { preview: r.preview }
}

export async function moveMedicalToItem(
  adminClient: SupabaseClient,
  opts: { department_id: string; supply_type_id: string; category_id: string | null }
): Promise<{ item_id?: string; moved?: number; error?: string }> {
  const r = await loadMedicalMove(adminClient, opts.department_id, opts.supply_type_id)
  if ('error' in r) return { error: r.error }
  if (r.preview.blockedReason) return { error: r.preview.blockedReason }
  const { supply, inv, roomById, presetRows } = r

  // 1. The equipment item — reuse (and reactivate) one with the same name; item names are unique.
  let item_id = r.existing?.id
  if (item_id) {
    await adminClient.from('items').update({ active: true, ...(opts.category_id ? { category_id: opts.category_id } : {}) }).eq('id', item_id)
  } else {
    const { data: created, error } = await adminClient.from('items').insert({
      department_id: opts.department_id, category_id: opts.category_id, item_name: supply.name.trim(),
      item_description: supply.notes, tracks_quantity: true, tracks_assets: false,
      requires_presence_check: true, tracks_expiration: !!supply.tracks_expiration,
      requires_inspection: false, requires_maintenance: false, active: true,
    }).select('id').single()
    if (error) return { error: error.message }
    item_id = created.id as string
  }

  // 2. Compartment placements become item standards (expected = PAR, at least 1).
  let moved = 0
  for (const i of inv) {
    const room = roomById[i.storeroom_id]
    if (room?.container_kind !== 'compartment_storage' || !room.compartment_id) continue
    const expected = Math.max(i.par_level ?? 0, 1)
    const { data: ex } = await adminClient.from('item_location_standards')
      .select('id').eq('apparatus_compartment_id', room.compartment_id).eq('item_id', item_id).maybeSingle()
    if (ex) await adminClient.from('item_location_standards').update({ active: true }).eq('id', ex.id)
    else {
      const { error } = await adminClient.from('item_location_standards')
        .insert({ apparatus_compartment_id: room.compartment_id, item_id, expected_quantity: expected, active: true })
      if (error) return { error: error.message }
    }
    moved++
  }

  // 3. Presets carry it as an item.
  for (const p of presetRows) {
    await adminClient.from('compartment_preset_items')
      .upsert({ preset_id: p.preset_id, item_id, expected_quantity: Math.max(p.par_level ?? 0, 1) }, { onConflict: 'preset_id,item_id', ignoreDuplicates: true })
  }

  // 4. Remove the medical placements (no stock — checked above; history keeps its name snapshots)
  //    and retire the medical type. Removing the type cascades its preset rows.
  if (inv.length > 0) {
    const { error } = await adminClient.from('medical_storeroom_inventory').delete().in('id', inv.map(i => i.id))
    if (error) return { error: error.message }
  }
  await adminClient.from('medical_supply_types').update({ active: false, notes: `Moved to the equipment catalog on ${new Date().toISOString().slice(0, 10)}.` }).eq('id', supply.id)
  await adminClient.from('compartment_preset_medications').delete().eq('supply_type_id', supply.id)

  return { item_id, moved }
}
