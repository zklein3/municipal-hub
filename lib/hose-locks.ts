import type { SupabaseClient } from '@supabase/supabase-js'

const LOCK_STALE_MINUTES = 30

// One round trip for any number of hoses. Selecting many hoses one server
// action at a time is slow (server actions run serially per page), so Select
// All uses this instead of a claim per hose.
export async function claimHosesBulk(
  adminClient: SupabaseClient,
  departmentId: string,
  hoseIds: string[],
  sessionToken: string,
  testerName: string,
): Promise<{ claimed: string[]; blocked: string[] }> {
  const ids = [...new Set(hoseIds)]
  if (ids.length === 0) return { claimed: [], blocked: [] }

  const staleCutoff = new Date(Date.now() - LOCK_STALE_MINUTES * 60 * 1000).toISOString()
  await adminClient.from('hose_testing_locks').delete().eq('department_id', departmentId).lt('created_at', staleCutoff)

  // Only this department's in-service hoses can be claimed.
  const { data: valid } = await adminClient
    .from('hoses')
    .select('id')
    .eq('department_id', departmentId)
    .eq('status', 'in_service')
    .in('id', ids)
  const validIds = new Set((valid ?? []).map(h => h.id))

  const { data: existing } = await adminClient.from('hose_testing_locks').select('hose_id, session_token').in('hose_id', ids)
  const heldByOthers = new Set((existing ?? []).filter(l => l.session_token !== sessionToken).map(l => l.hose_id))

  const claimed = ids.filter(id => validIds.has(id) && !heldByOthers.has(id))
  const blocked = ids.filter(id => heldByOthers.has(id))
  if (claimed.length) {
    const now = new Date().toISOString()
    await adminClient.from('hose_testing_locks').upsert(
      claimed.map(hose_id => ({ department_id: departmentId, hose_id, session_token: sessionToken, tester_name: testerName || null, created_at: now })),
      { onConflict: 'hose_id' },
    )
  }
  return { claimed, blocked }
}

export async function releaseHosesBulk(
  adminClient: SupabaseClient,
  departmentId: string,
  hoseIds: string[],
  sessionToken: string,
) {
  if (hoseIds.length === 0) return
  await adminClient
    .from('hose_testing_locks')
    .delete()
    .eq('department_id', departmentId)
    .eq('session_token', sessionToken)
    .in('hose_id', hoseIds)
}
