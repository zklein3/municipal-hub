import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import HubCard from '@/components/HubCard'

export default async function IsoHubPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: meList } = await adminClient.from('personnel').select('id, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) redirect('/login')

  const { data: myDeptList } = await adminClient
    .from('department_personnel')
    .select('department_id, system_role')
    .eq('personnel_id', me.id)
    .eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept || myDept.system_role !== 'admin') redirect('/dashboard')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">ISO</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Insurance Services Office compliance tools</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <HubCard
          title="Hose Inventory"
          description="Hose sections, pressure testing, and NFPA 1962 compliance"
          href="/iso/hoses"
        />
        <HubCard
          title="Hydrants"
          description="Hydrant locations and flow test records"
          href="/iso/hydrants"
        />
        <HubCard
          title="Mutual Aid"
          description="Inter-department mutual aid agreements"
          href="/iso/mutual-aid"
        />
        <HubCard
          title="Pre-Fire Plans"
          description="Structure pre-fire plans and occupancy surveys"
          href="/iso/preplans"
        />
        <HubCard
          title="ISO Report"
          description="Compiled ISO audit report for all sections"
          href="/iso/report"
        />
      </div>
    </div>
  )
}
