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
  property_normal_use?: string | null
  neris_narrative?: string | null
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
  // Unified persons — rescue + medical per person
  incident_persons?: { rescue_type: string; casualty_type: string; casualty_cause: string; entrapped: boolean; vehicle_type: string; safety_device: string; evaluation_care: string; improved_status: string; disposition: string }[] | null
  // Hazmat module
  hazsit_disposition?: string | null
  hazsit_evacuated?: number | null
  chemical_name?: string | null
  chemical_dot_class?: string | null
  chemical_release_occurred?: boolean | null
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
  staffing_count?: number | null,
  notes?: string | null,
) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove) return { error: 'Only officers and admins can set response mode.' }
  const adminClient = createAdminClient()
  const updates: Record<string, string | number | null> = { response_mode: response_mode || null }
  if (staffing_count !== undefined) updates.staffing_count = staffing_count
  if (notes !== undefined) updates.notes = notes || null
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

// Get state from incident — uses dedicated state field, falls back to parsing address for old records.
function getIncidentState(incident: any): string | null {
  if (incident.state) return incident.state
  if (!incident.address) return null
  const withZip = incident.address.match(/,\s*([A-Z]{2})\s+\d{5}/)
  if (withZip) return withZip[1]
  const withoutZip = incident.address.match(/,\s*([A-Z]{2})\s*$/)
  return withoutZip?.[1] ?? null
}

// ─── Shared payload builder — used by both preview and submit ─────────────────
// Payload structure confirmed against live NERIS test API during badge test (2026-05-13).
// Module field names (fire/medical/hazmat/rescue) need end-to-end verification.
function buildNerisPayload(
  incident: any,
  neris: any,
  apparatus: any[],
  personnelByApparatus: Map<string, number>,
  unitNumberMap: Record<string, string>,
  nerisEntityId: string,
): Record<string, unknown> {
  const state = getIncidentState(incident)
  const location = state ? { state } : {}

  const payload: Record<string, unknown> = {
    base: {
      department_neris_id: nerisEntityId,
      incident_number: incident.incident_number ?? incident.id,
      location,
    },
    dispatch: {
      internal_id: incident.incident_number ?? incident.id,
      call_create: incident.call_time ?? `${incident.incident_date}T00:00:00Z`,
      call_answered: incident.call_time ?? `${incident.incident_date}T00:00:00Z`,
      call_arrival: incident.call_time ?? `${incident.incident_date}T00:00:00Z`,
      location,
      // TODO(api-review): verify unit_response timing field names against NERIS openapi.json
      unit_responses: apparatus.map((a: any) => ({
        reported_id_unit: unitNumberMap[a.apparatus_id] ?? a.apparatus_id,
      })),
    },
    incident_types: neris.neris_incident_type
      ? [{ type: neris.neris_incident_type }]
      : [],
  }

  // Actions taken — action_noaction is a discriminated union on 'type'
  if (neris.actions_taken?.length > 0) {
    payload.actions_tactics = {
      action_noaction: {
        type: 'ACTION',
        actions: neris.actions_taken,
      },
    }
  } else if (neris.no_action_reason) {
    payload.actions_tactics = {
      action_noaction: {
        type: 'NOACTION',
        reason: neris.no_action_reason,
      },
    }
  }

  // TODO(api-review): narrative field name/location unknown — stripped until confirmed

  // TODO(api-review): locations, fire, medical, rescue, hazmat, aids
  // module field names need verification against NERIS openapi.json — stripped until confirmed.

  return payload
}

// ─── Preview payload (no submission) ─────────────────────────────────────────
export async function previewNerisPayload(incident_id: string) {
  const ctx = await getContext()
  if (!ctx?.isOfficerOrAbove) return { error: 'Only officers and admins can preview the NERIS payload.' }
  const department_id = ctx.department_id
  if (!department_id) return { error: 'Department not found.' }
  const adminClient = createAdminClient()

  const { data: incList } = await adminClient.from('incidents').select('*').eq('id', incident_id).eq('department_id', department_id)
  const incident = incList?.[0]
  if (!incident) return { error: 'Incident not found.' }

  const { data: nerisList } = await adminClient.from('incident_neris').select('*').eq('incident_id', incident_id)
  const neris = nerisList?.[0] ?? {}

  let { data: apparatus, error: apparatusError } = await adminClient
    .from('incident_apparatus')
    .select('id, apparatus_id, role, response_mode, staffing_count, notes, paged_at, on_scene_at, leaving_scene_at, available_at')
    .eq('incident_id', incident_id)
  if (apparatusError) {
    const fallback = await adminClient.from('incident_apparatus').select('id, apparatus_id, role, paged_at, on_scene_at, leaving_scene_at, available_at').eq('incident_id', incident_id)
    apparatus = (fallback.data ?? []).map((a: any) => ({ ...a, response_mode: null, staffing_count: null }))
  }

  const apparatusIds = (apparatus ?? []).map((a: any) => a.apparatus_id).filter(Boolean)
  const { data: apparatusPersonnel } = apparatusIds.length > 0
    ? await adminClient.from('incident_personnel').select('apparatus_id, status').eq('incident_id', incident_id).in('apparatus_id', apparatusIds)
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

  const { data: deptList } = await adminClient.from('departments').select('neris_entity_id').eq('id', department_id)
  const nerisEntityId = deptList?.[0]?.neris_entity_id ?? 'PREVIEW'

  const payload = buildNerisPayload(incident, neris, apparatus ?? [], personnelByApparatus, unitNumberMap, nerisEntityId)
  return { payload }
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
  if (!getIncidentState(incident)) return { error: 'Incident must have a State set before submitting to NERIS. Edit the incident and fill in the City, State, and Zip fields.' }

  // Fetch apparatus
  let { data: apparatus, error: apparatusError } = await adminClient
    .from('incident_apparatus')
    .select('id, apparatus_id, role, response_mode, staffing_count, notes, paged_at, on_scene_at, leaving_scene_at, available_at')
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

  const payload = buildNerisPayload(incident, neris, apparatus ?? [], personnelByApparatus, unitNumberMap, nerisEntityId)

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

  await adminClient.from('incidents').update({ neris_reported: true, status: 'finalized' }).eq('id', incident_id)

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
