import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { hasPermission } from '@/lib/permissions'
import PublicInboxSettingsClient from './PublicInboxSettingsClient'

export default async function PublicInboxSettingsPage() {
  const adminClient = createAdminClient()

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (!ctx.departmentId) redirect('/dashboard')
  if (!(await hasPermission(ctx, 'manage_public_site'))) redirect('/dashboard')

  const { data: dept } = await adminClient
    .from('departments')
    .select('public_site_enabled, public_slug, public_phone, public_email, public_address, public_tagline, public_about, burn_permit_county_info, burn_permit_restrictions')
    .eq('id', ctx.departmentId)
    .single()

  if (!dept?.public_site_enabled) redirect('/dashboard')

  return (
    <PublicInboxSettingsClient
      departmentId={ctx.departmentId}
      publicSlug={dept.public_slug ?? null}
      public_phone={dept.public_phone ?? null}
      public_email={dept.public_email ?? null}
      public_address={dept.public_address ?? null}
      public_tagline={dept.public_tagline ?? null}
      public_about={dept.public_about ?? null}
      burn_permit_county_info={dept.burn_permit_county_info ?? null}
      burn_permit_restrictions={dept.burn_permit_restrictions ?? null}
    />
  )
}
