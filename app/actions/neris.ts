'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logError } from '@/lib/logger'
import { revalidatePath } from 'next/cache'
import { nerisValidateIncident, nerisSubmitIncident } from '@/lib/neris-api'

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
  no_action_reason?: string | null
  displaced_persons?: number | null
  outside_fire_acres?: number | null
  fire_condition_arrival?: string | null
  building_damage?: string | null
  suppression_appliance?: string[]
  floor_of_origin?: number | null
  room_of_origin?: string | null
  fire_cause_code?: string | null
  aid_type?: string | null
  aid_direction?: string | null
  // Medical module — per-patient records
  medical_patients?: { evaluation_care: string; improved_status: string; disposition: string }[] | null
  // Hazmat module
  hazsit_disposition?: string | null
  hazsit_evacuated?: number | null
  chemical_name?: string | null
  chemical_dot_class?: string | null
  chemical_release_occurred?: boolean | null
  // Rescue module — per-victim records
  rescue_victims?: { rescue_type: string; casualty_type: string; casualty_cause: string; entrapped: boolean; vehicle_type: string; safety_device: string }[] | null
  vehicles_involved?: number | null
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
export async function saveApparatusResponseMode(
  apparatus_incident_id: string,
  response_mode: string,
  staffing_count?: number | null
) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove) return { error: 'Only officers and admins can set response mode.' }
  const adminClient = createAdminClient()
  const updates: Record<string, string | number | null> = { response_mode: response_mode || null }
  if (staffing_count !== undefined) updates.staffing_count = staffing_count
  const { error: dbErr } = await adminClient
    .from('incident_apparatus')
    .update(updates)
    .eq('id', apparatus_incident_id)
  if (dbErr) { await logError(dbErr.message, '/incidents/neris'); return { error: dbErr.message } }
  return { success: true }
}

// ─── Reopen report for editing ───────────────────────────────────────────────
export async function reopenNerisReport(incident_id: string) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove) return { error: 'Only officers and admins can reopen NERIS reports.' }
  const adminClient = createAdminClient()
  const { error: dbErr } = await adminClient
    .from('incident_neris')
    .update({ completed_by: null, completed_at: null, updated_at: new Date().toISOString() })
    .eq('incident_id', incident_id)
  if (dbErr) { await logError(dbErr.message, '/incidents/neris'); return { error: dbErr.message } }
  revalidatePath(`/incidents/${incident_id}`)
  revalidatePath(`/incidents/${incident_id}/neris`)
  return { success: true }
}

// ─── Submit report to NERIS API ───────────────────────────────────────────────
export async function submitToNeris(incident_id: string) {
  const ctx = await getContext()
  if (!ctx?.isAdmin) return { error: 'Only admins can submit to NERIS.' }
  const department_id = ctx.department_id
  if (!department_id) return { error: 'Department not found.' }
  const adminClient = createAdminClient()

  // Fetch department's NERIS entity ID
  const { data: deptList } = await adminClient
    .from('departments')
    .select('neris_entity_id')
    .eq('id', department_id)
  const nerisEntityId = deptList?.[0]?.neris_entity_id
  if (!nerisEntityId) return { error: 'This department does not have a NERIS entity ID configured. Contact your system administrator.' }

  // Fetch incident
  const { data: incList } = await adminClient
    .from('incidents')
    .select('*')
    .eq('id', incident_id)
    .eq('department_id', department_id)
  const incident = incList?.[0]
  if (!incident) return { error: 'Incident not found.' }

  // Fetch NERIS record
  const { data: nerisList } = await adminClient
    .from('incident_neris')
    .select('*')
    .eq('incident_id', incident_id)
  const neris = nerisList?.[0]
  if (!neris) return { error: 'NERIS report not found. Save the report first.' }
  if (neris.neris_status === 'submitted') return { error: 'Already submitted to NERIS.' }
  if (!neris.completed_at) return { error: 'Mark the report as ready before submitting.' }
  if (!neris.neris_incident_type) return { error: 'NERIS incident type is required before submitting.' }

  // Fetch apparatus
  let { data: apparatus, error: apparatusError } = await adminClient
    .from('incident_apparatus')
    .select('id, apparatus_id, role, response_mode, staffing_count, paged_at, on_scene_at, leaving_scene_at, available_at')
    .eq('incident_id', incident_id)
  if (apparatusError) {
    const fallback = await adminClient
      .from('incident_apparatus')
      .select('id, apparatus_id, role, paged_at, on_scene_at, leaving_scene_at, available_at')
      .eq('incident_id', incident_id)

    apparatus = (fallback.data ?? []).map((a: any) => ({
      ...a,
      response_mode: null,
      staffing_count: null,
    }))
  }
  const apparatusIds = (apparatus ?? []).map((a: any) => a.apparatus_id).filter(Boolean)
  const { data: apparatusPersonnel } = apparatusIds.length > 0
    ? await adminClient
      .from('incident_personnel')
      .select('apparatus_id, status')
      .eq('incident_id', incident_id)
      .in('apparatus_id', apparatusIds)
    : { data: [] }
  const personnelByApparatus = new Map<string, number>()
  for (const row of apparatusPersonnel ?? []) {
    if (!row.apparatus_id || row.status === 'absent') continue
    personnelByApparatus.set(row.apparatus_id, (personnelByApparatus.get(row.apparatus_id) ?? 0) + 1)
  }
  const { data: apparatusNames } = apparatusIds.length > 0
    ? await adminClient.from('apparatus').select('id, unit_number').in('id', apparatusIds)
    : { data: [] }
  const unitNumberMap = Object.fromEntries((apparatusNames ?? []).map((a: any) => [a.id, a.unit_number]))

  // Fetch mutual aid
  const { data: mutualAid } = await adminClient
    .from('incident_mutual_aid')
    .select('*')
    .eq('incident_id', incident_id)

  // Build NERIS incident payload
  // TODO: verify exact field names against NERIS API once credentials are available
  // Payload structure based on openapi.json IncidentPayload schema
  const payload: Record<string, unknown> = {
    dispatch: {
      internal_id: incident.incident_number ?? undefined,
      cad_id: incident.cad_number ?? undefined,
      incident_start: incident.call_time ?? `${incident.incident_date}T00:00:00Z`,
      incident_end: incident.in_service_at ?? undefined,
      address: incident.address ?? undefined,
    },
    incident_types: [{ code: neris.neris_incident_type }],
  }

  if (neris.property_use || neris.displaced_persons != null) {
    payload.locations = [{
      property_use: neris.property_use ?? undefined,
      displaced_persons: neris.displaced_persons ?? undefined,
    }]
  }

  if (neris.actions_taken?.length > 0) {
    payload.actions_tactics = {
      actions: neris.actions_taken.map((code: string) => ({ code })),
    }
  } else if (neris.no_action_reason) {
    payload.actions_tactics = {
      no_action_reason: neris.no_action_reason,
    }
  }

  if (neris.aid_type) {
    payload.aids = [{
      aid_type: neris.aid_type,
      direction: neris.aid_direction ?? undefined,
    }]
  }

  if (apparatus?.length) {
    payload.unit_response = apparatus.map((a: any) => ({
      unit_id: unitNumberMap[a.apparatus_id] ?? a.apparatus_id,
      response_mode: a.response_mode ?? undefined,
      staffing_count: a.staffing_count ?? personnelByApparatus.get(a.apparatus_id) ?? undefined,
      paged_at: a.paged_at ?? undefined,
      on_scene_at: a.on_scene_at ?? undefined,
      leaving_scene_at: a.leaving_scene_at ?? undefined,
      available_at: a.available_at ?? undefined,
    }))
  }

  if (incident.narrative) {
    payload.comments = [{ comment: incident.narrative }]
  }

  // Fire module
  if (neris.fire_condition_arrival || neris.building_damage || neris.fire_cause_code || neris.outside_fire_acres != null) {
    payload.fire = {
      condition_arrival: neris.fire_condition_arrival ?? undefined,
      building_damage: neris.building_damage ?? undefined,
      cause: neris.fire_cause_code ?? undefined,
      outside_fire_acres: neris.outside_fire_acres ?? undefined,
      suppression_appliances: neris.suppression_appliance ?? undefined,
      floor_of_origin: neris.floor_of_origin ?? undefined,
      room_of_origin: neris.room_of_origin ?? undefined,
    }
  }

  // Medical module — per-patient records
  const patients = neris.medical_patients ?? []
  if (patients.length > 0) {
    payload.medical = {
      patient_count: patients.length,
      patients: patients.map((p: { evaluation_care: string; improved_status: string; disposition: string }) => ({
        evaluation_care: p.evaluation_care || undefined,
        improved_status: p.improved_status || undefined,
        disposition: p.disposition || undefined,
      })),
    }
  }

  // Hazmat module
  if (neris.hazsit_disposition || neris.chemical_name) {
    payload.hazmat = {
      disposition: neris.hazsit_disposition ?? undefined,
      evacuated: neris.hazsit_evacuated ?? undefined,
      chemical_name: neris.chemical_name ?? undefined,
      dot_class: neris.chemical_dot_class ?? undefined,
      release_occurred: neris.chemical_release_occurred ?? undefined,
    }
  }

  // Rescue module — per-victim records
  const rescueVictims = neris.rescue_victims ?? []
  if (rescueVictims.length > 0 || neris.vehicles_involved != null) {
    payload.rescue = {
      vehicles_involved: neris.vehicles_involved ?? undefined,
      victims: rescueVictims.map((v: any) => ({
        rescue_type: v.rescue_type || undefined,
        casualty_type: v.casualty_type || undefined,
        casualty_cause: v.casualty_cause || undefined,
        entrapped: v.entrapped || undefined,
        vehicle_type: v.vehicle_type || undefined,
        safety_device: v.safety_device || undefined,
      })),
    }
  }

  // Validate first
  const validation = await nerisValidateIncident(nerisEntityId, payload)
  if (!validation.ok) return { error: `NERIS validation failed: ${validation.error}` }

  // Submit
  let nerisId: string
  try {
    const result = await nerisSubmitIncident(nerisEntityId, payload)
    nerisId = result.neris_id
  } catch (err: any) {
    await logError(err.message, '/incidents/neris/submit')
    return { error: err.message }
  }

  // Update local record
  const { error: dbErr } = await adminClient
    .from('incident_neris')
    .update({
      neris_status: 'submitted',
      neris_submission_id: nerisId,
      neris_submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('incident_id', incident_id)
  if (dbErr) { await logError(dbErr.message, '/incidents/neris/submit'); return { error: dbErr.message } }

  revalidatePath(`/incidents/${incident_id}`)
  revalidatePath(`/incidents/${incident_id}/neris`)
  return { success: true, neris_id: nerisId }
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
