import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NerisAdminClient from './NerisAdminClient'

export default async function NerisAdminPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: meList } = await adminClient.from('personnel').select('id, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me?.is_sys_admin) redirect('/dashboard')

  // All NERIS-enabled departments
  const { data: depts } = await adminClient
    .from('departments')
    .select('id, name, neris_entity_id, module_neris')
    .eq('module_neris', true)
    .order('name')

  const deptIds = (depts ?? []).map(d => d.id)

  // Submission counts per dept + recent submission date
  const { data: nerisRecords } = deptIds.length > 0
    ? await adminClient
        .from('incident_neris')
        .select('id, incident_id, department_id, neris_status, neris_submission_id, neris_submitted_at, neris_last_error, completed_at, updated_at, neris_issue_dismissed')
        .in('department_id', deptIds)
        .order('updated_at', { ascending: false })
    : { data: [] }

  // Incidents for those neris records (for display)
  const incidentIds = (nerisRecords ?? []).map(r => r.incident_id).filter(Boolean)
  const { data: incidents } = incidentIds.length > 0
    ? await adminClient
        .from('incidents')
        .select('id, incident_number, incident_date, incident_type')
        .in('id', incidentIds)
    : { data: [] }

  const incidentMap = Object.fromEntries((incidents ?? []).map(i => [i.id, i]))
  const deptMap = Object.fromEntries((depts ?? []).map(d => [d.id, d]))

  // Per-dept submission stats
  const deptStats = (depts ?? []).map(dept => {
    const deptRecords = (nerisRecords ?? []).filter(r => r.department_id === dept.id)
    const submitted = deptRecords.filter(r => r.neris_status === 'submitted')
    const drafts = deptRecords.filter(r => r.neris_status === 'draft')
    const errors = deptRecords.filter(r => r.neris_status === 'error')
    const lastSubmitted = submitted.sort((a, b) =>
      new Date(b.neris_submitted_at ?? 0).getTime() - new Date(a.neris_submitted_at ?? 0).getTime()
    )[0]?.neris_submitted_at ?? null
    return {
      ...dept,
      submitted: submitted.length,
      drafts: drafts.length,
      errors: errors.length,
      lastSubmitted,
    }
  })

  // Issues: errors + ready-but-not-submitted (completed_at set, status = draft)
  const issues = (nerisRecords ?? [])
    .filter(r => r.neris_status === 'error' || (r.neris_status === 'draft' && r.completed_at))
    .map(r => ({
      ...r,
      incident: incidentMap[r.incident_id] ?? null,
      dept: deptMap[r.department_id] ?? null,
    }))

  // Recent NERIS error logs
  const { data: errorLogs } = await adminClient
    .from('system_logs')
    .select('id, created_at, log_type, page, message, metadata, department_id, resolved')
    .or('page.ilike.%neris%,message.ilike.%neris%')
    .order('created_at', { ascending: false })
    .limit(50)

  const logsWithDept = (errorLogs ?? []).map(log => ({
    ...log,
    dept_name: log.department_id ? (deptMap[log.department_id]?.name ?? 'Unknown Dept') : null,
  }))

  return (
    <NerisAdminClient
      deptStats={deptStats}
      issues={issues}
      errorLogs={logsWithDept}
    />
  )
}
