import { createAdminClient } from '@/lib/supabase/admin'
import FillLogClient from './FillLogClient'

export const dynamic = 'force-dynamic'

export default async function FireSchoolFillLogPage() {
  const adminClient = createAdminClient()

  const { data: logs } = await adminClient
    .from('fire_school_fill_logs')
    .select('*')
    .order('filled_at', { ascending: false })

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">Fill Log</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{logs?.length ?? 0} total fill{(logs?.length ?? 0) !== 1 ? 's' : ''} recorded</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 mt-1">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          Live
        </span>
      </div>

      <FillLogClient logs={logs ?? []} />
    </div>
  )
}
