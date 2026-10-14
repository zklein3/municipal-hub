import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentPath } from '@/lib/current-path'
import { redirect } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { hasPermission } from '@/lib/permissions'
import { buildHoseReport, buildSessionReport, listFinalizedSessions, todayInTimezone } from '@/lib/hose-report'
import HoseTestingReportClient from './HoseTestingReportClient'

export default async function HoseTestingReportPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string; from?: string; to?: string; session?: string }>
}) {
  const { report, from, to, session } = await searchParams
  const adminClient = createAdminClient()

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (ctx.hasMultipleDepartments && !ctx.departmentId) redirect(`/select-department?next=${encodeURIComponent(await getCurrentPath())}`)
  if (!ctx.departmentId) redirect('/dashboard')

  const { data: dept } = await adminClient.from('departments').select('name, module_iso, timezone').eq('id', ctx.departmentId).single()
  if (!dept?.module_iso) redirect('/dashboard')
  if (!(await hasPermission(ctx, 'perform_iso_testing'))) redirect('/dashboard')

  const today = todayInTimezone(dept.timezone)
  const dateFrom = from ?? `${today.slice(0, 4)}-01-01`
  const dateTo = to ?? today

  const tab = report === 'passfail' ? 'passfail' : report === 'tests' ? 'tests' : 'total'

  const [data, sessions, sessionReport] = await Promise.all([
    buildHoseReport(ctx.departmentId, dateFrom, dateTo),
    tab === 'tests' ? listFinalizedSessions(ctx.departmentId) : Promise.resolve([]),
    tab === 'tests' && session ? buildSessionReport(ctx.departmentId, session) : Promise.resolve(null),
  ])

  return (
    <HoseTestingReportClient
      departmentName={dept.name}
      report={tab}
      dateFrom={dateFrom}
      dateTo={dateTo}
      data={data}
      sessions={sessions}
      sessionReport={sessionReport}
    />
  )
}
