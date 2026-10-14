import { createAdminClient } from '@/lib/supabase/admin'

// Shared by the dashboard report (/reports/hose-testing) and the PIN-gated
// public page (/hose-testing/[slug]/report), so both always show the same numbers.

export type TotalHoseRow = {
  hose_identifier: string
  length_ft: number
  hose_type: string
  status: string
  attention: boolean
}
export type TotalSizeGroup = { diameter_in: number; hoses: TotalHoseRow[] }

export type ResultRow = {
  hose_identifier: string
  length_ft: number
  test_date: string | null
  test_pressure_psi: number | null
  failure_reason: string | null
  tester: string | null
  retested: boolean
  status: string
  attention: boolean
}
export type PassFailSizeGroup = {
  diameter_in: number
  failed: ResultRow[]
  passed: ResultRow[]
  notTested: ResultRow[]
}

export type HoseReportData = { total: TotalSizeGroup[]; passFail: PassFailSizeGroup[] }

export type TestSessionSummary = {
  id: string
  testerName: string
  testDate: string
  pressurePsi: number | null
  hoseCount: number
  failedCount: number
}

export type TestSessionReport = {
  id: string
  testerName: string
  testDate: string
  pressurePsi: number | null
  durationMin: number | null
  hoses: { hose_identifier: string; diameter_in: number; length_ft: number; passed: boolean; failure_reason: string | null; retired: boolean }[]
}

const byIdentifier = (a: { hose_identifier: string }, b: { hose_identifier: string }) =>
  a.hose_identifier.localeCompare(b.hose_identifier, undefined, { numeric: true })

// Calendar date in the department's own timezone. `new Date().toISOString()`
// converts to UTC first, which rolls the date to "tomorrow" in the evening.
export function todayInTimezone(tz: string | null | undefined): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  } catch {
    return new Date().toISOString().split('T')[0]
  }
}

export async function buildHoseReport(departmentId: string, dateFrom: string, dateTo: string): Promise<HoseReportData> {
  const adminClient = createAdminClient()
  const [{ data: hosesRaw }, { data: testsRaw }] = await Promise.all([
    adminClient
      .from('hoses')
      .select('id, hose_identifier, hose_type, diameter_in, length_ft, status')
      .eq('department_id', departmentId),
    adminClient
      .from('hose_tests')
      .select('hose_id, test_date, tested_by, tested_by_name, test_pressure_psi, passed, failure_reason')
      .eq('department_id', departmentId)
      .gte('test_date', dateFrom)
      .lte('test_date', dateTo)
      .order('test_date', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  // Retired hose is kept so the report view can offer a Retired filter for history.
  const hoses = hosesRaw ?? []
  const tests = testsRaw ?? []

  const testerIds = [...new Set(tests.map(t => t.tested_by).filter(Boolean))] as string[]
  const { data: testersRaw } = testerIds.length > 0
    ? await adminClient.from('personnel').select('id, first_name, last_name').in('id', testerIds)
    : { data: [] as { id: string; first_name: string; last_name: string }[] }
  const testerMap = Object.fromEntries((testersRaw ?? []).map(p => [p.id, `${p.first_name} ${p.last_name}`.trim()]))

  // A hose's result is its most recent test in range, so fail-then-passing-retest lands in Passed.
  const latest: Record<string, (typeof tests)[number]> = {}
  const hadFailure = new Set<string>()
  for (const t of tests) {
    latest[t.hose_id] = t
    if (!t.passed) hadFailure.add(t.hose_id)
  }

  const sizes = [...new Set(hoses.map(h => Number(h.diameter_in)))].sort((a, b) => a - b)
  // Same idea as the Dept Admin list: out of service, or in service with a failing latest test.
  const attention = (h: (typeof hoses)[number]) =>
    h.status === 'out_of_service' || (h.status === 'in_service' && !!latest[h.id] && !latest[h.id].passed)

  const total: TotalSizeGroup[] = sizes.map(d => ({
    diameter_in: d,
    hoses: hoses
      .filter(h => Number(h.diameter_in) === d)
      .map(h => ({ hose_identifier: h.hose_identifier, length_ft: h.length_ft, hose_type: h.hose_type, status: h.status, attention: attention(h) }))
      .sort(byIdentifier),
  }))

  const passFail: PassFailSizeGroup[] = sizes.map(d => {
    const group: PassFailSizeGroup = { diameter_in: d, failed: [], passed: [], notTested: [] }
    for (const h of hoses.filter(x => Number(x.diameter_in) === d)) {
      const l = latest[h.id]
      const row: ResultRow = {
        hose_identifier: h.hose_identifier,
        length_ft: h.length_ft,
        test_date: l?.test_date ?? null,
        test_pressure_psi: l?.test_pressure_psi ?? null,
        failure_reason: l && !l.passed ? l.failure_reason : null,
        tester: l ? (l.tested_by ? (testerMap[l.tested_by] ?? null) : (l.tested_by_name ?? null)) : null,
        retested: !!l?.passed && hadFailure.has(h.id),
        status: h.status,
        attention: attention(h),
      }
      if (!l) { if (h.status === 'in_service') group.notTested.push(row) }
      else if (l.passed) group.passed.push(row)
      else group.failed.push(row)
    }
    group.failed.sort(byIdentifier); group.passed.sort(byIdentifier); group.notTested.sort(byIdentifier)
    return group
  })

  return { total, passFail }
}

// Finalized test sessions, newest first. A finalized session's non-failed hoses
// still read 'pending' in the items table; finalizing records anything not
// marked fail as a pass, so that is the rule used here too.
export async function listFinalizedSessions(departmentId: string): Promise<TestSessionSummary[]> {
  const adminClient = createAdminClient()
  const { data: sessions } = await adminClient
    .from('hose_test_sessions')
    .select('id, tester_name, test_date, test_pressure_psi')
    .eq('department_id', departmentId)
    .eq('status', 'finalized')
    .order('test_date', { ascending: false })
    .order('finalized_at', { ascending: false })
    .limit(100)
  const ids = (sessions ?? []).map(s => s.id)
  if (!ids.length) return []
  const { data: items } = await adminClient.from('hose_test_session_items').select('session_id, result').in('session_id', ids)
  return (sessions ?? []).map(s => {
    const mine = (items ?? []).filter(i => i.session_id === s.id)
    return {
      id: s.id,
      testerName: s.tester_name ?? '',
      testDate: s.test_date,
      pressurePsi: s.test_pressure_psi,
      hoseCount: mine.length,
      failedCount: mine.filter(i => i.result === 'fail').length,
    }
  })
}

export async function buildSessionReport(departmentId: string, sessionId: string): Promise<TestSessionReport | null> {
  const adminClient = createAdminClient()
  const { data: s } = await adminClient
    .from('hose_test_sessions')
    .select('id, tester_name, test_date, test_pressure_psi, duration_min, status')
    .eq('id', sessionId)
    .eq('department_id', departmentId)
    .maybeSingle()
  if (!s || s.status !== 'finalized') return null

  const { data: items } = await adminClient
    .from('hose_test_session_items')
    .select('hose_id, result, failure_reason, retire_on_finalize')
    .eq('session_id', sessionId)
  const hoseIds = (items ?? []).map(i => i.hose_id)
  const { data: hoses } = hoseIds.length
    ? await adminClient.from('hoses').select('id, hose_identifier, diameter_in, length_ft').in('id', hoseIds)
    : { data: [] as { id: string; hose_identifier: string; diameter_in: number; length_ft: number }[] }
  const hoseMap = Object.fromEntries((hoses ?? []).map(h => [h.id, h]))

  return {
    id: s.id,
    testerName: s.tester_name ?? '',
    testDate: s.test_date,
    pressurePsi: s.test_pressure_psi,
    durationMin: s.duration_min,
    hoses: (items ?? [])
      .filter(i => hoseMap[i.hose_id])
      .map(i => ({
        hose_identifier: hoseMap[i.hose_id].hose_identifier,
        diameter_in: Number(hoseMap[i.hose_id].diameter_in),
        length_ft: hoseMap[i.hose_id].length_ft,
        passed: i.result !== 'fail',
        failure_reason: i.result === 'fail' ? i.failure_reason : null,
        retired: i.result === 'fail' && !!i.retire_on_finalize,
      }))
      .sort(byIdentifier),
  }
}
