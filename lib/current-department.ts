import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SELECTED_DEPARTMENT_COOKIE, SYS_ADMIN_SENTINEL } from '@/lib/auth-cookies'
import { DEFAULT_TIMEZONE } from '@/lib/format-datetime'

export type CurrentDepartmentContext = {
  personnelId: string
  firstName: string
  lastName: string
  isSysAdmin: boolean
  departmentId: string | null
  departmentName: string | null
  departmentType: string
  departmentTimezone: string
  systemRole: string | null
  hasMultipleDepartments: boolean
  // True when the user has more than one viewing option (departments and/or
  // sys admin) but the SELECTED_DEPARTMENT_COOKIE doesn't resolve to a valid
  // choice yet — caller should send them to /select-department.
  selectionPending: boolean
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
    .select('system_role, department_id, departments(name, department_type, timezone)')
    .eq('personnel_id', me.id)
    .eq('active', true)

  const isSysAdmin = me.is_sys_admin ?? false
  // Sys admin gets an extra "viewing option" alongside their real department
  // memberships, picked via /select-department like any other department.
  const totalOptions = (deptList?.length ?? 0) + (isSysAdmin ? 1 : 0)

  let dept = deptList?.[0]
  let selectionPending = false
  let viewingAsSysAdmin = isSysAdmin && (deptList?.length ?? 0) === 0

  if (totalOptions > 1) {
    const cookieStore = await cookies()
    const selectedId = cookieStore.get(SELECTED_DEPARTMENT_COOKIE)?.value
    if (isSysAdmin && selectedId === SYS_ADMIN_SENTINEL) {
      dept = undefined
      viewingAsSysAdmin = true
    } else {
      dept = deptList?.find((d) => d.department_id === selectedId)
      // No fallback here — an unmatched cookie with multiple options means
      // the caller must send the user to /select-department, not guess.
      if (!dept) selectionPending = true
      viewingAsSysAdmin = false
    }
  }

  return {
    personnelId: me.id,
    firstName: me.first_name,
    lastName: me.last_name,
    isSysAdmin,
    departmentId: viewingAsSysAdmin ? null : dept?.department_id ?? null,
    departmentName: (dept?.departments as any)?.name ?? null,
    departmentType: (dept?.departments as any)?.department_type ?? 'fire',
    departmentTimezone: (dept?.departments as any)?.timezone ?? DEFAULT_TIMEZONE,
    systemRole: dept?.system_role ?? null,
    hasMultipleDepartments: totalOptions > 1,
    selectionPending,
  }
}
