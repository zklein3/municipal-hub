'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logError } from '@/lib/logger'
import { revalidatePath } from 'next/cache'

async function getOfficerContext() {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: meList } = await adminClient.from('personnel').select('id').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) return null
  const { data: deptList } = await adminClient
    .from('department_personnel').select('department_id, system_role')
    .eq('personnel_id', me.id).eq('active', true)
  const dept = deptList?.[0]
  if (!dept) return null
  return { me, dept, adminClient }
}

// ─── Lane template actions ────────────────────────────────────────────────────

export async function addLaneTemplate(departmentId: string, name: string) {
  const ctx = await getOfficerContext()
  if (!ctx || ctx.dept.system_role !== 'admin') return { error: 'Admin only.' }
  if (!name.trim()) return { error: 'Name is required.' }

  const { data: existing } = await ctx.adminClient
    .from('accountability_lane_templates')
    .select('sort_order')
    .eq('department_id', departmentId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1

  const { error: dbErr } = await ctx.adminClient
    .from('accountability_lane_templates')
    .insert({ department_id: departmentId, name: name.trim(), sort_order: nextOrder, active: true })
  if (dbErr) { await logError(dbErr.message, '/dept-admin/accountability'); return { error: dbErr.message } }
  revalidatePath('/dept-admin/accountability')
  return { success: true }
}

export async function updateLaneTemplate(id: string, name: string) {
  const ctx = await getOfficerContext()
  if (!ctx || ctx.dept.system_role !== 'admin') return { error: 'Admin only.' }
  if (!name.trim()) return { error: 'Name is required.' }
  const { error: dbErr } = await ctx.adminClient
    .from('accountability_lane_templates').update({ name: name.trim() }).eq('id', id)
  if (dbErr) { await logError(dbErr.message, '/dept-admin/accountability'); return { error: dbErr.message } }
  revalidatePath('/dept-admin/accountability')
  return { success: true }
}

export async function toggleLaneTemplate(id: string, active: boolean) {
  const ctx = await getOfficerContext()
  if (!ctx || ctx.dept.system_role !== 'admin') return { error: 'Admin only.' }
  const { error: dbErr } = await ctx.adminClient
    .from('accountability_lane_templates').update({ active }).eq('id', id)
  if (dbErr) { await logError(dbErr.message, '/dept-admin/accountability'); return { error: dbErr.message } }
  revalidatePath('/dept-admin/accountability')
  return { success: true }
}

export async function reorderLaneTemplates(departmentId: string, orderedIds: string[]) {
  const ctx = await getOfficerContext()
  if (!ctx || ctx.dept.system_role !== 'admin') return { error: 'Admin only.' }
  const updates = orderedIds.map((id, i) =>
    ctx.adminClient.from('accountability_lane_templates').update({ sort_order: i }).eq('id', id).eq('department_id', departmentId)
  )
  await Promise.all(updates)
  revalidatePath('/dept-admin/accountability')
  return { success: true }
}
