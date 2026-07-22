import { createAdminClient } from '@/lib/supabase/admin'
import DigestAckButton from './DigestAckButton'

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}

async function getItemTitle(adminClient: ReturnType<typeof createAdminClient>, itemType: string, itemId: string) {
  if (itemType === 'event_instance') {
    const { data: instance } = await adminClient
      .from('event_instances')
      .select('id, series_id, title_override')
      .eq('id', itemId)
      .maybeSingle()
    if (!instance) return 'Event'
    if (instance.title_override) return instance.title_override
    const { data: series } = await adminClient
      .from('event_series')
      .select('title')
      .eq('id', instance.series_id)
      .maybeSingle()
    return series?.title ?? 'Event'
  }

  const { data: training } = await adminClient
    .from('training_events')
    .select('topic')
    .eq('id', itemId)
    .maybeSingle()
  return training?.topic ?? 'Training'
}

export default async function DigestAckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const adminClient = createAdminClient()

  const { data: ack } = await adminClient
    .from('event_digest_acknowledgments')
    .select('id, item_type, item_id, event_date, acknowledged_at, department_id')
    .eq('id', id)
    .maybeSingle()

  if (!ack) {
    return (
      <Shell>
        <div className="rounded-xl bg-white border border-zinc-200 p-8 text-center">
          <p className="text-sm font-semibold text-zinc-700 mb-1">This reminder link isn&apos;t valid</p>
          <p className="text-xs text-zinc-400">It may have expired or already passed.</p>
        </div>
      </Shell>
    )
  }

  const [{ data: dept }, title] = await Promise.all([
    adminClient.from('departments').select('name').eq('id', ack.department_id).single(),
    getItemTitle(adminClient, ack.item_type, ack.item_id),
  ])

  return (
    <Shell>
      <div className="mb-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{dept?.name}</p>
        <h1 className="text-xl font-bold text-zinc-900 mt-1">{title}</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{formatDate(ack.event_date)}</p>
      </div>
      <DigestAckButton id={ack.id} initiallyAcknowledged={!!ack.acknowledged_at} />
      <p className="mt-4 text-center text-xs text-zinc-400">
        This only affects your reminders — other members&apos; notifications aren&apos;t changed.
      </p>
    </Shell>
  )
}
