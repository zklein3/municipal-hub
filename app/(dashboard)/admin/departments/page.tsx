import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import DepartmentsClient from './DepartmentsClient'

export default async function DepartmentsPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const [{ data: departments }, { data: fsSetting }] = await Promise.all([
    supabase.from('departments').select('id, name, code, active, created_at').order('name'),
    admin.from('system_settings').select('value').eq('key', 'fire_school_enabled').single(),
  ])

  return (
    <DepartmentsClient
      departments={departments ?? []}
      fireSchoolEnabled={fsSetting?.value !== 'false'}
    />
  )
}
