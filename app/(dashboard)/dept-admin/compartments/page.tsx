import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import CompartmentsClient from './CompartmentsClient'

export default async function CompartmentsPage() {
  const adminClient = createAdminClient()

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (!ctx.departmentId || (ctx.systemRole !== 'admin' && !ctx.isSysAdmin)) redirect('/dashboard')

  const department_id = ctx.departmentId
  const department_name = ctx.departmentName ?? 'Your Department'

  const { data: compartments } = await adminClient
    .from('compartment_names')
    .select('id, compartment_code, compartment_name, sort_order, active')
    .eq('department_id', department_id)
    .order('sort_order', { ascending: true, nullsFirst: false })

  const { data: apparatusList } = await adminClient
    .from('apparatus')
    .select('id, unit_number, apparatus_name')
    .eq('department_id', department_id)
    .eq('active', true)
    .order('unit_number', { ascending: true })

  // Full assignments: compartment_name_id → apparatus_id[]
  const { data: assignments } = await adminClient
    .from('apparatus_compartments')
    .select('compartment_name_id, apparatus_id')
    .eq('active', true)

  const usageMap: Record<string, number> = {}
  const assignmentMap: Record<string, string[]> = {}
  for (const a of assignments ?? []) {
    usageMap[a.compartment_name_id] = (usageMap[a.compartment_name_id] ?? 0) + 1
    if (!assignmentMap[a.compartment_name_id]) assignmentMap[a.compartment_name_id] = []
    assignmentMap[a.compartment_name_id].push(a.apparatus_id)
  }

  return (
    <CompartmentsClient
      compartments={compartments ?? []}
      usageMap={usageMap}
      assignmentMap={assignmentMap}
      apparatus={apparatusList ?? []}
      departmentName={department_name}
      departmentId={department_id}
    />
  )
}
