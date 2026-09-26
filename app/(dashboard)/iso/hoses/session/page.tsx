import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentPath } from '@/lib/current-path'
import { redirect } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { hasPermission } from '@/lib/permissions'
import HoseTestSessionClient from './HoseTestSessionClient'

export default async function HoseTestSessionPage() {
  const adminClient = createAdminClient()

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (ctx.hasMultipleDepartments && !ctx.departmentId) redirect(`/select-department?next=${encodeURIComponent(await getCurrentPath())}`)
  if (!ctx.departmentId) redirect('/dashboard')

  const { data: deptFlags } = await adminClient.from('departments').select('module_iso').eq('id', ctx.departmentId).single()
  if (!deptFlags?.module_iso) redirect('/dashboard')

  if (!(await hasPermission(ctx, 'perform_iso_testing'))) redirect('/iso/hoses')

  const [{ data: hosesRaw }, { data: locksRaw }] = await Promise.all([
    adminClient
      .from('hoses')
      .select('id, hose_identifier, hose_type, diameter_in, length_ft, status')
      .eq('department_id', ctx.departmentId)
      .eq('status', 'in_service')
      .order('hose_identifier'),
    adminClient
      .from('hose_testing_locks')
      .select('id, hose_id, session_token, tester_name')
      .eq('department_id', ctx.departmentId),
  ])

  const testerName = `${ctx.firstName} ${ctx.lastName}`

  const { data: draftsRaw } = await adminClient
    .from('hose_test_sessions')
    .select('id, tester_name, test_date')
    .eq('department_id', ctx.departmentId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
  const draftIds = (draftsRaw ?? []).map(d => d.id)
  const { data: draftItems } = draftIds.length
    ? await adminClient.from('hose_test_session_items').select('session_id, result').in('session_id', draftIds)
    : { data: [] as { session_id: string; result: string }[] }
  const openDrafts = (draftsRaw ?? []).map(d => {
    const mine = (draftItems ?? []).filter(i => i.session_id === d.id)
    return {
      id: d.id,
      testerName: d.tester_name ?? '',
      testDate: d.test_date,
      hoseCount: mine.length,
      failedCount: mine.filter(i => i.result === 'fail').length,
    }
  })

  return (
    <HoseTestSessionClient
      hoses={hosesRaw ?? []}
      testerName={testerName}
      departmentId={ctx.departmentId}
      initialLocks={locksRaw ?? []}
      openDrafts={openDrafts}
    />
  )
}
