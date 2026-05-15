import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import BackButton from '@/components/BackButton'
import FuelClient from '@/app/(dashboard)/fuel/FuelClient'

export default async function ApparatusFuelPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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
  if (!myDept) redirect('/dashboard')

  const isOfficerOrAbove = myDept.system_role === 'admin' || myDept.system_role === 'officer' || me.is_sys_admin
  const department_id = myDept.department_id

  const { data: apparatus } = await adminClient.from('apparatus')
    .select('id, unit_number, apparatus_name').eq('id', id).eq('department_id', department_id).single()
  if (!apparatus) redirect('/inspections')

  const { data: logsRaw } = await adminClient
    .from('apparatus_fuel_logs')
    .select('id, apparatus_id, fuel_date, gallons, cost_per_gallon, total_cost, fuel_type, odometer, vendor, notes, logged_by_personnel_id')
    .eq('apparatus_id', id)
    .eq('department_id', department_id)
    .order('fuel_date', { ascending: false })
    .order('created_at', { ascending: false })

  const personnelIds = [...new Set((logsRaw ?? []).map(l => l.logged_by_personnel_id).filter(Boolean) as string[])]
  const { data: personnelRaw } = personnelIds.length > 0
    ? await adminClient.from('personnel').select('id, first_name, last_name').in('id', personnelIds)
    : { data: [] }
  const personnelMap = Object.fromEntries((personnelRaw ?? []).map(p => [p.id, `${p.first_name} ${p.last_name}`]))

  const apparatusLabel = `${apparatus.unit_number}${apparatus.apparatus_name ? ` — ${apparatus.apparatus_name}` : ''}`

  const entries = (logsRaw ?? []).map(l => ({
    id: l.id,
    apparatus_id: l.apparatus_id,
    apparatus_label: apparatusLabel,
    fuel_date: l.fuel_date,
    gallons: l.gallons,
    cost_per_gallon: l.cost_per_gallon,
    total_cost: l.total_cost,
    fuel_type: l.fuel_type,
    odometer: l.odometer,
    vendor: l.vendor,
    notes: l.notes,
    logged_by_name: l.logged_by_personnel_id ? (personnelMap[l.logged_by_personnel_id] ?? null) : null,
  }))

  return (
    <div className="max-w-2xl">
      <div className="mb-2">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">Fuel Log</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{apparatusLabel}</p>
      </div>
      <div className="mb-5">
        <BackButton href={`/equipment/${id}?from=/inspections`} />
      </div>
      <FuelClient
        entries={entries}
        apparatus={[{ id: apparatus.id, unit_number: apparatus.unit_number, apparatus_name: apparatus.apparatus_name }]}
        fixedApparatusId={id}
        isOfficerOrAbove={isOfficerOrAbove}
      />
    </div>
  )
}
