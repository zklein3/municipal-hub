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

// ─── Incident accountability actions ─────────────────────────────────────────

export async function initIncidentLanes(incidentId: string) {
  const ctx = await getOfficerContext()
  if (!ctx) return { error: 'Not authenticated.' }

  // Get dept id from incident
  const { data: incList } = await ctx.adminClient.from('incidents').select('department_id').eq('id', incidentId)
  const inc = incList?.[0]
  if (!inc) return { error: 'Incident not found.' }

  // Pull active template lanes
  const { data: templates } = await ctx.adminClient
    .from('accountability_lane_templates')
    .select('name, sort_order')
    .eq('department_id', inc.department_id)
    .eq('active', true)
    .order('sort_order')

  if (!templates?.length) return { error: 'No lane templates configured. Set them up in Dept Admin → Accountability.' }

  const rows = templates.map(t => ({ incident_id: incidentId, name: t.name, sort_order: t.sort_order, created_by: ctx.me.id }))
  const { data: inserted, error: dbErr } = await ctx.adminClient
    .from('incident_accountability_lanes').insert(rows).select('id, name, sort_order')
  if (dbErr) { await logError(dbErr.message, '/incidents'); return { error: dbErr.message } }
  return { success: true, lanes: inserted ?? [] }
}

export async function addIncidentLane(incidentId: string, name: string) {
  const ctx = await getOfficerContext()
  if (!ctx) return { error: 'Not authenticated.' }
  if (!name.trim()) return { error: 'Name required.' }

  const { data: existing } = await ctx.adminClient
    .from('incident_accountability_lanes').select('sort_order')
    .eq('incident_id', incidentId).order('sort_order', { ascending: false }).limit(1)
  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1

  const { data: row, error: dbErr } = await ctx.adminClient
    .from('incident_accountability_lanes')
    .insert({ incident_id: incidentId, name: name.trim(), sort_order: nextOrder, created_by: ctx.me.id })
    .select('id, name, sort_order').single()
  if (dbErr) { await logError(dbErr.message, '/incidents'); return { error: dbErr.message } }
  return { success: true, lane: row }
}

export async function checkInPerson(
  incidentId: string,
  laneId: string | null,
  personnelId: string | null,
  rawName: string | null,
  rawDept: string | null
) {
  const ctx = await getOfficerContext()
  if (!ctx) return { error: 'Not authenticated.' }
  if (!personnelId && !rawName) return { error: 'Must provide personnel or name.' }

  const { data: row, error: dbErr } = await ctx.adminClient
    .from('incident_accountability')
    .insert({ incident_id: incidentId, lane_id: laneId, personnel_id: personnelId, raw_name: rawName, raw_dept: rawDept, added_by: ctx.me.id })
    .select('id, lane_id, personnel_id, raw_name, raw_dept, status, checked_in_at').single()
  if (dbErr) { await logError(dbErr.message, '/incidents'); return { error: dbErr.message } }
  return { success: true, entry: row }
}

export async function movePersonToLane(entryId: string, laneId: string) {
  const ctx = await getOfficerContext()
  if (!ctx) return { error: 'Not authenticated.' }
  const { error: dbErr } = await ctx.adminClient
    .from('incident_accountability').update({ lane_id: laneId }).eq('id', entryId)
  if (dbErr) { await logError(dbErr.message, '/incidents'); return { error: dbErr.message } }
  return { success: true }
}

export async function removeAccountabilityEntry(entryId: string) {
  const ctx = await getOfficerContext()
  if (!ctx) return { error: 'Not authenticated.' }
  const { error: dbErr } = await ctx.adminClient
    .from('incident_accountability').delete().eq('id', entryId)
  if (dbErr) { await logError(dbErr.message, '/incidents'); return { error: dbErr.message } }
  return { success: true }
}

export async function recordPAR(incidentId: string, snapshot: { lane_name: string; count: number; names: string[] }[]) {
  const ctx = await getOfficerContext()
  if (!ctx) return { error: 'Not authenticated.' }
  const { error: dbErr } = await ctx.adminClient
    .from('incident_par_checks')
    .insert({ incident_id: incidentId, checked_by: ctx.me.id, snapshot })
  if (dbErr) { await logError(dbErr.message, '/incidents'); return { error: dbErr.message } }
  return { success: true }
}
