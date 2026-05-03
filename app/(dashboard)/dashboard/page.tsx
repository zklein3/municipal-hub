import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SysAdminDashboard from './SysAdminDashboard'

async function getDashboardData(departmentId: string, personnelId: string) {
  const adminClient = createAdminClient()

  const today = new Date().toISOString().split('T')[0]
  const next7 = new Date(); next7.setDate(next7.getDate() + 7)
  const next7str = next7.toISOString().split('T')[0]

  const [pendingSetup, instances, trainingEvents] = await Promise.all([
    adminClient.from('department_personnel')
      .select('id')
      .eq('department_id', departmentId)
      .in('signup_status', ['temp_password', 'profile_setup']),
    adminClient.from('event_instances')
      .select('id, series_id, event_date, start_time, location, status')
      .gte('event_date', today)
      .lte('event_date', next7str)
      .neq('status', 'cancelled')
      .order('event_date', { ascending: true })
      .limit(5),
    adminClient.from('training_events')
      .select('id, event_date, start_time, topic, hours, location')
      .eq('department_id', departmentId)
      .gte('event_date', today)
      .lte('event_date', next7str)
      .order('event_date', { ascending: true })
      .limit(5),
  ])

  // Fetch series titles for instances
  const seriesIds = [...new Set((instances.data ?? []).map(i => i.series_id))]
  const { data: seriesData } = seriesIds.length > 0
    ? await adminClient.from('event_series').select('id, title, event_type, department_id').in('id', seriesIds).eq('department_id', departmentId)
    : { data: [] }
  const seriesMap = Object.fromEntries((seriesData ?? []).map(s => [s.id, s]))

  const deptInstances = (instances.data ?? []).filter(i => seriesMap[i.series_id])

  const instanceIds = deptInstances.map(i => i.id)
  const { data: myAttendance } = instanceIds.length > 0
    ? await adminClient.from('event_attendance').select('instance_id, status').eq('personnel_id', personnelId).in('instance_id', instanceIds)
    : { data: [] }
  const myAttendanceMap = Object.fromEntries((myAttendance ?? []).map(a => [a.instance_id, a.status]))

  const trainingEventIds = (trainingEvents.data ?? []).map(e => e.id)
  const { data: myTrainingAttendance } = trainingEventIds.length > 0
    ? await adminClient.from('training_event_attendance').select('event_id, status').eq('personnel_id', personnelId).in('event_id', trainingEventIds)
    : { data: [] }
  const myTrainingAttendanceMap = Object.fromEntries((myTrainingAttendance ?? []).map(a => [a.event_id, a.status]))

  return {
    pendingSetup: pendingSetup.data ?? [],
    upcomingEvents: deptInstances.map(i => ({
      id: i.id,
      title: seriesMap[i.series_id]?.title ?? '—',
      event_type: seriesMap[i.series_id]?.event_type ?? 'training',
      event_date: i.event_date,
      start_time: i.start_time,
      location: i.location,
      my_status: myAttendanceMap[i.id] ?? null,
    })),
    upcomingTraining: (trainingEvents.data ?? []).map(e => ({
      id: e.id,
      topic: e.topic,
      event_date: e.event_date,
      start_time: e.start_time,
      hours: e.hours,
      location: e.location,
      my_status: myTrainingAttendanceMap[e.id] ?? null,
    })),
  }
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  training: 'bg-blue-100 text-blue-700',
  meeting:  'bg-purple-100 text-purple-700',
  incident: 'bg-red-100 text-red-700',
  special:  'bg-green-100 text-green-700',
}
const EVENT_TYPE_LABELS: Record<string, string> = {
  training: 'Training', meeting: 'Meeting', incident: 'Incident', special: 'Special',
}
const ATTENDANCE_COLORS: Record<string, string> = {
  present:  'bg-green-100 text-green-700',
  pending:  'bg-yellow-100 text-yellow-700',
  absent:   'bg-red-100 text-red-700',
  excused:  'bg-blue-100 text-blue-700',
}

function formatTime(t: string | null) {
  if (!t) return null
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

function formatDate(d: string | null) {
  if (!d) return null
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch me with contact info
  const { data: meList } = await adminClient
    .from('personnel')
    .select('id, first_name, last_name, email, phone, is_sys_admin')
    .eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) redirect('/login')

  if (me.is_sys_admin) return <SysAdminDashboard />

  // Fetch my dept record with profile fields — flat, no nested joins
  const { data: myDeptList } = await adminClient
    .from('department_personnel')
    .select('department_id, system_role, employee_number, hire_date, role_id')
    .eq('personnel_id', me.id)
    .eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept) redirect('/login')

  // Fetch dept name separately
  const { data: deptData } = await adminClient
    .from('departments')
    .select('name')
    .eq('id', myDept.department_id)
    .single()

  // Fetch my title/rank if set
  const { data: roleData } = myDept.role_id
    ? await adminClient.from('personnel_roles').select('name').eq('id', myDept.role_id).single()
    : { data: null }

  const departmentId = myDept.department_id
  const departmentName = deptData?.name ?? 'Your Department'
  const systemRole = myDept.system_role
  const isAdmin = systemRole === 'admin'
  const isOfficerOrAbove = isAdmin || systemRole === 'officer'

  const profile = {
    name: [me.first_name, me.last_name].filter(Boolean).join(' ') || 'Your Name',
    initials: [me.first_name?.[0], me.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?',
    systemRole,
    title: roleData?.name ?? null,
    department: departmentName,
    employeeNumber: myDept.employee_number ?? null,
    hireDate: myDept.hire_date ?? null,
    phone: me.phone ?? null,
    email: me.email ?? null,
    personnelId: me.id,
  }

  const data = await getDashboardData(departmentId, me.id)

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const hasUpcoming = data.upcomingEvents.length > 0 || data.upcomingTraining.length > 0

  // Role-adaptive quick links
  const quickLinks = isAdmin ? [
    { href: '/dept-admin/setup',  label: 'Dept Setup',   desc: 'Configure your department' },
    { href: '/personnel',         label: 'Personnel',    desc: 'Department roster' },
    { href: '/apparatus',         label: 'Apparatus',    desc: 'Vehicles and units' },
    { href: '/events',            label: 'Events',       desc: 'Log attendance' },
    { href: '/inspections',       label: 'Inspections',  desc: 'Run equipment checks' },
    { href: '/reports/inspections', label: 'Reports',   desc: 'Inspection & attendance' },
  ] : isOfficerOrAbove ? [
    { href: '/personnel',         label: 'Personnel',    desc: 'Department roster' },
    { href: '/apparatus',         label: 'Apparatus',    desc: 'Vehicles and units' },
    { href: '/events',            label: 'Events',       desc: 'Log attendance' },
    { href: '/inspections',       label: 'Inspections',  desc: 'Run equipment checks' },
    { href: '/incidents',         label: 'Incidents',    desc: 'Log and manage incidents' },
    { href: '/reports/attendance', label: 'Reports',    desc: 'Attendance & activity' },
  ] : [
    { href: '/events',            label: 'Events',       desc: 'Log attendance' },
    { href: '/training',          label: 'Training',     desc: 'Courses & certifications' },
    { href: '/inspections',       label: 'Inspections',  desc: 'Run equipment checks' },
    { href: '/reports/my-activity', label: 'My Activity', desc: 'Your attendance & records' },
    { href: '/personnel',         label: 'Personnel',    desc: 'Department roster' },
    { href: '/apparatus',         label: 'Apparatus',    desc: 'Vehicles and units' },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">
          {greeting()}, {me.first_name || 'there'}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">{departmentName}</p>
      </div>

      {/* Admin: pending setup banner */}
      {isAdmin && data.pendingSetup.length > 0 && (
        <div className="mb-6 rounded-xl bg-yellow-50 border border-yellow-200 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-yellow-800">
              {data.pendingSetup.length} user{data.pendingSetup.length !== 1 ? 's' : ''} haven&apos;t completed account setup
            </p>
            <p className="text-xs text-yellow-600 mt-0.5">They need to log in and set their password and profile.</p>
          </div>
          <Link href="/dept-admin/setup" className="text-xs font-semibold text-yellow-800 hover:underline whitespace-nowrap ml-4">
            Dept Setup →
          </Link>
        </div>
      )}

      {/* Profile card */}
      <div className="mb-6 rounded-xl bg-white shadow-sm border border-zinc-200 p-5">
        <div className="flex items-start gap-4">
          {/* Initials avatar */}
          <div className="shrink-0 w-14 h-14 rounded-full bg-red-700 flex items-center justify-center text-white text-xl font-bold">
            {profile.initials}
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="text-xl font-bold text-zinc-900 leading-tight">{profile.name}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    systemRole === 'admin'   ? 'bg-red-100 text-red-700' :
                    systemRole === 'officer' ? 'bg-blue-100 text-blue-700' :
                                               'bg-zinc-100 text-zinc-600'
                  }`}>
                    {systemRole.charAt(0).toUpperCase() + systemRole.slice(1)}
                  </span>
                  {profile.title && (
                    <span className="text-sm text-zinc-500">{profile.title}</span>
                  )}
                  <span className="text-sm text-zinc-400">{profile.department}</span>
                </div>
              </div>
              <Link
                href={`/personnel/${profile.personnelId}`}
                className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-800 transition-colors"
              >
                Edit Profile →
              </Link>
            </div>

            {/* Detail row */}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-zinc-500">
              {profile.employeeNumber && (
                <span><span className="text-zinc-400 text-xs">Emp #</span> {profile.employeeNumber}</span>
              )}
              {profile.hireDate && (
                <span><span className="text-zinc-400 text-xs">Hired</span> {formatDate(profile.hireDate)}</span>
              )}
              {profile.phone && (
                <span>{profile.phone}</span>
              )}
              {profile.email && (
                <span className="truncate max-w-xs">{profile.email}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Events */}
      {hasUpcoming ? (
        <div className="rounded-xl bg-white shadow-sm border border-zinc-200 overflow-hidden mb-5">
          <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Upcoming This Week</h2>
            <div className="flex gap-3">
              <Link href="/events" className="text-xs font-semibold text-red-600 hover:text-red-800">Events →</Link>
              <Link href="/training" className="text-xs font-semibold text-red-600 hover:text-red-800">Training →</Link>
            </div>
          </div>
          <div className="divide-y divide-zinc-100">
            {data.upcomingEvents.map(evt => (
              <Link key={evt.id} href="/events" className="flex items-center px-5 py-3 gap-3 hover:bg-zinc-50 transition-colors">
                <div className="shrink-0 text-center w-10">
                  <p className="text-xs font-semibold text-zinc-400 uppercase">
                    {new Date(evt.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                  </p>
                  <p className="text-lg font-bold text-zinc-900 leading-none">
                    {new Date(evt.event_date + 'T00:00:00').getDate()}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{evt.title}</p>
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium shrink-0 ${EVENT_TYPE_COLORS[evt.event_type] ?? 'bg-zinc-100 text-zinc-600'}`}>
                      {EVENT_TYPE_LABELS[evt.event_type] ?? evt.event_type}
                    </span>
                  </div>
                  <div className="flex gap-2 text-xs text-zinc-400 mt-0.5">
                    {evt.start_time && <span>{formatTime(evt.start_time)}</span>}
                    {evt.location && <span>· {evt.location}</span>}
                  </div>
                </div>
                {evt.my_status && (
                  <span className={`text-xs rounded-full px-2 py-0.5 font-medium shrink-0 ${ATTENDANCE_COLORS[evt.my_status] ?? 'bg-zinc-100 text-zinc-500'}`}>
                    {evt.my_status.charAt(0).toUpperCase() + evt.my_status.slice(1)}
                  </span>
                )}
              </Link>
            ))}
            {data.upcomingTraining.map(evt => (
              <Link key={evt.id} href="/training" className="flex items-center px-5 py-3 gap-3 hover:bg-zinc-50 transition-colors">
                <div className="shrink-0 text-center w-10">
                  <p className="text-xs font-semibold text-zinc-400 uppercase">
                    {new Date(evt.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                  </p>
                  <p className="text-lg font-bold text-zinc-900 leading-none">
                    {new Date(evt.event_date + 'T00:00:00').getDate()}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{evt.topic}</p>
                    <span className="text-xs rounded-full px-2 py-0.5 font-medium shrink-0 bg-blue-100 text-blue-700">Training</span>
                  </div>
                  <div className="flex gap-2 text-xs text-zinc-400 mt-0.5">
                    {evt.start_time && <span>{formatTime(evt.start_time)}</span>}
                    {evt.hours && <span>· {evt.hours}h</span>}
                    {evt.location && <span>· {evt.location}</span>}
                  </div>
                </div>
                {evt.my_status && (
                  <span className={`text-xs rounded-full px-2 py-0.5 font-medium shrink-0 ${ATTENDANCE_COLORS[evt.my_status] ?? 'bg-zinc-100 text-zinc-500'}`}>
                    {evt.my_status.charAt(0).toUpperCase() + evt.my_status.slice(1)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm border border-zinc-200 px-5 py-5 mb-5 flex items-center justify-between">
          <p className="text-sm text-zinc-400">No events scheduled this week.</p>
          <div className="flex gap-3">
            <Link href="/events" className="text-xs font-semibold text-red-600 hover:text-red-800">Events →</Link>
            <Link href="/training" className="text-xs font-semibold text-red-600 hover:text-red-800">Training →</Link>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="rounded-xl bg-white shadow-sm border border-zinc-200 p-5">
        <h2 className="text-sm font-semibold text-zinc-900 mb-3">Quick Links</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {quickLinks.map(link => (
            <Link key={link.href} href={link.href}
              className="rounded-lg border border-zinc-200 px-4 py-3 hover:border-red-300 hover:bg-red-50 transition-all group">
              <p className="text-sm font-semibold text-zinc-800 group-hover:text-red-700">{link.label}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{link.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
