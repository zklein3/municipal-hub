import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentPath } from '@/lib/current-path'
import { redirect } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { hasPermission } from '@/lib/permissions'
import HoseTestingReportClient from './HoseTestingReportClient'

export type TotalHoseRow = {
  hose_identifier: string
  length_ft: number
  hose_type: string
  status: string
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
}
export type PassFailSizeGroup = {
  diameter_in: number
  failed: ResultRow[]
  passed: ResultRow[]
  notTested: ResultRow[]
}

const byIdentifier = (a: { hose_identifier: string }, b: { hose_identifier: string }) =>
  a.hose_identifier.localeCompare(b.hose_identifier, undefined, { numeric: true })

export default async function HoseTestingReportPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string; from?: string; to?: string }>
}) {
  const { report, from, to } = await searchParams
  const adminClient = createAdminClient()

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (ctx.hasMultipleDepartments && !ctx.departmentId) redirect(`/select-department?next=${encodeURIComponent(await getCurrentPath())}`)
  if (!ctx.departmentId) redirect('/dashboard')

  const { data: dept } = await adminClient.from('departments').select('name, module_iso').eq('id', ctx.departmentId).single()
  if (!dept?.module_iso) redirect('/dashboard')
  if (!(await hasPermission(ctx, 'perform_iso_testing'))) redirect('/dashboard')

  const today = new Date().toISOString().split('T')[0]
  const dateFrom = from ?? `${today.slice(0, 4)}-01-01`
  const dateTo = to ?? today

  const [{ data: hosesRaw }, { data: testsRaw }] = await Promise.all([
    adminClient
      .from('hoses')
      .select('id, hose_identifier, hose_type, diameter_in, length_ft, status')
      .eq('department_id', ctx.departmentId),
    adminClient
      .from('hose_tests')
      .select('hose_id, test_date, tested_by, tested_by_name, test_pressure_psi, passed, failure_reason')
      .eq('department_id', ctx.departmentId)
      .gte('test_date', dateFrom)
      .lte('test_date', dateTo)
      .order('test_date', { ascending: true }),
  ])

  const hoses = (hosesRaw ?? []).filter(h => h.status !== 'retired')
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

  const sizes = [...new Set(hoses.map(h => h.diameter_in))].sort((a, b) => a - b)

  const total: TotalSizeGroup[] = sizes.map(d => ({
    diameter_in: d,
    hoses: hoses
      .filter(h => h.diameter_in === d)
      .map(h => ({ hose_identifier: h.hose_identifier, length_ft: h.length_ft, hose_type: h.hose_type, status: h.status }))
      .sort(byIdentifier),
  }))

  const passFail: PassFailSizeGroup[] = sizes.map(d => {
    const group: PassFailSizeGroup = { diameter_in: d, failed: [], passed: [], notTested: [] }
    for (const h of hoses.filter(x => x.diameter_in === d)) {
      const l = latest[h.id]
      const row: ResultRow = {
        hose_identifier: h.hose_identifier,
        length_ft: h.length_ft,
        test_date: l?.test_date ?? null,
        test_pressure_psi: l?.test_pressure_psi ?? null,
        failure_reason: l && !l.passed ? l.failure_reason : null,
        tester: l ? (l.tested_by ? (testerMap[l.tested_by] ?? null) : (l.tested_by_name ?? null)) : null,
        retested: !!l?.passed && hadFailure.has(h.id),
      }
      if (!l) { if (h.status === 'in_service') group.notTested.push(row) }
      else if (l.passed) group.passed.push(row)
      else group.failed.push(row)
    }
    group.failed.sort(byIdentifier); group.passed.sort(byIdentifier); group.notTested.sort(byIdentifier)
    return group
  })

  return (
    <HoseTestingReportClient
      departmentName={dept.name}
      report={report === 'passfail' ? 'passfail' : 'total'}
      dateFrom={dateFrom}
      dateTo={dateTo}
      total={total}
      passFail={passFail}
    />
  )
}
