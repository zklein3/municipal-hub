import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import NewBoardClient from './NewBoardClient'

export default async function NewAccountabilityBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ incident_id?: string }>
}) {
  const { incident_id } = await searchParams

  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: meList } = await adminClient.from('personnel').select('id').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) redirect('/login')

  const { data: myDeptList } = await adminClient
    .from('department_personnel').select('department_id, system_role')
    .eq('personnel_id', me.id).eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept) redirect('/dashboard')

  const department_id = myDept.department_id

  // Recent incidents for optional linking
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const { data: recentIncidents } = await adminClient
    .from('incidents')
    .select('id, incident_number, incident_type, incident_date, address, city')
    .eq('department_id', department_id)
    .gte('incident_date', since.toISOString().split('T')[0])
    .order('incident_date', { ascending: false })
    .limit(30)

  // Pre-fill incident if coming from incident page
  let prefilledIncident: { id: string; label: string } | null = null
  if (incident_id) {
    const inc = (recentIncidents ?? []).find(i => i.id === incident_id)
    if (inc) {
      prefilledIncident = {
        id: inc.id,
        label: `${inc.incident_number}${inc.address ? ' · ' + inc.address : ''}`,
      }
    } else {
      // Outside the 30-day window — fetch directly
      const { data: incList } = await adminClient
        .from('incidents').select('id, incident_number, address')
        .eq('id', incident_id).eq('department_id', department_id)
      const inc2 = incList?.[0]
      if (inc2) prefilledIncident = { id: inc2.id, label: `${inc2.incident_number}${inc2.address ? ' · ' + inc2.address : ''}` }
    }
  }

  const incidentOptions = (recentIncidents ?? []).map(i => ({
    id: i.id,
    label: `${i.incident_number}${i.address ? ' · ' + i.address : ''}${i.city ? ', ' + i.city : ''}`,
  }))

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900">New Accountability Board</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Create a board for any incident, training, drill, or other event.</p>
      </div>
      <NewBoardClient
        incidentOptions={incidentOptions}
        prefilledIncident={prefilledIncident}
      />
    </div>
  )
}
