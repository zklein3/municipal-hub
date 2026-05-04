import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl bg-white border border-zinc-200 p-4">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-zinc-900">{value}</p>
      {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default async function IsoReportPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: meList } = await adminClient.from('personnel').select('id, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) redirect('/login')

  const { data: myDeptList } = await adminClient.from('department_personnel').select('department_id, system_role').eq('personnel_id', me.id).eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept) redirect('/dashboard')

  const department_id = myDept.department_id
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const oneYearAgoStr = oneYearAgo.toISOString().slice(0, 10)

  // Apparatus specs coverage
  const { data: allApparatus } = await adminClient
    .from('apparatus')
    .select('id, unit_number, make, model, model_year, exclude_from_iso')
    .eq('department_id', department_id)
    .eq('active', true)
    .order('unit_number')

  const { data: isoSpecs } = await adminClient
    .from('apparatus_iso_specs')
    .select('apparatus_id, pump_rating_gpm, tank_capacity_gal, foam_capacity_gal, aerial_length_ft, hose_load_notes')
    .eq('department_id', department_id)

  const isoSpecMap = Object.fromEntries((isoSpecs ?? []).map(s => [s.apparatus_id, s]))

  // Hose stats
  const { data: hoses } = await adminClient
    .from('hoses')
    .select('id, hose_identifier, hose_type, diameter_in, length_ft, status, apparatus_id')
    .eq('department_id', department_id)
    .neq('status', 'retired')

  const { data: recentHoseTests } = await adminClient
    .from('hose_tests')
    .select('hose_id, test_date, passed')
    .eq('department_id', department_id)
    .gte('test_date', oneYearAgoStr)
    .order('test_date', { ascending: false })

  const testedHoseIds = new Set((recentHoseTests ?? []).map(t => t.hose_id))
  const hosesFailed = new Set((recentHoseTests ?? []).filter(t => !t.passed).map(t => t.hose_id))

  // Hydrant stats
  const { data: hydrants } = await adminClient
    .from('hydrants')
    .select('id, hydrant_number, location_description, out_of_service')
    .eq('department_id', department_id)

  const { data: recentFlowTests } = await adminClient
    .from('hydrant_flow_tests')
    .select('hydrant_id, test_date, flow_gpm')
    .eq('department_id', department_id)
    .gte('test_date', oneYearAgoStr)
    .order('test_date', { ascending: false })

  const testedHydrantIds = new Set((recentFlowTests ?? []).map(t => t.hydrant_id))

  // Mutual aid (last 12 months)
  const { data: mutualAidRaw } = await adminClient
    .from('incident_mutual_aid')
    .select('id, external_department_name, role, apparatus_description, personnel_count, created_at')
    .eq('department_id', department_id)
    .order('created_at', { ascending: false })
    .limit(20)

  const isoApparatus = (allApparatus ?? []).filter(a => !a.exclude_from_iso)
  const excludedApparatus = (allApparatus ?? []).filter(a => a.exclude_from_iso)
  const totalApparatus = isoApparatus.length
  const specsComplete = isoApparatus.filter(a => isoSpecMap[a.id]).length

  const activeHoses = (hoses ?? []).filter(h => h.status === 'in_service')
  const hosesTestedPct = activeHoses.length > 0
    ? Math.round((activeHoses.filter(h => testedHoseIds.has(h.id)).length / activeHoses.length) * 100)
    : null

  const totalHydrants = (hydrants ?? []).length
  const hydrantsTestedPct = totalHydrants > 0
    ? Math.round((hydrants ?? []).filter(h => testedHydrantIds.has(h.id)).length / totalHydrants * 100)
    : null

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900">ISO Report</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Coverage summary for ISO audit preparation</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-8">
        <StatCard label="Apparatus Specs" value={`${specsComplete}/${totalApparatus}`} sub="ISO specs entered" />
        <StatCard label="Hose Test Rate" value={hosesTestedPct != null ? `${hosesTestedPct}%` : '—'} sub="tested past 12 months" />
        <StatCard label="Hydrant Flow Rate" value={hydrantsTestedPct != null ? `${hydrantsTestedPct}%` : '—'} sub="tested past 12 months" />
        <StatCard label="Mutual Aid Logged" value={(mutualAidRaw ?? []).length} sub="recent entries" />
      </div>

      {/* Apparatus specs table */}
      <section className="rounded-xl bg-white border border-zinc-200 p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-900">Apparatus Specifications</h2>
        </div>
        {totalApparatus === 0 && excludedApparatus.length === 0 ? (
          <p className="text-sm text-zinc-400">No active apparatus.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-zinc-400 border-b border-zinc-100">
                  <th className="pb-2 font-medium pr-4">Unit</th>
                  <th className="pb-2 font-medium pr-4">Year/Make/Model</th>
                  <th className="pb-2 font-medium pr-4">Pump (GPM)</th>
                  <th className="pb-2 font-medium pr-4">Tank (gal)</th>
                  <th className="pb-2 font-medium pr-4">Aerial (ft)</th>
                  <th className="pb-2 font-medium">ISO Specs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {isoApparatus.map(a => {
                  const spec = isoSpecMap[a.id]
                  return (
                    <tr key={a.id}>
                      <td className="py-2 pr-4 font-medium text-zinc-800">
                        <Link href={`/apparatus/${a.id}`} className="hover:underline text-red-700">{a.unit_number}</Link>
                      </td>
                      <td className="py-2 pr-4 text-zinc-600">
                        {[a.model_year, a.make, a.model].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td className="py-2 pr-4 text-zinc-600">{spec?.pump_rating_gpm ?? '—'}</td>
                      <td className="py-2 pr-4 text-zinc-600">{spec?.tank_capacity_gal ?? '—'}</td>
                      <td className="py-2 pr-4 text-zinc-600">{spec?.aerial_length_ft ?? '—'}</td>
                      <td className="py-2">
                        <span className={`rounded-full px-2 py-0.5 font-medium ${spec ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-400'}`}>
                          {spec ? 'Complete' : 'Missing'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {excludedApparatus.map(a => (
                  <tr key={a.id} className="opacity-50">
                    <td className="py-2 pr-4 font-medium text-zinc-500">
                      <Link href={`/apparatus/${a.id}`} className="hover:underline">{a.unit_number}</Link>
                    </td>
                    <td className="py-2 pr-4 text-zinc-400">
                      {[a.model_year, a.make, a.model].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="py-2 pr-4 text-zinc-400">—</td>
                    <td className="py-2 pr-4 text-zinc-400">—</td>
                    <td className="py-2 pr-4 text-zinc-400">—</td>
                    <td className="py-2">
                      <span className="rounded-full px-2 py-0.5 font-medium bg-zinc-100 text-zinc-400">
                        Excluded
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Hose compliance */}
      <section className="rounded-xl bg-white border border-zinc-200 p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-900">Hose Test Compliance (NFPA 1962)</h2>
          <Link href="/iso/hoses" className="text-xs text-red-700 hover:underline font-medium">Manage →</Link>
        </div>
        {activeHoses.length === 0 ? (
          <p className="text-sm text-zinc-400">No active hoses. <Link href="/iso/hoses" className="text-red-600 hover:underline">Add hoses →</Link></p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {activeHoses.map(h => {
              const tested = testedHoseIds.has(h.id)
              const failed = hosesFailed.has(h.id)
              return (
                <div key={h.id} className="flex items-center gap-3 text-xs py-1 border-b border-zinc-50 last:border-0">
                  <span className="font-mono font-medium text-zinc-800 w-20 shrink-0">{h.hose_identifier}</span>
                  <span className="text-zinc-500 w-16 shrink-0 capitalize">{h.hose_type.replace('_', ' ')}</span>
                  <span className="text-zinc-400">{h.diameter_in}" × {h.length_ft}ft</span>
                  <span className={`ml-auto rounded-full px-2 py-0.5 font-medium shrink-0 ${
                    failed ? 'bg-red-100 text-red-700' :
                    tested ? 'bg-green-100 text-green-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {failed ? 'Failed' : tested ? 'Tested' : 'Overdue'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Hydrant compliance */}
      <section className="rounded-xl bg-white border border-zinc-200 p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-900">Hydrant Flow Test Compliance</h2>
          <Link href="/iso/hydrants" className="text-xs text-red-700 hover:underline font-medium">Manage →</Link>
        </div>
        {(hydrants ?? []).length === 0 ? (
          <p className="text-sm text-zinc-400">No hydrants added. <Link href="/iso/hydrants" className="text-red-600 hover:underline">Add hydrants →</Link></p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {(hydrants ?? []).map(h => {
              const tested = testedHydrantIds.has(h.id)
              return (
                <div key={h.id} className="flex items-center gap-3 text-xs py-1 border-b border-zinc-50 last:border-0">
                  <span className="font-mono font-medium text-zinc-800 w-16 shrink-0">{h.hydrant_number}</span>
                  <span className="text-zinc-600 min-w-0 truncate">{h.location_description}</span>
                  {h.out_of_service && <span className="text-xs text-red-600 shrink-0">OOS</span>}
                  <span className={`ml-auto rounded-full px-2 py-0.5 font-medium shrink-0 ${tested ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {tested ? 'Tested' : 'Overdue'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Mutual aid log */}
      <section className="rounded-xl bg-white border border-zinc-200 p-5 mb-8">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">Mutual Aid Log</h2>
        {(mutualAidRaw ?? []).length === 0 ? (
          <p className="text-sm text-zinc-400">No mutual aid entries. Log entries from the Incidents page.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {(mutualAidRaw ?? []).map(m => (
              <div key={m.id} className="flex items-start gap-3 text-xs py-1.5 border-b border-zinc-50 last:border-0">
                <span className={`shrink-0 rounded-full px-2 py-0.5 font-medium ${m.role === 'gave_aid' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                  {m.role === 'gave_aid' ? 'Gave Aid' : 'Received Aid'}
                </span>
                <div className="min-w-0">
                  <span className="font-medium text-zinc-800">{m.external_department_name}</span>
                  {m.apparatus_description && <span className="text-zinc-400 ml-2">· {m.apparatus_description}</span>}
                  {m.personnel_count != null && <span className="text-zinc-400 ml-2">· {m.personnel_count} personnel</span>}
                  <p className="text-zinc-400 mt-0.5">{formatDate(m.created_at.slice(0, 10))}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
