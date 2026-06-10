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
  if (!me) return { error: 'Session expired.' }

  // Allow sys admins or department admins for this department
  if (!me.is_sys_admin) {
    const { data: deptList } = await adminClient
      .from('department_personnel')
      .select('system_role')
      .eq('personnel_id', me.id)
      .eq('department_id', departmentId)
      .eq('active', true)
    if (deptList?.[0]?.system_role !== 'admin') return { error: 'Only department admins can change event visibility.' }
  }

  const { error: dbErr } = await adminClient
    .from('event_series')
    .update({ is_public: isPublic })
    .eq('id', eventSeriesId)
    .eq('department_id', departmentId)

  if (dbErr) {
    await logError(dbErr, `/events`)
    return { error: dbErr.message }
  }

  revalidatePath('/events')
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

  // Email the resident their approval directly via the send-permit-approval Edge Function
  // (fireops7.com verified in Resend 2026-06-07 — direct sends now enabled)
  if (status === 'approved') {
    const { error: emailErr } = await adminClient.functions.invoke('send-permit-approval', {
      body: { permit_id },
    })
    if (emailErr) {
      await logError(emailErr, '/inbox', { personnel_id: me.id, metadata: { permit_id, report_type: 'burn_permit_approval_email' } })
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

export async function submitPublicFeedback(formData: FormData) {
  const adminClient = createAdminClient()

  const department_id = formData.get('department_id') as string
  const feedback_type = formData.get('feedback_type') as string
  const contact_name  = (formData.get('contact_name') as string)?.trim() || null
  const contact_email = (formData.get('contact_email') as string)?.trim() || null
  const message       = (formData.get('message') as string)?.trim()
  const page_url      = (formData.get('page_url') as string)?.trim() || null

  if (!department_id || !message) {
    return { error: 'Please enter a message.' }
  }

  if (!['feedback', 'bug_report'].includes(feedback_type)) {
    return { error: 'Invalid feedback type.' }
  }

  if (contact_email) {
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRx.test(contact_email)) return { error: 'Please enter a valid email address.' }
  }

  const { data: inserted, error: dbErr } = await adminClient
    .from('public_feedback')
    .insert({ department_id, feedback_type, contact_name, contact_email, message, page_url })
    .select('id')
    .single()

  if (dbErr) {
    await logError(dbErr, 'public/feedback')
    return { error: 'Something went wrong. Please try again.' }
  }

  const { data: dept } = await adminClient
    .from('departments')
    .select('name')
    .eq('id', department_id)
    .single()

  await logEvent({
    log_type: 'user_report',
    page: '/dept/feedback',
    department_id,
    message: [
      `New ${feedback_type === 'bug_report' ? 'bug report' : 'feedback'} submitted.`,
      contact_name ? `Name: ${contact_name}` : null,
      contact_email ? `Email: ${contact_email}` : null,
      `Department: ${dept?.name ?? department_id}`,
      `Message: ${message}`,
      `Review at: https://www.fireops7.com/inbox`,
    ].filter(Boolean).join('\n'),
    metadata: { department_id, feedback_type, feedback_id: inserted?.id ?? null },
  })

  return { success: true }
}

// ─── Inbox: Update public feedback status ────────────────────────────────────
export async function updatePublicFeedbackStatus(formData: FormData) {
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

  const feedback_id   = formData.get('feedback_id') as string
  const status        = formData.get('status') as string
  const reviewer_notes = (formData.get('reviewer_notes') as string)?.trim() || null

  if (!['new', 'reviewed', 'resolved'].includes(status)) return { error: 'Invalid status.' }

  const { error: dbErr } = await adminClient
    .from('public_feedback')
    .update({ status, reviewer_notes, updated_at: new Date().toISOString() })
    .eq('id', feedback_id)
  if (dbErr) { await logError(dbErr, '/inbox'); return { error: dbErr.message } }

  revalidatePath('/inbox')
  return { success: true }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ─── Inbox / Admin: Reply to a public feedback submitter via email ────────────
export async function replyToPublicFeedback(formData: FormData) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Session expired.' }

  const { data: meList } = await adminClient
    .from('personnel').select('id, first_name, last_name, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) return { error: 'Could not verify your account.' }

  const feedback_id = formData.get('feedback_id') as string
  const reply_message = (formData.get('reply_message') as string)?.trim()
  if (!feedback_id || !reply_message) return { error: 'Please enter a reply message.' }

  const { data: feedback } = await adminClient
    .from('public_feedback')
    .select('id, department_id, feedback_type, contact_name, contact_email, message')
    .eq('id', feedback_id)
    .single()
  if (!feedback) return { error: 'Feedback not found.' }
  if (!feedback.contact_email) return { error: 'This submission has no email address on file — a reply cannot be sent.' }

  // Authorize: sys admin, or officer+ in the feedback's department
  if (!me.is_sys_admin) {
    const { data: myDeptList } = await adminClient
      .from('department_personnel').select('system_role')
      .eq('personnel_id', me.id).eq('department_id', feedback.department_id).eq('active', true)
    const myDept = myDeptList?.[0]
    if (!myDept || myDept.system_role === 'member') return { error: 'Unauthorized.' }
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return { error: 'Email sending is not configured.' }

  const { data: dept } = await adminClient
    .from('departments').select('name, public_email').eq('id', feedback.department_id).single()

  const replierName = `${me.first_name ?? ''} ${me.last_name ?? ''}`.trim()
  const deptName = dept?.name ?? 'FireOps7'
  const greeting = feedback.contact_name ? `Hi ${escapeHtml(feedback.contact_name)},` : 'Hi,'
  const subjectLabel = feedback.feedback_type === 'bug_report' ? 'problem report' : 'feedback'

  const signOffLines = replierName
    ? `${escapeHtml(replierName)}<br/>${escapeHtml(deptName)}`
    : escapeHtml(deptName)

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <p>${greeting}</p>
      <p style="white-space:pre-line">${escapeHtml(reply_message)}</p>
      <p style="margin-top:24px">— ${signOffLines}</p>
    </div>
  `

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${deptName} (via FireOps7) <noreply@fireops7.com>`,
      to: feedback.contact_email,
      ...(dept?.public_email ? { reply_to: dept.public_email } : {}),
      subject: `Re: Your ${subjectLabel} to ${deptName}`,
      html,
    }),
  })

  if (!emailRes.ok) {
    await logError(await emailRes.text(), '/inbox/feedback-reply')
    return { error: 'Failed to send reply email. Please try again.' }
  }

  const { error: dbErr } = await adminClient
    .from('public_feedback')
    .update({
      reply_message,
      replied_at: new Date().toISOString(),
      replied_by_personnel_id: me.id,
      status: 'resolved',
      updated_at: new Date().toISOString(),
    })
    .eq('id', feedback_id)
  if (dbErr) { await logError(dbErr, '/inbox'); return { error: dbErr.message } }

  revalidatePath('/inbox')
  revalidatePath('/admin/logs')
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
