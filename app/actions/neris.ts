'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logError } from '@/lib/logger'
import { revalidatePath } from 'next/cache'

async function getContext() {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: meList } = await adminClient.from('personnel').select('id, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) return null
  const { data: myDeptList } = await adminClient.from('department_personnel').select('department_id, system_role').eq('personnel_id', me.id).eq('active', true)
  const myDept = myDeptList?.[0]
  return {
    me,
    user_id: user.id,
    department_id: myDept?.department_id ?? null,
    system_role: myDept?.system_role ?? null,
    isOfficerOrAbove: myDept?.system_role === 'admin' || myDept?.system_role === 'officer' || me.is_sys_admin,
    isAdmin: myDept?.system_role === 'admin' || me.is_sys_admin,
  }
}

// ─── Get or create NERIS record ───────────────────────────────────────────────
// Returns existing record or creates a blank draft.
export async function getOrCreateNerisRecord(incident_id: string) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove) return { error: 'Only officers and admins can access NERIS reports.' }
  const department_id = ctx.department_id
  if (!department_id) return { error: 'Department not found.' }
  const adminClient = createAdminClient()

  // Verify incident belongs to dept
  const { data: incidentList } = await adminClient
    .from('incidents')
    .select('id, department_id')
    .eq('id', incident_id)
    .eq('department_id', department_id)
  if (!incidentList?.[0]) return { error: 'Incident not found.' }

  const { data: existing } = await adminClient
    .from('incident_neris')
    .select('*')
    .eq('incident_id', incident_id)
  if (existing?.[0]) return { success: true, record: existing[0] }

  const { data: created, error: dbErr } = await adminClient
    .from('incident_neris')
    .insert({ incident_id, department_id, neris_status: 'draft' })
    .select('*')
    .single()
  if (dbErr) { await logError(dbErr.message, '/incidents/neris'); return { error: dbErr.message } }
  return { success: true, record: created }
}

// ─── Save NERIS report (upsert) ───────────────────────────────────────────────
export async function saveNerisReport(incident_id: string, data: {
  neris_incident_type?: string | null
  property_use?: string | null
  actions_taken?: string[]
  displaced_persons?: number | null
  fire_condition_arrival?: string | null
  building_damage?: string | null
  suppression_appliance?: string[]
  floor_of_origin?: number | null
  room_of_origin?: string | null
  fire_cause_code?: string | null
  aid_type?: string | null
  aid_direction?: string | null
  // Medical module
  patient_count?: number | null
  patient_evaluation_care?: string | null
  patient_improved_status?: string | null
  medical_disposition?: string | null
  // Hazmat module
  hazsit_disposition?: string | null
  hazsit_evacuated?: number | null
  chemical_name?: string | null
  chemical_dot_class?: string | null
  chemical_release_occurred?: boolean | null
  // Rescue module
  rescue_type?: string | null
  casualty_type?: string | null
  casualty_cause?: string | null
}) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove) return { error: 'Only officers and admins can save NERIS reports.' }
  const department_id = ctx.department_id
  if (!department_id) return { error: 'Department not found.' }
  const adminClient = createAdminClient()

  const { data: existing } = await adminClient
    .from('incident_neris')
    .select('id, neris_status')
    .eq('incident_id', incident_id)
  const record = existing?.[0]

  if (record?.neris_status === 'submitted') {
    return { error: 'This report has already been submitted to NERIS and cannot be edited.' }
  }

  const payload = {
    ...data,
    updated_at: new Date().toISOString(),
  }

  let dbErr
  if (record) {
    const { error } = await adminClient
      .from('incident_neris')
      .update(payload)
      .eq('id', record.id)
    dbErr = error
  } else {
    const { error } = await adminClient
      .from('incident_neris')
      .insert({ incident_id, department_id, neris_status: 'draft', ...payload })
    dbErr = error
  }

  if (dbErr) { await logError(dbErr.message, '/incidents/neris'); return { error: dbErr.message } }
  revalidatePath(`/incidents/${incident_id}`)
  revalidatePath(`/incidents/${incident_id}/neris`)
  return { success: true }
}

// ─── Save response mode per apparatus ────────────────────────────────────────
export async function saveApparatusResponseMode(apparatus_incident_id: string, response_mode: string) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove) return { error: 'Only officers and admins can set response mode.' }
  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient
    .from('incident_apparatus')
    .update({ response_mode })
    .eq('id', apparatus_incident_id)
  if (dbErr) { await logError(dbErr.message, '/incidents/neris'); return { error: dbErr.message } }
  return { success: true }
}

// ─── Mark report complete ─────────────────────────────────────────────────────
export async function markNerisComplete(incident_id: string) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove) return { error: 'Only officers and admins can complete NERIS reports.' }
  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient
    .from('incident_neris')
    .update({
      neris_status: 'draft',
      completed_by: ctx.user_id,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('incident_id', incident_id)
  if (dbErr) { await logError(dbErr.message, '/incidents/neris'); return { error: dbErr.message } }
  revalidatePath(`/incidents/${incident_id}`)
  revalidatePath(`/incidents/${incident_id}/neris`)
  return { success: true }
}
