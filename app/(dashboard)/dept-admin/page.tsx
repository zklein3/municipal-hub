import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { hasPermission, getPermissionSnapshot } from '@/lib/permissions'
import Image from 'next/image'
import HubCard from '@/components/HubCard'
import HelpText from '@/components/HelpText'

type GroupId = 'people' | 'department' | 'equipment' | 'events' | 'incident' | 'compliance'

const GROUPS: { id: GroupId; title: string; description: string }[] = [
  { id: 'people', title: 'People & Access', description: 'Members, permission groups, and station kiosks' },
  { id: 'department', title: 'Department', description: 'Settings, notifications, and the public site' },
  { id: 'equipment', title: 'Equipment & Medical', description: 'Apparatus, compartments, presets, medical, inspections, and fuel' },
  { id: 'events', title: 'Events & Training', description: 'Events, attendance rules, and training and certifications' },
  { id: 'incident', title: 'Incident & Command', description: 'Accountability, ICS, NERIS, and police settings' },
  { id: 'compliance', title: 'Compliance', description: 'ISO hose, hydrants, mutual aid, and reports' },
]

type Entry = {
  group: GroupId
  title: string
  description: string
  href: string
  stat?: number
  statLabel?: string
  alert?: boolean
}

export default async function DeptAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>
}) {
  const { group: requestedGroup } = await searchParams
  const adminClient = createAdminClient()

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (!ctx.departmentId) redirect('/dashboard')
  if (!(await hasPermission(ctx, 'access_dept_admin_hub'))) redirect('/dashboard')

  const departmentId = ctx.departmentId
  const isFireDept = ctx.departmentType === 'fire'
  const isPoliceDept = ctx.departmentType === 'law_enforcement'
  const perms = await getPermissionSnapshot(ctx)

  const [
    { data: deptFlags },
    { count: activeMemberCount },
    { count: pendingSetupCount },
  ] = await Promise.all([
    adminClient.from('departments')
      .select('module_iso, module_neris, module_medical, module_fuel_storage, module_ics, public_site_enabled')
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
  const moduleMedical = (deptFlags as any)?.module_medical ?? false
  const moduleIcs = (deptFlags as any)?.module_ics ?? false
  const moduleFuelStorage = (deptFlags as any)?.module_fuel_storage ?? false
  const publicSiteEnabled = (deptFlags as any)?.public_site_enabled ?? false
  const hasPendingSetup = (pendingSetupCount ?? 0) > 0

  // Every admin destination, tagged with its group. Only entries the caller's permission group
  // grants (and the department's modules allow) are included.
  const entries: Entry[] = [
    ...(perms.manage_users ? [{
      group: 'people' as const, title: 'Personnel', description: 'Manage members, roles, and account setup',
      href: '/dept-admin/personnel', stat: activeMemberCount ?? undefined,
      statLabel: hasPendingSetup ? `${pendingSetupCount} pending setup` : 'Active Members', alert: hasPendingSetup,
    }] : []),
    ...(perms.manage_permission_groups ? [{ group: 'people' as const, title: 'Permission Groups', description: 'Customize what each role can do', href: '/dept-admin/permission-groups' }] : []),
    ...(perms.manage_kiosk_devices ? [{ group: 'people' as const, title: 'Kiosk Devices', description: 'Set up a station tablet for scan-in/scan-out presence tracking', href: '/dept-admin/kiosk' }] : []),

    ...(perms.manage_department_settings ? [{ group: 'department' as const, title: 'Department Settings', description: 'Timezone, feature toggles, and public-facing tools', href: '/dept-admin/settings' }] : []),
    ...(perms.manage_department_settings ? [{ group: 'department' as const, title: 'Notifications', description: 'Who gets emailed, and for what', href: '/dept-admin/notifications' }] : []),
    ...(publicSiteEnabled && perms.manage_public_site ? [{ group: 'department' as const, title: 'Public Site', description: 'Public info, QR codes, burn permits, and records inbox', href: '/dept-admin/public-inbox' }] : []),

    // Setup is one page with tabs; these go straight to the right tab.
    ...(perms.manage_dept_setup ? [{ group: 'equipment' as const, title: 'Equipment Setup', description: 'Stations, apparatus, compartments, and the equipment item catalog', href: '/dept-admin/setup' }] : []),
    ...(perms.manage_dept_setup ? [{ group: 'equipment' as const, title: 'Compartment Presets', description: 'Ready-made compartments and the standard set for each apparatus type', href: '/dept-admin/setup?tab=presets' }] : []),
    ...(moduleMedical && perms.manage_medical_supply_setup ? [{ group: 'equipment' as const, title: 'Medical Setup', description: 'Medication types, storerooms, and bags', href: '/dept-admin/setup?tab=medical' }] : []),
    ...(perms.manage_inspection_settings ? [{ group: 'equipment' as const, title: 'Inspections', description: 'Vehicle check items and inspection session settings', href: '/dept-admin/inspections' }] : []),
    ...(moduleFuelStorage && perms.manage_fuel_storage ? [{ group: 'equipment' as const, title: 'Fuel Tanks', description: 'Manage on-site storage tanks and fuel deliveries', href: '/dept-admin/fuel-tanks' }] : []),

    ...(perms.manage_events ? [{ group: 'events' as const, title: 'Events', description: 'Manage attendance, approvals, and event settings', href: '/dept-admin/events' }] : []),
    ...(perms.manage_attendance_settings ? [{ group: 'events' as const, title: 'Attendance Settings', description: 'Excuse types and participation requirements', href: '/dept-admin/attendance' }] : []),
    ...(perms.record_training_completion ? [{ group: 'events' as const, title: 'Training & Certs', description: 'Certification types, courses, and training setup', href: '/dept-admin/training' }] : []),

    ...(perms.manage_accountability_lanes ? [{ group: 'incident' as const, title: 'Accountability', description: 'Configure accountability lanes — default, ICS/NIMS Mode, and Active Violence profiles', href: '/dept-admin/accountability' }] : []),
    ...(moduleIcs && perms.manage_ics_defaults ? [{ group: 'incident' as const, title: 'ICS Defaults', description: 'Default radio channels (ICS 205) and medical plan contacts (ICS 206), copied into every new operational period', href: '/dept-admin/ics-defaults' }] : []),
    ...(isFireDept && moduleNeris && perms.submit_neris ? [{ group: 'incident' as const, title: 'NERIS Settings', description: 'Incident reporting configuration', href: '/dept-admin/neris' }] : []),
    ...(isPoliceDept && perms.manage_police_settings ? [{ group: 'incident' as const, title: 'Police Settings', description: 'Contact types, action-taken options, and case numbering', href: '/dept-admin/police' }] : []),

    ...(moduleIso && perms.perform_iso_testing ? [{ group: 'compliance' as const, title: 'ISO', description: 'Hose inventory, hydrants, mutual aid, and ISO report', href: '/iso' }] : []),
  ]

  const visibleGroups = GROUPS
    .map(g => ({ ...g, items: entries.filter(e => e.group === g.id) }))
    .filter(g => g.items.length > 0)
  const openGroup = visibleGroups.find(g => g.id === requestedGroup)

  return (
    <div>
      <div className="mb-6">
        {openGroup && (
          <Link href="/dept-admin" className="text-xs text-zinc-400 hover:text-zinc-600 mb-2 inline-block">← Dept Admin</Link>
        )}
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">{openGroup ? openGroup.title : 'Dept Admin'}</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{openGroup ? openGroup.description : 'Department configuration and management'}</p>
      </div>

      {!openGroup && (
        <HelpText className="mb-4">
          Cards here only show if your permission group grants that specific capability — Permission Groups is where
          you control who sees what, for yourself and everyone else in the department.
        </HelpText>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {openGroup
          ? openGroup.items.map(e => (
              <HubCard key={e.href} title={e.title} description={e.description} href={e.href}
                stat={e.stat} statLabel={e.statLabel} alert={e.alert} />
            ))
          : visibleGroups.map(g => {
              // A group with a single destination goes straight there — no one-card sub-menu.
              const only = g.items.length === 1 ? g.items[0] : null
              const alertItem = g.items.find(i => i.alert)
              return (
                <HubCard
                  key={g.id}
                  title={g.title}
                  description={only ? only.description : g.items.map(i => i.title).join(' · ')}
                  href={only ? only.href : `/dept-admin?group=${g.id}`}
                  stat={alertItem ? alertItem.statLabel : undefined}
                  statLabel={alertItem ? alertItem.title : undefined}
                  alert={!!alertItem}
                />
              )
            })}
      </div>

      {/* NERIS promo — fire depts only, shown only when module is not yet enabled */}
      {!openGroup && isFireDept && !moduleNeris && (
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
