import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import RunReportClient from './RunReportClient'

export type RunReportRow = {
  id: string
  incident_date: string
  incident_number: string | null
  incident_type: string | null
  address: string | null
  city: string | null
  responder_count: number
  apparatus_count: number
}

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  fire:       'Fire',
  rescue:     'Rescue',
  standby:    'Standby',
  training:   'Training',
  meeting:    'Meeting',
  special:    'Special',
  mutual_aid: 'Mutual Aid',
}

export default async function RunReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; type?: string }>
}) {
  const { from, to, type } = await searchParams

  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: meList } = await adminClient.from('personnel').select('id, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) redirect('/login')

  const { data: myDeptList } = await adminClient
    .from('department_personnel').select('department_id, system_role').eq('personnel_id', me.id).eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept) redirect('/dashboard')
  if (myDept.system_role === 'member' && !me.is_sys_admin) redirect('/dashboard')

  const department_id = myDept.department_id

  const defaultTo = new Date()
  const defaultFrom = new Date()
  defaultFrom.setDate(defaultFrom.getDate() - 90)

  const dateFrom = from ?? defaultFrom.toISOString().split('T')[0]
  const dateTo   = to   ?? defaultTo.toISOString().split('T')[0]

  // Incidents in date range, optionally filtered by type
  let query = adminClient
    .from('incidents')
    .select('id, incident_date, incident_number, incident_type, address, city')
    .eq('department_id', department_id)
    .gte('incident_date', dateFrom)
    .lte('incident_date', dateTo)
    .order('incident_date', { ascending: false })

  if (type) query = query.eq('incident_type', type)

  const { data: incidentsRaw } = await query

  const incidentIds = (incidentsRaw ?? []).map(i => i.id)

  // Responder counts per incident
  const { data: personnelRows } = incidentIds.length > 0
    ? await adminClient.from('incident_personnel').select('incident_id').in('incident_id', incidentIds).neq('status', 'absent')
    : { data: [] }

  const responderCounts: Record<string, number> = {}
  for (const row of personnelRows ?? []) {
    responderCounts[row.incident_id] = (responderCounts[row.incident_id] ?? 0) + 1
  }

  // Apparatus counts per incident
  const { data: apparatusRows } = incidentIds.length > 0
    ? await adminClient.from('incident_apparatus').select('incident_id').in('incident_id', incidentIds)
    : { data: [] }

  const apparatusCounts: Record<string, number> = {}
  for (const row of apparatusRows ?? []) {
    apparatusCounts[row.incident_id] = (apparatusCounts[row.incident_id] ?? 0) + 1
  }

  const rows: RunReportRow[] = (incidentsRaw ?? []).map(i => ({
    id: i.id,
    incident_date: i.incident_date,
    incident_number: i.incident_number,
    incident_type: i.incident_type,
    address: i.address,
    city: i.city,
    responder_count: responderCounts[i.id] ?? 0,
    apparatus_count: apparatusCounts[i.id] ?? 0,
  }))

  // Incident types present in this dept for the type dropdown
  const { data: typeRows } = await adminClient
    .from('incidents')
    .select('incident_type')
    .eq('department_id', department_id)
    .not('incident_type', 'is', null)

  const availableTypes = [...new Set((typeRows ?? []).map(r => r.incident_type).filter(Boolean))]
    .sort()
    .map(t => ({ value: t!, label: INCIDENT_TYPE_LABELS[t!] ?? t! }))

  return (
    <RunReportClient
      rows={rows}
      dateFrom={dateFrom}
      dateTo={dateTo}
      selectedType={type ?? null}
      availableTypes={availableTypes}
    />
  )
}
