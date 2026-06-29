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
  }
}

type PersonInput = {
  person_id?: string
  first_name: string
  last_name: string
  dob?: string | null
  phone?: string | null
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
    const { data, error } = await adminClient
      .from('pd_persons')
      .insert({
        department_id,
        first_name: p.first_name.trim(),
        last_name: p.last_name.trim(),
        dob: p.dob || null,
        phone: p.phone || null,
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
    contact_type: (formData.get('contact_type') as string) || 'field_interview',
    reason: formData.get('reason') as string,
    action_taken: (formData.get('action_taken') as string) || null,
    report_number: (formData.get('report_number') as string) || null,
    notes: (formData.get('notes') as string) || null,
  }
}

export async function createContact(formData: FormData) {
  const ctx = await getContext()
  if (!ctx?.department_id) return { error: 'Not authorized.' }
  const adminClient = createAdminClient()

  const fields = contactFieldsFromForm(formData)
  if (!fields.contact_date) return { error: 'Date is required.' }
  if (!fields.reason?.trim()) return { error: 'Reason is required.' }

  const address_id = (formData.get('address_id') as string) || null
  const addressText = (formData.get('address') as string) || null
  const personsRaw = formData.get('persons') as string
  let persons: PersonInput[] = []
  if (personsRaw) {
    try { persons = JSON.parse(personsRaw) } catch { /* ignore malformed input */ }
  }

  const addressResult = await resolveAddress(adminClient, ctx.department_id, address_id, addressText)
  if (addressResult.error) { await logError(addressResult.error, '/forms/contact'); return { error: addressResult.error } }

  const personsResult = await resolvePersons(adminClient, ctx.department_id, persons)
  if (personsResult.error) { await logError(personsResult.error, '/forms/contact'); return { error: personsResult.error } }

  const { data: contact, error } = await adminClient.from('pd_contacts').insert({
    department_id: ctx.department_id,
    officer_id: ctx.personnelId,
    officer_name: ctx.officerName,
    address_id: addressResult.address_id,
    address: addressResult.address,
    ...fields,
  }).select('id').single()

  if (error || !contact) { await logError(error?.message ?? 'insert failed', '/forms/contact'); return { error: error?.message ?? 'Failed to save contact.' } }

  if (personsResult.personIds.length > 0) {
    const { error: linkError } = await adminClient.from('pd_contact_persons').insert(
      personsResult.personIds.map(person_id => ({ contact_id: contact.id, person_id }))
    )
    if (linkError) { await logError(linkError.message, '/forms/contact'); return { error: linkError.message } }
  }

  revalidatePath('/forms/contact')
  return { success: true }
}

export async function updateContact(id: string, formData: FormData) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove) return { error: 'Only officers and admins can edit contacts.' }
  const adminClient = createAdminClient()

  const fields = contactFieldsFromForm(formData)
  if (!fields.contact_date) return { error: 'Date is required.' }
  if (!fields.reason?.trim()) return { error: 'Reason is required.' }

  const address_id = (formData.get('address_id') as string) || null
  const addressText = (formData.get('address') as string) || null
  const personsRaw = formData.get('persons') as string
  let persons: PersonInput[] = []
  if (personsRaw) {
    try { persons = JSON.parse(personsRaw) } catch { /* ignore malformed input */ }
  }

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
