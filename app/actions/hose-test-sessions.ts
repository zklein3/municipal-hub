'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { hasPermission } from '@/lib/permissions'
import { logError } from '@/lib/logger'
import { revalidatePath } from 'next/cache'

// Draft ("pending") hose test sessions. A session is saved when the crew starts
// testing, with every hose pending; nothing touches hose_tests (and therefore
// no report or compliance count) until finalizeHoseTestSession runs. Same
// actions serve both entry points: slug = null is the logged-in officer
// session, a slug is the no-login /hose-testing/[slug] page.

type Access = {
  departmentId: string
  personnelId: string | null
  source: 'app' | 'public'
  defaultTesterName: string
}

async function resolveAccess(slug: string | null): Promise<Access | { error: string }> {
  if (slug === null) {
    const ctx = await getCurrentDepartmentContext()
    if (!ctx?.departmentId) return { error: 'Unauthorized' }
    if (!(await hasPermission(ctx, 'perform_iso_testing'))) return { error: 'Unauthorized' }
    return {
      departmentId: ctx.departmentId,
      personnelId: ctx.personnelId,
      source: 'app',
      defaultTesterName: `${ctx.firstName} ${ctx.lastName}`.trim(),
    }
  }
  const adminClient = createAdminClient()
  const { data: dept } = await adminClient
    .from('departments')
    .select('id, hose_testing_enabled')
    .eq('public_slug', slug)
    .maybeSingle()
  if (!dept || !dept.hose_testing_enabled) return { error: 'Hose testing is not currently enabled.' }
  return { departmentId: dept.id, personnelId: null, source: 'public', defaultTesterName: '' }
}

export type DraftItem = {
  hose_id: string
  result: 'pending' | 'pass' | 'fail'
  failure_reason: string
  retire_on_finalize: boolean
  hose_identifier: string
  diameter_in: number
  length_ft: number
  hose_type: string
}

export type OpenedSession = {
  id: string
  status: 'draft' | 'finalized' | 'abandoned'
  testerName: string
  testDate: string
  pressurePsi: number | null
  durationMin: number
  items: DraftItem[]
  conflictHoseIds: string[]
}

type Err = { error: string }

async function loadSession(
  access: Access,
  sessionId: string,
): Promise<{ session: any } | Err> {
  const adminClient = createAdminClient()
  const { data: session } = await adminClient
    .from('hose_test_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('department_id', access.departmentId)
    .maybeSingle()
  if (!session) return { error: 'Test session not found.' }
  return { session }
}

async function buildOpened(sessionId: string, session: any, conflictHoseIds: string[]): Promise<OpenedSession> {
  const adminClient = createAdminClient()
  const { data: items } = await adminClient
    .from('hose_test_session_items')
    .select('hose_id, result, failure_reason, retire_on_finalize')
    .eq('session_id', sessionId)
  const hoseIds = (items ?? []).map(i => i.hose_id)
  const { data: hoses } = hoseIds.length
    ? await adminClient.from('hoses').select('id, hose_identifier, diameter_in, length_ft, hose_type').in('id', hoseIds)
    : { data: [] as any[] }
  const hoseMap = Object.fromEntries((hoses ?? []).map(h => [h.id, h]))
  const rows: DraftItem[] = (items ?? [])
    .filter(i => hoseMap[i.hose_id])
    .map(i => ({
      hose_id: i.hose_id,
      result: i.result,
      failure_reason: i.failure_reason ?? '',
      retire_on_finalize: i.retire_on_finalize,
      hose_identifier: hoseMap[i.hose_id].hose_identifier,
      diameter_in: hoseMap[i.hose_id].diameter_in,
      length_ft: hoseMap[i.hose_id].length_ft,
      hose_type: hoseMap[i.hose_id].hose_type,
    }))
    .sort((a, b) => a.diameter_in - b.diameter_in || a.hose_identifier.localeCompare(b.hose_identifier, undefined, { numeric: true }))
  return {
    id: session.id,
    status: session.status,
    testerName: session.tester_name ?? '',
    testDate: session.test_date,
    pressurePsi: session.test_pressure_psi,
    durationMin: session.duration_min,
    items: rows,
    conflictHoseIds,
  }
}

export async function startHoseTestSession(
  slug: string | null,
  input: { testerName: string; testDate: string; pressurePsi: number; durationMin: number; hoseIds: string[]; lockToken: string },
): Promise<{ session: OpenedSession } | Err> {
  const access = await resolveAccess(slug)
  if ('error' in access) return access

  const testerName = (input.testerName || access.defaultTesterName).trim()
  if (!testerName) return { error: 'Tester name is required.' }
  if (!input.testDate) return { error: 'Test date is required.' }
  if (!input.pressurePsi || input.pressurePsi <= 0) return { error: 'Pressure is required.' }
  const hoseIds = [...new Set(input.hoseIds)]
  if (hoseIds.length === 0) return { error: 'Select at least one hose to test.' }

  const adminClient = createAdminClient()

  // Every hose must be this department's and in service.
  const { data: hoses } = await adminClient
    .from('hoses')
    .select('id')
    .eq('department_id', access.departmentId)
    .eq('status', 'in_service')
    .in('id', hoseIds)
  if ((hoses?.length ?? 0) !== hoseIds.length) return { error: 'One or more selected hoses are not in service for this department.' }

  // A hose can only be in one open test at a time, even for the same browser.
  const { data: openDrafts } = await adminClient
    .from('hose_test_sessions').select('id').eq('department_id', access.departmentId).eq('status', 'draft')
  const openIds = (openDrafts ?? []).map(d => d.id)
  if (openIds.length) {
    const { data: taken } = await adminClient
      .from('hose_test_session_items').select('hose_id').in('session_id', openIds).in('hose_id', hoseIds).limit(1)
    if (taken?.length) return { error: 'A selected hose is already in another open test. Finish or discard that test first.' }
  }

  const { data: locks } = await adminClient.from('hose_testing_locks').select('hose_id, session_token, tester_name').in('hose_id', hoseIds)
  const blocked = (locks ?? []).find(l => l.session_token !== input.lockToken)
  if (blocked) return { error: `A selected hose is already in a test by ${blocked.tester_name || 'another tester'}.` }

  const { data: session, error: sErr } = await adminClient
    .from('hose_test_sessions')
    .insert({
      department_id: access.departmentId,
      source: access.source,
      lock_token: input.lockToken,
      tester_name: testerName,
      tested_by: access.personnelId,
      test_date: input.testDate,
      test_pressure_psi: input.pressurePsi,
      duration_min: input.durationMin || 5,
    })
    .select('*')
    .single()
  if (sErr || !session) {
    await logError(sErr?.message ?? 'session insert failed', 'startHoseTestSession', { department_id: access.departmentId })
    return { error: sErr?.message ?? 'Could not start the test.' }
  }

  const { error: iErr } = await adminClient
    .from('hose_test_session_items')
    .insert(hoseIds.map(hose_id => ({ session_id: session.id, hose_id })))
  if (iErr) {
    await adminClient.from('hose_test_sessions').delete().eq('id', session.id)
    await logError(iErr.message, 'startHoseTestSession', { department_id: access.departmentId })
    return { error: iErr.message }
  }

  await adminClient.from('hose_testing_locks').upsert(
    hoseIds.map(hose_id => ({ department_id: access.departmentId, hose_id, session_token: input.lockToken, tester_name: testerName, created_at: new Date().toISOString() })),
    { onConflict: 'hose_id' },
  )

  return { session: await buildOpened(session.id, session, []) }
}

// Opens a draft and takes over its hose locks for this browser, so a draft
// started on one device (or an expired tab) can be picked up from another.
export async function openHoseTestSession(
  slug: string | null,
  sessionId: string,
  lockToken: string,
): Promise<{ session: OpenedSession } | Err> {
  const access = await resolveAccess(slug)
  if ('error' in access) return access
  const loaded = await loadSession(access, sessionId)
  if ('error' in loaded) return loaded
  const { session } = loaded

  const conflicts: string[] = []
  if (session.status === 'draft') {
    const adminClient = createAdminClient()
    const { data: items } = await adminClient.from('hose_test_session_items').select('hose_id').eq('session_id', sessionId)
    const hoseIds = (items ?? []).map(i => i.hose_id)
    const { data: locks } = hoseIds.length
      ? await adminClient.from('hose_testing_locks').select('hose_id, session_token').in('hose_id', hoseIds)
      : { data: [] as { hose_id: string; session_token: string }[] }
    const lockByHose = Object.fromEntries((locks ?? []).map(l => [l.hose_id, l.session_token]))
    const now = new Date().toISOString()
    const toWrite: string[] = []
    for (const id of hoseIds) {
      const holder = lockByHose[id]
      if (!holder || holder === session.lock_token || holder === lockToken) toWrite.push(id)
      else conflicts.push(id)
    }
    if (toWrite.length) {
      await adminClient.from('hose_testing_locks').upsert(
        toWrite.map(hose_id => ({ department_id: access.departmentId, hose_id, session_token: lockToken, tester_name: session.tester_name, created_at: now })),
        { onConflict: 'hose_id' },
      )
    }
    if (session.lock_token !== lockToken) {
      await adminClient.from('hose_test_sessions').update({ lock_token: lockToken }).eq('id', sessionId)
    }
  }
  return { session: await buildOpened(sessionId, session, conflicts) }
}

export async function saveHoseTestItem(
  slug: string | null,
  sessionId: string,
  hoseId: string,
  input: { result: 'pending' | 'fail'; failureReason: string; retire: boolean },
): Promise<{ success: true } | Err> {
  const access = await resolveAccess(slug)
  if ('error' in access) return access
  const loaded = await loadSession(access, sessionId)
  if ('error' in loaded) return loaded
  if (loaded.session.status !== 'draft') return { error: 'This test has already been finalized.' }

  const adminClient = createAdminClient()
  const isFail = input.result === 'fail'
  const { data: updated, error: dbErr } = await adminClient
    .from('hose_test_session_items')
    .update({
      result: input.result,
      failure_reason: isFail ? input.failureReason.trim() || null : null,
      retire_on_finalize: isFail ? input.retire : false,
      updated_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId)
    .eq('hose_id', hoseId)
    .select('id')
  if (dbErr) { await logError(dbErr.message, 'saveHoseTestItem', { department_id: access.departmentId }); return { error: dbErr.message } }
  if (!updated?.length) return { error: 'Hose is not part of this test.' }

  const now = new Date().toISOString()
  await adminClient.from('hose_test_sessions').update({ updated_at: now }).eq('id', sessionId)
  // Keep this test's locks from going stale during a long session.
  await adminClient.from('hose_testing_locks').update({ created_at: now }).eq('session_token', loaded.session.lock_token).eq('department_id', access.departmentId)
  return { success: true }
}

export async function saveHoseTestSessionParams(
  slug: string | null,
  sessionId: string,
  input: { testDate: string; pressurePsi: number; durationMin: number },
): Promise<{ success: true } | Err> {
  const access = await resolveAccess(slug)
  if ('error' in access) return access
  const loaded = await loadSession(access, sessionId)
  if ('error' in loaded) return loaded
  if (loaded.session.status !== 'draft') return { error: 'This test has already been finalized.' }
  if (!input.testDate) return { error: 'Test date is required.' }
  if (!input.pressurePsi || input.pressurePsi <= 0) return { error: 'Pressure is required.' }

  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient
    .from('hose_test_sessions')
    .update({ test_date: input.testDate, test_pressure_psi: input.pressurePsi, duration_min: input.durationMin || 5, updated_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (dbErr) return { error: dbErr.message }
  return { success: true }
}

export async function finalizeHoseTestSession(
  slug: string | null,
  sessionId: string,
): Promise<{ success: true; passed: number; failed: number; retired: number; passedHoseIds: string[]; failedHoseIds: string[]; retiredHoseIds: string[] } | Err> {
  const access = await resolveAccess(slug)
  if ('error' in access) return access
  const loaded = await loadSession(access, sessionId)
  if ('error' in loaded) return loaded
  const { session } = loaded
  if (session.status !== 'draft') return { error: 'This test has already been finalized.' }
  if (!session.test_pressure_psi || session.test_pressure_psi <= 0) return { error: 'Pressure is required.' }

  const adminClient = createAdminClient()
  const { data: items } = await adminClient
    .from('hose_test_session_items')
    .select('hose_id, result, failure_reason, retire_on_finalize')
    .eq('session_id', sessionId)
  if (!items?.length) return { error: 'No hoses in this test.' }

  const missingReason = items.filter(i => i.result === 'fail' && !i.failure_reason?.trim())
  if (missingReason.length) return { error: `Enter a failure note for every failed hose (${missingReason.length} missing).` }

  // Claim the finalize atomically so a double-tap or two devices can't log it twice.
  const { data: claimed } = await adminClient
    .from('hose_test_sessions')
    .update({ status: 'finalized', finalized_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('status', 'draft')
    .select('id')
  if (!claimed?.length) return { error: 'This test has already been finalized.' }

  const rows = items.map(i => ({
    hose_id: i.hose_id,
    department_id: access.departmentId,
    test_date: session.test_date,
    tested_by: session.tested_by,
    tested_by_name: session.tested_by ? null : session.tester_name,
    test_pressure_psi: session.test_pressure_psi,
    duration_min: session.duration_min,
    passed: i.result !== 'fail',
    failure_reason: i.result === 'fail' ? i.failure_reason : null,
    notes: null,
  }))
  const { error: insErr } = await adminClient.from('hose_tests').insert(rows)
  if (insErr) {
    await adminClient.from('hose_test_sessions').update({ status: 'draft', finalized_at: null }).eq('id', sessionId)
    await logError(insErr.message, 'finalizeHoseTestSession', { department_id: access.departmentId })
    return { error: insErr.message }
  }

  const failedIds = items.filter(i => i.result === 'fail').map(i => i.hose_id)
  const retireIds = items.filter(i => i.result === 'fail' && i.retire_on_finalize).map(i => i.hose_id)
  if (retireIds.length) {
    await adminClient
      .from('hoses')
      .update({ status: 'out_of_service', updated_at: new Date().toISOString() })
      .eq('department_id', access.departmentId)
      .in('id', retireIds)
  }
  await adminClient.from('hose_testing_locks').delete().eq('department_id', access.departmentId).in('hose_id', items.map(i => i.hose_id))

  revalidatePath('/iso/hoses')
  revalidatePath('/iso/report')
  if (slug) revalidatePath(`/hose-testing/${slug}`)
  const passedIds = items.filter(i => i.result !== 'fail').map(i => i.hose_id)
  return {
    success: true,
    passed: passedIds.length,
    failed: failedIds.length,
    retired: retireIds.length,
    passedHoseIds: passedIds,
    failedHoseIds: failedIds,
    retiredHoseIds: retireIds,
  }
}

export async function abandonHoseTestSession(slug: string | null, sessionId: string): Promise<{ success: true } | Err> {
  const access = await resolveAccess(slug)
  if ('error' in access) return access
  const loaded = await loadSession(access, sessionId)
  if ('error' in loaded) return loaded
  if (loaded.session.status !== 'draft') return { success: true }

  const adminClient = createAdminClient()
  const { data: items } = await adminClient.from('hose_test_session_items').select('hose_id').eq('session_id', sessionId)
  await adminClient.from('hose_test_sessions').update({ status: 'abandoned', updated_at: new Date().toISOString() }).eq('id', sessionId).eq('status', 'draft')
  const hoseIds = (items ?? []).map(i => i.hose_id)
  if (hoseIds.length) {
    await adminClient.from('hose_testing_locks').delete().eq('department_id', access.departmentId).in('hose_id', hoseIds)
  }
  return { success: true }
}
