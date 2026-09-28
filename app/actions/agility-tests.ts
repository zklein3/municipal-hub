'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { hasPermission } from '@/lib/permissions'
import { prepareSlug } from '@/lib/public-slug'
import { canAdministerAgilityTest } from '@/lib/agility-pin'
import { FREMONT_AGILITY_TEST, evaluateEvolution, type AgilityEvolutionSpec } from '@/lib/agility-test-spec'
import { logError } from '@/lib/logger'
import { revalidatePath } from 'next/cache'

// Non-user access point for Fremont's Physical Agility Test — no login
// required, same idiom as app/actions/hose-testing.ts. Scoped per-department
// via a slug in the URL (/agility-test/[slug]), reusing departments.public_slug.
// Unlike hose testing, the whole page (not just roster edits) is PIN-gated —
// see lib/agility-pin.ts for why.

async function resolveDeptBySlug(slug: string) {
  const adminClient = createAdminClient()
  const { data: dept } = await adminClient
    .from('departments')
    .select('id, name, agility_test_enabled')
    .eq('public_slug', slug)
    .maybeSingle()
  return dept
}

export async function getPublicAgilityTestContext(slug: string) {
  const dept = await resolveDeptBySlug(slug)
  if (!dept || !dept.agility_test_enabled) return { enabled: false, departmentName: null, departmentId: null }
  return { enabled: true, departmentName: dept.name, departmentId: dept.id, evolutions: FREMONT_AGILITY_TEST }
}

export async function searchAgilityTestPersonnel(slug: string, pinToken: string | null | undefined, query: string) {
  const dept = await resolveDeptBySlug(slug)
  if (!dept || !dept.agility_test_enabled) return []
  if (!(await canAdministerAgilityTest(dept.id, pinToken))) return []

  const adminClient = createAdminClient()
  const { data: rows } = await adminClient
    .from('department_personnel')
    .select('personnel_id')
    .eq('department_id', dept.id)
    .eq('active', true)

  const ids = (rows ?? []).map(r => r.personnel_id)
  if (ids.length === 0) return []

  const { data: people } = await adminClient
    .from('personnel')
    .select('id, first_name, last_name')
    .in('id', ids)
    .order('last_name')

  const q = query.trim().toLowerCase()
  return (people ?? [])
    .map(p => ({ id: p.id, name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() }))
    .filter(p => !q || p.name.toLowerCase().includes(q))
}

type EvolutionSubmission = {
  number: number
  timeSeconds: number
  subCheckValues: Record<string, boolean | number>
}

export async function submitAgilityTest(
  slug: string,
  pinToken: string | null | undefined,
  payload: {
    subjectType: 'candidate' | 'employee'
    personnelId?: string | null
    candidateName: string
    testDate: string
    administeredByName: string
    notes?: string
    evolutions: EvolutionSubmission[]
  },
): Promise<{ testId: string; overallResult: 'pass' | 'fail' } | { error: string }> {
  const dept = await resolveDeptBySlug(slug)
  if (!dept || !dept.agility_test_enabled) return { error: 'Physical agility testing is not currently enabled.' }
  if (!(await canAdministerAgilityTest(dept.id, pinToken))) return { error: 'PIN required.' }

  const name = payload.candidateName.trim()
  if (!name) return { error: 'Name is required.' }
  if (!payload.administeredByName.trim()) return { error: 'Administered-by name is required.' }
  if (!payload.testDate) return { error: 'Test date is required.' }
  if (payload.evolutions.length === 0) return { error: 'At least one evolution is required.' }
  if (payload.subjectType === 'employee' && !payload.personnelId) return { error: 'Select an employee.' }

  const specByNumber: Record<number, AgilityEvolutionSpec> = Object.fromEntries(FREMONT_AGILITY_TEST.map(e => [e.number, e]))

  const evolutionRows: {
    evolution_number: number
    evolution_name: string
    time_seconds: number
    cutoff_seconds: number
    result: 'pass' | 'fail'
    sub_checks: Record<string, boolean | number> | null
  }[] = []

  let overallResult: 'pass' | 'fail' = 'pass'
  let stoppedAt: number | null = null

  for (const ev of payload.evolutions) {
    const spec = specByNumber[ev.number]
    if (!spec) return { error: `Unknown evolution ${ev.number}.` }
    const result = evaluateEvolution(spec, ev.timeSeconds, ev.subCheckValues)
    evolutionRows.push({
      evolution_number: spec.number,
      evolution_name: spec.name,
      time_seconds: ev.timeSeconds,
      cutoff_seconds: spec.cutoffSeconds,
      result,
      sub_checks: Object.keys(ev.subCheckValues).length > 0 ? ev.subCheckValues : null,
    })
    if (result === 'fail') {
      overallResult = 'fail'
      stoppedAt = spec.number
      break // sheet: failing any evolution ends the test, candidate doesn't proceed further
    }
  }

  const adminClient = createAdminClient()

  // Employee subject: verify the picked personnel actually belongs to this department.
  if (payload.subjectType === 'employee' && payload.personnelId) {
    const { data: deptPersonnel } = await adminClient
      .from('department_personnel')
      .select('id')
      .eq('department_id', dept.id)
      .eq('personnel_id', payload.personnelId)
      .eq('active', true)
      .maybeSingle()
    if (!deptPersonnel) return { error: 'Selected employee is not active in this department.' }
  }

  const { data: test, error: testErr } = await adminClient
    .from('physical_agility_tests')
    .insert({
      department_id: dept.id,
      subject_type: payload.subjectType,
      personnel_id: payload.subjectType === 'employee' ? payload.personnelId : null,
      candidate_name: name,
      test_date: payload.testDate,
      administered_by_name: payload.administeredByName.trim(),
      overall_result: overallResult,
      stopped_at_evolution: stoppedAt,
      notes: payload.notes?.trim() || null,
    })
    .select('id')
    .single()

  if (testErr || !test) {
    await logError(testErr?.message ?? 'Failed to create agility test', `/agility-test/${slug}`, { department_id: dept.id })
    return { error: testErr?.message ?? 'Failed to save test.' }
  }

  const { error: evoErr } = await adminClient
    .from('physical_agility_test_evolutions')
    .insert(evolutionRows.map(r => ({ ...r, test_id: test.id })))

  if (evoErr) {
    await logError(evoErr.message, `/agility-test/${slug}`, { department_id: dept.id, metadata: { test_id: test.id } })
    return { error: evoErr.message }
  }

  if (payload.subjectType === 'employee' && payload.personnelId) {
    revalidatePath(`/personnel/${payload.personnelId}`)
  }

  return { testId: test.id, overallResult }
}

// ─── Public print page — keyed by the test's own unguessable id, same
// security model as other one-off print links in this app (e.g. /print/qr).
// No login: candidates who took the test have no account, and the officer
// handing the printout to Chief/HR may already have closed the PIN session.
export async function getAgilityTestForPrint(testId: string) {
  const adminClient = createAdminClient()
  const { data: test } = await adminClient
    .from('physical_agility_tests')
    .select('id, department_id, subject_type, candidate_name, test_date, administered_by_name, overall_result, stopped_at_evolution, notes')
    .eq('id', testId)
    .maybeSingle()
  if (!test) return null

  const { data: dept } = await adminClient
    .from('departments')
    .select('name, agility_test_enabled')
    .eq('id', test.department_id)
    .maybeSingle()
  if (!dept?.agility_test_enabled) return null

  const { data: evolutions } = await adminClient
    .from('physical_agility_test_evolutions')
    .select('evolution_number, evolution_name, time_seconds, cutoff_seconds, result, sub_checks')
    .eq('test_id', testId)
    .order('evolution_number')

  return { test, departmentName: dept.name, evolutions: evolutions ?? [] }
}

// ─── Personnel Profile — full history for a current employee ───────────────
export async function listAgilityTestsForPersonnel(personnelId: string) {
  const ctx = await getCurrentDepartmentContext()
  if (!ctx?.departmentId) return []

  const adminClient = createAdminClient()
  const { data: tests } = await adminClient
    .from('physical_agility_tests')
    .select('id, test_date, overall_result, administered_by_name, stopped_at_evolution, notes')
    .eq('department_id', ctx.departmentId)
    .eq('personnel_id', personnelId)
    .order('test_date', { ascending: false })

  if (!tests || tests.length === 0) return []

  const testIds = tests.map(t => t.id)
  const { data: evolutions } = await adminClient
    .from('physical_agility_test_evolutions')
    .select('test_id, evolution_number, evolution_name, time_seconds, cutoff_seconds, result')
    .in('test_id', testIds)
    .order('evolution_number')

  const evoByTest: Record<string, typeof evolutions> = {}
  for (const e of evolutions ?? []) {
    if (!evoByTest[e.test_id]) evoByTest[e.test_id] = []
    evoByTest[e.test_id]!.push(e)
  }

  return tests.map(t => ({ ...t, evolutions: evoByTest[t.id] ?? [] }))
}

// ─── Dept Admin: self-service enable/configure ─────────────────────────────

export async function getAgilityTestConfig() {
  const ctx = await getCurrentDepartmentContext()
  if (!ctx?.departmentId) return null
  if (!(await hasPermission(ctx, 'manage_department_settings'))) return null

  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('departments')
    .select('agility_test_enabled, public_slug')
    .eq('id', ctx.departmentId)
    .single()

  return data
}

export async function setAgilityTestConfig(
  enabled: boolean,
  slug: string | null,
): Promise<{ error?: string; suggestion?: string; success?: boolean; slug?: string | null }> {
  const ctx = await getCurrentDepartmentContext()
  if (!ctx) return { error: 'Not authenticated.' }
  if (!(await hasPermission(ctx, 'manage_department_settings'))) return { error: 'Only admins can update department settings.' }
  if (!ctx.departmentId) return { error: 'No department selected.' }

  const adminClient = createAdminClient()

  const { data: current } = await adminClient
    .from('departments')
    .select('public_slug')
    .eq('id', ctx.departmentId)
    .single()

  // A slug is required to enable, but an existing one is never overwritten
  // here — printed QR codes and shared links depend on it staying put.
  let newSlug: string | undefined
  if (!current?.public_slug && slug?.trim()) {
    const prepared = await prepareSlug(adminClient, slug, ctx.departmentId)
    if ('error' in prepared) return prepared
    newSlug = prepared.slug
  }
  if (enabled && !current?.public_slug && !newSlug) {
    return { error: 'A URL slug is required to enable public agility testing.' }
  }

  const update: { agility_test_enabled: boolean; public_slug?: string } = { agility_test_enabled: enabled }
  if (newSlug) update.public_slug = newSlug

  const { error: dbErr } = await adminClient
    .from('departments')
    .update(update)
    .eq('id', ctx.departmentId)

  if (dbErr) {
    if (dbErr.code === '23505') return { error: 'That slug is already in use by another department.' }
    await logError(dbErr.message, '/dept-admin/settings', { department_id: ctx.departmentId })
    return { error: dbErr.message }
  }

  revalidatePath('/dept-admin/settings')
  return { success: true, slug: update.public_slug ?? current?.public_slug ?? null }
}
