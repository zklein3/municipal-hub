'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { logError, logEvent } from '@/lib/logger'
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
  const public_about            = (formData.get('public_about') as string)?.trim() || null
  const burn_permit_restrictions = (formData.get('burn_permit_restrictions') as string)?.trim() || null
  const burn_permit_county_info  = (formData.get('burn_permit_county_info') as string)?.trim() || null

  if (public_site_enabled && !public_slug) return { error: 'A URL slug is required to enable the public site.' }

  const { error: dbErr } = await adminClient
    .from('departments')
    .update({ public_site_enabled, public_slug, public_phone, public_email, public_address, public_tagline, public_about, burn_permit_restrictions, burn_permit_county_info })
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

export async function saveDeptInboxSettings(formData: FormData) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Session expired.' }

  const { data: meList } = await adminClient.from('personnel').select('id').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) return { error: 'Could not verify your account.' }

  const { data: myDeptList } = await adminClient
    .from('department_personnel')
    .select('department_id, system_role')
    .eq('personnel_id', me.id)
    .eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept || myDept.system_role !== 'admin') return { error: 'Unauthorized.' }

  const department_id          = myDept.department_id
  const burn_permit_county_info  = (formData.get('burn_permit_county_info') as string)?.trim() || null
  const burn_permit_restrictions = (formData.get('burn_permit_restrictions') as string)?.trim() || null

  const { error: dbErr } = await adminClient
    .from('departments')
    .update({ burn_permit_county_info, burn_permit_restrictions })
    .eq('id', department_id)

  if (dbErr) {
    await logError(dbErr, '/dept-admin/public-inbox')
    return { error: dbErr.message }
  }

  revalidatePath('/dept-admin/public-inbox')
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

  const { data: dept } = await adminClient
    .from('departments')
    .select('name, public_slug')
    .eq('id', department_id)
    .single()

  await logEvent({
    log_type: 'user_report',
    page: '/dept/burn-permit',
    department_id,
    message: [
      `New burn permit application submitted.`,
      `Applicant: ${contact_name}`,
      `Email: ${contact_email}`,
      contact_phone ? `Phone: ${contact_phone}` : null,
      `Department: ${dept?.name ?? department_id}`,
      `Burn address: ${burn_address}`,
      `Burn date: ${burn_date}`,
      burn_description ? `Description: ${burn_description}` : null,
      `Confirmation code: ${data.confirmation_code}`,
      `Review at: https://www.fireops7.com/inbox`,
    ].filter(Boolean).join('\n'),
    metadata: {
      permit_id: data.confirmation_code,
      confirmation_code: data.confirmation_code,
      department_id,
    },
  })

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

  // Validate dept config before approving
  if (status === 'approved') {
    const { data: permitCheck } = await adminClient
      .from('burn_permits')
      .select('department_id')
      .eq('id', permit_id)
      .single()

    if (permitCheck) {
      const { data: deptCheck } = await adminClient
        .from('departments')
        .select('name, burn_permit_county_info')
        .eq('id', permitCheck.department_id)
        .single()

      if (!deptCheck?.name) {
        return { error: 'Department name is not set. Configure it in Admin → Department before approving permits.' }
      }
      if (!deptCheck?.burn_permit_county_info) {
        return { error: 'County/sheriff info is required before approving permits. Configure it in Admin → Department → Public Site tab.' }
      }
    }
  }

  const updateData: Record<string, unknown> = { status, reviewer_notes, updated_at: new Date().toISOString() }
  if (status === 'approved') {
    updateData.issued_date = new Date().toISOString().split('T')[0]
    updateData.approved_by_personnel_id = me.id
    if (permit_expiry_date) updateData.permit_expiry_date = permit_expiry_date
  }

  const { error: dbErr } = await adminClient.from('burn_permits').update(updateData).eq('id', permit_id)
  if (dbErr) { await logError(dbErr, '/inbox'); return { error: dbErr.message } }

  // Temporary email path: notify the app owner through the existing system log email flow.
  // Direct resident email is disabled until the sending domain is verified in Resend.
  if (status === 'approved') {
    const { data: permit } = await adminClient
      .from('burn_permits')
      .select('id, confirmation_code, contact_name, contact_email, contact_phone, burn_address, burn_date, burn_description, permit_expiry_date, issued_date, department_id')
      .eq('id', permit_id)
      .single()

    const { data: dept } = permit?.department_id
      ? await adminClient
          .from('departments')
          .select('name, public_slug')
          .eq('id', permit.department_id)
          .single()
      : { data: null }

    if (permit) {
      const statusUrl = dept?.public_slug
        ? `https://www.fireops7.com/dept/${dept.public_slug}/permit-status?code=${permit.confirmation_code}`
        : null
      const printUrl = dept?.public_slug
        ? `https://www.fireops7.com/dept/${dept.public_slug}/permit-print?code=${permit.confirmation_code}`
        : null

      await logEvent({
        log_type: 'user_report',
        page: '/inbox',
        personnel_id: me.id,
        department_id: permit.department_id,
        message: [
          `Burn permit approved for ${permit.contact_name}.`,
          `Resident email: ${permit.contact_email}`,
          permit.contact_phone ? `Resident phone: ${permit.contact_phone}` : null,
          `Department: ${dept?.name ?? 'Unknown department'}`,
          `Confirmation code: ${permit.confirmation_code}`,
          `Burn address: ${permit.burn_address}`,
          `Burn date: ${permit.burn_date}`,
          `Issued date: ${permit.issued_date ?? 'not set'}`,
          `Expires: ${permit.permit_expiry_date ?? 'not set'}`,
          statusUrl ? `Resident status link: ${statusUrl}` : null,
          printUrl ? `Direct print link: ${printUrl}` : null,
          'Temporary workflow: forward this approval information to the resident until fireops7.com is verified in Resend.',
        ].filter(Boolean).join('\n'),
        metadata: {
          permit_id: permit.id,
          confirmation_code: permit.confirmation_code,
          resident_email: permit.contact_email,
          status_url: statusUrl,
          print_url: printUrl,
          email_workflow: 'system_log_forwarding',
          report_type: 'burn_permit_approval',
        },
      })
    }
  }

  revalidatePath('/inbox')
  return { success: true }
}

// ─── Permit: Save officer signature ──────────────────────────────────────────
export async function savePermitOfficerSignature(formData: FormData) {
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

  const permit_id = formData.get('permit_id') as string
  const blob = formData.get('signature') as Blob
  if (!permit_id || !blob) return { error: 'Missing required fields.' }

  const path = `permits/officer/${permit_id}.png`
  const { error: uploadErr } = await adminClient.storage
    .from('signatures')
    .upload(path, blob, { contentType: 'image/png', upsert: true })
  if (uploadErr) { await logError(uploadErr, '/inbox'); return { error: uploadErr.message } }

  const signed_at = new Date().toISOString()
  const { error: dbErr } = await adminClient
    .from('burn_permits')
    .update({ officer_signature_url: path, officer_signed_at: signed_at })
    .eq('id', permit_id)
  if (dbErr) { await logError(dbErr, '/inbox'); return { error: dbErr.message } }

  revalidatePath('/inbox')
  return { success: true, signedAt: signed_at }
}

// ─── Permit: Save applicant signature (public — validated by confirmation code) ─
export async function savePermitApplicantSignature(formData: FormData) {
  const adminClient = createAdminClient()

  const confirmation_code = (formData.get('confirmation_code') as string)?.toUpperCase().trim()
  const department_id     = formData.get('department_id') as string
  const blob              = formData.get('signature') as Blob

  if (!confirmation_code || !department_id || !blob) return { error: 'Missing required fields.' }

  const { data: permit } = await adminClient
    .from('burn_permits')
    .select('id, status, officer_signed_at')
    .eq('confirmation_code', confirmation_code)
    .eq('department_id', department_id)
    .single()

  if (!permit) return { error: 'Permit not found.' }
  if (permit.status !== 'approved') return { error: 'Permit is not approved.' }
  if (!permit.officer_signed_at) return { error: 'Officer must sign before applicant.' }

  const path = `permits/applicant/${permit.id}.png`
  const { error: uploadErr } = await adminClient.storage
    .from('signatures')
    .upload(path, blob, { contentType: 'image/png', upsert: true })
  if (uploadErr) return { error: uploadErr.message }

  const signed_at = new Date().toISOString()
  const { error: dbErr } = await adminClient
    .from('burn_permits')
    .update({ applicant_signature_url: path, applicant_signed_at: signed_at })
    .eq('id', permit.id)
  if (dbErr) return { error: dbErr.message }

  return { success: true, signedAt: signed_at }
}

// ─── Permit: Applicant print-and-sign acknowledgement (public) ───────────────
export async function acknowledgePermitPrintAndSign(formData: FormData) {
  const adminClient = createAdminClient()

  const confirmation_code = (formData.get('confirmation_code') as string)?.toUpperCase().trim()
  const department_id     = formData.get('department_id') as string

  if (!confirmation_code || !department_id) return { error: 'Missing required fields.' }

  const { data: permit } = await adminClient
    .from('burn_permits')
    .select('id, status, officer_signed_at')
    .eq('confirmation_code', confirmation_code)
    .eq('department_id', department_id)
    .single()

  if (!permit) return { error: 'Permit not found.' }
  if (permit.status !== 'approved') return { error: 'Permit is not approved.' }

  const { error: dbErr } = await adminClient
    .from('burn_permits')
    .update({ applicant_acknowledged_at: new Date().toISOString() })
    .eq('id', permit.id)
  if (dbErr) return { error: dbErr.message }

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

  if (status === 'fulfilled' || status === 'denied') {
    const { data: req } = await adminClient
      .from('public_record_requests')
      .select('contact_name, contact_email, confirmation_code, department_id, request_type')
      .eq('id', request_id)
      .single()
    if (req) {
      await logEvent({
        log_type: 'user_report',
        page: '/inbox',
        personnel_id: me.id,
        department_id: req.department_id,
        message: [
          `Records request ${status}: ${req.contact_name}`,
          `Email: ${req.contact_email}`,
          `Request type: ${req.request_type}`,
          `Confirmation code: ${req.confirmation_code}`,
          reviewer_notes ? `Notes: ${reviewer_notes}` : null,
        ].filter(Boolean).join('\n'),
        metadata: { request_id, confirmation_code: req.confirmation_code, status },
      })
    }
  }

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

  const { data: dept } = await adminClient
    .from('departments')
    .select('name')
    .eq('id', department_id)
    .single()

  await logEvent({
    log_type: 'user_report',
    page: '/dept/records',
    department_id,
    message: [
      `New records request submitted.`,
      `Applicant: ${contact_name}`,
      `Email: ${contact_email}`,
      contact_phone ? `Phone: ${contact_phone}` : null,
      `Department: ${dept?.name ?? department_id}`,
      `Request type: ${request_type}`,
      description ? `Description: ${description}` : null,
      incident_date ? `Incident date: ${incident_date}` : null,
      incident_address ? `Incident address: ${incident_address}` : null,
      `Confirmation code: ${data.confirmation_code}`,
      `Review at: https://www.fireops7.com/inbox`,
    ].filter(Boolean).join('\n'),
    metadata: { confirmation_code: data.confirmation_code, department_id },
  })

  return { confirmationCode: data.confirmation_code }
}
