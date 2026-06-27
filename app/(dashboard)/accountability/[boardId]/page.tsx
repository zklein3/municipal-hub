import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import AccountabilityBoard from '../AccountabilityBoard'
import BoardHeader from './BoardHeader'

export default async function AccountabilityBoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>
}) {
  const { boardId } = await params

  const adminClient = createAdminClient()

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (ctx.hasMultipleDepartments && !ctx.departmentId) redirect('/select-department')
  if (!ctx.departmentId) redirect('/dashboard')
  const me = { id: ctx.personnelId, first_name: ctx.firstName, last_name: ctx.lastName }

  const department_id = ctx.departmentId
  const isOfficerOrAbove = ctx.systemRole === 'admin' || ctx.systemRole === 'officer'

  const { data: board } = await adminClient
    .from('accountability_boards')
    .select('id, title, board_date, status, linked_incident_id, linked_training_event_id, linked_event_instance_id')
    .eq('id', boardId)
    .eq('department_id', department_id)
    .single()
  if (!board) notFound()

  // Linked incident label
  let linkedIncidentLabel: string | null = null
  let linkedIncidentId: string | null = board.linked_incident_id ?? null
  if (board.linked_incident_id) {
    const { data: incList } = await adminClient
      .from('incidents').select('incident_number').eq('id', board.linked_incident_id)
    linkedIncidentLabel = incList?.[0]?.incident_number ?? null
  }

  // Lanes + entries
  const { data: lanes } = await adminClient
    .from('accountability_lanes')
    .select('id, name, sort_order')
    .eq('board_id', boardId)
    .order('sort_order')

  const { data: entriesRaw } = await adminClient
    .from('accountability_entries')
    .select('id, lane_id, personnel_id, raw_name, raw_dept, status, checked_in_at')
    .eq('board_id', boardId)
    .order('checked_in_at')

  // Resolve personnel names
  const personnelIds = [...new Set((entriesRaw ?? []).map(e => e.personnel_id).filter(Boolean))] as string[]
  const { data: personnelRaw } = personnelIds.length > 0
    ? await adminClient.from('personnel').select('id, first_name, last_name').in('id', personnelIds)
    : { data: [] }
  const nameMap = Object.fromEntries((personnelRaw ?? []).map(p => [p.id, `${p.first_name} ${p.last_name}`]))

  const entries = (entriesRaw ?? []).map(e => ({
    ...e,
    display_name: e.personnel_id ? (nameMap[e.personnel_id] ?? '—') : (e.raw_name ?? '—'),
    display_dept: e.personnel_id ? '' : (e.raw_dept ?? ''),
  }))

  // Dept personnel list
  const { data: deptPersonnelRaw } = await adminClient
    .from('department_personnel')
    .select('personnel_id, personnel(id, first_name, last_name)')
    .eq('department_id', department_id)
    .eq('active', true)
  const deptPersonnel = (deptPersonnelRaw ?? [])
    .map(p => ({
      id: (p.personnel as any)?.id ?? p.personnel_id,
      name: [(p.personnel as any)?.first_name, (p.personnel as any)?.last_name].filter(Boolean).join(' '),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // QR tokens
  const { data: qrTokensRaw } = await adminClient
    .from('personnel_qr_tokens')
    .select('personnel_id, token_type, token_value')
    .in('personnel_id', deptPersonnel.map(p => p.id))
  const qrTokens = (qrTokensRaw ?? []).map(t => ({
    ...t,
    display_name: deptPersonnel.find(p => p.id === t.personnel_id)?.name ?? '—',
  }))

  // Recent incidents for link picker
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const { data: recentIncidents } = isOfficerOrAbove
    ? await adminClient
        .from('incidents')
        .select('id, incident_number, address')
        .eq('department_id', department_id)
        .gte('incident_date', since.toISOString().split('T')[0])
        .order('incident_date', { ascending: false })
        .limit(30)
    : { data: [] }

  const incidentOptions = (recentIncidents ?? []).map(i => ({
    id: i.id,
    label: `${i.incident_number}${i.address ? ' · ' + i.address : ''}`,
  }))

  return (
    <div className="max-w-2xl">
      <BoardHeader
        boardId={boardId}
        title={board.title}
        boardDate={board.board_date}
        status={board.status}
        linkedIncidentId={linkedIncidentId}
        linkedIncidentLabel={linkedIncidentLabel}
        isOfficerOrAbove={isOfficerOrAbove}
        incidentOptions={incidentOptions}
      />

      <AccountabilityBoard
        boardId={boardId}
        initialLanes={lanes ?? []}
        initialEntries={entries}
        qrTokens={qrTokens}
        deptPersonnel={deptPersonnel}
        isOfficerOrAbove={isOfficerOrAbove}
      />
    </div>
  )
}
