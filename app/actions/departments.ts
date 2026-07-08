'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { revalidatePath } from 'next/cache'
import { nerisCheckEntityExists } from '@/lib/neris-api'

async function assertSysAdmin(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'Not authenticated.'
  const adminClient = createAdminClient()
  const { data: meList } = await adminClient.from('personnel').select('is_sys_admin').eq('auth_user_id', user.id)
  if (!meList?.[0]?.is_sys_admin) return 'Not authorized.'
  return null
}

export async function createDepartment(formData: FormData) {
  const name = formData.get('name') as string
  const code = formData.get('code') as string

  if (!name) return { error: 'Department name is required.' }

  const authErr = await assertSysAdmin()
  if (authErr) return { error: authErr }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('departments')
    .insert({ name, code: code || null, active: true })

  if (error) return { error: error.message }

  revalidatePath('/admin/departments')
  return { success: true }
}

export async function toggleDepartment(id: string, active: boolean) {
  const authErr = await assertSysAdmin()
  if (authErr) return { error: authErr }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('departments')
    .update({ active })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/departments')
  return { success: true }
}

export async function saveDeptInspectionSettings(formData: FormData) {
  const adminClient = createAdminClient()

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) return { error: 'Not authenticated.' }
  if (!ctx.departmentId || (ctx.systemRole !== 'admin' && !ctx.isSysAdmin)) return { error: 'Only admins can change inspection settings.' }

  const hours = parseInt(formData.get('inspection_session_duration_hours') as string)
  if (!hours || hours < 1) return { error: 'Duration must be at least 1 hour.' }
  if (hours > 8760) return { error: 'Duration cannot exceed 8760 hours (1 year).' }

  const { error } = await adminClient
    .from('departments')
    .update({ inspection_session_duration_hours: hours })
    .eq('id', ctx.departmentId)
  if (error) return { error: error.message }

  revalidatePath('/dept-admin/inspections')
  return { success: true }
}

export async function updateDepartmentModules(
  departmentId: string,
  modules: { module_operations?: boolean; module_iso?: boolean; module_neris?: boolean; module_medical?: boolean; public_site_enabled?: boolean }
) {
  const authErr = await assertSysAdmin()
  if (authErr) return { error: authErr }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('departments')
    .update(modules)
    .eq('id', departmentId)

  if (error) return { error: error.message }
  revalidatePath(`/admin/dept/${departmentId}`)
  revalidatePath('/dashboard')
  return { success: true }
}

export async function setFuelStorageModule(enabled: boolean) {
  const ctx = await getCurrentDepartmentContext()
  if (!ctx) return { error: 'Not authenticated.' }
  if (ctx.systemRole !== 'admin') return { error: 'Only admins can change this setting.' }
  if (!ctx.departmentId) return { error: 'No department found.' }

  const admin = createAdminClient()
  const { error: dbErr } = await admin
    .from('departments')
    .update({ module_fuel_storage: enabled })
    .eq('id', ctx.departmentId)

  if (dbErr) return { error: dbErr.message }
  revalidatePath('/dept-admin')
  revalidatePath('/fuel')
  return { success: true }
}

export async function saveNerisEntityId(departmentId: string, nerisEntityId: string) {
  const authErr = await assertSysAdmin()
  if (authErr) return { error: authErr }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('departments')
    .update({ neris_entity_id: nerisEntityId || null })
    .eq('id', departmentId)

  if (error) return { error: error.message }
  revalidatePath(`/admin/dept/${departmentId}`)
  return { success: true }
}

export async function saveDeptAdminNerisEntityId(departmentId: string, nerisEntityId: string) {
  const adminClient = createAdminClient()

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) return { error: 'Not authenticated.' }
  if (ctx.systemRole !== 'admin' && !ctx.isSysAdmin) return { error: 'Only admins can update NERIS settings.' }
  if (ctx.departmentId !== departmentId && !ctx.isSysAdmin) return { error: 'Department mismatch.' }

  const { data: deptList } = await adminClient.from('departments').select('module_neris').eq('id', departmentId)
  if (!deptList?.[0]?.module_neris) return { error: 'NERIS is not enabled for this department.' }

  const { error } = await adminClient
    .from('departments')
    .update({ neris_entity_id: nerisEntityId || null })
    .eq('id', departmentId)

  if (error) return { error: error.message }
  revalidatePath('/dept-admin/neris')
  return { success: true }
}

export async function saveDeptTimezone(departmentId: string, timezone: string) {
  const adminClient = createAdminClient()

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) return { error: 'Not authenticated.' }
  if (ctx.systemRole !== 'admin' && !ctx.isSysAdmin) return { error: 'Only admins can update department settings.' }
  if (ctx.departmentId !== departmentId && !ctx.isSysAdmin) return { error: 'Department mismatch.' }
  if (!timezone) return { error: 'Timezone is required.' }

  const { error } = await adminClient
    .from('departments')
    .update({ timezone })
    .eq('id', departmentId)

  if (error) return { error: error.message }
  revalidatePath('/dept-admin/settings')
  return { success: true }
}

export async function testNerisConnection(nerisEntityId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated.' }
  const { data: meList } = await adminClient.from('personnel').select('id, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) return { ok: false, error: 'Not authenticated.' }
  if (!nerisEntityId.trim()) return { ok: false, error: 'Enter an Entity ID first.' }
  return nerisCheckEntityExists(nerisEntityId.trim())
}
