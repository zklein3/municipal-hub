'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { hasPermission } from '@/lib/permissions'
import { logError } from '@/lib/logger'
import { revalidatePath } from 'next/cache'

// Per-person email opt-ins on department_personnel. Add new notification types here and in
// app/(dashboard)/dept-admin/notifications/NotificationsClient.tsx.
const NOTIFICATION_FIELDS = ['notify_feedback', 'burn_permit_reviewer', 'notify_membership_interest'] as const
export type NotificationField = typeof NOTIFICATION_FIELDS[number]

export async function setNotificationPref(deptPersonnelId: string, field: NotificationField, value: boolean) {
  if (!NOTIFICATION_FIELDS.includes(field)) return { error: 'Unknown notification type.' }

  const ctx = await getCurrentDepartmentContext()
  if (!ctx || !ctx.departmentId) return { error: 'Session expired.' }
  if (!(await hasPermission(ctx, 'manage_department_settings'))) return { error: 'Unauthorized.' }

  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient
    .from('department_personnel')
    .update({ [field]: value })
    .eq('id', deptPersonnelId)
    .eq('department_id', ctx.departmentId)
  if (dbErr) {
    await logError(dbErr.message, '/dept-admin/notifications', { department_id: ctx.departmentId })
    return { error: dbErr.message }
  }

  revalidatePath('/dept-admin/notifications')
  return { success: true }
}
