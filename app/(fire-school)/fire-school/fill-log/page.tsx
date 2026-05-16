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
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">Fill Log</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{logs?.length ?? 0} total fill{(logs?.length ?? 0) !== 1 ? 's' : ''} recorded</p>
      </div>

      <FillLogClient logs={logs ?? []} />
    </div>
  )
}
