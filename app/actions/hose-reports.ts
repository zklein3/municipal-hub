'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { canManageHoses } from '@/lib/hose-pin'
import {
  buildHoseReport, buildSessionReport, listFinalizedSessions, todayInTimezone,
  type HoseReportData, type TestSessionReport, type TestSessionSummary,
} from '@/lib/hose-report'

// Reports for the no-login /hose-testing/[slug]/report page. Testing there is
// open, but this is department-wide data, so every call re-checks the same
// signed PIN unlock token that gates "Manage Hoses".

export type PublicHoseReport = {
  departmentName: string
  dateFrom: string
  dateTo: string
  data: HoseReportData
  sessions: TestSessionSummary[]
  sessionReport: TestSessionReport | null
}

export async function getPublicHoseReport(
  slug: string,
  pinToken: string | null,
  opts: { from?: string; to?: string; session?: string | null; withSessions?: boolean },
): Promise<PublicHoseReport | { error: string; locked?: boolean }> {
  const adminClient = createAdminClient()
  const { data: dept } = await adminClient
    .from('departments')
    .select('id, name, timezone, hose_testing_enabled')
    .eq('public_slug', slug)
    .maybeSingle()
  if (!dept || !dept.hose_testing_enabled) return { error: 'Hose testing is not currently enabled.' }
  if (!(await canManageHoses(dept.id, pinToken))) return { error: 'Enter the officer PIN to view reports.', locked: true }

  const today = todayInTimezone(dept.timezone)
  const dateFrom = opts.from ?? `${today.slice(0, 4)}-01-01`
  const dateTo = opts.to ?? today

  const [data, sessions, sessionReport] = await Promise.all([
    buildHoseReport(dept.id, dateFrom, dateTo),
    opts.withSessions ? listFinalizedSessions(dept.id) : Promise.resolve([]),
    opts.session ? buildSessionReport(dept.id, opts.session) : Promise.resolve(null),
  ])
  return { departmentName: dept.name, dateFrom, dateTo, data, sessions, sessionReport }
}
