'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { nerisCheckEntityExists } from '@/lib/neris-api'

export async function createDepartment(formData: FormData) {
  const name = formData.get('name') as string
  const code = formData.get('code') as string

  if (!name) return { error: 'Department name is required.' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('departments')
    .insert({ name, code: code || null, active: true })

  if (error) return { error: error.message }

  revalidatePath('/admin/departments')
  return { success: true }
}

export async function toggleDepartment(id: string, active: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('departments')
    .update({ active })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/departments')
  return { success: true }
}

export async function saveDeptInspectionSettings(formData: FormData) {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: meList } = await adminClient.from('personnel').select('id, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) return { error: 'Not authenticated.' }

  const { data: myDeptList } = await adminClient.from('department_personnel').select('department_id, system_role').eq('personnel_id', me.id).eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept || (myDept.system_role !== 'admin' && !me.is_sys_admin)) return { error: 'Only admins can change inspection settings.' }

  const hours = parseInt(formData.get('inspection_session_duration_hours') as string)
  if (!hours || hours < 1) return { error: 'Duration must be at least 1 hour.' }
  if (hours > 8760) return { error: 'Duration cannot exceed 8760 hours (1 year).' }

  const { error } = await adminClient
    .from('departments')
    .update({ inspection_session_duration_hours: hours })
    .eq('id', myDept.department_id)
  if (error) return { error: error.message }

  revalidatePath('/dept-admin/inspections')
  return { success: true }
}

export async function updateDepartmentModules(
  departmentId: string,
  modules: { module_operations?: boolean; module_iso?: boolean; module_neris?: boolean; module_medical?: boolean; public_site_enabled?: boolean }
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('departments')
    .update(modules)
    .eq('id', departmentId)

  if (error) return { error: error.message }
  revalidatePath(`/admin/dept/${departmentId}`)
  revalidatePath('/dashboard')
  return { success: true }
}

export async function saveNerisEntityId(departmentId: string, nerisEntityId: string) {
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
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: meList } = await adminClient.from('personnel').select('id, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) return { error: 'Not authenticated.' }

  const { data: myDeptList } = await adminClient
    .from('department_personnel')
    .select('department_id, system_role')
    .eq('personnel_id', me.id)
    .eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept || (myDept.system_role !== 'admin' && !me.is_sys_admin)) return { error: 'Only admins can update NERIS settings.' }
  if (myDept.department_id !== departmentId) return { error: 'Department mismatch.' }

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
