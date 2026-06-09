import { createAdminClient } from '@/lib/supabase/admin'
import LogsClient from './LogsClient'

export default async function LogsPage() {
  const admin = createAdminClient()

  const { data: logs } = await admin
    .from('system_logs')
    .select('id, created_at, log_type, page, message, metadata, personnel_id, department_id, resolved')
    .order('created_at', { ascending: false })

  const { data: personnel } = await admin
    .from('personnel')
    .select('id, first_name, last_name')

  const personnelMap = Object.fromEntries(
    (personnel ?? []).map((p) => [p.id, `${p.first_name} ${p.last_name}`])
  )

  // Pull related public_feedback rows for user_report logs that reference one
  const feedbackIds = [...new Set(
    (logs ?? [])
      .map((l) => (l.metadata as Record<string, unknown> | null)?.feedback_id)
      .filter((id): id is string => typeof id === 'string')
  )]

  let feedbackMap: Record<string, {
    contact_email: string | null
    contact_name: string | null
    message: string
    feedback_type: string
    reply_message: string | null
    replied_at: string | null
    replied_by_name: string | null
  }> = {}

  if (feedbackIds.length > 0) {
    const { data: feedbackRows } = await admin
      .from('public_feedback')
      .select('id, contact_email, contact_name, message, feedback_type, reply_message, replied_at, replied_by_personnel_id')
      .in('id', feedbackIds)

    feedbackMap = Object.fromEntries((feedbackRows ?? []).map((f) => [f.id, {
      contact_email: f.contact_email,
      contact_name: f.contact_name,
      message: f.message,
      feedback_type: f.feedback_type,
      reply_message: f.reply_message,
      replied_at: f.replied_at,
      replied_by_name: f.replied_by_personnel_id ? (personnelMap[f.replied_by_personnel_id] ?? null) : null,
    }]))
  }

  return <LogsClient logs={logs ?? []} personnelMap={personnelMap} feedbackMap={feedbackMap} />
}
