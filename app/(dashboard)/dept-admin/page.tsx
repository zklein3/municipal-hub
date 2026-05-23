import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import HubCard from '@/components/HubCard'

export default async function DeptAdminPage() {
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

  const departmentId = myDept.department_id

  const [
    { data: deptFlags },
    { count: activeMemberCount },
    { count: pendingSetupCount },
  ] = await Promise.all([
    adminClient.from('departments')
      .select('module_iso, module_neris, public_site_enabled')
      .eq('id', departmentId)
      .single(),
    adminClient.from('department_personnel')
      .select('id', { count: 'exact', head: true })
      .eq('department_id', departmentId)
      .eq('active', true),
    adminClient.from('department_personnel')
      .select('id', { count: 'exact', head: true })
      .eq('department_id', departmentId)
      .in('signup_status', ['temp_password', 'profile_setup']),
  ])

  const moduleIso = (deptFlags as any)?.module_iso ?? false
  const moduleNeris = (deptFlags as any)?.module_neris ?? false
  const publicSiteEnabled = (deptFlags as any)?.public_site_enabled ?? false
  const hasPendingSetup = (pendingSetupCount ?? 0) > 0

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">Dept Admin</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Department configuration and management</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <HubCard
          title="Personnel"
          description="Manage members, roles, and account setup"
          href="/dept-admin/personnel"
          stat={activeMemberCount ?? undefined}
          statLabel={hasPendingSetup ? `${pendingSetupCount} pending setup` : 'Active Members'}
          alert={hasPendingSetup}
        />
        <HubCard
          title="Training & Certs"
          description="Certification types, courses, and training setup"
          href="/dept-admin/training"
        />
        <HubCard
          title="Equipment Setup"
          description="Item types, categories, and dept configuration"
          href="/dept-admin/setup"
        />
        {moduleIso && (
          <HubCard
            title="ISO"
            description="Hose inventory, hydrants, mutual aid, and ISO report"
            href="/iso"
          />
        )}
        {moduleNeris && (
          <HubCard
            title="NERIS Settings"
            description="Incident reporting configuration"
            href="/dept-admin/neris"
          />
        )}
        {publicSiteEnabled && (
          <HubCard
            title="Public Site"
            description="Burn permits and public records inbox"
            href="/dept-admin/public-inbox"
          />
        )}
      </div>

      {/* NERIS promo — shown only when module is not yet enabled */}
      {!moduleNeris && (
        <div className="mt-8 rounded-2xl bg-zinc-950 border border-zinc-800 px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <Image
            src="/NERIS_Data_Exchange_Compatible__SealV1.png"
            alt="NERIS V1 Data Exchange Compatible"
            width={72}
            height={72}
            className="shrink-0 rounded-full"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-red-500 mb-1">Available for Your Department</p>
            <h2 className="text-base font-bold text-white mb-1">Submit Incidents Directly to NERIS</h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              FireOps7 is NERIS V1 Data Exchange Compatible — your department can submit incident reports directly
              to the National Emergency Response Information System without leaving FireOps7.
              Contact us to enable NERIS integration for your department.
            </p>
            <p className="text-xs text-zinc-600 mt-2">
              The NERIS V1 badge indicates technical compatibility only and does not imply endorsement by NERIS or FSRI.
            </p>
          </div>
          <a
            href="mailto:zklein3@gmail.com?subject=NERIS Integration Request"
            className="shrink-0 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition-colors whitespace-nowrap"
          >
            Contact Us
          </a>
        </div>
      )}
    </div>
  )
}
