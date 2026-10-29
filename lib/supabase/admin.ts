import { createClient } from '@supabase/supabase-js'
import { perfGlobal } from '@/lib/perf'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      ...perfGlobal,
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
