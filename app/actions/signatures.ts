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

  revalidatePath('/inbox')
  revalidatePath(`/incidents/${existing.incident_id}`)
  return { success: true }
}

// ─── Event Attendance Signatures ──────────────────────────────────────────────

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
