import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import SignaturesClient from './SignaturesClient'

export default async function SignaturesPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: meList } = await adminClient
    .from('personnel')
    .select('id, first_name, last_name')
    .eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) redirect('/login')

  const { data: sigs } = await adminClient
    .from('incident_signatures')
    .select('id, incident_id, created_at')
    .eq('personnel_id', me.id)
    .is('signed_at', null)
    .order('created_at', { ascending: false })

  const pending = sigs ?? []

  let incidents: any[] = []
  if (pending.length > 0) {
    const incidentIds = pending.map(s => s.incident_id)
    const { data } = await adminClient
      .from('incidents')
      .select('id, incident_number, incident_date, incident_type, address, city, state')
      .in('id', incidentIds)
    incidents = data ?? []
  }

  const incidentMap = Object.fromEntries(incidents.map(i => [i.id, i]))

  const rows = pending.map(sig => ({
    sig_id: sig.id,
    incident_id: sig.incident_id,
    created_at: sig.created_at,
    incident: incidentMap[sig.incident_id] ?? null,
  }))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">Pending Signatures</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Sign to confirm you were on scene for these incidents</p>
      </div>
      <SignaturesClient
        rows={rows}
        memberName={`${me.first_name} ${me.last_name}`.trim()}
      />
    </div>
  )
}
