'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { logError } from '@/lib/logger'

export async function acknowledgeDigestItem(formData: FormData) {
  const adminClient = createAdminClient()
  const id = formData.get('id') as string
  if (!id) return { error: 'Missing reminder id.' }

  const { data: ack } = await adminClient
    .from('event_digest_acknowledgments')
    .select('id, acknowledged_at')
    .eq('id', id)
    .maybeSingle()

  if (!ack) return { error: "This reminder link isn't valid." }

  if (!ack.acknowledged_at) {
    const { error: dbErr } = await adminClient
      .from('event_digest_acknowledgments')
      .update({ acknowledged_at: new Date().toISOString() })
      .eq('id', id)
    if (dbErr) { await logError(dbErr, '/digest-ack', { metadata: { ack_id: id } }); return { error: dbErr.message } }
  }

  return { success: true }
}
