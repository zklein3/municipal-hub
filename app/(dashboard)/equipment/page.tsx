import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function EquipmentPage() {
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

  const { data: apparatusRaw } = await adminClient
    .from('apparatus')
    .select('id, unit_number, apparatus_name, apparatus_type_id, station_id, active')
    .eq('department_id', myDept.department_id)
    .eq('active', true)
    .order('unit_number')

  const typeIds = (apparatusRaw ?? []).map(a => a.apparatus_type_id).filter(Boolean)
  const { data: typeData } = typeIds.length > 0
    ? await adminClient.from('apparatus_types').select('id, name').in('id', typeIds)
    : { data: [] }

  const stationIds = (apparatusRaw ?? []).map(a => a.station_id).filter(Boolean)
  const { data: stationData } = stationIds.length > 0
    ? await adminClient.from('stations').select('id, station_name, station_number').in('id', stationIds)
    : { data: [] }

  const typeMap = Object.fromEntries((typeData ?? []).map(t => [t.id, t.name]))
  const stationMap = Object.fromEntries((stationData ?? []).map(s => [s.id, s]))

  // Compartment counts per apparatus
  const appIds = (apparatusRaw ?? []).map(a => a.id)
  const { data: compartments } = appIds.length > 0
    ? await adminClient.from('apparatus_compartments').select('id, apparatus_id').eq('active', true).in('apparatus_id', appIds)
    : { data: [] }

  const compCountByApparatus: Record<string, number> = {}
  for (const c of compartments ?? []) {
    compCountByApparatus[c.apparatus_id] = (compCountByApparatus[c.apparatus_id] ?? 0) + 1
  }

  const apparatus = (apparatusRaw ?? []).map(a => ({
    id: a.id,
    unit_number: a.unit_number,
    apparatus_name: a.apparatus_name,
    type_name: a.apparatus_type_id ? (typeMap[a.apparatus_type_id] ?? null) : null,
    station: a.station_id ? (stationMap[a.station_id] ?? null) : null,
    compartment_count: compCountByApparatus[a.id] ?? 0,
  }))

  // Group by station
  const stationGroups = new Map<string | null, { label: string; items: typeof apparatus }>()
  for (const a of apparatus) {
    const key = a.station?.id ?? null
    if (!stationGroups.has(key)) {
      stationGroups.set(key, {
        label: a.station
          ? `Station ${a.station.station_number ? a.station.station_number + ' — ' : ''}${a.station.station_name}`
          : 'Unassigned',
        items: [],
      })
    }
    stationGroups.get(key)!.items.push(a)
  }

  const groups = Array.from(stationGroups.entries())
    .sort(([aKey], [bKey]) => {
      if (aKey === null) return 1
      if (bKey === null) return -1
      return 0
    })
    .map(([, group]) => group)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">Inventory</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Apparatus inventory and department storage</p>
      </div>

      {/* Storage card */}
      <Link
        href="/equipment/storage"
        className="flex items-center justify-between rounded-xl bg-white border border-zinc-200 shadow-sm px-5 py-4 mb-6 hover:border-red-300 hover:shadow-md transition-all group"
      >
        <div>
          <p className="text-sm font-semibold text-zinc-900 group-hover:text-red-700 transition-colors">Station Storage</p>
          <p className="text-xs text-zinc-400 mt-0.5">Unassigned pool, PAR levels, and item transfers</p>
        </div>
        <span className="text-xs font-semibold text-red-600 group-hover:text-red-800 shrink-0">View →</span>
      </Link>

      {apparatus.length === 0 ? (
        <div className="rounded-xl bg-white border border-zinc-200 px-6 py-12 text-center text-sm text-zinc-400">
          No apparatus found for this department.
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map(group => (
            <div key={group.label}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">{group.label}</h2>
                <div className="flex-1 h-px bg-zinc-200" />
              </div>

              <div className="flex flex-col gap-3">
                {group.items.map(a => (
                  <div key={a.id} className="rounded-xl bg-white border border-zinc-200 shadow-sm px-5 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-bold text-zinc-900">{a.unit_number}</span>
                        {a.apparatus_name && (
                          <span className="text-sm text-zinc-500">{a.apparatus_name}</span>
                        )}
                        {a.type_name && (
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">{a.type_name}</span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {a.compartment_count} compartment{a.compartment_count !== 1 ? 's' : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2 shrink-0">
                      <Link
                        href={`/inspections/vehicle-check/${a.id}`}
                        className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        Vehicle Check
                      </Link>
                      <Link
                        href={`/equipment/${a.id}`}
                        className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 transition-colors"
                      >
                        View Inventory
                      </Link>
                      <Link
                        href={`/equipment/${a.id}/fuel`}
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
                      >
                        Fuel Log
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
