import { createAdminClient } from '@/lib/supabase/admin'
import { parseSalamanderCard, isFireOps7Card, parseFireOps7Card, unescapeDebugRaw } from '@/lib/salamander'
import QrDebugScansClient from './QrDebugScansClient'

export default async function QrDebugScansPage() {
  const adminClient = createAdminClient()

  const { data: scans } = await adminClient
    .from('qr_debug_scans')
    .select('id, raw_value, scanned_at, source')
    .order('scanned_at', { ascending: false })

  const rows = (scans ?? []).map(scan => {
    const restored = unescapeDebugRaw(scan.raw_value)
    const fireOps7Id = isFireOps7Card(restored) ? parseFireOps7Card(restored) : null
    const card = fireOps7Id ? null : parseSalamanderCard(restored)
    const parses = !!fireOps7Id || !!card

    return {
      id: scan.id,
      scanned_at: scan.scanned_at,
      raw_value: scan.raw_value,
      source: scan.source,
      parses,
      fireOps7Id,
      card,
    }
  })

  return <QrDebugScansClient rows={rows} />
}
