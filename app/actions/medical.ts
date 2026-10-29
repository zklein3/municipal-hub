'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { hasPermission } from '@/lib/permissions'
import { logError } from '@/lib/logger'
import { getOrCreateCompartmentStoreroom } from '@/lib/medical-storeroom'
import { randomBytes } from 'node:crypto'

// Bags move between trucks, members and storerooms, so their QR code can't encode a unit number.
function newBagQrCode() {
  return `BAG-${randomBytes(4).toString('hex').toUpperCase()}`
}
import { revalidatePath } from 'next/cache'

async function getContext() {
  const ctx = await getCurrentDepartmentContext()
  if (!ctx) return null
  return {
    me: { id: ctx.personnelId, is_sys_admin: ctx.isSysAdmin },
    department_id: ctx.departmentId,
    system_role: ctx.systemRole,
    isAdmin: await hasPermission(ctx, 'manage_medical_supply_setup'),
    isOfficerOrAbove: await hasPermission(ctx, 'manage_medical_inventory'),
    fullCtx: ctx,
  }
}


// ─── Assign Supply Type to a Compartment ──────────────────────────────────────
// The medical counterpart to assignItemToCompartment (app/actions/equipment.ts) --
// lets a compartment's "+ Add Item" flow add a medication the same way it adds
// regular equipment, without requiring stock to already exist anywhere.
export async function assignMedicalSupplyToCompartment(formData: FormData) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove) return { error: 'Only officers and admins can assign medications.' }
  if (!ctx.department_id) return { error: 'Department not found.' }
  const adminClient = createAdminClient()

  const apparatus_compartment_id = formData.get('apparatus_compartment_id') as string
  const supply_type_id = formData.get('supply_type_id') as string
  const par_level = parseInt(formData.get('par_level') as string) || 0
  if (!apparatus_compartment_id || !supply_type_id) return { error: 'Compartment and medication are required.' }

  const room = await getOrCreateCompartmentStoreroom(adminClient, ctx.department_id, apparatus_compartment_id)
  if ('error' in room) return { error: room.error }

  const { data: existingInv } = await adminClient
    .from('medical_storeroom_inventory')
    .select('id')
    .eq('storeroom_id', room.storeroom_id)
    .eq('supply_type_id', supply_type_id)
    .maybeSingle()

  if (existingInv) return { error: 'This medication is already assigned to this compartment.' }

  const { error: invErr } = await adminClient.from('medical_storeroom_inventory').insert({
    storeroom_id: room.storeroom_id,
    supply_type_id,
    department_id: ctx.department_id,
    par_level,
  })
  if (invErr) { await logError(invErr.message, '/equipment'); return { error: invErr.message } }

  revalidatePath('/equipment')
  revalidatePath('/apparatus')
  revalidatePath('/dept-admin/setup')
  return { success: true }
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
  revalidatePath('/medical')
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
  revalidatePath('/medical')
  return { success: true }
}

export async function deleteMedicalSupplyType(id: string) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admins only.' }
  const adminClient = createAdminClient()

  const [
    { count: inventoryCount },
    { count: templateItemCount },
  ] = await Promise.all([
    adminClient.from('medical_storeroom_inventory').select('id', { count: 'exact', head: true }).eq('supply_type_id', id),
    adminClient.from('medical_bag_template_items').select('id', { count: 'exact', head: true }).eq('supply_type_id', id),
  ])

  const blockers: string[] = []
  if ((inventoryCount ?? 0) > 0) blockers.push('assigned to a storeroom, bag, or compartment')
  if ((templateItemCount ?? 0) > 0) blockers.push('used in a bag template')

  if (blockers.length > 0) {
    return { error: `Can't delete — this supply type ${blockers.join('; ')}. Deactivate it instead.` }
  }

  const { error: dbErr } = await adminClient.from('medical_supply_types').delete().eq('id', id)
  if (dbErr) { await logError(dbErr.message, '/dept-admin/medical'); return { error: dbErr.message } }
  revalidatePath('/medical')
  revalidatePath('/dept-admin/setup')
  return { success: true }
}

// ─── Bag Templates ────────────────────────────────────────────────────────────

export async function createBagTemplate(formData: FormData) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admins only.' }
  const adminClient = createAdminClient()

  const { data: row, error: dbErr } = await adminClient.from('medical_bag_templates').insert({
    department_id: ctx.department_id,
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || null,
    active: true,
  }).select('id').single()

  if (dbErr) { await logError(dbErr.message, '/dept-admin/medical'); return { error: dbErr.message } }
  revalidatePath('/medical')
  return { success: true, id: row.id }
}

export async function updateBagTemplate(formData: FormData) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admins only.' }
  const adminClient = createAdminClient()

  const { error: dbErr } = await adminClient.from('medical_bag_templates').update({
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || null,
    active: formData.get('active') === 'true',
    updated_at: new Date().toISOString(),
  }).eq('id', formData.get('id') as string)

  if (dbErr) { await logError(dbErr.message, '/dept-admin/medical'); return { error: dbErr.message } }
  revalidatePath('/medical')
  return { success: true }
}

export async function addTemplateItem(template_id: string, supply_type_id: string, par_level: number) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admins only.' }
  const adminClient = createAdminClient()

  const { error: dbErr } = await adminClient.from('medical_bag_template_items').upsert({
    template_id, supply_type_id, par_level,
  }, { onConflict: 'template_id,supply_type_id' })

  if (dbErr) { await logError(dbErr.message, '/dept-admin/medical'); return { error: dbErr.message } }
  revalidatePath('/medical')
  return { success: true }
}

export async function removeTemplateItem(item_id: string) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admins only.' }
  const adminClient = createAdminClient()

  const { error: dbErr } = await adminClient.from('medical_bag_template_items').delete().eq('id', item_id)
  if (dbErr) { await logError(dbErr.message, '/dept-admin/medical'); return { error: dbErr.message } }
  revalidatePath('/medical')
  return { success: true }
}

// ─── Bag template contents: equipment items + child bags (2B) ────────────────

export async function addTemplateEquipmentItem(template_id: string, item_id: string, expected_qty: number) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admins only.' }
  const adminClient = createAdminClient()
  const { data: tmpl } = await adminClient.from('medical_bag_templates')
    .select('department_id').eq('id', template_id).single()
  if (!tmpl || tmpl.department_id !== ctx.department_id) return { error: 'Bag template not found.' }

  const { error: dbErr } = await adminClient.from('bag_template_items').upsert({
    template_id, item_id, expected_qty: Math.max(0, Math.floor(expected_qty) || 0),
  }, { onConflict: 'template_id,item_id' })
  if (dbErr) { await logError(dbErr.message, '/medical'); return { error: dbErr.message } }
  revalidatePath('/medical')
  return { success: true }
}

export async function removeTemplateEquipmentItem(id: string) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admins only.' }
  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient.from('bag_template_items').delete().eq('id', id)
  if (dbErr) { await logError(dbErr.message, '/medical'); return { error: dbErr.message } }
  revalidatePath('/medical')
  return { success: true }
}

export async function addTemplateChild(template_id: string, child_template_id: string, quantity: number) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admins only.' }
  const adminClient = createAdminClient()
  if (template_id === child_template_id) return { error: "A bag can't contain itself." }

  const { data: tmpls } = await adminClient.from('medical_bag_templates')
    .select('id, department_id').in('id', [template_id, child_template_id])
  if ((tmpls ?? []).length !== 2 || tmpls!.some(t => t.department_id !== ctx.department_id))
    return { error: 'Bag template not found.' }

  // Cycle guard: the child must not (directly or deeply) already contain this template.
  const { data: links } = await adminClient.from('bag_template_children')
    .select('template_id, child_template_id')
  const kids = new Map<string, string[]>()
  for (const l of links ?? []) kids.set(l.template_id, [...(kids.get(l.template_id) ?? []), l.child_template_id])
  const stack = [child_template_id]
  const seen = new Set<string>()
  while (stack.length) {
    const cur = stack.pop()!
    if (cur === template_id) return { error: 'That would put a bag inside itself (a loop). Pick a different bag.' }
    if (seen.has(cur)) continue
    seen.add(cur)
    stack.push(...(kids.get(cur) ?? []))
  }

  const { error: dbErr } = await adminClient.from('bag_template_children').upsert({
    template_id, child_template_id, quantity: Math.max(1, Math.floor(quantity) || 1),
  }, { onConflict: 'template_id,child_template_id' })
  if (dbErr) { await logError(dbErr.message, '/medical'); return { error: dbErr.message } }
  revalidatePath('/medical')
  return { success: true }
}

export async function removeTemplateChild(id: string) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admins only.' }
  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient.from('bag_template_children').delete().eq('id', id)
  if (dbErr) { await logError(dbErr.message, '/medical'); return { error: dbErr.message } }
  revalidatePath('/medical')
  return { success: true }
}

// Creates one bag from a template (medications at PAR, equipment items at expected qty) and,
// recursively, the bags the template says it contains. Returns the new bag's id.
async function createBagFromTemplate(
  adminClient: ReturnType<typeof createAdminClient>,
  department_id: string,
  opts: {
    template_id: string
    name?: string
    apparatus_id: string | null
    compartment_id?: string | null
    parent_storeroom_id?: string | null
    inventory_mode: 'standard' | 'independent'
    depth: number
  },
): Promise<{ id?: string; error?: string }> {
  if (opts.depth > 5) return { error: 'Bag templates are nested too deeply.' }

  const { data: tmpl } = await adminClient.from('medical_bag_templates')
    .select('name, department_id').eq('id', opts.template_id).single()
  if (!tmpl || tmpl.department_id !== department_id) return { error: 'Bag template not found.' }

  // Instances auto-number per template ("Trauma Box 1, 2…"); a custom name is kept as given.
  const { data: maxRow } = await adminClient.from('medical_storerooms')
    .select('bag_number').eq('department_id', department_id).eq('template_id', opts.template_id)
    .order('bag_number', { ascending: false, nullsFirst: false }).limit(1)
  const bag_number = (maxRow?.[0]?.bag_number ?? 0) + 1
  const requested = opts.name?.trim()
  const name = !requested || requested === tmpl.name ? `${tmpl.name} ${bag_number}` : requested

  const { data: bag, error: bagErr } = await adminClient.from('medical_storerooms').insert({
    department_id,
    apparatus_id: opts.apparatus_id,
    compartment_id: opts.compartment_id || null,
    parent_storeroom_id: opts.parent_storeroom_id || null,
    template_id: opts.template_id,
    inventory_mode: opts.inventory_mode,
    name,
    bag_number,
    qr_code: newBagQrCode(),
    container_kind: 'bag',
    active: true,
  }).select('id').single()
  if (bagErr) { await logError(bagErr.message, '/apparatus'); return { error: bagErr.message } }
  const bagId: string = bag.id

  const [{ data: medItems }, { data: equipItems }, { data: children }] = await Promise.all([
    adminClient.from('medical_bag_template_items').select('supply_type_id, par_level').eq('template_id', opts.template_id),
    adminClient.from('bag_template_items').select('item_id, expected_qty').eq('template_id', opts.template_id),
    adminClient.from('bag_template_children').select('child_template_id, quantity').eq('template_id', opts.template_id),
  ])

  if (medItems && medItems.length > 0) {
    const { error: invErr } = await adminClient.from('medical_storeroom_inventory').insert(
      medItems.map(i => ({
        storeroom_id: bagId, supply_type_id: i.supply_type_id,
        department_id, par_level: i.par_level,
      })))
    if (invErr) { await logError(invErr.message, '/apparatus'); return { error: invErr.message } }
  }

  if (equipItems && equipItems.length > 0) {
    const { error: stdErr } = await adminClient.from('item_location_standards').insert(
      equipItems.map(i => ({ storeroom_id: bagId, item_id: i.item_id, expected_quantity: i.expected_qty, active: true })))
    if (stdErr) { await logError(stdErr.message, '/apparatus'); return { error: stdErr.message } }
  }

  for (const child of children ?? []) {
    for (let n = 0; n < child.quantity; n++) {
      const res = await createBagFromTemplate(adminClient, department_id, {
        template_id: child.child_template_id,
        apparatus_id: opts.apparatus_id,
        parent_storeroom_id: bagId,
        inventory_mode: opts.inventory_mode,
        depth: opts.depth + 1,
      })
      if (res.error) return { error: res.error }
    }
  }

  return { id: bagId }
}

export async function deployBagFromTemplate(data: {
  apparatus_id: string
  template_id: string
  name: string
  inventory_mode: 'standard' | 'independent'
  compartment_id?: string | null
}) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admins only.' }
  if (!ctx.department_id) return { error: 'Department not found.' }
  const adminClient = createAdminClient()

  // A bag is always its own row (container_kind 'bag'). Placing it in a compartment just sets
  // compartment_id — a compartment can hold its loose medications plus any number of bags.
  if (data.compartment_id) {
    const { data: comp } = await adminClient.from('apparatus_compartments')
      .select('apparatus_id').eq('id', data.compartment_id).single()
    if (comp?.apparatus_id !== data.apparatus_id) return { error: 'That compartment is not on this apparatus.' }
  }

  const res = await createBagFromTemplate(adminClient, ctx.department_id, {
    template_id: data.template_id,
    name: data.name,
    apparatus_id: data.apparatus_id,
    compartment_id: data.compartment_id,
    inventory_mode: data.inventory_mode,
    depth: 0,
  })
  if (res.error) return { error: res.error }

  revalidatePath(`/apparatus/${data.apparatus_id}`)
  revalidatePath(`/equipment/${data.apparatus_id}`)
  revalidatePath('/dept-admin/setup')
  return { success: true }
}

// Deploy a bag somewhere other than directly on a truck compartment: in a station storeroom,
// inside another bag (wherever that bag is), or assigned to a member (POV bag).
export async function deployBagToPlace(data: {
  template_id: string
  name: string
  inventory_mode: 'standard' | 'independent'
  destination: { kind: 'storeroom' | 'bag' | 'member'; id: string }
}) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admins only.' }
  if (!ctx.department_id) return { error: 'Department not found.' }
  const adminClient = createAdminClient()
  const { kind, id } = data.destination

  let apparatus_id: string | null = null
  let parent_storeroom_id: string | null = null
  let assigned_personnel_id: string | null = null

  if (kind === 'member') {
    const { data: dp } = await adminClient.from('department_personnel')
      .select('personnel_id').eq('department_id', ctx.department_id).eq('personnel_id', id).eq('active', true).maybeSingle()
    if (!dp) return { error: 'Member not found in this department.' }
    assigned_personnel_id = id
  } else {
    const { data: dest } = await adminClient.from('medical_storerooms')
      .select('id, department_id, container_kind, apparatus_id, active').eq('id', id).single()
    if (!dest || dest.department_id !== ctx.department_id || !dest.active) return { error: 'Destination not found.' }
    if (kind === 'storeroom' && dest.container_kind !== 'storeroom') return { error: 'That is not a storeroom.' }
    if (kind === 'bag' && dest.container_kind !== 'bag') return { error: 'That is not a bag.' }
    parent_storeroom_id = dest.id
    apparatus_id = dest.apparatus_id // a bag inside a truck's bag stays on that truck
  }

  const res = await createBagFromTemplate(adminClient, ctx.department_id, {
    template_id: data.template_id,
    name: data.name,
    apparatus_id,
    parent_storeroom_id,
    inventory_mode: data.inventory_mode,
    depth: 0,
  })
  if (res.error) return { error: res.error }

  if (assigned_personnel_id) {
    const { error: dbErr } = await adminClient.from('medical_storerooms')
      .update({ assigned_personnel_id }).eq('id', res.id!)
    if (dbErr) { await logError(dbErr.message, '/medical'); return { error: dbErr.message } }
  }

  revalidatePath('/medical')
  if (apparatus_id) revalidatePath(`/equipment/${apparatus_id}`)
  return { success: true }
}

export async function assignBagToApparatus(data: {
  template_id: string
  apparatus_id: string
  name: string
  inventory_mode: 'standard' | 'independent'
  compartment_id?: string | null
}) {
  return deployBagFromTemplate({
    apparatus_id: data.apparatus_id,
    template_id: data.template_id,
    name: data.name,
    inventory_mode: data.inventory_mode,
    compartment_id: data.compartment_id,
  })
}

// Place a bag in a different compartment on its own apparatus, or take it out of a compartment
// (still on the truck). The bag is its own row, so this only changes where it sits — its contents
// stay with it. Moves between trucks/members/storerooms come in step 2C (with the required
// "did the contents move too?" questions).
export async function updateBagCompartment(storeroom_id: string, compartment_id: string | null) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admins only.' }
  const adminClient = createAdminClient()

  const { data: bag } = await adminClient
    .from('medical_storerooms')
    .select('id, apparatus_id, department_id, container_kind')
    .eq('id', storeroom_id)
    .single()
  if (!bag || bag.container_kind !== 'bag' || bag.department_id !== ctx.department_id) return { error: 'Bag not found.' }

  if (compartment_id) {
    const { data: comp } = await adminClient.from('apparatus_compartments')
      .select('apparatus_id').eq('id', compartment_id).single()
    if (comp?.apparatus_id !== bag.apparatus_id) return { error: 'That compartment is not on the same apparatus as this bag.' }
  }

  const { error: dbErr } = await adminClient.from('medical_storerooms')
    .update({ compartment_id: compartment_id || null, parent_storeroom_id: null, updated_at: new Date().toISOString() })
    .eq('id', storeroom_id)
  if (dbErr) { await logError(dbErr.message, '/apparatus'); return { error: dbErr.message } }

  revalidatePath('/dept-admin/setup')
  if (bag.apparatus_id) revalidatePath(`/equipment/${bag.apparatus_id}`)
  return { success: true }
}

// Move a bag (with any bags nested in it) to a compartment, another bag, a station storeroom, or a
// member. Two answers are required every time: did the medications go with the bag (if not, where do
// the stocked lots go?) and did the tracked equipment go with it.
export async function moveBag(data: {
  bag_id: string
  destination: { kind: 'compartment' | 'bag' | 'storeroom' | 'member'; id: string }
  medsMovedWithBag: boolean | null
  medsDestinationStoreroomId?: string | null
  assetsMovedWithBag: boolean | null
  notes?: string | null
}) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admins only.' }
  if (!ctx.department_id) return { error: 'Department not found.' }
  if (data.medsMovedWithBag === null || data.assetsMovedWithBag === null)
    return { error: 'Answer both questions: did the medications move with the bag, and did the tracked equipment?' }
  if (data.medsMovedWithBag === false && !data.medsDestinationStoreroomId)
    return { error: 'Choose where the medications go.' }
  const adminClient = createAdminClient()
  const dept = ctx.department_id

  const { data: bag } = await adminClient.from('medical_storerooms')
    .select('id, name, department_id, container_kind, apparatus_id, compartment_id, parent_storeroom_id, assigned_personnel_id, station_id')
    .eq('id', data.bag_id).single()
  if (!bag || bag.container_kind !== 'bag' || bag.department_id !== dept) return { error: 'Bag not found.' }

  // Everything that travels: this bag plus bags nested in it, at any depth.
  const { data: allBags } = await adminClient.from('medical_storerooms')
    .select('id, name, parent_storeroom_id').eq('department_id', dept).eq('container_kind', 'bag').eq('active', true)
  const kidsOf = new Map<string, string[]>()
  for (const b of allBags ?? []) if (b.parent_storeroom_id) kidsOf.set(b.parent_storeroom_id, [...(kidsOf.get(b.parent_storeroom_id) ?? []), b.id])
  const subtree: string[] = []
  const queue = [bag.id]
  while (queue.length) { const cur = queue.pop()!; subtree.push(cur); queue.push(...(kidsOf.get(cur) ?? [])) }

  const nameOf = (id: string) => (allBags ?? []).find(b => b.id === id)?.name ?? 'a bag'
  const { kind, id } = data.destination

  // "Unit 11 — TRAUMA" for log text, so the move history names the actual compartment.
  async function compartmentLabel(compartmentId: string | null): Promise<string | null> {
    if (!compartmentId) return null
    const { data: c } = await adminClient.from('apparatus_compartments').select('apparatus_id, compartment_name_id').eq('id', compartmentId).single()
    if (!c) return null
    const [{ data: a }, { data: n }] = await Promise.all([
      adminClient.from('apparatus').select('unit_number').eq('id', c.apparatus_id).single(),
      adminClient.from('compartment_names').select('compartment_code').eq('id', c.compartment_name_id).single(),
    ])
    return `Unit ${a?.unit_number ?? '?'} — ${n?.compartment_code ?? '?'}`
  }
  let newApparatus: string | null = null
  const patch: { compartment_id: string | null; parent_storeroom_id: string | null; assigned_personnel_id: string | null } =
    { compartment_id: null, parent_storeroom_id: null, assigned_personnel_id: null }
  let toDescription = ''

  if (kind === 'compartment') {
    const { data: comp } = await adminClient.from('apparatus_compartments').select('id, apparatus_id').eq('id', id).single()
    if (!comp) return { error: 'Compartment not found.' }
    const { data: app } = await adminClient.from('apparatus').select('unit_number, department_id').eq('id', comp.apparatus_id).single()
    if (!app || app.department_id !== dept) return { error: 'Compartment not found.' }
    newApparatus = comp.apparatus_id
    patch.compartment_id = comp.id
    toDescription = (await compartmentLabel(comp.id)) ?? `Unit ${app.unit_number} compartment`
  } else if (kind === 'bag' || kind === 'storeroom') {
    const { data: dest } = await adminClient.from('medical_storerooms')
      .select('id, name, department_id, container_kind, apparatus_id, active').eq('id', id).single()
    if (!dest || dest.department_id !== dept || !dest.active) return { error: 'Destination not found.' }
    if (kind === 'bag' && dest.container_kind !== 'bag') return { error: 'That is not a bag.' }
    if (kind === 'storeroom' && dest.container_kind !== 'storeroom') return { error: 'That is not a storeroom.' }
    if (subtree.includes(dest.id)) return { error: "A bag can't be placed inside itself or a bag within it." }
    patch.parent_storeroom_id = dest.id
    newApparatus = kind === 'bag' ? dest.apparatus_id : null
    toDescription = `${kind === 'bag' ? 'Inside' : 'Storeroom'} ${dest.name}`
  } else {
    const { data: dp } = await adminClient.from('department_personnel')
      .select('personnel_id, personnel(first_name, last_name)')
      .eq('department_id', dept).eq('personnel_id', id).eq('active', true).maybeSingle()
    if (!dp) return { error: 'Member not found in this department.' }
    const p = (dp as any).personnel
    patch.assigned_personnel_id = id
    toDescription = `Assigned to ${[p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'member'}`
  }

  const fromApparatus: string | null = bag.apparatus_id
  const fromDescription = bag.parent_storeroom_id ? `Inside ${nameOf(bag.parent_storeroom_id)}`
    : bag.compartment_id ? ((await compartmentLabel(bag.compartment_id)) ?? 'A truck compartment') : bag.assigned_personnel_id ? 'Assigned to a member'
    : bag.apparatus_id ? 'On a truck (not pinned)' : 'Unplaced'

  // Medications left behind: move every stocked lot in the subtree to the chosen storeroom first,
  // so a failure leaves the bag where it was.
  if (data.medsMovedWithBag === false) {
    const { data: dest } = await adminClient.from('medical_storerooms')
      .select('id, department_id').eq('id', data.medsDestinationStoreroomId!).single()
    if (!dest || dest.department_id !== dept) return { error: 'Medication destination not found.' }
    const { data: inv } = await adminClient.from('medical_storeroom_inventory').select('id').in('storeroom_id', subtree)
    const invIds = (inv ?? []).map(i => i.id)
    const { data: lots } = invIds.length > 0
      ? await adminClient.from('medical_stock_lots').select('id, storeroom_inventory_id, quantity_remaining')
          .in('storeroom_inventory_id', invIds).eq('active', true).gt('quantity_remaining', 0)
      : { data: [] }
    for (const lot of lots ?? []) {
      const r = await transferStock({
        source_inventory_id: lot.storeroom_inventory_id, lot_id: lot.id,
        destination_storeroom_id: dest.id, quantity: lot.quantity_remaining,
        notes: `Bag "${bag.name}" moved — medications left behind`,
      })
      if ('error' in r && r.error) return { error: `Medication transfer failed: ${r.error}` }
    }
  }

  const now = new Date().toISOString()
  const { error: moveErr } = await adminClient.from('medical_storerooms')
    .update({ ...patch, apparatus_id: newApparatus, updated_at: now }).eq('id', bag.id)
  if (moveErr) { await logError(moveErr.message, '/medical'); return { error: moveErr.message } }

  // Nested bags travel with it, so their truck follows.
  const nested = subtree.filter(b => b !== bag.id)
  if (nested.length > 0) {
    const { error: nestErr } = await adminClient.from('medical_storerooms')
      .update({ apparatus_id: newApparatus, updated_at: now }).in('id', nested)
    if (nestErr) { await logError(nestErr.message, '/medical'); return { error: nestErr.message } }
  }

  // Tracked equipment last confirmed in these bags: follows the truck, or stays put and is unlinked.
  if (data.assetsMovedWithBag) {
    if (newApparatus !== fromApparatus) {
      await adminClient.from('item_assets').update({ apparatus_id: newApparatus }).in('container_id', subtree)
    }
  } else {
    await adminClient.from('item_assets').update({ container_id: null }).in('container_id', subtree)
  }

  await adminClient.from('container_movement_log').insert({
    department_id: dept, bag_id: bag.id, bag_name: bag.name,
    from_description: fromDescription, to_description: toDescription,
    from_apparatus_id: fromApparatus, to_apparatus_id: newApparatus,
    moved_by: ctx.me.id,
    meds_moved_with_bag: data.medsMovedWithBag, meds_destination_id: data.medsMovedWithBag ? null : data.medsDestinationStoreroomId,
    assets_moved_with_bag: data.assetsMovedWithBag, notes: data.notes?.trim() || null,
  })

  revalidatePath('/medical')
  for (const a of new Set([fromApparatus, newApparatus])) if (a) revalidatePath(`/equipment/${a}`)
  return { success: true }
}

export async function removeBagFromApparatus(storeroom_id: string) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admins only.' }
  const adminClient = createAdminClient()

  // Lots hang off the bag's inventory rows, not the bag itself. (This used to compare the lot's
  // storeroom_inventory_id to the bag id, which never matched — so bags with stock could be removed.)
  const { data: invRows } = await adminClient
    .from('medical_storeroom_inventory').select('id').eq('storeroom_id', storeroom_id)
  const invIds = (invRows ?? []).map(i => i.id)
  const { data: lots } = invIds.length > 0
    ? await adminClient
        .from('medical_stock_lots')
        .select('id')
        .in('storeroom_inventory_id', invIds)
        .eq('active', true)
        .gt('quantity_remaining', 0)
        .limit(1)
    : { data: [] }

  if (lots && lots.length > 0)
    return { error: 'Cannot remove — bag has active stock. Waste or transfer stock first.' }

  const { error: dbErr } = await adminClient
    .from('medical_storerooms')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', storeroom_id)

  if (dbErr) { await logError(dbErr.message, '/dept-admin/medical'); return { error: dbErr.message } }
  revalidatePath('/medical')
  return { success: true }
}

export async function updateBagInventoryMode(storeroom_id: string, mode: 'standard' | 'independent') {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admins only.' }
  const adminClient = createAdminClient()

  const { error: dbErr } = await adminClient
    .from('medical_storerooms')
    .update({ inventory_mode: mode, updated_at: new Date().toISOString() })
    .eq('id', storeroom_id)

  if (dbErr) { await logError(dbErr.message, '/apparatus'); return { error: dbErr.message } }
  revalidatePath('/medical')
  return { success: true }
}

// ─── Storerooms ───────────────────────────────────────────────────────────────

export async function createMedicalStoreroom(formData: FormData) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admins only.' }
  const adminClient = createAdminClient()

  const compartment_id = (formData.get('compartment_id') as string) || null
  const { error: dbErr } = await adminClient.from('medical_storerooms').insert({
    department_id: ctx.department_id,
    station_id: (formData.get('station_id') as string) || null,
    apparatus_id: (formData.get('apparatus_id') as string) || null,
    compartment_id,
    name: formData.get('name') as string,
    notes: (formData.get('notes') as string) || null,
    active: true,
    container_kind: compartment_id ? 'compartment_storage' : 'storeroom',
  })

  if (dbErr) { await logError(dbErr.message, '/dept-admin/medical'); return { error: dbErr.message } }
  revalidatePath('/medical')
  return { success: true }
}

export async function updateMedicalStoreroom(formData: FormData) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admins only.' }
  const adminClient = createAdminClient()

  const { error: dbErr } = await adminClient.from('medical_storerooms').update({
    station_id: (formData.get('station_id') as string) || null,
    apparatus_id: (formData.get('apparatus_id') as string) || null,
    compartment_id: (formData.get('compartment_id') as string) || null,
    name: formData.get('name') as string,
    notes: (formData.get('notes') as string) || null,
    active: formData.get('active') === 'true',
    updated_at: new Date().toISOString(),
  }).eq('id', formData.get('id') as string)

  if (dbErr) { await logError(dbErr.message, '/dept-admin/medical'); return { error: dbErr.message } }
  revalidatePath('/medical')
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
  revalidatePath('/medical')
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
  revalidatePath('/medical')
  revalidatePath('/equipment/[id]', 'page')
  revalidatePath('/apparatus/[id]', 'page')
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
  signer_1_signature: string | null
  signer_2_signature: string | null
  concentration_amount: number | null
  concentration_unit: string | null
  volume_per_unit: number | null
  volume_unit: string | null
  control_numbers: string[] | null
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
    .select('required_signatures, name, is_controlled')
    .eq('id', invRow.supply_type_id)
    .single()

  const sigsRequired = supplyType?.required_signatures ?? 0
  if (sigsRequired >= 1 && !data.signer_1_id) return { error: 'Signer 1 is required for this supply type.' }
  if (sigsRequired >= 1 && !data.signer_1_signature) return { error: 'Signer 1 must sign.' }
  if (sigsRequired >= 2 && !data.signer_2_id) return { error: 'A second signer is required for controlled substances.' }
  if (sigsRequired >= 2 && !data.signer_2_signature) return { error: 'The second signer must sign.' }

  // Controlled substances get one control number per vial — checked here rather than left
  // to the DB unique constraint alone so a typo'd duplicate surfaces as a clear error.
  if (supplyType?.is_controlled) {
    const numbers = (data.control_numbers ?? []).map(n => n.trim())
    if (numbers.length !== data.quantity_received || numbers.some(n => !n))
      return { error: 'A control number is required for every vial.' }
    if (new Set(numbers).size !== numbers.length)
      return { error: 'Control numbers must be unique — two vials have the same number.' }
  }

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
    concentration_amount: data.concentration_amount || null,
    concentration_unit: data.concentration_unit || null,
    volume_per_unit: data.volume_per_unit || null,
    volume_unit: data.volume_unit || null,
  }).select('id').single()

  if (lotErr) { await logError(lotErr.message, '/medical'); return { error: lotErr.message } }

  // Create the transaction record first so controlled-substance vials can be tagged with it
  // below — that's what lets the CS log resolve a "Received" line back to its control numbers
  // even after the vials are later transferred to a different lot (which reassigns lot_id).
  const { data: tx, error: txErr } = await adminClient.from('medical_stock_transactions').insert({
    department_id: invRow.department_id,
    storeroom_id: invRow.storeroom_id,
    supply_type_id: invRow.supply_type_id,
    supply_type_name: supplyType?.name ?? null,
    lot_id: lot.id,
    transaction_type: 'received',
    quantity: data.quantity_received,
    performed_by: ctx.me.id,
    signer_1_id: data.signer_1_id || null,
    signer_1_at: data.signer_1_id ? now : null,
    signer_1_signature_data: data.signer_1_signature || null,
    signer_2_id: data.signer_2_id || null,
    signer_2_at: data.signer_2_id ? now : null,
    signer_2_signature_data: data.signer_2_signature || null,
    notes: data.notes || null,
  }).select('id').single()

  if (txErr) { await logError(txErr.message, '/medical'); return { error: txErr.message } }

  if (supplyType?.is_controlled) {
    const { error: unitsErr } = await adminClient.from('medical_stock_units').insert(
      (data.control_numbers ?? []).map(control_number => ({
        lot_id: lot.id,
        department_id: invRow.department_id,
        control_number: control_number.trim(),
        status: 'available' as const,
        transaction_id: tx.id,
      }))
    )
    if (unitsErr) {
      await logError(unitsErr.message, '/medical', { metadata: { lot_id: lot.id } })
      const dup = unitsErr.code === '23505'
      return { error: dup ? 'One of these control numbers is already in use in this department.' : unitsErr.message }
    }
  }

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
  signer_1_signature: string | null
  signer_2_signature: string | null
}) {
  const ctx = await getContext()
  if (!ctx?.department_id) return { error: 'Not authorized.' }
  if (!(await hasPermission(ctx.fullCtx, 'dispense_controlled_substances'))) return { error: 'Not authorized.' }
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
    .select('name, required_signatures')
    .eq('id', invRow.supply_type_id)
    .single()

  const sigsRequired = supplyType?.required_signatures ?? 0
  if (sigsRequired >= 1 && !data.signer_1_id) return { error: 'Signer 1 is required for this supply type.' }
  if (sigsRequired >= 1 && !data.signer_1_signature) return { error: 'Signer 1 must sign.' }
  if (sigsRequired >= 2 && !data.signer_2_id) return { error: 'A second signer is required for controlled substances.' }
  if (sigsRequired >= 2 && !data.signer_2_signature) return { error: 'The second signer must sign.' }

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
    supply_type_name: supplyType?.name ?? null,
    lot_id: data.lot_id,
    transaction_type: 'dispensed',
    quantity: data.quantity,
    performed_by: ctx.me.id,
    signer_1_id: data.signer_1_id || null,
    signer_1_at: data.signer_1_id ? now : null,
    signer_1_signature_data: data.signer_1_signature || null,
    signer_2_id: data.signer_2_id || null,
    signer_2_at: data.signer_2_id ? now : null,
    signer_2_signature_data: data.signer_2_signature || null,
    notes: data.notes || null,
  })
  if (txErr) { await logError(txErr.message, '/medical'); return { error: txErr.message } }

  revalidatePath('/medical')
  return { success: true }
}

// ─── Administer (per-vial: amount given, remainder auto-wasted) ──────────────

export async function administerStock(data: {
  storeroom_inventory_id: string
  unit_id: string
  administered_amount: number
  notes: string | null
  signer_1_id: string | null
  signer_2_id: string | null
  signer_1_signature: string | null
  signer_2_signature: string | null
}) {
  const ctx = await getContext()
  if (!ctx?.department_id) return { error: 'Not authorized.' }
  if (!(await hasPermission(ctx.fullCtx, 'dispense_controlled_substances'))) return { error: 'Not authorized.' }
  const adminClient = createAdminClient()

  if (!data.unit_id || !data.administered_amount || data.administered_amount <= 0)
    return { error: 'Select a vial and enter the amount administered.' }

  const { data: unit } = await adminClient
    .from('medical_stock_units')
    .select('id, lot_id, status, control_number')
    .eq('id', data.unit_id)
    .single()
  if (!unit) return { error: 'Vial not found.' }
  if (unit.status !== 'available') return { error: `Vial ${unit.control_number} has already been ${unit.status}.` }

  const { data: lot } = await adminClient
    .from('medical_stock_lots')
    .select('quantity_remaining, volume_per_unit, volume_unit, storeroom_inventory_id')
    .eq('id', unit.lot_id)
    .single()
  if (!lot) return { error: 'Lot not found.' }
  if (lot.storeroom_inventory_id !== data.storeroom_inventory_id) return { error: 'Vial does not belong to this storeroom.' }
  if (lot.quantity_remaining < 1) return { error: 'No vials remaining in this lot.' }
  if (!lot.volume_per_unit) return { error: 'This lot has no volume per unit on file — cannot log administration.' }
  if (data.administered_amount > lot.volume_per_unit)
    return { error: `Administered amount cannot exceed ${lot.volume_per_unit} ${lot.volume_unit ?? ''} per vial.` }

  const { data: invRow } = await adminClient
    .from('medical_storeroom_inventory')
    .select('storeroom_id, supply_type_id, department_id')
    .eq('id', data.storeroom_inventory_id)
    .single()
  if (!invRow) return { error: 'Inventory record not found.' }

  const { data: supplyType } = await adminClient
    .from('medical_supply_types')
    .select('name, required_signatures')
    .eq('id', invRow.supply_type_id)
    .single()

  const sigsRequired = supplyType?.required_signatures ?? 0
  if (sigsRequired >= 1 && !data.signer_1_id) return { error: 'Signer 1 is required.' }
  if (sigsRequired >= 1 && !data.signer_1_signature) return { error: 'Signer 1 must sign.' }
  if (sigsRequired >= 2 && !data.signer_2_id) return { error: 'A witness is required for controlled substance administration.' }
  if (sigsRequired >= 2 && !data.signer_2_signature) return { error: 'The witness must sign.' }

  const wasteAmount = Math.round((lot.volume_per_unit - data.administered_amount) * 1000) / 1000
  const now = new Date().toISOString()
  const newQty = lot.quantity_remaining - 1

  const { error: lotErr } = await adminClient
    .from('medical_stock_lots')
    .update({ quantity_remaining: newQty, active: newQty > 0, updated_at: now })
    .eq('id', unit.lot_id)
  if (lotErr) { await logError(lotErr.message, '/medical'); return { error: lotErr.message } }

  const { data: tx, error: txErr } = await adminClient.from('medical_stock_transactions').insert({
    department_id: invRow.department_id,
    storeroom_id: invRow.storeroom_id,
    supply_type_id: invRow.supply_type_id,
    supply_type_name: supplyType?.name ?? null,
    lot_id: unit.lot_id,
    transaction_type: 'administered',
    quantity: 1,
    administered_amount: data.administered_amount,
    waste_amount: wasteAmount,
    volume_unit: lot.volume_unit,
    performed_by: ctx.me.id,
    signer_1_id: data.signer_1_id || null,
    signer_1_at: data.signer_1_id ? now : null,
    signer_1_signature_data: data.signer_1_signature || null,
    signer_2_id: data.signer_2_id || null,
    signer_2_at: data.signer_2_id ? now : null,
    signer_2_signature_data: data.signer_2_signature || null,
    notes: data.notes || null,
  }).select('id').single()
  if (txErr) { await logError(txErr.message, '/medical'); return { error: txErr.message } }

  const { error: unitErr } = await adminClient
    .from('medical_stock_units')
    .update({ status: 'administered', transaction_id: tx.id })
    .eq('id', unit.id)
  if (unitErr) await logError(unitErr.message, '/medical', { metadata: { unit_id: unit.id, transaction_id: tx.id } })

  revalidatePath('/medical')
  return { success: true, wasteAmount }
}

export async function wasteStock(data: {
  storeroom_inventory_id: string
  lot_id: string
  quantity: number
  unit_ids: string[] | null
  waste_reason: string
  notes: string | null
  signer_1_id: string | null
  signer_2_id: string | null
  signer_1_signature: string | null
  signer_2_signature: string | null
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
    .select('name, required_signatures, is_controlled')
    .eq('id', invRow.supply_type_id)
    .single()

  const sigsRequired = supplyType?.required_signatures ?? 0
  if (sigsRequired >= 1 && !data.signer_1_id) return { error: 'Signer 1 is required.' }
  if (sigsRequired >= 1 && !data.signer_1_signature) return { error: 'Signer 1 must sign.' }
  if (sigsRequired >= 2 && !data.signer_2_id) return { error: 'A witness is required for controlled substance waste.' }
  if (sigsRequired >= 2 && !data.signer_2_signature) return { error: 'The witness must sign.' }

  // Controlled substances are wasted by specific vial, not a raw count — verify the
  // selected vials are actually available and belong to this lot before touching anything.
  let units: { id: string; control_number: string }[] = []
  if (supplyType?.is_controlled) {
    const unitIds = data.unit_ids ?? []
    if (unitIds.length !== data.quantity) return { error: 'Select which vials are being wasted.' }
    const { data: fetchedUnits } = await adminClient
      .from('medical_stock_units')
      .select('id, control_number, status, lot_id')
      .in('id', unitIds)
    if (!fetchedUnits || fetchedUnits.length !== unitIds.length) return { error: 'One or more selected vials could not be found.' }
    const badUnit = fetchedUnits.find(u => u.lot_id !== data.lot_id || u.status !== 'available')
    if (badUnit) return { error: `Vial ${badUnit.control_number} is not available in this lot.` }
    units = fetchedUnits
  }

  const now = new Date().toISOString()
  const newQty = lot.quantity_remaining - data.quantity

  const { error: lotErr } = await adminClient
    .from('medical_stock_lots')
    .update({ quantity_remaining: newQty, active: newQty > 0, updated_at: now })
    .eq('id', data.lot_id)
  if (lotErr) { await logError(lotErr.message, '/medical'); return { error: lotErr.message } }

  const noteText = [data.waste_reason, data.notes].filter(Boolean).join(' — ')
  const { data: tx, error: txErr } = await adminClient.from('medical_stock_transactions').insert({
    department_id: invRow.department_id,
    storeroom_id: invRow.storeroom_id,
    supply_type_id: invRow.supply_type_id,
    supply_type_name: supplyType?.name ?? null,
    lot_id: data.lot_id,
    transaction_type: 'wasted',
    quantity: data.quantity,
    performed_by: ctx.me.id,
    signer_1_id: data.signer_1_id || null,
    signer_1_at: data.signer_1_id ? now : null,
    signer_1_signature_data: data.signer_1_signature || null,
    signer_2_id: data.signer_2_id || null,
    signer_2_at: data.signer_2_id ? now : null,
    signer_2_signature_data: data.signer_2_signature || null,
    notes: noteText || null,
  }).select('id').single()
  if (txErr) { await logError(txErr.message, '/medical'); return { error: txErr.message } }

  if (units.length > 0) {
    const { error: unitsErr } = await adminClient
      .from('medical_stock_units')
      .update({ status: 'wasted', transaction_id: tx.id })
      .in('id', units.map(u => u.id))
    if (unitsErr) await logError(unitsErr.message, '/medical', { metadata: { transaction_id: tx.id } })
  }

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
  if (!ctx?.department_id) return { error: 'Not authorized.' }
  const adminClient = createAdminClient()

  if (!data.lot_id || data.quantity < 1)
    return { error: 'Lot and quantity are required.' }

  // Fetch source lot
  const { data: lot } = await adminClient
    .from('medical_stock_lots')
    .select('quantity_remaining, lot_number, expiration_date, received_date, concentration_amount, concentration_unit, volume_per_unit, volume_unit')
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

  // Controlled substances require officer+
  const { data: supplyTypeRow } = await adminClient
    .from('medical_supply_types')
    .select('name, is_controlled')
    .eq('id', srcInv.supply_type_id)
    .single()
  if (supplyTypeRow?.is_controlled && !ctx.isOfficerOrAbove)
    return { error: 'Controlled substances can only be transferred by officers or admins.' }

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
      concentration_amount: lot.concentration_amount,
      concentration_unit: lot.concentration_unit,
      volume_per_unit: lot.volume_per_unit,
      volume_unit: lot.volume_unit,
    })
    .select('id')
    .single()
  if (newLotErr) { await logError(newLotErr.message, '/medical'); return { error: newLotErr.message } }

  // Controlled substances carry their physical vial identity with them — move the oldest
  // available control-numbered units from the source lot onto the new destination lot.
  if (supplyTypeRow?.is_controlled) {
    const { data: movableUnits } = await adminClient
      .from('medical_stock_units')
      .select('id')
      .eq('lot_id', data.lot_id)
      .eq('status', 'available')
      .order('created_at', { ascending: true })
      .limit(data.quantity)
    if (movableUnits && movableUnits.length > 0) {
      const { error: moveErr } = await adminClient
        .from('medical_stock_units')
        .update({ lot_id: newLot.id })
        .in('id', movableUnits.map(u => u.id))
      if (moveErr) await logError(moveErr.message, '/medical', { metadata: { lot_id: data.lot_id, new_lot_id: newLot.id } })
    }
  }

  // transferred_out transaction
  const { error: txOutErr } = await adminClient.from('medical_stock_transactions').insert({
    department_id: srcInv.department_id,
    storeroom_id: srcInv.storeroom_id,
    supply_type_id: srcInv.supply_type_id,
    supply_type_name: supplyTypeRow?.name ?? null,
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
    supply_type_name: supplyTypeRow?.name ?? null,
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

export async function transferToCompartment(data: {
  source_inventory_id: string
  lot_id: string
  compartment_id: string   // apparatus_compartments.id
  quantity: number
  notes: string | null
}) {
  const ctx = await getContext()
  if (!ctx?.department_id) return { error: 'Not authorized.' }
  const adminClient = createAdminClient()

  if (!data.lot_id || data.quantity < 1)
    return { error: 'Lot and quantity are required.' }

  const { data: lot } = await adminClient
    .from('medical_stock_lots')
    .select('quantity_remaining, lot_number, expiration_date, received_date')
    .eq('id', data.lot_id)
    .single()
  if (!lot) return { error: 'Lot not found.' }
  if (lot.quantity_remaining < data.quantity)
    return { error: `Only ${lot.quantity_remaining} units available in this lot.` }

  const { data: srcInv } = await adminClient
    .from('medical_storeroom_inventory')
    .select('storeroom_id, supply_type_id, department_id')
    .eq('id', data.source_inventory_id)
    .single()
  if (!srcInv) return { error: 'Source inventory record not found.' }

  const { data: supplyTypeRow } = await adminClient
    .from('medical_supply_types')
    .select('is_controlled')
    .eq('id', srcInv.supply_type_id)
    .single()
  if (supplyTypeRow?.is_controlled && !ctx.isOfficerOrAbove)
    return { error: 'Controlled substances can only be transferred by officers or admins.' }

  // Resolve (or auto-create) the compartment's medical storeroom
  const room = await getOrCreateCompartmentStoreroom(adminClient, ctx.department_id, data.compartment_id)
  if ('error' in room) { await logError(room.error, '/medical'); return { error: room.error } }
  const destStoreroomId = room.storeroom_id

  // Get or auto-create inventory assignment for this supply type
  const { data: existingInv } = await adminClient
    .from('medical_storeroom_inventory')
    .select('id')
    .eq('storeroom_id', destStoreroomId)
    .eq('supply_type_id', srcInv.supply_type_id)

  if (!existingInv || existingInv.length === 0) {
    const { error: invErr } = await adminClient
      .from('medical_storeroom_inventory')
      .insert({
        storeroom_id: destStoreroomId,
        supply_type_id: srcInv.supply_type_id,
        department_id: ctx.department_id,
        par_level: 0,
      })
    if (invErr) { await logError(invErr.message, '/medical'); return { error: invErr.message } }
  }

  // Now delegate to transferStock with the resolved destination storeroom
  return transferStock({
    source_inventory_id: data.source_inventory_id,
    lot_id: data.lot_id,
    destination_storeroom_id: destStoreroomId,
    quantity: data.quantity,
    notes: data.notes,
  })
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

  // Controlled substances are vial-tracked by control number — a blind count adjustment
  // can't tell which physical vial it's supposedly adding or removing. Use Waste/Administer
  // instead so the specific vial stays accounted for.
  const { count: unitCount } = await adminClient
    .from('medical_stock_units')
    .select('id', { count: 'exact', head: true })
    .eq('lot_id', data.lot_id)
  if (unitCount && unitCount > 0)
    return { error: 'This lot is tracked by control number — use Waste to remove a specific vial instead of adjusting the count.' }

  const delta = data.new_quantity - lot.quantity_remaining
  if (delta === 0) return { error: 'New quantity is the same as current quantity.' }

  const { data: invRow } = await adminClient
    .from('medical_storeroom_inventory')
    .select('storeroom_id, supply_type_id, department_id')
    .eq('id', data.storeroom_inventory_id)
    .single()
  if (!invRow) return { error: 'Inventory record not found.' }

  const { data: supplyType } = await adminClient
    .from('medical_supply_types')
    .select('name')
    .eq('id', invRow.supply_type_id)
    .single()

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
    supply_type_name: supplyType?.name ?? null,
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
  if (!ctx?.department_id) return { error: 'Not authorized.' }
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

export async function updateStockLot(data: {
  lot_id: string
  lot_number: string | null
  expiration_date: string | null
}) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove) return { error: 'Officers and admins only.' }
  const adminClient = createAdminClient()

  const { error: dbErr } = await adminClient
    .from('medical_stock_lots')
    .update({ lot_number: data.lot_number || null, expiration_date: data.expiration_date || null })
    .eq('id', data.lot_id)
  if (dbErr) { await logError(dbErr.message, '/medical'); return { error: dbErr.message } }

  revalidatePath('/medical')
  revalidatePath('/equipment')
  return { success: true }
}

export async function wasteExpiredLots(data: {
  storeroom_inventory_id: string
  waste_reason: string
  notes: string | null
  signer_1_id: string | null
  signer_2_id: string | null
  signer_1_signature: string | null
  signer_2_signature: string | null
}) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove) return { error: 'Officers and admins only.' }
  const adminClient = createAdminClient()

  const { data: invRow } = await adminClient
    .from('medical_storeroom_inventory')
    .select('storeroom_id, supply_type_id, department_id')
    .eq('id', data.storeroom_inventory_id)
    .single()
  if (!invRow) return { error: 'Inventory record not found.' }

  const { data: supplyType } = await adminClient
    .from('medical_supply_types')
    .select('name, required_signatures')
    .eq('id', invRow.supply_type_id)
    .single()

  const sigsRequired = supplyType?.required_signatures ?? 0
  if (sigsRequired >= 1 && !data.signer_1_id) return { error: 'Signer 1 is required.' }
  if (sigsRequired >= 1 && !data.signer_1_signature) return { error: 'Signer 1 must sign.' }
  if (sigsRequired >= 2 && !data.signer_2_id) return { error: 'A witness is required for controlled substance waste.' }
  if (sigsRequired >= 2 && !data.signer_2_signature) return { error: 'The witness must sign.' }

  const now = new Date()
  const { data: expiredLots } = await adminClient
    .from('medical_stock_lots')
    .select('id, lot_number, quantity_remaining')
    .eq('storeroom_inventory_id', data.storeroom_inventory_id)
    .eq('active', true)
    .gt('quantity_remaining', 0)
    .lt('expiration_date', now.toISOString().split('T')[0])

  if (!expiredLots || expiredLots.length === 0)
    return { error: 'No expired lots found.' }

  const noteText = [data.waste_reason, data.notes].filter(Boolean).join(' — ')

  for (const lot of expiredLots) {
    const { error: lotErr } = await adminClient
      .from('medical_stock_lots')
      .update({ quantity_remaining: 0, active: false })
      .eq('id', lot.id)
    if (lotErr) { await logError(lotErr.message, '/medical'); return { error: lotErr.message } }

    const { data: tx, error: txErr } = await adminClient.from('medical_stock_transactions').insert({
      department_id: invRow.department_id,
      storeroom_id: invRow.storeroom_id,
      supply_type_id: invRow.supply_type_id,
      supply_type_name: supplyType?.name ?? null,
      lot_id: lot.id,
      transaction_type: 'wasted',
      quantity: lot.quantity_remaining,
      performed_by: ctx.me.id,
      signer_1_id: data.signer_1_id || null,
      signer_1_at: data.signer_1_id ? now.toISOString() : null,
      signer_1_signature_data: data.signer_1_signature || null,
      signer_2_id: data.signer_2_id || null,
      signer_2_at: data.signer_2_id ? now.toISOString() : null,
      signer_2_signature_data: data.signer_2_signature || null,
      notes: noteText || null,
    }).select('id').single()
    if (txErr) { await logError(txErr.message, '/medical'); return { error: txErr.message } }

    const { error: unitsErr } = await adminClient
      .from('medical_stock_units')
      .update({ status: 'wasted', transaction_id: tx.id })
      .eq('lot_id', lot.id)
      .eq('status', 'available')
    if (unitsErr) await logError(unitsErr.message, '/medical', { metadata: { lot_id: lot.id, transaction_id: tx.id } })
  }

  revalidatePath('/medical')
  revalidatePath('/equipment')
  return { success: true, count: expiredLots.length }
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
  revalidatePath('/medical')
  revalidatePath('/medical')
  return { success: true }
}
