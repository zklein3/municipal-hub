import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { signOut } from '@/app/actions/auth'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { hasBiometricCredentials, isBiometricUnlocked } from '@/app/actions/biometric'
import BiometricLockScreen from '@/components/BiometricLockScreen'
import FeedbackButton from '@/components/FeedbackButton'
import MobileSidebar from '@/components/MobileSidebar'
import NavGroups from '@/components/NavGroups'
import type { NavGroup } from '@/components/NavGroups'
import PageNavBar from '@/components/PageNavBar'
import PWAInstallButton from '@/components/PWAInstallButton'
import { getDeptTheme } from '@/lib/department-theme'

async function getUserContext() {
  const ctx = await getCurrentDepartmentContext()
  if (!ctx) return null

  if (ctx.selectionPending) {
    redirect('/select-department')
  }

  return {
    id: ctx.personnelId,
    personnelId: ctx.personnelId,
    first_name: ctx.firstName,
    last_name: ctx.lastName,
    is_sys_admin: ctx.isSysAdmin,
    system_role: ctx.systemRole,
    department_name: ctx.departmentName,
    department_type: ctx.departmentType,
    department_id: ctx.departmentId,
    hasMultipleDepartments: ctx.hasMultipleDepartments,
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserContext()
  const isSysAdmin = user?.is_sys_admin ?? false
  // True only when there's no department context — i.e. the user is in the
  // dedicated sys admin overview, not viewing a department they also admin.
  const viewingSysAdminOverview = isSysAdmin && !user?.department_id

  if (user) {
    const [bioEnabled, bioUnlocked] = await Promise.all([hasBiometricCredentials(), isBiometricUnlocked()])
    if (bioEnabled && !bioUnlocked) {
      return <BiometricLockScreen name={user.first_name} />
    }
  }
  const systemRole = user?.system_role ?? null
  const isDeptAdmin = systemRole === 'admin'
  const isOfficerOrAbove = isDeptAdmin || systemRole === 'officer'

  // Nav badge counts + dept module flags
  let announcementUnreadCount = 0
  let inboxPendingCount = 0
  let publicSiteEnabled = false
  let moduleOperations = false
  let moduleIso = false
  let moduleNeris = false
  let pendingSignatureCount = 0
  if (!viewingSysAdminOverview && user?.department_id && user?.id) {
    const adminClient = createAdminClient()
    const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const [{ data: allIds }, { data: readIds }, { data: pendingPermits }, { data: pendingRequests }, { data: deptFlags }, { count: sigCount }, { count: medicalAlertCount }] = await Promise.all([
      adminClient.from('announcements').select('id').eq('department_id', user.department_id),
      adminClient.from('announcement_reads').select('announcement_id').eq('personnel_id', user.id),
      isOfficerOrAbove
        ? adminClient.from('burn_permits').select('id').eq('department_id', user.department_id).eq('status', 'pending')
        : Promise.resolve({ data: [] }),
      isOfficerOrAbove
        ? adminClient.from('public_record_requests').select('id').eq('department_id', user.department_id).eq('status', 'pending')
        : Promise.resolve({ data: [] }),
      adminClient.from('departments').select('public_site_enabled, module_operations, module_iso, module_neris, module_medical').eq('id', user.department_id).single(),
      adminClient.from('incident_signatures').select('id', { count: 'exact', head: true }).eq('personnel_id', user.id).is('signed_at', null),
      Promise.resolve({ count: 0, data: null, error: null }), // medical alert resolved after deptFlags
    ])
    const readSet = new Set((readIds ?? []).map((r: { announcement_id: string }) => r.announcement_id))
    announcementUnreadCount = (allIds ?? []).filter((a: { id: string }) => !readSet.has(a.id)).length
    pendingSignatureCount = sigCount ?? 0
    publicSiteEnabled = (deptFlags as any)?.public_site_enabled ?? false
    moduleOperations = (deptFlags as any)?.module_operations ?? false
    moduleIso = (deptFlags as any)?.module_iso ?? false
    moduleNeris = (deptFlags as any)?.module_neris ?? false
    const moduleMedical = (deptFlags as any)?.module_medical ?? false

    // Medical alert badge — only when module is enabled
    let medicalAlertBadge = 0
    if (moduleMedical && isOfficerOrAbove) {
      const thirtyDaysOutDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const { count } = await adminClient.from('medical_stock_lots').select('id', { count: 'exact', head: true }).eq('department_id', user.department_id).eq('active', true).gt('quantity_remaining', 0).lte('expiration_date', thirtyDaysOutDate)
      medicalAlertBadge = count ?? 0
    }
    inboxPendingCount = (pendingPermits?.length ?? 0) + (pendingRequests?.length ?? 0) + medicalAlertBadge
  }

  const opsBadge = announcementUnreadCount > 0 ? announcementUnreadCount : undefined
  const inboxBadge = (inboxPendingCount + pendingSignatureCount) > 0
    ? inboxPendingCount + pendingSignatureCount
    : undefined

  const departmentType = user?.department_type ?? 'fire'
  const isFireDept = departmentType === 'fire'

  const navGroups: NavGroup[] = viewingSysAdminOverview ? [
    { items: [{ href: '/dashboard', label: 'Overview' }] },
  ] : isFireDept ? [
    { items: [{ href: '/dashboard', label: 'Dashboard' }] },
    { items: [{ href: '/operations', label: 'Operations', badge: opsBadge }] },
    { items: [{ href: '/inbox', label: 'Inbox', badge: inboxBadge }] },
    { items: [{ href: '/personnel', label: 'Personnel' }] },
    { items: [{ href: '/training', label: 'Training' }] },
    { items: [{ href: '/equipment', label: 'Inventory' }] },
    { items: [{ href: '/reports', label: 'Reports' }] },
  ] : [
    { items: [{ href: '/dashboard', label: 'Dashboard' }] },
    { items: [{ href: '/personnel', label: 'Personnel' }] },
    { items: [{ href: '/training', label: 'Training' }] },
    { items: [{ href: '/reports', label: 'Reports' }] },
  ]

  const adminNavItems = viewingSysAdminOverview ? [
    { href: '/admin/departments', label: 'Departments' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/logs', label: 'System Logs' },
    { href: '/admin/neris', label: 'NERIS' },
  ] : isDeptAdmin ? [
    { href: '/dept-admin', label: 'Dept Admin' },
  ] : []

  const adminLabel = viewingSysAdminOverview ? 'System Admin' : 'Dept Admin'
  const theme = getDeptTheme(departmentType)

  const userInfo = {
    name: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
    role: viewingSysAdminOverview ? 'System Admin' : systemRole ?? '',
    departmentName: user?.department_name ?? (isSysAdmin ? 'System Administrator' : null),
    profileHref: user?.personnelId ? `/personnel/${user.personnelId}` : null,
    canSwitchDepartment: user?.hasMultipleDepartments ?? false,
  }

  return (
    <div className="flex min-h-screen bg-zinc-100">
      <aside className={`hidden md:flex w-64 ${theme.sidebarBg} text-white flex-col shrink-0`}>
        <SidebarContent navGroups={navGroups} adminNavItems={adminNavItems} adminLabel={adminLabel} userInfo={userInfo} theme={theme} />
      </aside>
      <MobileSidebar navGroups={navGroups} adminNavItems={adminNavItems} adminLabel={adminLabel} userInfo={userInfo} theme={theme} />
      <main className="flex-1 pt-20 px-4 pb-4 sm:pt-0 sm:p-6 lg:p-8 overflow-y-auto">
        <PageNavBar />
        {children}
      </main>
    </div>
  )
}

function SidebarContent({ navGroups, adminNavItems, adminLabel, userInfo, theme }: {
  navGroups: NavGroup[]
  adminNavItems: { href: string; label: string }[]
  adminLabel: string
  userInfo: { name: string; role: string; departmentName: string | null; profileHref: string | null; canSwitchDepartment: boolean }
  theme: ReturnType<typeof getDeptTheme>
}) {
  return (
    <>
      <div className={`px-6 py-5 border-b ${theme.border}`}>
        <h1 className="text-xl font-bold tracking-tight">FireOps7</h1>
        {userInfo.departmentName && <p className={`text-xs ${theme.textMuted} mt-0.5 truncate`}>{userInfo.departmentName}</p>}
        {userInfo.canSwitchDepartment && (
          <a href="/select-department" className={`text-xs ${theme.switchLink} underline mt-0.5 inline-block hover:text-white`}>
            Switch Department
          </a>
        )}
      </div>
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <NavGroups groups={navGroups} theme={theme} />
        {adminNavItems.length > 0 && (
          <div className="mt-4">
            <div className={`mb-1 px-3 text-xs font-semibold ${theme.textMuted} uppercase tracking-wider`}>{adminLabel}</div>
            <NavGroups groups={[{ items: adminNavItems }]} theme={theme} />
          </div>
        )}
      </nav>
      <div className={`px-4 py-4 border-t ${theme.border} flex flex-col gap-2`}>
        <div className="mb-1">
          {userInfo.profileHref ? (
            <a href={userInfo.profileHref} className="group block">
              <p className="text-sm font-medium truncate group-hover:underline">{userInfo.name}</p>
              <p className={`text-xs ${theme.textMuted} capitalize`}>{userInfo.role}</p>
            </a>
          ) : (
            <div>
              <p className="text-sm font-medium truncate">{userInfo.name}</p>
              <p className={`text-xs ${theme.textMuted} capitalize`}>{userInfo.role}</p>
            </div>
          )}
        </div>
        <PWAInstallButton />
        <FeedbackButton />
        <form action={signOut}>
          <button type="submit" className={`w-full rounded-lg ${theme.buttonBg} px-3 py-1.5 text-xs font-medium text-white ${theme.buttonHoverBg} transition-colors text-left`}>
            Sign Out
          </button>
        </form>
      </div>
    </>
  )
}

export { SidebarContent }
