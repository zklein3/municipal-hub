'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { hasPermission } from '@/lib/permissions'
import { logError, logEvent } from '@/lib/logger'
import { claimHosesBulk, releaseHosesBulk } from '@/lib/hose-locks'
import { revalidatePath } from 'next/cache'

async function getContext() {
  const ctx = await getCurrentDepartmentContext()
  if (!ctx) return null
  return {
    me: { id: ctx.personnelId, is_sys_admin: ctx.isSysAdmin },
    department_id: ctx.departmentId,
    system_role: ctx.systemRole,
    isOfficerOrAbove: await hasPermission(ctx, 'perform_iso_testing'),
  }
}

// ─── Apparatus ISO specs ──────────────────────────────────────────────────────

export async function upsertApparatusIsoSpecs(formData: FormData) {
  const ctx = await getContext()
  if (!ctx || !ctx.isOfficerOrAbove || !ctx.department_id) return { error: 'Unauthorized' }

  const apparatus_id = formData.get('apparatus_id') as string

  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient
    .from('apparatus_iso_specs')
    .upsert({
      apparatus_id,
      department_id: ctx.department_id,
      pump_rating_gpm: formData.get('pump_rating_gpm') ? parseInt(formData.get('pump_rating_gpm') as string) : null,
      tank_capacity_gal: formData.get('tank_capacity_gal') ? parseInt(formData.get('tank_capacity_gal') as string) : null,
      foam_capacity_gal: formData.get('foam_capacity_gal') ? parseInt(formData.get('foam_capacity_gal') as string) : null,
      aerial_length_ft: formData.get('aerial_length_ft') ? parseInt(formData.get('aerial_length_ft') as string) : null,
      turning_radius_ft: formData.get('turning_radius_ft') ? parseInt(formData.get('turning_radius_ft') as string) : null,
      gvwr_lbs: formData.get('gvwr_lbs') ? parseInt(formData.get('gvwr_lbs') as string) : null,
      hose_loads: (() => { try { return JSON.parse(formData.get('hose_loads') as string) } catch { return null } })(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'apparatus_id' })

  if (dbErr) {
    await logError(dbErr.message, 'upsertApparatusIsoSpecs', { personnel_id: ctx.me.id })
    return { error: dbErr.message }
  }

  revalidatePath(`/apparatus/${apparatus_id}`)
  return { success: true }
}

// ─── Hose Test Session ────────────────────────────────────────────────────────

// Batch tests are now saved as drafts and finalized via app/actions/hose-test-sessions.ts.

// Shares hose_testing_locks with the public /hose-testing/[slug] flow, so an
// in-app officer and a public/mutual-aid tester can't both grab the same
// physical hose. Unlike the public claimHose, this never checks
// hose_testing_enabled — that flag only gates public (anon) access; in-system
// users can always use hose testing when module_iso + perform_iso_testing
// allow it, toggle notwithstanding.
const LOCK_STALE_MINUTES = 30

export async function claimHoseInApp(hoseId: string, sessionToken: string, testerName: string) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove || !ctx.department_id) return { error: 'Unauthorized' }

  const adminClient = createAdminClient()
  const staleCutoff = new Date(Date.now() - LOCK_STALE_MINUTES * 60 * 1000).toISOString()
  await adminClient.from('hose_testing_locks').delete().eq('department_id', ctx.department_id).lt('created_at', staleCutoff)

  const { data: existing } = await adminClient
    .from('hose_testing_locks')
    .select('session_token, tester_name')
    .eq('hose_id', hoseId)
    .maybeSingle()

  if (existing && existing.session_token !== sessionToken) {
    return { error: `Already selected by ${existing.tester_name || 'another tester'}.` }
  }

  const { error: dbErr } = await adminClient
    .from('hose_testing_locks')
    .upsert(
      { department_id: ctx.department_id, hose_id: hoseId, session_token: sessionToken, tester_name: testerName || null, created_at: new Date().toISOString() },
      { onConflict: 'hose_id' }
    )

  if (dbErr) {
    await logError(dbErr.message, 'claimHoseInApp', { personnel_id: ctx.me.id, metadata: { hose_id: hoseId } })
    return { error: dbErr.message }
  }
  return { success: true }
}

export async function claimHosesInApp(hoseIds: string[], sessionToken: string, testerName: string) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove || !ctx.department_id) return { error: 'Unauthorized' }
  const result = await claimHosesBulk(createAdminClient(), ctx.department_id, hoseIds, sessionToken, testerName)
  return { success: true, ...result }
}

export async function releaseHosesInApp(hoseIds: string[], sessionToken: string) {
  const ctx = await getContext()
  if (!ctx?.department_id) return { error: 'Unauthorized' }
  await releaseHosesBulk(createAdminClient(), ctx.department_id, hoseIds, sessionToken)
  return { success: true }
}

// Clears every selection lock held under one session token — for a selection
// left behind by a tester who walked away. Draft tests are discarded from
// "Open tests" instead, so locks belonging to a draft are left alone here.
export async function releaseHeldSelection(sessionToken: string) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove || !ctx.department_id) return { error: 'Unauthorized' }

  const adminClient = createAdminClient()
  const { data: drafts } = await adminClient
    .from('hose_test_sessions').select('id').eq('department_id', ctx.department_id).eq('status', 'draft')
  const draftIds = (drafts ?? []).map(d => d.id)
  const { data: inDraft } = draftIds.length
    ? await adminClient.from('hose_test_session_items').select('hose_id').in('session_id', draftIds)
    : { data: [] as { hose_id: string }[] }
  const keep = new Set((inDraft ?? []).map(i => i.hose_id))

  const { data: locks } = await adminClient
    .from('hose_testing_locks').select('hose_id').eq('department_id', ctx.department_id).eq('session_token', sessionToken)
  const toClear = (locks ?? []).map(l => l.hose_id).filter(id => !keep.has(id))
  if (toClear.length) {
    await adminClient.from('hose_testing_locks').delete().eq('department_id', ctx.department_id).in('hose_id', toClear)
  }
  return { success: true, cleared: toClear.length }
}

export async function releaseHoseInApp(hoseId: string, sessionToken: string) {
  const ctx = await getContext()
  if (!ctx?.department_id) return { error: 'Unauthorized' }

  const adminClient = createAdminClient()
  await adminClient
    .from('hose_testing_locks')
    .delete()
    .eq('hose_id', hoseId)
    .eq('session_token', sessionToken)

  return { success: true }
}

// Clears someone else's lock regardless of session_token -- for when the
// original tester (public or in-app) left without finishing: device died,
// walked away, closed the tab without releasing. Without this the only way
// a stuck lock clears is the 30-minute staleness cleanup in claimHoseInApp.
export async function forceReleaseHoseInApp(hoseId: string) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove || !ctx.department_id) return { error: 'Unauthorized' }

  const adminClient = createAdminClient()
  await adminClient
    .from('hose_testing_locks')
    .delete()
    .eq('hose_id', hoseId)
    .eq('department_id', ctx.department_id)

  return { success: true }
}

// ─── Mutual Aid Agreements ───────────────────────────────────────────────────

type MAAApparatus = {
  identifier: string
  pump_gpm: number | null
  tank_gal: number | null
  hose_loads: { diameter_in: number; length_ft: number }[]
}

export async function createMutualAidAgreement(
  fields: {
    partner_department: string
    agreement_type: string
    effective_date: string | null
    expiration_date: string | null
    notes: string | null
    apparatus: MAAApparatus[]
  }
) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove || !ctx.department_id) return { error: 'Unauthorized' }

  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient.from('iso_mutual_aid_agreements').insert({
    department_id: ctx.department_id,
    partner_department: fields.partner_department,
    agreement_type: fields.agreement_type,
    effective_date: fields.effective_date || null,
    expiration_date: fields.expiration_date || null,
    notes: fields.notes || null,
    apparatus: fields.apparatus,
    created_by: ctx.me.id,
  })
  if (dbErr) { await logError(dbErr.message, '/iso/mutual-aid'); return { error: dbErr.message } }
  revalidatePath('/iso/mutual-aid')
  revalidatePath('/iso/report')
  return { success: true }
}

export async function updateMutualAidAgreement(
  id: string,
  fields: {
    partner_department: string
    agreement_type: string
    effective_date: string | null
    expiration_date: string | null
    notes: string | null
    apparatus: MAAApparatus[]
  }
) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove || !ctx.department_id) return { error: 'Unauthorized' }

  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient
    .from('iso_mutual_aid_agreements')
    .update({
      partner_department: fields.partner_department,
      agreement_type: fields.agreement_type,
      effective_date: fields.effective_date || null,
      expiration_date: fields.expiration_date || null,
      notes: fields.notes || null,
      apparatus: fields.apparatus,
    })
    .eq('id', id)
    .eq('department_id', ctx.department_id)
  if (dbErr) { await logError(dbErr.message, '/iso/mutual-aid'); return { error: dbErr.message } }
  revalidatePath('/iso/mutual-aid')
  revalidatePath('/iso/report')
  return { success: true }
}

export async function toggleMutualAidAgreement(id: string, active: boolean) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove || !ctx.department_id) return { error: 'Unauthorized' }

  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient
    .from('iso_mutual_aid_agreements')
    .update({ active })
    .eq('id', id)
    .eq('department_id', ctx.department_id)
  if (dbErr) { await logError(dbErr.message, '/iso/mutual-aid'); return { error: dbErr.message } }
  revalidatePath('/iso/mutual-aid')
  revalidatePath('/iso/report')
  return { success: true }
}

// ─── Pre-Plans ───────────────────────────────────────────────────────────────

export async function savePreplan(formData: FormData) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove || !ctx.department_id) return { error: 'Unauthorized' }

  const id = (formData.get('id') as string) || null
  const location_name = (formData.get('location_name') as string)?.trim()
  const address = (formData.get('address') as string)?.trim() || null
  const surveyed_date = (formData.get('surveyed_date') as string) || null
  const notes = (formData.get('notes') as string)?.trim() || null
  const file = formData.get('document') as File | null

  if (!location_name) return { error: 'Location name is required.' }

  const adminClient = createAdminClient()
  let document_path: string | null = null

  if (file && file.size > 0) {
    const ext = file.name.split('.').pop() ?? 'pdf'
    const path = `preplans/${ctx.department_id}/${Date.now()}.${ext}`
    const { error: uploadErr } = await adminClient.storage
      .from('documents')
      .upload(path, file, { contentType: file.type || 'application/pdf' })
    if (uploadErr) { await logError(uploadErr.message, '/iso/preplans'); return { error: 'Document upload failed.' } }
    document_path = path
  }

  if (id) {
    const update: Record<string, unknown> = { location_name, address, surveyed_date, notes, updated_at: new Date().toISOString() }
    if (document_path) update.document_path = document_path
    const { error: dbErr } = await adminClient.from('iso_preplans').update(update).eq('id', id).eq('department_id', ctx.department_id)
    if (dbErr) { await logError(dbErr.message, '/iso/preplans'); return { error: dbErr.message } }
  } else {
    const { error: dbErr } = await adminClient.from('iso_preplans').insert({
      department_id: ctx.department_id, location_name, address, surveyed_date, notes,
      document_path, created_by: ctx.me.id,
    })
    if (dbErr) { await logError(dbErr.message, '/iso/preplans'); return { error: dbErr.message } }
  }

  revalidatePath('/iso/preplans')
  revalidatePath('/iso/report')
  return { success: true }
}

export async function deletePreplan(id: string) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove || !ctx.department_id) return { error: 'Unauthorized' }
  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient.from('iso_preplans').delete().eq('id', id).eq('department_id', ctx.department_id)
  if (dbErr) { await logError(dbErr.message, '/iso/preplans'); return { error: dbErr.message } }
  revalidatePath('/iso/preplans')
  revalidatePath('/iso/report')
  return { success: true }
}

export async function getPreplanDocUrl(document_path: string): Promise<string | null> {
  const adminClient = createAdminClient()
  const { data } = await adminClient.storage.from('documents').createSignedUrl(document_path, 3600)
  return data?.signedUrl ?? null
}

// ─── Pump Tests ──────────────────────────────────────────────────────────────

export async function savePumpTest(formData: FormData) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove || !ctx.department_id) return { error: 'Unauthorized' }

  const apparatus_id = formData.get('apparatus_id') as string
  const test_date = formData.get('test_date') as string
  const vendor = (formData.get('vendor') as string)?.trim()
  const passed = formData.get('passed') === 'true'
  const notes = (formData.get('notes') as string)?.trim() || null
  const file = formData.get('document') as File | null

  if (!apparatus_id || !test_date || !vendor) return { error: 'Date and vendor are required.' }

  const adminClient = createAdminClient()
  let document_path: string | null = null

  if (file && file.size > 0) {
    const ext = file.name.split('.').pop() ?? 'pdf'
    const path = `pump-tests/${apparatus_id}/${Date.now()}.${ext}`
    const { error: uploadErr } = await adminClient.storage
      .from('documents')
      .upload(path, file, { contentType: file.type || 'application/pdf' })
    if (uploadErr) {
      await logError(uploadErr.message, '/apparatus')
      return { error: 'Document upload failed.' }
    }
    document_path = path
  }

  const { error: dbErr } = await adminClient
    .from('apparatus_pump_tests')
    .insert({
      apparatus_id,
      department_id: ctx.department_id,
      test_date,
      vendor,
      passed,
      notes,
      document_path,
      logged_by_personnel_id: ctx.me.id,
    })

  if (dbErr) {
    await logError(dbErr.message, '/apparatus')
    return { error: dbErr.message }
  }

  revalidatePath(`/apparatus/${apparatus_id}`)
  return { success: true }
}

export async function getPumpTestDocUrl(document_path: string): Promise<string | null> {
  const adminClient = createAdminClient()
  const { data } = await adminClient.storage
    .from('documents')
    .createSignedUrl(document_path, 3600)
  return data?.signedUrl ?? null
}

// ─── Hoses ────────────────────────────────────────────────────────────────────

export async function createHose(formData: FormData) {
  const ctx = await getContext()
  if (!ctx || !ctx.isOfficerOrAbove || !ctx.department_id) return { error: 'Unauthorized' }

  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient.from('hoses').insert({
    department_id: ctx.department_id,
    apparatus_id: (formData.get('apparatus_id') as string) || null,
    hose_identifier: (formData.get('hose_identifier') as string)?.trim(),
    hose_type: formData.get('hose_type') as string,
    diameter_in: parseFloat(formData.get('diameter_in') as string),
    length_ft: parseInt(formData.get('length_ft') as string),
    manufacturer: (formData.get('manufacturer') as string)?.trim() || null,
    serial_number: (formData.get('serial_number') as string)?.trim() || null,
    year_placed_in_service: formData.get('year_placed_in_service') ? parseInt(formData.get('year_placed_in_service') as string) : null,
    status: 'in_service',
    notes: (formData.get('notes') as string)?.trim() || null,
  })

  if (dbErr) {
    await logError(dbErr.message, 'createHose', { personnel_id: ctx.me.id })
    return { error: dbErr.message }
  }

  revalidatePath('/iso/hoses')
  return { success: true }
}

export async function updateHose(formData: FormData) {
  const ctx = await getContext()
  if (!ctx || !ctx.isOfficerOrAbove || !ctx.department_id) return { error: 'Unauthorized' }

  const hose_id = formData.get('hose_id') as string
  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient.from('hoses').update({
    apparatus_id: (formData.get('apparatus_id') as string) || null,
    hose_identifier: (formData.get('hose_identifier') as string)?.trim(),
    hose_type: formData.get('hose_type') as string,
    diameter_in: parseFloat(formData.get('diameter_in') as string),
    length_ft: parseInt(formData.get('length_ft') as string),
    manufacturer: (formData.get('manufacturer') as string)?.trim() || null,
    serial_number: (formData.get('serial_number') as string)?.trim() || null,
    year_placed_in_service: formData.get('year_placed_in_service') ? parseInt(formData.get('year_placed_in_service') as string) : null,
    status: formData.get('status') as string,
    notes: (formData.get('notes') as string)?.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq('id', hose_id).eq('department_id', ctx.department_id)

  if (dbErr) {
    await logError(dbErr.message, 'updateHose', { personnel_id: ctx.me.id })
    return { error: dbErr.message }
  }

  revalidatePath('/iso/hoses')
  return { success: true }
}

export async function addHoseTest(formData: FormData) {
  const ctx = await getContext()
  if (!ctx || !ctx.isOfficerOrAbove || !ctx.department_id) return { error: 'Unauthorized' }

  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient.from('hose_tests').insert({
    hose_id: formData.get('hose_id') as string,
    department_id: ctx.department_id,
    test_date: formData.get('test_date') as string,
    tested_by: ctx.me.id,
    test_pressure_psi: parseInt(formData.get('test_pressure_psi') as string),
    duration_min: parseInt(formData.get('duration_min') as string) || 3,
    passed: formData.get('passed') === 'true',
    failure_reason: (formData.get('failure_reason') as string)?.trim() || null,
    notes: (formData.get('notes') as string)?.trim() || null,
  })

  if (dbErr) {
    await logError(dbErr.message, 'addHoseTest', { personnel_id: ctx.me.id })
    return { error: dbErr.message }
  }

  revalidatePath('/iso/hoses')
  return { success: true }
}

// Corrections to logged tests. Every change writes the original row to system_logs
// (who, when, why) so a voided or edited test can always be reconstructed.
export async function updateHoseTest(testId: string, formData: FormData) {
  const ctx = await getContext()
  if (!ctx || !ctx.isOfficerOrAbove || !ctx.department_id) return { error: 'Unauthorized' }

  const test_date = formData.get('test_date') as string
  const test_pressure_psi = parseInt(formData.get('test_pressure_psi') as string)
  const duration_min = parseInt(formData.get('duration_min') as string)
  const passed = formData.get('passed') === 'true'
  const failure_reason = (formData.get('failure_reason') as string)?.trim() || null
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!test_date) return { error: 'Test date is required.' }
  if (!test_pressure_psi || test_pressure_psi <= 0) return { error: 'Test pressure is required.' }
  if (!passed && !failure_reason) return { error: 'Enter a failure reason for a failed test.' }

  const adminClient = createAdminClient()
  const { data: before } = await adminClient
    .from('hose_tests').select('*').eq('id', testId).eq('department_id', ctx.department_id).maybeSingle()
  if (!before) return { error: 'Test not found.' }

  const after = { test_date, test_pressure_psi, duration_min: duration_min || before.duration_min, passed, failure_reason: passed ? null : failure_reason, notes }
  const { error: dbErr } = await adminClient.from('hose_tests').update(after).eq('id', testId).eq('department_id', ctx.department_id)
  if (dbErr) { await logError(dbErr.message, 'updateHoseTest', { personnel_id: ctx.me.id }); return { error: dbErr.message } }

  await logEvent({
    log_type: 'info', page: '/iso/hoses', message: 'hose_test_edited',
    personnel_id: ctx.me.id, department_id: ctx.department_id,
    metadata: { test_id: testId, hose_id: before.hose_id, before, after },
  })
  revalidatePath('/iso/hoses')
  return { success: true }
}

export async function deleteHoseTest(testId: string, reason: string) {
  const ctx = await getContext()
  if (!ctx || !ctx.isOfficerOrAbove || !ctx.department_id) return { error: 'Unauthorized' }
  if (!reason?.trim()) return { error: 'A reason is required to delete a test.' }

  const adminClient = createAdminClient()
  const { data: before } = await adminClient
    .from('hose_tests').select('*').eq('id', testId).eq('department_id', ctx.department_id).maybeSingle()
  if (!before) return { error: 'Test not found.' }

  // Log first: if the delete then fails nothing is lost, and if the log fails we don't delete.
  const { error: logErr } = await adminClient.from('system_logs').insert({
    log_type: 'info', page: '/iso/hoses', message: 'hose_test_voided',
    personnel_id: ctx.me.id, department_id: ctx.department_id,
    metadata: { test_id: testId, hose_id: before.hose_id, reason: reason.trim(), voided_at: new Date().toISOString(), original: before },
  })
  if (logErr) return { error: 'Could not record the audit entry, so the test was not deleted.' }

  const { error: dbErr } = await adminClient.from('hose_tests').delete().eq('id', testId).eq('department_id', ctx.department_id)
  if (dbErr) { await logError(dbErr.message, 'deleteHoseTest', { personnel_id: ctx.me.id }); return { error: dbErr.message } }

  revalidatePath('/iso/hoses')
  return { success: true }
}

// ─── Hydrants ─────────────────────────────────────────────────────────────────

export async function createHydrant(formData: FormData) {
  const ctx = await getContext()
  if (!ctx || !ctx.isOfficerOrAbove || !ctx.department_id) return { error: 'Unauthorized' }

  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient.from('hydrants').insert({
    department_id: ctx.department_id,
    hydrant_number: (formData.get('hydrant_number') as string)?.trim(),
    location_description: (formData.get('location_description') as string)?.trim(),
    street_address: (formData.get('street_address') as string)?.trim() || null,
    lat: formData.get('lat') ? parseFloat(formData.get('lat') as string) : null,
    lng: formData.get('lng') ? parseFloat(formData.get('lng') as string) : null,
    owner: (formData.get('owner') as string)?.trim() || null,
    hydrant_type: (formData.get('hydrant_type') as string) || null,
    main_size_in: formData.get('main_size_in') ? parseFloat(formData.get('main_size_in') as string) : null,
    out_of_service: false,
    notes: (formData.get('notes') as string)?.trim() || null,
  })

  if (dbErr) {
    await logError(dbErr.message, 'createHydrant', { personnel_id: ctx.me.id })
    return { error: dbErr.message }
  }

  revalidatePath('/iso/hydrants')
  return { success: true }
}

export async function updateHydrant(formData: FormData) {
  const ctx = await getContext()
  if (!ctx || !ctx.isOfficerOrAbove || !ctx.department_id) return { error: 'Unauthorized' }

  const hydrant_id = formData.get('hydrant_id') as string
  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient.from('hydrants').update({
    hydrant_number: (formData.get('hydrant_number') as string)?.trim(),
    location_description: (formData.get('location_description') as string)?.trim(),
    street_address: (formData.get('street_address') as string)?.trim() || null,
    lat: formData.get('lat') ? parseFloat(formData.get('lat') as string) : null,
    lng: formData.get('lng') ? parseFloat(formData.get('lng') as string) : null,
    owner: (formData.get('owner') as string)?.trim() || null,
    hydrant_type: (formData.get('hydrant_type') as string) || null,
    main_size_in: formData.get('main_size_in') ? parseFloat(formData.get('main_size_in') as string) : null,
    out_of_service: formData.get('out_of_service') === 'true',
    notes: (formData.get('notes') as string)?.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq('id', hydrant_id).eq('department_id', ctx.department_id)

  if (dbErr) {
    await logError(dbErr.message, 'updateHydrant', { personnel_id: ctx.me.id })
    return { error: dbErr.message }
  }

  revalidatePath('/iso/hydrants')
  return { success: true }
}

export async function addHydrantFlowTest(formData: FormData) {
  const ctx = await getContext()
  if (!ctx || !ctx.isOfficerOrAbove || !ctx.department_id) return { error: 'Unauthorized' }

  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient.from('hydrant_flow_tests').insert({
    hydrant_id: formData.get('hydrant_id') as string,
    department_id: ctx.department_id,
    test_date: formData.get('test_date') as string,
    tested_by: ctx.me.id,
    static_pressure_psi: parseInt(formData.get('static_pressure_psi') as string),
    residual_pressure_psi: parseInt(formData.get('residual_pressure_psi') as string),
    flow_gpm: parseInt(formData.get('flow_gpm') as string),
    pitot_reading_psi: formData.get('pitot_reading_psi') ? parseFloat(formData.get('pitot_reading_psi') as string) : null,
    nozzle_diameter_in: formData.get('nozzle_diameter_in') ? parseFloat(formData.get('nozzle_diameter_in') as string) : null,
    notes: (formData.get('notes') as string)?.trim() || null,
  })

  if (dbErr) {
    await logError(dbErr.message, 'addHydrantFlowTest', { personnel_id: ctx.me.id })
    return { error: dbErr.message }
  }

  revalidatePath('/iso/hydrants')
  return { success: true }
}

// ─── Mutual Aid ───────────────────────────────────────────────────────────────

export async function addMutualAid(formData: FormData) {
  const ctx = await getContext()
  if (!ctx || !ctx.isOfficerOrAbove || !ctx.department_id) return { error: 'Unauthorized' }

  const incident_id = formData.get('incident_id') as string
  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient.from('incident_mutual_aid').insert({
    incident_id,
    department_id: ctx.department_id,
    external_department_name: (formData.get('external_department_name') as string)?.trim(),
    role: formData.get('role') as string,
    apparatus_description: (formData.get('apparatus_description') as string)?.trim() || null,
    personnel_count: formData.get('personnel_count') ? parseInt(formData.get('personnel_count') as string) : null,
    arrival_time: (formData.get('arrival_time') as string) || null,
    departure_time: (formData.get('departure_time') as string) || null,
    notes: (formData.get('notes') as string)?.trim() || null,
  })

  if (dbErr) {
    await logError(dbErr.message, 'addMutualAid', { personnel_id: ctx.me.id })
    return { error: dbErr.message }
  }

  revalidatePath(`/incidents/${incident_id}`)
  return { success: true }
}

export async function updateMutualAid(mutualAidId: string, formData: FormData) {
  const ctx = await getContext()
  if (!ctx || !ctx.isOfficerOrAbove || !ctx.department_id) return { error: 'Unauthorized' }

  const incident_id = formData.get('incident_id') as string
  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient
    .from('incident_mutual_aid')
    .update({
      external_department_name: (formData.get('external_department_name') as string)?.trim(),
      role: formData.get('role') as string,
      apparatus_description: (formData.get('apparatus_description') as string)?.trim() || null,
      personnel_count: formData.get('personnel_count') ? parseInt(formData.get('personnel_count') as string) : null,
      arrival_time: (formData.get('arrival_time') as string) || null,
      departure_time: (formData.get('departure_time') as string) || null,
      notes: (formData.get('notes') as string)?.trim() || null,
    })
    .eq('id', mutualAidId)
    .eq('department_id', ctx.department_id)

  if (dbErr) {
    await logError(dbErr.message, 'updateMutualAid', { personnel_id: ctx.me.id })
    return { error: dbErr.message }
  }

  revalidatePath(`/incidents/${incident_id}`)
  return { success: true }
}

export async function removeMutualAid(mutualAidId: string, incidentId: string) {
  const ctx = await getContext()
  if (!ctx || !ctx.isOfficerOrAbove || !ctx.department_id) return { error: 'Unauthorized' }

  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient
    .from('incident_mutual_aid')
    .delete()
    .eq('id', mutualAidId)
    .eq('department_id', ctx.department_id)

  if (dbErr) {
    await logError(dbErr.message, 'removeMutualAid', { personnel_id: ctx.me.id })
    return { error: dbErr.message }
  }

  revalidatePath(`/incidents/${incidentId}`)
  return { success: true }
}

// ─── Remove Hose ──────────────────────────────────────────────────────────────
// Quick status change from Hose Inventory, mainly "Return to service" for a
// hose that was taken out of service after failing a test.
export async function setHoseStatus(hoseId: string, status: 'in_service' | 'out_of_service') {
  const ctx = await getContext()
  if (!ctx || !ctx.isOfficerOrAbove || !ctx.department_id) return { error: 'Unauthorized' }
  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient
    .from('hoses')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', hoseId)
    .eq('department_id', ctx.department_id)
  if (dbErr) { await logError(dbErr.message, '/iso/hoses', { personnel_id: ctx.me.id }); return { error: dbErr.message } }
  if (status !== 'in_service') {
    await adminClient.from('hose_testing_locks').delete().eq('hose_id', hoseId).eq('department_id', ctx.department_id)
  }
  revalidatePath('/iso/hoses')
  revalidatePath('/iso/report')
  return { success: true }
}

export async function removeHose(hoseId: string) {
  const ctx = await getContext()
  if (!ctx || !ctx.isOfficerOrAbove || !ctx.department_id) return { error: 'Unauthorized' }
  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient
    .from('hoses')
    .update({ status: 'retired', updated_at: new Date().toISOString() })
    .eq('id', hoseId)
    .eq('department_id', ctx.department_id)
  if (dbErr) { await logError(dbErr, '/iso/hoses'); return { error: dbErr.message } }
  revalidatePath('/iso/hoses')
  return { success: true }
}

// ─── Remove Hydrant ───────────────────────────────────────────────────────────
export async function removeHydrant(hydrantId: string) {
  const ctx = await getContext()
  if (!ctx || !ctx.isOfficerOrAbove || !ctx.department_id) return { error: 'Unauthorized' }
  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient
    .from('hydrants')
    .update({ active: false })
    .eq('id', hydrantId)
    .eq('department_id', ctx.department_id)
  if (dbErr) { await logError(dbErr, '/iso/hydrants'); return { error: dbErr.message } }
  revalidatePath('/iso/hydrants')
  return { success: true }
}
