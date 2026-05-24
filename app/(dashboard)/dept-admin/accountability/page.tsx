import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AccountabilitySettingsClient from './AccountabilitySettingsClient'

const DEFAULT_LANES = [
  'Staging',
  'Command',
  'Interior Attack',
  'Exterior / Suppression',
  'Ventilation',
  'RIT / RIC',
  'Rehab',
  'EMS',
]

export default async function AccountabilitySettingsPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: meList } = await adminClient.from('personnel').select('id').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) redirect('/login')

  const { data: myDeptList } = await adminClient
    .from('department_personnel')
    .select('department_id, system_role')
    .eq('personnel_id', me.id)
    .eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept || myDept.system_role !== 'admin') redirect('/dashboard')

  const department_id = myDept.department_id

  let { data: lanes } = await adminClient
    .from('accountability_lane_templates')
    .select('id, name, sort_order, active')
    .eq('department_id', department_id)
    .order('sort_order')

  // Seed defaults on first visit
  if (!lanes || lanes.length === 0) {
    const seeds = DEFAULT_LANES.map((name, i) => ({
      department_id,
      name,
      sort_order: i,
      active: true,
    }))
    await adminClient.from('accountability_lane_templates').insert(seeds)
    const { data: fresh } = await adminClient
      .from('accountability_lane_templates')
      .select('id, name, sort_order, active')
      .eq('department_id', department_id)
      .order('sort_order')
    lanes = fresh
  }

  return (
    <AccountabilitySettingsClient
      lanes={lanes ?? []}
      departmentId={department_id}
    />
  )
}
