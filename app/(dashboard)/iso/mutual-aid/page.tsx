import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import MutualAidClient from './MutualAidClient'

export default async function MutualAidPage() {
  const adminClient = createAdminClient()

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (ctx.hasMultipleDepartments && !ctx.departmentId) redirect('/select-department')
  if (!ctx.departmentId) redirect('/dashboard')

  const { data: deptFlags } = await adminClient.from('departments').select('module_iso').eq('id', ctx.departmentId).single()
  if (!deptFlags?.module_iso) redirect('/dashboard')

  const isOfficerOrAbove = ctx.systemRole === 'admin' || ctx.systemRole === 'officer' || ctx.isSysAdmin

  const { data: agreements } = await adminClient
    .from('iso_mutual_aid_agreements')
    .select('id, partner_department, agreement_type, effective_date, expiration_date, active, notes, apparatus')
    .eq('department_id', ctx.departmentId)
    .order('active', { ascending: false })
    .order('partner_department')

  return (
    <MutualAidClient
      agreements={agreements ?? []}
      isOfficerOrAbove={isOfficerOrAbove}
    />
  )
}
