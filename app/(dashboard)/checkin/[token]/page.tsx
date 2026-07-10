import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { verifyCheckinToken } from '@/lib/checkin-token'
import CheckinClient from './CheckinClient'

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="max-w-md mx-auto mt-10 sm:mt-20 px-4">
      <div className="rounded-xl bg-white border border-zinc-200 shadow-sm p-6 text-center">
        <p className="text-sm text-zinc-600">{message}</p>
      </div>
    </div>
  )
}

function formatEventDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export default async function CheckinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const payload = verifyCheckinToken(token)
  if (!payload) return <ErrorCard message="This check-in link is invalid or has expired." />

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const nextUrl = `/checkin/${token}`
  if (!user) redirect(`/login?next=${encodeURIComponent(nextUrl)}`)

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect(`/login?next=${encodeURIComponent(nextUrl)}`)
  if (ctx.hasMultipleDepartments && !ctx.departmentId) redirect(`/select-department?next=${encodeURIComponent(nextUrl)}`)
  if (!ctx.departmentId) return <ErrorCard message="You don't have an active department to check in with." />

  const adminClient = createAdminClient()

  let title = ''
  let subtitle = ''
  let alreadyLogged = false

  if (payload.type === 'event_instance') {
    const { data: instance } = await adminClient
      .from('event_instances')
      .select('id, event_date, series_id')
      .eq('id', payload.id)
      .single()
    if (!instance) return <ErrorCard message="This event no longer exists." />

    const { data: series } = await adminClient
      .from('event_series')
      .select('title, department_id')
      .eq('id', instance.series_id)
      .single()
    if (!series || series.department_id !== ctx.departmentId) return <ErrorCard message="This event isn't part of your department." />

    title = series.title
    subtitle = formatEventDate(instance.event_date)

    const { data: existing } = await adminClient
      .from('event_attendance')
      .select('id')
      .eq('instance_id', payload.id)
      .eq('personnel_id', ctx.personnelId)
      .single()
    alreadyLogged = !!existing
  } else if (payload.type === 'training_event') {
    const { data: evt } = await adminClient
      .from('training_events')
      .select('topic, event_date, department_id')
      .eq('id', payload.id)
      .single()
    if (!evt || evt.department_id !== ctx.departmentId) return <ErrorCard message="This training event isn't part of your department." />

    title = evt.topic
    subtitle = formatEventDate(evt.event_date)

    const { data: existing } = await adminClient
      .from('training_event_attendance')
      .select('id')
      .eq('event_id', payload.id)
      .eq('personnel_id', ctx.personnelId)
      .single()
    alreadyLogged = !!existing
  } else {
    const { data: incident } = await adminClient
      .from('incidents')
      .select('incident_number, incident_type, address, department_id')
      .eq('id', payload.id)
      .single()
    if (!incident || incident.department_id !== ctx.departmentId) return <ErrorCard message="This incident isn't part of your department." />

    title = incident.incident_number ? `Incident ${incident.incident_number}` : 'Incident'
    subtitle = [incident.incident_type, incident.address].filter(Boolean).join(' — ')

    const { data: existing } = await adminClient
      .from('incident_personnel')
      .select('id')
      .eq('incident_id', payload.id)
      .eq('personnel_id', ctx.personnelId)
      .single()
    alreadyLogged = !!existing
  }

  return (
    <CheckinClient
      type={payload.type}
      id={payload.id}
      personnelId={ctx.personnelId}
      title={title}
      subtitle={subtitle}
      memberName={`${ctx.firstName} ${ctx.lastName}`}
      alreadyLogged={alreadyLogged}
    />
  )
}
