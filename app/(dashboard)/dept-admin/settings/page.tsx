import { redirect } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { createAdminClient } from '@/lib/supabase/admin'
import DeptSettingsClient from './DeptSettingsClient'

export default async function DeptSettingsPage() {
  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (!ctx.departmentId || (ctx.systemRole !== 'admin' && !ctx.isSysAdmin)) redirect('/dashboard')

  const adminClient = createAdminClient()
  const { data: deptData } = await adminClient
    .from('departments')
    .select('weekly_digest_enabled')
    .eq('id', ctx.departmentId)
    .single()

  return (
    <div className="max-w-lg">
      <DeptSettingsClient
        departmentId={ctx.departmentId}
        timezone={ctx.departmentTimezone}
        weeklyDigestEnabled={deptData?.weekly_digest_enabled ?? false}
      />
    </div>
  )
}
