import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/actions/auth'
import FeedbackButton from '@/components/FeedbackButton'
import MobileSidebar from '@/components/MobileSidebar'
import NavGroups from '@/components/NavGroups'
import type { NavGroup } from '@/components/NavGroups'

async function getUserContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const adminClient = createAdminClient()
  const { data: meList } = await adminClient.from('personnel').select('id, first_name, last_name, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) return null
  const { data: deptList } = await adminClient
    .from('department_personnel')
    .select('system_role, department_id, departments(name)')
    .eq('personnel_id', me.id)
    .eq('active', true)
  const dept = deptList?.[0]
  return {
    ...me,
    personnelId: me.id,
    system_role: dept?.system_role ?? null,
    department_name: (dept?.departments as any)?.name ?? null,
    department_id: dept?.department_id ?? null,
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserContext()
  const isSysAdmin = user?.is_sys_admin ?? false
  const systemRole = user?.system_role ?? null
  const isDeptAdmin = systemRole === 'admin'
  const isOfficerOrAbove = isDeptAdmin || systemRole === 'officer'

  // Nav badge counts
  let announcementUnreadCount = 0
  let inboxPendingCount = 0
  if (!isSysAdmin && user?.department_id && user?.id) {
    const adminClient = createAdminClient()
    const [{ data: allIds }, { data: readIds }, { data: pendingPermits }, { data: pendingRequests }] = await Promise.all([
      adminClient.from('announcements').select('id').eq('department_id', user.department_id),
      adminClient.from('announcement_reads').select('announcement_id').eq('personnel_id', user.id),
      isOfficerOrAbove
        ? adminClient.from('burn_permits').select('id').eq('department_id', user.department_id).eq('status', 'pending')
        : Promise.resolve({ data: [] }),
      isOfficerOrAbove
        ? adminClient.from('public_record_requests').select('id').eq('department_id', user.department_id).eq('status', 'pending')
        : Promise.resolve({ data: [] }),
    ])
    const readSet = new Set((readIds ?? []).map((r: { announcement_id: string }) => r.announcement_id))
    announcementUnreadCount = (allIds ?? []).filter((a: { id: string }) => !readSet.has(a.id)).length
    inboxPendingCount = (pendingPermits?.length ?? 0) + (pendingRequests?.length ?? 0)
  }

  const navGroups: NavGroup[] = isSysAdmin ? [
    { items: [{ href: '/dashboard', label: 'Overview' }] },
  ] : [
    { items: [{ href: '/dashboard', label: 'Dashboard' }] },
    {
      label: 'Personnel',
      items: [
        { href: '/personnel', label: 'Roster' },
      ],
    },
    {
      label: 'Training & Events',
      items: [
        { href: '/events', label: 'Events' },
        { href: '/training', label: 'Certifications' },
      ],
    },
    {
      label: 'Operations',
      items: [
        { href: '/announcements', label: 'Announcements', badge: announcementUnreadCount > 0 ? announcementUnreadCount : undefined },
        { href: '/incidents', label: 'Incidents' },
        { href: '/inbox', label: 'Public Inbox', badge: inboxPendingCount > 0 ? inboxPendingCount : undefined },
      ],
    },
    { items: [{ href: '/inspections', label: 'Inspections' }] },
    {
      label: 'Reports',
      items: [
        { href: '/reports/my-activity', label: 'My Activity' },
      ],
    },
  ]

  const adminNavItems = isSysAdmin ? [
    { href: '/admin/departments', label: 'Departments' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/logs', label: 'System Logs' },
  ] : isDeptAdmin ? [
    { href: '/dept-admin/setup', label: 'Equipment' },
    { href: '/dept-admin/personnel', label: 'Personnel' },
    { href: '/dept-admin/training', label: 'Training' },
    { href: '/iso/report', label: 'ISO' },
  ] : []

  const adminLabel = isSysAdmin ? 'System Admin' : 'Dept Admin'

  const userInfo = {
    name: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
    role: isSysAdmin ? 'System Admin' : systemRole ?? '',
    departmentName: user?.department_name ?? (isSysAdmin ? 'System Administrator' : null),
    profileHref: user?.personnelId ? `/personnel/${user.personnelId}` : null,
  }

  return (
    <div className="flex min-h-screen bg-zinc-100">
      <aside className="hidden md:flex w-64 bg-red-800 text-white flex-col shrink-0">
        <SidebarContent navGroups={navGroups} adminNavItems={adminNavItems} adminLabel={adminLabel} userInfo={userInfo} />
      </aside>
      <MobileSidebar navGroups={navGroups} adminNavItems={adminNavItems} adminLabel={adminLabel} userInfo={userInfo} />
      <main className="flex-1 pt-20 px-4 pb-4 sm:pt-0 sm:p-6 lg:p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

function SidebarContent({ navGroups, adminNavItems, adminLabel, userInfo }: {
  navGroups: NavGroup[]
  adminNavItems: { href: string; label: string }[]
  adminLabel: string
  userInfo: { name: string; role: string; departmentName: string | null; profileHref: string | null }
}) {
  return (
    <>
      <div className="px-6 py-5 border-b border-red-700">
        <h1 className="text-xl font-bold tracking-tight">FireOps7</h1>
        {userInfo.departmentName && <p className="text-xs text-red-300 mt-0.5 truncate">{userInfo.departmentName}</p>}
      </div>
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <NavGroups groups={navGroups} />
        {adminNavItems.length > 0 && (
          <div className="mt-4">
            <div className="mb-1 px-3 text-xs font-semibold text-red-300 uppercase tracking-wider">{adminLabel}</div>
            <NavGroups groups={[{ items: adminNavItems }]} />
          </div>
        )}
      </nav>
      <div className="px-4 py-4 border-t border-red-700 flex flex-col gap-2">
        <div className="mb-1">
          {userInfo.profileHref ? (
            <a href={userInfo.profileHref} className="group block">
              <p className="text-sm font-medium truncate group-hover:underline">{userInfo.name}</p>
              <p className="text-xs text-red-300 capitalize">{userInfo.role}</p>
            </a>
          ) : (
            <div>
              <p className="text-sm font-medium truncate">{userInfo.name}</p>
              <p className="text-xs text-red-300 capitalize">{userInfo.role}</p>
            </div>
          )}
        </div>
        <FeedbackButton />
        <form action={signOut}>
          <button type="submit" className="w-full rounded-lg bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 transition-colors text-left">
            Sign Out
          </button>
        </form>
      </div>
    </>
  )
}

export { SidebarContent }
