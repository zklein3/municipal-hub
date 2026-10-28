import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentPath } from '@/lib/current-path'
import { redirect } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import { formatLocalDateTime } from '@/lib/format-datetime'

type Line = { kind: 'item' | 'medication' | 'asset'; label: string; ok: boolean; detail: string }
type Check = { key: string; at: string; by: string; path: string; lines: Line[] }

// Every check of one bag across trucks and locations — history follows the bag, and each check shows
// where the bag was at the time (the log's location snapshot).
export default async function BagHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const adminClient = createAdminClient()

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (ctx.hasMultipleDepartments && !ctx.departmentId) redirect(`/select-department?next=${encodeURIComponent(await getCurrentPath())}`)
  if (!ctx.departmentId) redirect('/dashboard')

  const { data: bag } = await adminClient.from('medical_storerooms')
    .select('id, name, department_id, apparatus_id, container_kind, qr_code').eq('id', id).single()
  if (!bag || bag.department_id !== ctx.departmentId || bag.container_kind !== 'bag') redirect('/equipment')

  const { data: moves } = await adminClient.from('container_movement_log')
    .select('id, moved_at, from_description, to_description, meds_moved_with_bag, assets_moved_with_bag, notes')
    .eq('bag_id', id).order('moved_at', { ascending: false }).limit(50)

  const [{ data: presence }, { data: meds }, { data: assetLogs }] = await Promise.all([
    adminClient.from('compartment_presence_check_logs')
      .select('id, inspected_at, inspected_by_name, location_path, apparatus_name, item_name, present, actual_quantity, notes')
      .eq('storeroom_id', id).order('inspected_at', { ascending: false }).limit(300),
    adminClient.from('medical_supply_presence_check_logs')
      .select('id, inspected_at, inspected_by_name, location_path, apparatus_name, supply_type_name, present, actual_quantity, expiration_status, notes')
      .eq('storeroom_id', id).order('inspected_at', { ascending: false }).limit(300),
    adminClient.from('item_asset_inspection_logs')
      .select('id, inspected_at, inspected_by_name, location_path, apparatus_name, asset_id, overall_result')
      .eq('storeroom_id', id).order('inspected_at', { ascending: false }).limit(300),
  ])

  const assetIds = [...new Set((assetLogs ?? []).map(a => a.asset_id as string))]
  const { data: assets } = assetIds.length > 0
    ? await adminClient.from('item_assets').select('id, asset_tag').in('id', assetIds)
    : { data: [] as { id: string; asset_tag: string }[] }
  const tagById = new Map((assets ?? []).map(a => [a.id, a.asset_tag]))

  // One check = everything submitted at the same moment by the same person.
  const checks = new Map<string, Check>()
  const add = (at: string, by: string | null, apparatus: string | null, path: string | null, line: Line) => {
    const key = `${at}|${by ?? ''}`
    const where = [apparatus ? `Unit ${apparatus}` : null, path].filter(Boolean).join(' › ') || 'Location not recorded'
    const c = checks.get(key) ?? { key, at, by: by ?? '—', path: where, lines: [] }
    c.lines.push(line)
    checks.set(key, c)
  }
  for (const p of presence ?? []) add(p.inspected_at, p.inspected_by_name, p.apparatus_name, p.location_path,
    { kind: 'item', label: p.item_name ?? 'Item', ok: p.present, detail: p.present ? `Qty ${p.actual_quantity ?? '—'}${p.notes ? ` · ${p.notes}` : ''}` : `Missing${p.notes ? ` · ${p.notes}` : ''}` })
  for (const m of meds ?? []) add(m.inspected_at, m.inspected_by_name, m.apparatus_name, m.location_path,
    { kind: 'medication', label: m.supply_type_name ?? 'Medication', ok: m.present, detail: m.present ? `Qty ${m.actual_quantity ?? '—'}${m.expiration_status && m.expiration_status !== 'confirmed' ? ` · ${m.expiration_status.replace('_', ' ')}` : ''}${m.notes ? ` · ${m.notes}` : ''}` : `Missing${m.notes ? ` · ${m.notes}` : ''}` })
  for (const a of assetLogs ?? []) add(a.inspected_at, a.inspected_by_name, a.apparatus_name, a.location_path,
    { kind: 'asset', label: tagById.get(a.asset_id) ?? 'Asset', ok: a.overall_result === 'PASS', detail: a.overall_result })

  const ordered = [...checks.values()].sort((a, b) => b.at.localeCompare(a.at))

  return (
    <div className="pt-20 px-4 pb-4 sm:pt-0 sm:p-6 lg:p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900">🎒 {bag.name} — Check History</h1>
        <p className="text-sm text-zinc-500 mt-1">Every check of this bag, with where it was at the time.</p>
        {bag.apparatus_id && (
          <a href={`/equipment/${bag.apparatus_id}`} className="text-xs font-semibold text-blue-600 hover:underline">Open its truck →</a>
        )}
      </div>

      {(moves ?? []).length > 0 && (
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <p className="px-4 py-2.5 text-xs font-semibold text-zinc-600 uppercase tracking-wider bg-zinc-50 border-b border-zinc-100">Moves</p>
          <div className="divide-y divide-zinc-100">
            {(moves ?? []).map(m => (
              <div key={m.id} className="px-4 py-2.5">
                <p className="text-sm text-zinc-800">{m.from_description ?? '—'} → {m.to_description ?? '—'}</p>
                <p className="text-xs text-zinc-500">
                  {formatLocalDateTime(m.moved_at, ctx.departmentTimezone, { dateStyle: 'medium', timeStyle: 'short' })}
                  {' · '}Medications {m.meds_moved_with_bag ? 'moved with it' : 'left behind'}
                  {' · '}Equipment {m.assets_moved_with_bag ? 'moved with it' : 'left behind'}
                  {m.notes ? ` · ${m.notes}` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {ordered.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white px-6 py-10 text-center text-sm text-zinc-400">
          No checks recorded for this bag yet.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {ordered.map(c => {
            const problems = c.lines.filter(l => !l.ok).length
            return (
              <div key={c.key} className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-zinc-50 border-b border-zinc-100">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900">{formatLocalDateTime(c.at, ctx.departmentTimezone, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    <p className="text-xs text-zinc-500">{c.path} · {c.by}</p>
                  </div>
                  <span className={`text-xs rounded-full px-2 py-0.5 font-medium shrink-0 ${problems === 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {problems === 0 ? 'All good' : `${problems} issue${problems !== 1 ? 's' : ''}`}
                  </span>
                </div>
                <div className="divide-y divide-zinc-100">
                  {c.lines.map((l, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 px-4 py-2">
                      <p className="text-sm text-zinc-800">{l.kind === 'medication' ? '💊 ' : ''}{l.label}</p>
                      <p className={`text-xs ${l.ok ? 'text-zinc-500' : 'text-red-600 font-medium'}`}>{l.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
