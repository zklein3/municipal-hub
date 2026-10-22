import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

// Seeds a department's own copies of the master starter catalog (items, categories, medication
// types, compartment presets + contents + apparatus-type tags). See PLAN_INVENTORY_STREAMLINE.md.
//
// Rules:
// - Additive only. Never updates or removes a department's existing rows (beyond tagging an adopted
//   row's source_starter_id when it is still null).
// - Ledger-driven: department_starter_seeds records every master row ever given to the department.
//   A master row already in the ledger is never re-seeded, so the department's renames, edits and
//   deletes are never undone. Re-running after a partial failure finishes the job.
// - Name matching is normalized (trim, collapse spaces, case-insensitive), so an existing department
//   row like "Chainsaw " is adopted instead of duplicated.
// - Medication types/medications are seeded only when the department has module_medical on; turning
//   the module on later and re-running picks them up (they were never recorded in the ledger).
// - Fire departments only.
//
// Takes the admin (service-role) client as an argument so it can run outside a request (scripts,
// tests) as well as from server actions. Callers are responsible for authorization.

type Kind =
  | 'category' | 'item' | 'medication_type'
  | 'compartment' | 'compartment_type' | 'compartment_item' | 'compartment_medication'

export type StarterSeedSummary = {
  skipped?: string
  categories: { created: number; adopted: number }
  items: { created: number; adopted: number }
  medicationTypes: { created: number; adopted: number }
  presets: { created: number; adopted: number }
  presetTypes: number
  presetItems: number
  presetMedications: number
  medicationsSkippedNoModule: boolean
}

export function normalizeName(s: string | null | undefined): string {
  return (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

// Type tags have no row id of their own (composite key), so derive a stable uuid-shaped ledger key.
function tagKey(compartmentId: string, typeId: string): string {
  const h = createHash('sha1').update(`${compartmentId}:${typeId}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}

function emptySummary(): StarterSeedSummary {
  return {
    categories: { created: 0, adopted: 0 },
    items: { created: 0, adopted: 0 },
    medicationTypes: { created: 0, adopted: 0 },
    presets: { created: 0, adopted: 0 },
    presetTypes: 0,
    presetItems: 0,
    presetMedications: 0,
    medicationsSkippedNoModule: false,
  }
}

export async function seedDepartmentStarters(
  adminClient: SupabaseClient,
  department_id: string
): Promise<{ summary?: StarterSeedSummary; error?: string }> {
  const summary = emptySummary()

  const { data: deptRows, error: deptErr } = await adminClient
    .from('departments')
    .select('id, department_type, module_medical')
    .eq('id', department_id)
  if (deptErr) return { error: deptErr.message }
  const dept = deptRows?.[0]
  if (!dept) return { error: 'Department not found.' }
  if ((dept.department_type ?? 'fire') !== 'fire') {
    summary.skipped = 'Starter catalog applies to fire departments only.'
    return { summary }
  }
  const withMedical = !!dept.module_medical
  summary.medicationsSkippedNoModule = !withMedical

  const [
    ledgerRes, mCatsRes, mItemsRes, mMedsRes, mCompsRes, mTypesRes, mCompItemsRes, mCompMedsRes,
    dCatsRes, dItemsRes, dMedsRes, dPresetsRes,
  ] = await Promise.all([
    adminClient.from('department_starter_seeds').select('kind, starter_id, target_id').eq('department_id', department_id),
    adminClient.from('starter_categories').select('id, category_name, sort_order').eq('active', true),
    adminClient.from('starter_items').select('id, category_id, item_name, item_description, tracks_quantity, tracks_assets, requires_presence_check, tracks_expiration, requires_inspection, requires_maintenance').eq('active', true),
    adminClient.from('starter_medication_types').select('id, name, category, unit_of_measure, is_controlled, tracks_expiration, required_signatures, notes').eq('active', true),
    adminClient.from('starter_compartments').select('id, name, default_code, description, sort_order').eq('active', true),
    adminClient.from('starter_compartment_types').select('starter_compartment_id, apparatus_type_id'),
    adminClient.from('starter_compartment_items').select('id, starter_compartment_id, starter_item_id, expected_quantity, minimum_quantity, sort_order, notes'),
    adminClient.from('starter_compartment_medications').select('id, starter_compartment_id, starter_medication_type_id, par_level, sort_order'),
    adminClient.from('item_categories').select('id, category_name, source_starter_id').eq('department_id', department_id),
    adminClient.from('items').select('id, item_name, source_starter_id').eq('department_id', department_id),
    adminClient.from('medical_supply_types').select('id, name, source_starter_id').eq('department_id', department_id),
    adminClient.from('compartment_presets').select('id, name, source_starter_id').eq('department_id', department_id),
  ])
  const firstErr = [ledgerRes, mCatsRes, mItemsRes, mMedsRes, mCompsRes, mTypesRes, mCompItemsRes, mCompMedsRes,
    dCatsRes, dItemsRes, dMedsRes, dPresetsRes].find(r => r.error)?.error
  if (firstErr) return { error: firstErr.message }

  // ── Ledger ────────────────────────────────────────────────────────────────
  const ledger = new Map<string, string | null>() // `${kind}:${starter_id}` → target_id
  for (const l of ledgerRes.data ?? []) ledger.set(`${l.kind}:${l.starter_id}`, l.target_id)
  const seeded = (kind: Kind, id: string) => ledger.has(`${kind}:${id}`)
  const newLedger: { department_id: string; kind: Kind; starter_id: string; target_id: string | null }[] = []
  const record = (kind: Kind, starter_id: string, target_id: string | null) => {
    ledger.set(`${kind}:${starter_id}`, target_id)
    newLedger.push({ department_id, kind, starter_id, target_id })
  }

  // Resolves master id → department row id for something seeded earlier (target still exists) or,
  // failing that, by normalized name. Returns null when the department removed it.
  function makeResolver(rows: { id: string; name: string }[], kind: Kind) {
    const byId = new Set(rows.map(r => r.id))
    const byName = new Map(rows.map(r => [normalizeName(r.name), r.id]))
    return {
      byName,
      resolve(masterId: string, masterName: string): string | null {
        const target = ledger.get(`${kind}:${masterId}`)
        if (target && byId.has(target)) return target
        return byName.get(normalizeName(masterName)) ?? null
      },
      add(id: string, name: string) { byId.add(id); byName.set(normalizeName(name), id) },
    }
  }

  async function adoptSourceTags(table: string, ids: { id: string; source: string }[]) {
    for (const { id, source } of ids) {
      await adminClient.from(table).update({ source_starter_id: source }).eq('id', id).is('source_starter_id', null)
    }
  }

  // ── Categories ────────────────────────────────────────────────────────────
  const cats = makeResolver((dCatsRes.data ?? []).map(c => ({ id: c.id, name: c.category_name })), 'category')
  {
    const toInsert: any[] = []
    const adopt: { id: string; source: string }[] = []
    for (const m of mCatsRes.data ?? []) {
      if (seeded('category', m.id)) continue
      const existing = cats.byName.get(normalizeName(m.category_name))
      if (existing) { adopt.push({ id: existing, source: m.id }); record('category', m.id, existing); summary.categories.adopted++ }
      else toInsert.push({ department_id, category_name: m.category_name.trim(), sort_order: m.sort_order, active: true, source_starter_id: m.id })
    }
    if (toInsert.length) {
      const { data, error } = await adminClient.from('item_categories').insert(toInsert).select('id, category_name, source_starter_id')
      if (error) return { error: `categories: ${error.message}` }
      for (const r of data ?? []) { cats.add(r.id, r.category_name); record('category', r.source_starter_id, r.id); summary.categories.created++ }
    }
    await adoptSourceTags('item_categories', adopt)
  }
  const masterCatName = new Map((mCatsRes.data ?? []).map(c => [c.id, c.category_name]))

  // A new master item whose category the department already removed: re-create that category,
  // since the item needs a home (categories can only be deleted when empty).
  async function categoryFor(masterCategoryId: string | null): Promise<string | null> {
    if (!masterCategoryId) return null
    const name = masterCatName.get(masterCategoryId)
    if (!name) return null
    const found = cats.resolve(masterCategoryId, name)
    if (found) return found
    const { data, error } = await adminClient.from('item_categories')
      .insert({ department_id, category_name: name.trim(), active: true, source_starter_id: masterCategoryId })
      .select('id').single()
    if (error || !data) return null
    cats.add(data.id, name)
    await adminClient.from('department_starter_seeds').update({ target_id: data.id })
      .eq('department_id', department_id).eq('kind', 'category').eq('starter_id', masterCategoryId)
    return data.id
  }

  // ── Items ─────────────────────────────────────────────────────────────────
  const items = makeResolver((dItemsRes.data ?? []).map(i => ({ id: i.id, name: i.item_name })), 'item')
  {
    const toInsert: any[] = []
    const adopt: { id: string; source: string }[] = []
    for (const m of mItemsRes.data ?? []) {
      if (seeded('item', m.id)) continue
      const existing = items.byName.get(normalizeName(m.item_name))
      if (existing) { adopt.push({ id: existing, source: m.id }); record('item', m.id, existing); summary.items.adopted++; continue }
      toInsert.push({
        department_id,
        category_id: await categoryFor(m.category_id),
        item_name: m.item_name.trim(),
        item_description: m.item_description,
        tracks_quantity: m.tracks_quantity,
        tracks_assets: m.tracks_assets,
        requires_presence_check: m.requires_presence_check,
        tracks_expiration: m.tracks_expiration,
        requires_inspection: m.requires_inspection,
        requires_maintenance: m.requires_maintenance,
        active: true,
        source_starter_id: m.id,
      })
    }
    if (toInsert.length) {
      const { data, error } = await adminClient.from('items').insert(toInsert).select('id, item_name, source_starter_id')
      if (error) return { error: `items: ${error.message}` }
      for (const r of data ?? []) { items.add(r.id, r.item_name); record('item', r.source_starter_id, r.id); summary.items.created++ }
    }
    await adoptSourceTags('items', adopt)
  }
  const masterItemName = new Map((mItemsRes.data ?? []).map(i => [i.id, i.item_name]))

  // ── Medication types (module_medical only) ───────────────────────────────
  const meds = makeResolver((dMedsRes.data ?? []).map(m => ({ id: m.id, name: m.name })), 'medication_type')
  if (withMedical) {
    const toInsert: any[] = []
    const adopt: { id: string; source: string }[] = []
    for (const m of mMedsRes.data ?? []) {
      if (seeded('medication_type', m.id)) continue
      const existing = meds.byName.get(normalizeName(m.name))
      if (existing) { adopt.push({ id: existing, source: m.id }); record('medication_type', m.id, existing); summary.medicationTypes.adopted++ }
      else toInsert.push({
        department_id, name: m.name.trim(), category: m.category, unit_of_measure: m.unit_of_measure,
        is_controlled: m.is_controlled, tracks_expiration: m.tracks_expiration,
        required_signatures: m.required_signatures, notes: m.notes, active: true, source_starter_id: m.id,
      })
    }
    if (toInsert.length) {
      const { data, error } = await adminClient.from('medical_supply_types').insert(toInsert).select('id, name, source_starter_id')
      if (error) return { error: `medication types: ${error.message}` }
      for (const r of data ?? []) { meds.add(r.id, r.name); record('medication_type', r.source_starter_id, r.id); summary.medicationTypes.created++ }
    }
    await adoptSourceTags('medical_supply_types', adopt)
  }
  const masterMedName = new Map((mMedsRes.data ?? []).map(m => [m.id, m.name]))

  // ── Compartment presets ──────────────────────────────────────────────────
  const presets = makeResolver((dPresetsRes.data ?? []).map(p => ({ id: p.id, name: p.name })), 'compartment')
  {
    const toInsert: any[] = []
    const adopt: { id: string; source: string }[] = []
    for (const m of mCompsRes.data ?? []) {
      if (seeded('compartment', m.id)) continue
      const existing = presets.byName.get(normalizeName(m.name))
      if (existing) { adopt.push({ id: existing, source: m.id }); record('compartment', m.id, existing); summary.presets.adopted++ }
      else toInsert.push({
        department_id, name: m.name.trim(), default_code: m.default_code.trim().toUpperCase(),
        description: m.description, sort_order: m.sort_order, active: true, source_starter_id: m.id,
      })
    }
    if (toInsert.length) {
      const { data, error } = await adminClient.from('compartment_presets').insert(toInsert).select('id, name, source_starter_id')
      if (error) return { error: `presets: ${error.message}` }
      for (const r of data ?? []) { presets.add(r.id, r.name); record('compartment', r.source_starter_id, r.id); summary.presets.created++ }
    }
    await adoptSourceTags('compartment_presets', adopt)
  }
  const masterCompName = new Map((mCompsRes.data ?? []).map(c => [c.id, c.name]))
  const presetFor = (masterCompId: string) => {
    const name = masterCompName.get(masterCompId)
    return name ? presets.resolve(masterCompId, name) : null
  }

  // ── Preset apparatus-type tags ───────────────────────────────────────────
  {
    const rows: any[] = []
    for (const t of mTypesRes.data ?? []) {
      const key = tagKey(t.starter_compartment_id, t.apparatus_type_id)
      if (seeded('compartment_type', key)) continue
      const preset_id = presetFor(t.starter_compartment_id)
      if (!preset_id) continue // department removed the preset
      rows.push({ preset_id, apparatus_type_id: t.apparatus_type_id })
      record('compartment_type', key, preset_id)
    }
    if (rows.length) {
      const { error } = await adminClient.from('compartment_preset_types')
        .upsert(rows, { onConflict: 'preset_id,apparatus_type_id', ignoreDuplicates: true })
      if (error) return { error: `preset types: ${error.message}` }
      summary.presetTypes += rows.length
    }
  }

  // ── Preset items ─────────────────────────────────────────────────────────
  {
    const rows: any[] = []
    for (const ci of mCompItemsRes.data ?? []) {
      if (seeded('compartment_item', ci.id)) continue
      const preset_id = presetFor(ci.starter_compartment_id)
      const itemName = masterItemName.get(ci.starter_item_id)
      const item_id = itemName ? items.resolve(ci.starter_item_id, itemName) : null
      if (!preset_id || !item_id) continue // preset or item removed by the department (or item inactive in master)
      rows.push({
        preset_id, item_id, expected_quantity: ci.expected_quantity,
        minimum_quantity: ci.minimum_quantity, sort_order: ci.sort_order, notes: ci.notes,
      })
      record('compartment_item', ci.id, preset_id)
    }
    if (rows.length) {
      const { error } = await adminClient.from('compartment_preset_items')
        .upsert(rows, { onConflict: 'preset_id,item_id', ignoreDuplicates: true })
      if (error) return { error: `preset items: ${error.message}` }
      summary.presetItems += rows.length
    }
  }

  // ── Preset medications (module_medical only) ─────────────────────────────
  if (withMedical) {
    const rows: any[] = []
    for (const cm of mCompMedsRes.data ?? []) {
      if (seeded('compartment_medication', cm.id)) continue
      const preset_id = presetFor(cm.starter_compartment_id)
      const medName = masterMedName.get(cm.starter_medication_type_id)
      const supply_type_id = medName ? meds.resolve(cm.starter_medication_type_id, medName) : null
      if (!preset_id || !supply_type_id) continue
      rows.push({ preset_id, supply_type_id, par_level: cm.par_level, sort_order: cm.sort_order })
      record('compartment_medication', cm.id, preset_id)
    }
    if (rows.length) {
      const { error } = await adminClient.from('compartment_preset_medications')
        .upsert(rows, { onConflict: 'preset_id,supply_type_id', ignoreDuplicates: true })
      if (error) return { error: `preset medications: ${error.message}` }
      summary.presetMedications += rows.length
    }
  }

  // ── Write ledger last-but-safely: rows above are idempotent on their own unique keys, so a
  // failure here just means the next run re-matches by name and records again. ───────────────
  if (newLedger.length) {
    const { error } = await adminClient.from('department_starter_seeds')
      .upsert(newLedger, { onConflict: 'department_id,kind,starter_id', ignoreDuplicates: true })
    if (error) return { error: `ledger: ${error.message}` }
  }

  return { summary }
}
