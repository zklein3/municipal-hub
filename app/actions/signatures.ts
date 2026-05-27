'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function getMe() {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: meList } = await adminClient.from('personnel').select('id').eq('auth_user_id', user.id)
  return meList?.[0] ?? null
}

export async function getPendingSignatureCount(): Promise<number> {
  const me = await getMe()
  if (!me) return 0
  const adminClient = createAdminClient()
  const [{ count: incidentCount }, { count: eventCount }] = await Promise.all([
    adminClient.from('incident_signatures').select('id', { count: 'exact', head: true })
      .eq('personnel_id', me.id).is('signed_at', null),
    adminClient.from('event_attendance_signatures').select('id', { count: 'exact', head: true })
      .eq('personnel_id', me.id).is('signed_at', null),
  ])
  return (incidentCount ?? 0) + (eventCount ?? 0)
}

export async function getPendingSignatures() {
  const me = await getMe()
  if (!me) return { error: 'Not authenticated', data: null }
  const adminClient = createAdminClient()

  const { data: sigs } = await adminClient
    .from('incident_signatures')
    .select('id, incident_id, created_at')
    .eq('personnel_id', me.id)
    .is('signed_at', null)
    .order('created_at', { ascending: false })

  if (!sigs || sigs.length === 0) return { data: [] }

  const incidentIds = sigs.map(s => s.incident_id)
  const { data: incidents } = await adminClient
    .from('incidents')
    .select('id, incident_number, incident_date, incident_type, address, city')
    .in('id', incidentIds)

  const incidentMap = Object.fromEntries((incidents ?? []).map(i => [i.id, i]))

  const data = sigs.map(sig => ({
    sig_id: sig.id,
    incident_id: sig.incident_id,
    created_at: sig.created_at,
    incident: incidentMap[sig.incident_id] ?? null,
  }))

  return { data }
}

export async function saveIncidentSignature(formData: FormData) {
  const me = await getMe()
  if (!me) return { error: 'Not authenticated' }

  const sig_id = formData.get('sig_id') as string
  const signatureBlob = formData.get('signature') as File | null
  if (!sig_id) return { error: 'Missing signature record ID' }
  if (!signatureBlob || signatureBlob.size === 0) return { error: 'Signature is required' }

  // Convert blob to base64 data URL
  const arrayBuf = await signatureBlob.arrayBuffer()
  const b64 = Buffer.from(arrayBuf).toString('base64')
  const dataUrl = `data:image/png;base64,${b64}`

  const adminClient = createAdminClient()

  // Verify the sig belongs to this person and is unsigned
  const { data: existing } = await adminClient
    .from('incident_signatures')
    .select('id, personnel_id, signed_at, incident_id')
    .eq('id', sig_id)
    .eq('personnel_id', me.id)
    .single()

  if (!existing) return { error: 'Signature record not found' }
  if (existing.signed_at) return { error: 'Already signed' }

  const { error: updErr } = await adminClient
    .from('incident_signatures')
    .update({ signature_data: dataUrl, signed_at: new Date().toISOString() })
    .eq('id', sig_id)

  if (updErr) return { error: updErr.message }

  revalidatePath('/signatures')
  revalidatePath(`/incidents/${existing.incident_id}`)
  return { success: true }
}

export async function getIncidentSignatureRoster(incident_id: string) {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', data: null }

  const { data: meList } = await adminClient
    .from('personnel').select('id, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) return { error: 'Not found', data: null }

  // Must be officer+ in the incident's department (or sys admin)
  const { data: incList } = await adminClient
    .from('incidents').select('department_id').eq('id', incident_id)
  const inc = incList?.[0]
  if (!inc) return { error: 'Incident not found', data: null }

  if (!me.is_sys_admin) {
    const { data: dpList } = await adminClient
      .from('department_personnel')
      .select('system_role')
      .eq('personnel_id', me.id)
      .eq('department_id', inc.department_id)
      .eq('active', true)
    const dp = dpList?.[0]
    if (!dp || dp.system_role === 'member') return { error: 'Insufficient permissions', data: null }
  }

  const { data: sigs } = await adminClient
    .from('incident_signatures')
    .select('id, personnel_id, signed_at, signature_data')
    .eq('incident_id', incident_id)
    .order('signed_at', { ascending: true, nullsFirst: false })

  if (!sigs || sigs.length === 0) return { data: [] }

  const personnelIds = sigs.map(s => s.personnel_id)
  const { data: personnel } = await adminClient
    .from('personnel')
    .select('id, first_name, last_name')
    .in('id', personnelIds)

  const personnelMap = Object.fromEntries((personnel ?? []).map(p => [p.id, p]))

  const data = sigs.map(sig => ({
    sig_id: sig.id,
    personnel_id: sig.personnel_id,
    signed_at: sig.signed_at,
    has_signature: !!sig.signature_data,
    name: personnelMap[sig.personnel_id]
      ? `${personnelMap[sig.personnel_id].first_name} ${personnelMap[sig.personnel_id].last_name}`.trim()
      : '—',
  }))

  return { data }
}

// ─── Event Attendance Signatures ──────────────────────────────────────────────

export async function getPendingEventAttendanceSignatures() {
  const me = await getMe()
  if (!me) return { error: 'Not authenticated', data: null }
  const adminClient = createAdminClient()

  const { data: sigs } = await adminClient
    .from('event_attendance_signatures')
    .select('id, instance_id, created_at')
    .eq('personnel_id', me.id)
    .is('signed_at', null)
    .order('created_at', { ascending: false })

  if (!sigs || sigs.length === 0) return { data: [] }

  const instanceIds = sigs.map(s => s.instance_id)
  const { data: instances } = await adminClient
    .from('event_instances')
    .select('id, event_date, location, series_id')
    .in('id', instanceIds)

  const seriesIds = [...new Set((instances ?? []).map(i => i.series_id))]
  const { data: seriesData } = seriesIds.length > 0
    ? await adminClient.from('event_series').select('id, title, event_type').in('id', seriesIds)
    : { data: [] }

  const seriesMap = Object.fromEntries((seriesData ?? []).map(s => [s.id, s]))
  const instanceMap = Object.fromEntries((instances ?? []).map(i => [i.id, i]))

  const data = sigs.map(sig => {
    const inst = instanceMap[sig.instance_id]
    const series = inst ? seriesMap[inst.series_id] : null
    return {
      sig_id: sig.id,
      instance_id: sig.instance_id,
      created_at: sig.created_at,
      event: inst && series ? {
        title: series.title,
        event_type: series.event_type,
        event_date: inst.event_date,
        location: inst.location,
      } : null,
    }
  })

  return { data }
}

export async function saveEventAttendanceSignature(formData: FormData) {
  const me = await getMe()
  if (!me) return { error: 'Not authenticated' }

  const sig_id = formData.get('sig_id') as string
  const signatureBlob = formData.get('signature') as File | null
  if (!sig_id) return { error: 'Missing signature record ID' }
  if (!signatureBlob || signatureBlob.size === 0) return { error: 'Signature is required' }

  const arrayBuf = await signatureBlob.arrayBuffer()
  const b64 = Buffer.from(arrayBuf).toString('base64')
  const dataUrl = `data:image/png;base64,${b64}`

  const adminClient = createAdminClient()

  const { data: existing } = await adminClient
    .from('event_attendance_signatures')
    .select('id, personnel_id, signed_at')
    .eq('id', sig_id)
    .eq('personnel_id', me.id)
    .single()

  if (!existing) return { error: 'Signature record not found' }
  if (existing.signed_at) return { error: 'Already signed' }

  const { error: updErr } = await adminClient
    .from('event_attendance_signatures')
    .update({ signature_data: dataUrl, signed_at: new Date().toISOString() })
    .eq('id', sig_id)

  if (updErr) return { error: updErr.message }

  revalidatePath('/inbox')
  return { success: true }
}
