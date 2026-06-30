'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { logError } from '@/lib/logger'
import { revalidatePath } from 'next/cache'

async function getContext() {
  const ctx = await getCurrentDepartmentContext()
  if (!ctx) return null
  return {
    personnelId: ctx.personnelId,
    officerName: `${ctx.firstName} ${ctx.lastName}`,
    department_id: ctx.departmentId,
    isOfficerOrAbove: ctx.systemRole === 'admin' || ctx.systemRole === 'officer' || ctx.isSysAdmin,
    isAdmin: ctx.systemRole === 'admin' || ctx.isSysAdmin,
  }
}

const DEFAULT_CONTACT_TYPES = ['Field Interview', 'Traffic Stop', 'Pedestrian Check', 'Business Contact', 'Follow-Up', 'Other']
const DEFAULT_ACTION_TAKEN_TYPES = ['Verbal Warning', 'Citation Issued', 'Arrest', 'Report Filed', 'No Action']

// ─── Contact Types (admin-configurable list) ──────────────────────────────
export async function ensurePdContactTypes(department_id: string) {
  const adminClient = createAdminClient()
  const { data: existing } = await adminClient.from('pd_contact_types').select('id').eq('department_id', department_id).limit(1)
  if (existing && existing.length > 0) return { seeded: false }
  const { error: dbErr } = await adminClient.from('pd_contact_types').insert(
    DEFAULT_CONTACT_TYPES.map((label, i) => ({ department_id, label, sort_order: i, active: true }))
  )
  if (dbErr) { await logError(dbErr.message, '/dept-admin/police'); return { error: dbErr.message } }
  return { seeded: true }
}

export async function getPdContactTypes(department_id: string) {
  await ensurePdContactTypes(department_id)
  const adminClient = createAdminClient()
  const { data, error: dbErr } = await adminClient
    .from('pd_contact_types')
    .select('id, label, sort_order, active')
    .eq('department_id', department_id)
    .order('sort_order')
  if (dbErr) return { items: [], error: dbErr.message }
  return { items: data ?? [] }
}

export async function addPdContactType(departmentId: string, label: string) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admin only.' }
  if (!label.trim()) return { error: 'Label is required.' }
  const adminClient = createAdminClient()
  const { data: last } = await adminClient.from('pd_contact_types').select('sort_order').eq('department_id', departmentId).order('sort_order', { ascending: false }).limit(1)
  const sort_order = (last?.[0]?.sort_order ?? -1) + 1
  const { error: dbErr } = await adminClient.from('pd_contact_types').insert({ department_id: departmentId, label: label.trim(), sort_order, active: true })
  if (dbErr) { await logError(dbErr.message, '/dept-admin/police'); return { error: dbErr.message } }
  revalidatePath('/dept-admin/police')
  return { success: true }
}

export async function updatePdContactType(id: string, label: string) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admin only.' }
  if (!label.trim()) return { error: 'Label is required.' }
  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient.from('pd_contact_types').update({ label: label.trim() }).eq('id', id)
  if (dbErr) { await logError(dbErr.message, '/dept-admin/police'); return { error: dbErr.message } }
  revalidatePath('/dept-admin/police')
  return { success: true }
}

export async function togglePdContactType(id: string, active: boolean) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admin only.' }
  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient.from('pd_contact_types').update({ active }).eq('id', id)
  if (dbErr) { await logError(dbErr.message, '/dept-admin/police'); return { error: dbErr.message } }
  revalidatePath('/dept-admin/police')
  return { success: true }
}

export async function reorderPdContactTypes(departmentId: string, orderedIds: string[]) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admin only.' }
  const adminClient = createAdminClient()
  await Promise.all(orderedIds.map((id, i) =>
    adminClient.from('pd_contact_types').update({ sort_order: i }).eq('id', id).eq('department_id', departmentId)
  ))
  revalidatePath('/dept-admin/police')
  return { success: true }
}

// ─── Action Taken Types (admin-configurable list) ─────────────────────────
export async function ensurePdActionTakenTypes(department_id: string) {
  const adminClient = createAdminClient()
  const { data: existing } = await adminClient.from('pd_action_taken_types').select('id').eq('department_id', department_id).limit(1)
  if (existing && existing.length > 0) return { seeded: false }
  const { error: dbErr } = await adminClient.from('pd_action_taken_types').insert(
    DEFAULT_ACTION_TAKEN_TYPES.map((label, i) => ({ department_id, label, sort_order: i, active: true }))
  )
  if (dbErr) { await logError(dbErr.message, '/dept-admin/police'); return { error: dbErr.message } }
  return { seeded: true }
}

export async function getPdActionTakenTypes(department_id: string) {
  await ensurePdActionTakenTypes(department_id)
  const adminClient = createAdminClient()
  const { data, error: dbErr } = await adminClient
    .from('pd_action_taken_types')
    .select('id, label, sort_order, active')
    .eq('department_id', department_id)
    .order('sort_order')
  if (dbErr) return { items: [], error: dbErr.message }
  return { items: data ?? [] }
}

export async function addPdActionTakenType(departmentId: string, label: string) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admin only.' }
  if (!label.trim()) return { error: 'Label is required.' }
  const adminClient = createAdminClient()
  const { data: last } = await adminClient.from('pd_action_taken_types').select('sort_order').eq('department_id', departmentId).order('sort_order', { ascending: false }).limit(1)
  const sort_order = (last?.[0]?.sort_order ?? -1) + 1
  const { error: dbErr } = await adminClient.from('pd_action_taken_types').insert({ department_id: departmentId, label: label.trim(), sort_order, active: true })
  if (dbErr) { await logError(dbErr.message, '/dept-admin/police'); return { error: dbErr.message } }
  revalidatePath('/dept-admin/police')
  return { success: true }
}

export async function updatePdActionTakenType(id: string, label: string) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admin only.' }
  if (!label.trim()) return { error: 'Label is required.' }
  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient.from('pd_action_taken_types').update({ label: label.trim() }).eq('id', id)
  if (dbErr) { await logError(dbErr.message, '/dept-admin/police'); return { error: dbErr.message } }
  revalidatePath('/dept-admin/police')
  return { success: true }
}

export async function togglePdActionTakenType(id: string, active: boolean) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admin only.' }
  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient.from('pd_action_taken_types').update({ active }).eq('id', id)
  if (dbErr) { await logError(dbErr.message, '/dept-admin/police'); return { error: dbErr.message } }
  revalidatePath('/dept-admin/police')
  return { success: true }
}

export async function reorderPdActionTakenTypes(departmentId: string, orderedIds: string[]) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admin only.' }
  const adminClient = createAdminClient()
  await Promise.all(orderedIds.map((id, i) =>
    adminClient.from('pd_action_taken_types').update({ sort_order: i }).eq('id', id).eq('department_id', departmentId)
  ))
  revalidatePath('/dept-admin/police')
  return { success: true }
}

// ─── Case numbering ────────────────────────────────────────────────────────
export async function getPdCaseNumberSettings(department_id: string) {
  const adminClient = createAdminClient()
  const { data, error: dbErr } = await adminClient
    .from('departments')
    .select('pd_case_number_mode, pd_case_number_prefix')
    .eq('id', department_id)
    .single()
  if (dbErr || !data) return { mode: 'manual' as const, prefix: null }
  return { mode: (data.pd_case_number_mode as 'auto' | 'manual') ?? 'manual', prefix: data.pd_case_number_prefix as string | null }
}

export async function updatePdCaseNumberSettings(departmentId: string, mode: 'auto' | 'manual', prefix: string | null) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Admin only.' }
  if (mode === 'auto' && !prefix?.trim()) return { error: 'A prefix is required for auto-numbering.' }
  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient
    .from('departments')
    .update({ pd_case_number_mode: mode, pd_case_number_prefix: prefix?.trim() || null })
    .eq('id', departmentId)
  if (dbErr) { await logError(dbErr.message, '/dept-admin/police'); return { error: dbErr.message } }
  revalidatePath('/dept-admin/police')
  return { success: true }
}

// Generates the next case number for a department in 'auto' mode, e.g. YPD26-0001.
// Returns null when the department is in 'manual' mode (officer types their own).
export async function generatePdCaseNumber(department_id: string): Promise<string | null> {
  const { mode, prefix } = await getPdCaseNumberSettings(department_id)
  if (mode !== 'auto' || !prefix) return null
  const adminClient = createAdminClient()
  const year = new Date().getFullYear()
  const { data: seq, error: dbErr } = await adminClient.rpc('increment_pd_contact_counter', { p_department_id: department_id, p_year: year })
  if (dbErr || seq == null) { await logError(dbErr?.message ?? 'counter rpc failed', '/forms/contact'); return null }
  const yy = String(year).slice(-2)
  return `${prefix}${yy}-${String(seq).padStart(4, '0')}`
}

type PersonInput = {
  person_id?: string
  first_name: string
  last_name: string
  dob?: string | null
  phone?: string | null
  address?: string | null
  is_dangerous?: boolean
  danger_reason?: string | null
}

// Resolves an address into an address_id, creating a new pd_addresses row
// if the officer typed a new one rather than picking an existing match.
async function resolveAddress(
  adminClient: ReturnType<typeof createAdminClient>,
  department_id: string,
  address_id: string | null,
  addressText: string | null
): Promise<{ address_id: string | null; address: string | null; error?: string }> {
  if (address_id) {
    const { data, error } = await adminClient.from('pd_addresses').select('id, address').eq('id', address_id).eq('department_id', department_id).single()
    if (error || !data) return { address_id: null, address: addressText, error: 'Selected address not found.' }
    return { address_id: data.id, address: data.address }
  }
  if (addressText && addressText.trim()) {
    const { data, error } = await adminClient.from('pd_addresses').insert({ department_id, address: addressText.trim() }).select('id, address').single()
    if (error || !data) return { address_id: null, address: addressText, error: error?.message }
    return { address_id: data.id, address: data.address }
  }
  return { address_id: null, address: null }
}

// Resolves a list of person inputs into person_ids, creating new pd_persons
// rows for any that don't reference an existing person_id.
async function resolvePersons(
  adminClient: ReturnType<typeof createAdminClient>,
  department_id: string,
  persons: PersonInput[]
): Promise<{ personIds: string[]; error?: string }> {
  const personIds: string[] = []
  for (const p of persons) {
    if (p.person_id) {
      personIds.push(p.person_id)
      continue
    }
    if (!p.first_name?.trim() || !p.last_name?.trim()) continue
    if (!p.dob) return { personIds, error: `DOB is required for new person ${p.first_name} ${p.last_name}.` }
    const { data, error } = await adminClient
      .from('pd_persons')
      .insert({
        department_id,
        first_name: p.first_name.trim(),
        last_name: p.last_name.trim(),
        dob: p.dob || null,
        phone: p.phone || null,
        address: p.address || null,
        is_dangerous: p.is_dangerous ?? false,
        danger_reason: p.is_dangerous ? (p.danger_reason || null) : null,
      })
      .select('id')
      .single()
    if (error || !data) return { personIds, error: error?.message }
    personIds.push(data.id)
  }
  return { personIds }
}

function contactFieldsFromForm(formData: FormData) {
  return {
    contact_date: formData.get('contact_date') as string,
    contact_time: (formData.get('contact_time') as string) || null,
    location_detail: (formData.get('location_detail') as string) || null,
    contact_type: (formData.get('contact_type') as string) || null,
    report_number: (formData.get('report_number') as string) || null,
    narrative: (formData.get('narrative') as string) || null,
  }
}

function actionTypeIdsFromForm(formData: FormData): string[] {
  const raw = formData.get('action_type_ids') as string
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

async function syncContactActions(adminClient: ReturnType<typeof createAdminClient>, contactId: string, actionTypeIds: string[]) {
  const { error: deleteErr } = await adminClient.from('pd_contact_actions').delete().eq('contact_id', contactId)
  if (deleteErr) return { error: deleteErr.message }
  if (actionTypeIds.length > 0) {
    const { error: insertErr } = await adminClient.from('pd_contact_actions').insert(
      actionTypeIds.map(action_type_id => ({ contact_id: contactId, action_type_id }))
    )
    if (insertErr) return { error: insertErr.message }
  }
  return {}
}

export async function createContact(formData: FormData) {
  const ctx = await getContext()
  if (!ctx?.department_id) return { error: 'Not authorized.' }
  const adminClient = createAdminClient()

  const fields = contactFieldsFromForm(formData)
  if (!fields.contact_date) return { error: 'Date is required.' }

  const address_id = (formData.get('address_id') as string) || null
  const addressText = (formData.get('address') as string) || null
  const personsRaw = formData.get('persons') as string
  let persons: PersonInput[] = []
  if (personsRaw) {
    try { persons = JSON.parse(personsRaw) } catch { /* ignore malformed input */ }
  }
  const actionTypeIds = actionTypeIdsFromForm(formData)

  const addressResult = await resolveAddress(adminClient, ctx.department_id, address_id, addressText)
  if (addressResult.error) { await logError(addressResult.error, '/forms/contact'); return { error: addressResult.error } }

  const personsResult = await resolvePersons(adminClient, ctx.department_id, persons)
  if (personsResult.error) { await logError(personsResult.error, '/forms/contact'); return { error: personsResult.error } }

  let report_number = fields.report_number
  if (!report_number?.trim()) {
    report_number = await generatePdCaseNumber(ctx.department_id)
  }

  const { data: contact, error } = await adminClient.from('pd_contacts').insert({
    department_id: ctx.department_id,
    officer_id: ctx.personnelId,
    officer_name: ctx.officerName,
    address_id: addressResult.address_id,
    address: addressResult.address,
    ...fields,
    report_number,
  }).select('id').single()

  if (error || !contact) { await logError(error?.message ?? 'insert failed', '/forms/contact'); return { error: error?.message ?? 'Failed to save contact.' } }

  if (personsResult.personIds.length > 0) {
    const { error: linkError } = await adminClient.from('pd_contact_persons').insert(
      personsResult.personIds.map(person_id => ({ contact_id: contact.id, person_id }))
    )
    if (linkError) { await logError(linkError.message, '/forms/contact'); return { error: linkError.message } }
  }

  const actionsResult = await syncContactActions(adminClient, contact.id, actionTypeIds)
  if (actionsResult.error) { await logError(actionsResult.error, '/forms/contact'); return { error: actionsResult.error } }

  revalidatePath('/forms/contact')
  return { success: true }
}

export async function updateContact(id: string, formData: FormData) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove) return { error: 'Only officers and admins can edit contacts.' }
  const adminClient = createAdminClient()

  const fields = contactFieldsFromForm(formData)
  if (!fields.contact_date) return { error: 'Date is required.' }

  const address_id = (formData.get('address_id') as string) || null
  const addressText = (formData.get('address') as string) || null
  const personsRaw = formData.get('persons') as string
  let persons: PersonInput[] = []
  if (personsRaw) {
    try { persons = JSON.parse(personsRaw) } catch { /* ignore malformed input */ }
  }
  const actionTypeIds = actionTypeIdsFromForm(formData)

  const addressResult = await resolveAddress(adminClient, ctx.department_id!, address_id, addressText)
  if (addressResult.error) { await logError(addressResult.error, '/forms/contact'); return { error: addressResult.error } }

  const personsResult = await resolvePersons(adminClient, ctx.department_id!, persons)
  if (personsResult.error) { await logError(personsResult.error, '/forms/contact'); return { error: personsResult.error } }

  const { error } = await adminClient
    .from('pd_contacts')
    .update({
      address_id: addressResult.address_id,
      address: addressResult.address,
      ...fields,
    })
    .eq('id', id)
    .eq('department_id', ctx.department_id!)

  if (error) { await logError(error.message, '/forms/contact'); return { error: error.message } }

  const { error: deleteLinksError } = await adminClient.from('pd_contact_persons').delete().eq('contact_id', id)
  if (deleteLinksError) { await logError(deleteLinksError.message, '/forms/contact'); return { error: deleteLinksError.message } }

  if (personsResult.personIds.length > 0) {
    const { error: linkError } = await adminClient.from('pd_contact_persons').insert(
      personsResult.personIds.map(person_id => ({ contact_id: id, person_id }))
    )
    if (linkError) { await logError(linkError.message, '/forms/contact'); return { error: linkError.message } }
  }

  const actionsResult = await syncContactActions(adminClient, id, actionTypeIds)
  if (actionsResult.error) { await logError(actionsResult.error, '/forms/contact'); return { error: actionsResult.error } }

  revalidatePath('/forms/contact')
  return { success: true }
}

export async function deleteContact(id: string) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove) return { error: 'Only officers and admins can delete contacts.' }
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('pd_contacts').delete().eq('id', id).eq('department_id', ctx.department_id!)
  if (error) { await logError(error.message, '/forms/contact'); return { error: error.message } }
  revalidatePath('/forms/contact')
  return { success: true }
}

// ─── Officer safety flag ──────────────────────────────────────────────────
// Lives on the person, not the contact — once someone is flagged, every
// past and future contact involving them should surface the warning.
export async function updatePersonDangerFlag(personId: string, isDangerous: boolean, reason: string | null) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove) return { error: 'Only officers and admins can set an officer safety flag.' }
  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('pd_persons')
    .update({
      is_dangerous: isDangerous,
      danger_reason: isDangerous ? (reason || null) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', personId)
    .eq('department_id', ctx.department_id!)
  if (error) { await logError(error.message, '/forms/contact'); return { error: error.message } }
  revalidatePath('/forms/contact')
  return { success: true }
}
