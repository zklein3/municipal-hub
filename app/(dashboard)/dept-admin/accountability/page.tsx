import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'
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
  const adminClient = createAdminClient()

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (!ctx.departmentId || ctx.systemRole !== 'admin') redirect('/dashboard')

  const department_id = ctx.departmentId

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
