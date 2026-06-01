import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import EventsClient from './EventsClient'

export default async function EventsPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: meList } = await adminClient.from('personnel').select('id, first_name, last_name, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) redirect('/login')

  const { data: myDeptList } = await adminClient
    .from('department_personnel')
    .select('department_id, system_role')
    .eq('personnel_id', me.id)
    .eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept) redirect('/dashboard')

  const isOfficerOrAbove = myDept.system_role === 'admin' || myDept.system_role === 'officer' || me.is_sys_admin
  const department_id = myDept.department_id

  // Excuse types for the excuse request form
  const { data: excuseTypesRaw } = await adminClient
    .from('excuse_types')
    .select('id, excuse_name')
    .eq('department_id', department_id)
    .eq('active', true)
    .order('excuse_name')

  // Event instances: past 30 days + future 365 (special events) / 60 days (all others)
  const past30 = new Date()
  past30.setDate(past30.getDate() - 30)
  const future365 = new Date()
  future365.setDate(future365.getDate() + 365)
  const future60str = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: instances } = await adminClient
    .from('event_instances')
    .select('id, series_id, event_date, start_time, location, status, notes, requires_verification, requires_signature')
    .gte('event_date', past30.toISOString().split('T')[0])
    .lte('event_date', future365.toISOString().split('T')[0])
    .order('event_date', { ascending: true })

  // Series info — display fields + training flags
  const seriesIds = [...new Set((instances ?? []).map(i => i.series_id))]
  const { data: seriesData } = seriesIds.length > 0
    ? await adminClient
        .from('event_series')
        .select('id, title, event_type, department_id, recurrence_type, description, duration_minutes, is_training, training_hours')
        .in('id', seriesIds)
        .eq('department_id', department_id)
    : { data: [] }

  const deptSeriesIds = new Set((seriesData ?? []).map(s => s.id))
  const seriesMap = Object.fromEntries((seriesData ?? []).map(s => [s.id, s]))

  // Filter to this dept; trim non-special events to 60-day future window
  const deptInstances = (instances ?? []).filter(i => {
    if (!deptSeriesIds.has(i.series_id)) return false
    const isSpecial = seriesMap[i.series_id]?.event_type === 'special'
    if (!isSpecial && i.event_date > future60str) return false
    return true
  })

  const instanceIds = deptInstances.map(i => i.id)

  // My attendance
  const { data: myAttendance } = instanceIds.length > 0
    ? await adminClient
        .from('event_attendance')
        .select('id, instance_id, status, submitted_at')
        .eq('personnel_id', me.id)
        .in('instance_id', instanceIds)
    : { data: [] }

  const myAttendanceMap = Object.fromEntries((myAttendance ?? []).map(a => [a.instance_id, a]))

  // My pending signatures
  const { data: myPendingSigs } = instanceIds.length > 0
    ? await adminClient
        .from('event_attendance_signatures')
        .select('id, instance_id')
        .eq('personnel_id', me.id)
        .is('signed_at', null)
        .in('instance_id', instanceIds)
    : { data: [] }

  const pendingSigByInstance = Object.fromEntries((myPendingSigs ?? []).map(s => [s.instance_id, s.id]))

  const events = deptInstances.map(i => ({
    id: i.id,
    series_id: i.series_id,
    title: seriesMap[i.series_id]?.title ?? '—',
    event_type: seriesMap[i.series_id]?.event_type ?? 'meeting',
    description: seriesMap[i.series_id]?.description ?? null,
    duration_minutes: seriesMap[i.series_id]?.duration_minutes ?? null,
    is_training: seriesMap[i.series_id]?.is_training ?? false,
    training_hours: seriesMap[i.series_id]?.training_hours ?? null,
    event_date: i.event_date,
    start_time: i.start_time,
    location: i.location,
    status: i.status,
    notes: i.notes,
    requires_verification: i.requires_verification,
    pending_sig_id: pendingSigByInstance[i.id] ?? null,
    my_attendance: myAttendanceMap[i.id] ?? null,
  }))

  return (
    <EventsClient
      events={events}
      excuseTypes={(excuseTypesRaw ?? []).map(e => ({ id: e.id, name: e.excuse_name }))}
      myPersonnelId={me.id}
      myName={`${me.first_name} ${me.last_name}`}
      isOfficerOrAbove={isOfficerOrAbove}
    />
  )
}
