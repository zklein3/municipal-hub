import { redirect } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { hasPermission } from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { findAvailableSlug } from '@/lib/public-slug'
import { slugify } from '@/lib/slug'
import DeptSettingsClient from './DeptSettingsClient'

export default async function DeptSettingsPage() {
  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (!ctx.departmentId) redirect('/dashboard')
  if (!(await hasPermission(ctx, 'manage_department_settings'))) redirect('/dashboard')

  const adminClient = createAdminClient()
  const { data: deptData } = await adminClient
    .from('departments')
    .select('name, weekly_digest_enabled, hose_testing_enabled, public_site_enabled, module_fuel_storage, public_slug')
    .eq('id', ctx.departmentId)
    .single()

  // Only prefill when no slug is set yet; an existing slug is never touched.
  const suggestedSlug = deptData?.public_slug || !deptData?.name
    ? ''
    : (await findAvailableSlug(adminClient, slugify(deptData.name), ctx.departmentId)) ?? slugify(deptData.name)

  return (
    <div className="max-w-lg">
      <DeptSettingsClient
        departmentId={ctx.departmentId}
        timezone={ctx.departmentTimezone}
        weeklyDigestEnabled={deptData?.weekly_digest_enabled ?? false}
        hoseTestingEnabled={deptData?.hose_testing_enabled ?? false}
        publicSiteEnabled={deptData?.public_site_enabled ?? false}
        fuelStorageEnabled={deptData?.module_fuel_storage ?? false}
        publicSlug={deptData?.public_slug ?? null}
        suggestedSlug={suggestedSlug}
      />
    </div>
  )
}
