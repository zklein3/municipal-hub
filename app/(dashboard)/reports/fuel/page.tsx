import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import FuelReportClient from './FuelReportClient'

export default async function FuelReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; apparatusId?: string }>
}) {
  const { from: fromParam, to: toParam, apparatusId } = await searchParams

  // Default to current month when no dates provided
  const now = new Date()
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const defaultTo = now.toISOString().split('T')[0]
  const from = fromParam || defaultFrom
  const to = toParam || defaultTo
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: meList } = await adminClient.from('personnel').select('id, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) redirect('/login')

  const { data: myDeptList } = await adminClient.from('department_personnel')
    .select('department_id, system_role').eq('personnel_id', me.id).eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept || (myDept.system_role === 'member' && !me.is_sys_admin)) redirect('/dashboard')

  const department_id = myDept.department_id

  const { data: apparatusRaw } = await adminClient.from('apparatus')
    .select('id, unit_number, apparatus_name')
    .eq('department_id', department_id)
    .eq('active', true)
    .order('unit_number')

  let query = adminClient
    .from('apparatus_fuel_logs')
    .select('id, apparatus_id, fuel_date, gallons, cost_per_gallon, total_cost, fuel_type, fuel_system, aux_description, odometer, engine_hours, vendor, notes, logged_by_personnel_id')
    .eq('department_id', department_id)
    .order('fuel_date', { ascending: false })

  if (from) query = query.gte('fuel_date', from)
  if (to) query = query.lte('fuel_date', to)
  if (apparatusId) query = query.eq('apparatus_id', apparatusId)

  const { data: logsRaw } = await query

  const personnelIds = [...new Set((logsRaw ?? []).map(l => l.logged_by_personnel_id).filter(Boolean) as string[])]
  const { data: personnelRaw } = personnelIds.length > 0
    ? await adminClient.from('personnel').select('id, first_name, last_name').in('id', personnelIds)
    : { data: [] }
  const personnelMap = Object.fromEntries((personnelRaw ?? []).map(p => [p.id, `${p.first_name} ${p.last_name}`]))

  const apparatusMap = Object.fromEntries((apparatusRaw ?? []).map(a => [
    a.id,
    `${a.unit_number}${a.apparatus_name ? ` — ${a.apparatus_name}` : ''}`,
  ]))

  const entries = (logsRaw ?? []).map(l => ({
    id: l.id,
    apparatus_id: l.apparatus_id,
    apparatus_label: apparatusMap[l.apparatus_id] ?? '—',
    fuel_date: l.fuel_date,
    gallons: l.gallons,
    cost_per_gallon: l.cost_per_gallon,
    total_cost: l.total_cost,
    fuel_type: l.fuel_type,
    fuel_system: l.fuel_system,
    aux_description: l.aux_description,
    odometer: l.odometer,
    engine_hours: l.engine_hours,
    vendor: l.vendor,
    notes: l.notes,
    logged_by_name: l.logged_by_personnel_id ? (personnelMap[l.logged_by_personnel_id] ?? null) : null,
  }))

  return (
    <FuelReportClient
      entries={entries}
      apparatus={apparatusRaw ?? []}
      filters={{ from, to, apparatusId: apparatusId ?? '' }}
    />
  )
}
