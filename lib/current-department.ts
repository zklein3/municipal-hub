import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SELECTED_DEPARTMENT_COOKIE } from '@/lib/auth-cookies'

export type CurrentDepartmentContext = {
  personnelId: string
  firstName: string
  lastName: string
  isSysAdmin: boolean
  departmentId: string | null
  departmentName: string | null
  departmentType: string
  systemRole: string | null
  hasMultipleDepartments: boolean
}

/**
 * Resolves the personnel record + their *currently selected* department,
 * honoring the SELECTED_DEPARTMENT_COOKIE for users with multiple active
 * department memberships. Falls back to the sole membership for everyone else.
 * Returns null if there's no authenticated user or personnel record.
 */
export async function getCurrentDepartmentContext(): Promise<CurrentDepartmentContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const adminClient = createAdminClient()
  const { data: meList } = await adminClient
    .from('personnel')
    .select('id, first_name, last_name, is_sys_admin')
    .eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) return null

  const { data: deptList } = await adminClient
    .from('department_personnel')
    .select('system_role, department_id, departments(name, department_type)')
    .eq('personnel_id', me.id)
    .eq('active', true)

  let dept = deptList?.[0]
  if ((deptList?.length ?? 0) > 1) {
    const cookieStore = await cookies()
    const selectedId = cookieStore.get(SELECTED_DEPARTMENT_COOKIE)?.value
    // No fallback here — an unmatched cookie with multiple memberships means
    // the caller must send the user to /select-department, not guess.
    dept = deptList?.find((d) => d.department_id === selectedId)
  }

  return {
    personnelId: me.id,
    firstName: me.first_name,
    lastName: me.last_name,
    isSysAdmin: me.is_sys_admin ?? false,
    departmentId: dept?.department_id ?? null,
    departmentName: (dept?.departments as any)?.name ?? null,
    departmentType: (dept?.departments as any)?.department_type ?? 'fire',
    systemRole: dept?.system_role ?? null,
    hasMultipleDepartments: (deptList?.length ?? 0) > 1,
  }
}
