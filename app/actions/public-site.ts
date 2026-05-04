'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/logger'
import { revalidatePath } from 'next/cache'

export async function savePublicSiteSettings(formData: FormData) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Session expired.' }

  const { data: meList } = await adminClient.from('personnel').select('id, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me?.is_sys_admin) return { error: 'Unauthorized.' }

  const department_id      = formData.get('department_id') as string
  const public_site_enabled = formData.get('public_site_enabled') === 'true'
  const public_slug        = (formData.get('public_slug') as string)?.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || null
  const public_phone       = (formData.get('public_phone') as string)?.trim() || null
  const public_email       = (formData.get('public_email') as string)?.trim() || null
  const public_address     = (formData.get('public_address') as string)?.trim() || null
  const public_tagline     = (formData.get('public_tagline') as string)?.trim() || null
  const public_about       = (formData.get('public_about') as string)?.trim() || null

  if (public_site_enabled && !public_slug) return { error: 'A URL slug is required to enable the public site.' }

  const { error: dbErr } = await adminClient
    .from('departments')
    .update({ public_site_enabled, public_slug, public_phone, public_email, public_address, public_tagline, public_about })
    .eq('id', department_id)

  if (dbErr) {
    if (dbErr.code === '23505') return { error: 'That slug is already in use by another department.' }
    await logError(dbErr, `/admin/dept/${department_id}`)
    return { error: dbErr.message }
  }

  revalidatePath(`/admin/dept/${department_id}`)
  return { success: true, slug: public_slug }
}

export async function toggleEventSeriesPublic(eventSeriesId: string, isPublic: boolean, departmentId: string) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Session expired.' }

  const { data: meList } = await adminClient.from('personnel').select('id, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me?.is_sys_admin) return { error: 'Unauthorized.' }

  const { error: dbErr } = await adminClient
    .from('event_series')
    .update({ is_public: isPublic })
    .eq('id', eventSeriesId)

  if (dbErr) {
    await logError(dbErr, `/admin/dept/${departmentId}`)
    return { error: dbErr.message }
  }

  revalidatePath(`/admin/dept/${departmentId}`)
  return { success: true }
}

export async function submitBurnPermit(formData: FormData) {
  const adminClient = createAdminClient()

  const department_id  = formData.get('department_id') as string
  const contact_name   = (formData.get('contact_name') as string)?.trim()
  const contact_email  = (formData.get('contact_email') as string)?.trim()
  const contact_phone  = (formData.get('contact_phone') as string)?.trim() || null
  const burn_address   = (formData.get('burn_address') as string)?.trim()
  const burn_date      = formData.get('burn_date') as string
  const burn_description = (formData.get('burn_description') as string)?.trim()

  if (!department_id || !contact_name || !contact_email || !burn_address || !burn_date || !burn_description) {
    return { error: 'Please fill in all required fields.' }
  }

  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRx.test(contact_email)) return { error: 'Please enter a valid email address.' }

  const today = new Date().toISOString().split('T')[0]
  if (burn_date < today) return { error: 'Burn date cannot be in the past.' }

  const { data, error: dbErr } = await adminClient
    .from('burn_permits')
    .insert({ department_id, contact_name, contact_email, contact_phone, burn_address, burn_date, burn_description })
    .select('confirmation_code')
    .single()

  if (dbErr) {
    await logError(dbErr, 'public/burn-permit')
    return { error: 'Something went wrong. Please try again.' }
  }

  return { confirmationCode: data.confirmation_code }
}

// ─── Inbox: Update burn permit status ────────────────────────────────────────
export async function updateBurnPermitStatus(formData: FormData) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Session expired.' }

  const { data: meList } = await adminClient
    .from('personnel').select('id, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) return { error: 'Could not verify your account.' }

  const { data: myDeptList } = await adminClient
    .from('department_personnel').select('system_role').eq('personnel_id', me.id).eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept || myDept.system_role === 'member') return { error: 'Unauthorized.' }

  const permit_id          = formData.get('permit_id') as string
  const status             = formData.get('status') as string
  const reviewer_notes     = (formData.get('reviewer_notes') as string)?.trim() || null
  const permit_expiry_date = (formData.get('permit_expiry_date') as string) || null

  if (!['approved', 'denied', 'cancelled'].includes(status)) return { error: 'Invalid status.' }

  const updateData: Record<string, unknown> = { status, reviewer_notes, updated_at: new Date().toISOString() }
  if (status === 'approved') {
    updateData.issued_date = new Date().toISOString().split('T')[0]
    updateData.approved_by_personnel_id = me.id
    if (permit_expiry_date) updateData.permit_expiry_date = permit_expiry_date
  }

  const { error: dbErr } = await adminClient.from('burn_permits').update(updateData).eq('id', permit_id)
  if (dbErr) { await logError(dbErr, '/inbox'); return { error: dbErr.message } }

  revalidatePath('/inbox')
  return { success: true }
}

// ─── Inbox: Update record request status ─────────────────────────────────────
export async function updateRecordRequestStatus(formData: FormData) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Session expired.' }

  const { data: meList } = await adminClient
    .from('personnel').select('id, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) return { error: 'Could not verify your account.' }

  const { data: myDeptList } = await adminClient
    .from('department_personnel').select('system_role').eq('personnel_id', me.id).eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept || myDept.system_role === 'member') return { error: 'Unauthorized.' }

  const request_id     = formData.get('request_id') as string
  const status         = formData.get('status') as string
  const reviewer_notes = (formData.get('reviewer_notes') as string)?.trim() || null

  if (!['in_review', 'fulfilled', 'denied'].includes(status)) return { error: 'Invalid status.' }

  const { error: dbErr } = await adminClient
    .from('public_record_requests')
    .update({ status, reviewer_notes, updated_at: new Date().toISOString() })
    .eq('id', request_id)
  if (dbErr) { await logError(dbErr, '/inbox'); return { error: dbErr.message } }

  revalidatePath('/inbox')
  return { success: true }
}

export async function submitRecordRequest(formData: FormData) {
  const adminClient = createAdminClient()

  const department_id    = formData.get('department_id') as string
  const contact_name     = (formData.get('contact_name') as string)?.trim()
  const contact_email    = (formData.get('contact_email') as string)?.trim()
  const contact_phone    = (formData.get('contact_phone') as string)?.trim() || null
  const request_type     = formData.get('request_type') as string
  const description      = (formData.get('description') as string)?.trim()
  const incident_date    = (formData.get('incident_date') as string) || null
  const incident_address = (formData.get('incident_address') as string)?.trim() || null

  if (!department_id || !contact_name || !contact_email || !request_type || !description) {
    return { error: 'Please fill in all required fields.' }
  }

  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRx.test(contact_email)) return { error: 'Please enter a valid email address.' }

  const validTypes = ['incident_report', 'inspection_record', 'other']
  if (!validTypes.includes(request_type)) return { error: 'Invalid request type.' }

  const { data, error: dbErr } = await adminClient
    .from('public_record_requests')
    .insert({ department_id, contact_name, contact_email, contact_phone, request_type, description, incident_date, incident_address })
    .select('confirmation_code')
    .single()

  if (dbErr) {
    await logError(dbErr, 'public/records')
    return { error: 'Something went wrong. Please try again.' }
  }

  return { confirmationCode: data.confirmation_code }
}
