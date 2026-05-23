import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import PrintButton from '../training-signin/PrintButton'

export default async function RunSheetPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  if (!id) return <p style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Missing incident id.</p>

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()

  const { data: meList } = await adminClient.from('personnel').select('id, is_sys_admin').eq('auth_user_id', user.id)
  const me = meList?.[0]
  if (!me) redirect('/login')

  const { data: myDeptList } = await adminClient
    .from('department_personnel').select('department_id, system_role').eq('personnel_id', me.id).eq('active', true)
  const myDept = myDeptList?.[0]
  if (!myDept && !me.is_sys_admin) redirect('/login')

  const { data: incident } = await adminClient.from('incidents').select('*').eq('id', id).single()
  if (!incident) return <p style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Incident not found.</p>

  const { data: dept } = await adminClient.from('departments').select('name').eq('id', incident.department_id).single()

  const { data: incApparatus } = await adminClient
    .from('incident_apparatus')
    .select('id, apparatus_id, enroute_at')
    .eq('incident_id', id)

  const apparatusIds = (incApparatus ?? []).map(a => a.apparatus_id).filter(Boolean)
  const { data: apparatusNames } = apparatusIds.length > 0
    ? await adminClient.from('apparatus').select('id, unit_number').in('id', apparatusIds)
    : { data: [] }
  const apparatusNameMap = Object.fromEntries((apparatusNames ?? []).map(a => [a.id, a.unit_number]))

  const { data: incPersonnel } = await adminClient
    .from('incident_personnel')
    .select('personnel_id, apparatus_id, role, status')
    .eq('incident_id', id)
    .neq('status', 'absent')

  // All dept personnel — build name map
  const { data: deptPersonnelRaw } = await adminClient
    .from('department_personnel')
    .select('personnel_id, personnel(id, first_name, last_name)')
    .eq('department_id', incident.department_id)
    .eq('active', true)

  const personnelNameMap: Record<string, string> = {}
  const allPersonnel: { id: string; name: string; responded: boolean }[] = []
  const respondedIds = new Set((incPersonnel ?? []).map(p => p.personnel_id))

  for (const dp of deptPersonnelRaw ?? []) {
    const p = dp.personnel as any
    const pid = p?.id ?? dp.personnel_id
    const name = `${p?.last_name ?? ''}, ${p?.first_name ?? ''}`.trim().replace(/^,\s*/, '')
    personnelNameMap[pid] = name
    allPersonnel.push({ id: pid, name, responded: respondedIds.has(pid) })
  }
  allPersonnel.sort((a, b) => a.name.localeCompare(b.name))

  // Build apparatus groups: each unit + Station group for unassigned
  type ApparatusGroup = { unitLabel: string; members: string[] }
  const apparatusGroups: ApparatusGroup[] = []

  for (const a of incApparatus ?? []) {
    const unit = apparatusNameMap[a.apparatus_id] ?? '—'
    const members = (incPersonnel ?? [])
      .filter(p => p.apparatus_id === a.apparatus_id)
      .map(p => personnelNameMap[p.personnel_id] ?? '—')
      .sort()
    apparatusGroups.push({ unitLabel: unit, members })
  }

  // Station: personnel with no apparatus_id
  const stationMembers = (incPersonnel ?? [])
    .filter(p => !p.apparatus_id)
    .map(p => {
      const name = personnelNameMap[p.personnel_id] ?? '—'
      const roleLabel = p.role === 'standby' ? ' (Standby)' : p.role === 'other' ? '' : ''
      return name + roleLabel
    })
    .sort()

  if (stationMembers.length > 0) {
    apparatusGroups.push({ unitLabel: 'Station', members: stationMembers })
  }

  // Mutual aid — all records, split by role
  const { data: mutualAidRows } = await adminClient
    .from('incident_mutual_aid').select('external_department_name, role').eq('incident_id', id)
  const maGave     = (mutualAidRows ?? []).filter(m => m.role === 'gave_aid').map(m => m.external_department_name)
  const maReceived = (mutualAidRows ?? []).filter(m => m.role === 'received_aid').map(m => m.external_department_name)

  function milTime(dt: string | null) {
    if (!dt) return ''
    const d = new Date(dt)
    return `${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`
  }
  function fmtDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
  }

  const incType = incident.incident_type ?? ''
  const isFire      = incType === 'fire'
  const isRescue    = incType === 'rescue'
  const isStandby   = incType === 'standby'
  const isMeeting   = incType === 'meeting' || incType === 'special'
  const isTraining  = incType === 'training'
  const isMutualAid = incType === 'mutual_aid' || !!incident.mutual_aid_direction || (mutualAidRows ?? []).length > 0
  const hasMutualAidOut = maGave.length > 0 || incident.mutual_aid_direction === 'to'   || incident.mutual_aid_direction === 'both'
  const hasMutualAidIn  = maReceived.length > 0 || incident.mutual_aid_direction === 'from' || incident.mutual_aid_direction === 'both'
  // Department name strings — prefer detailed table, fall back to flat incident field
  const maToNames   = maGave.length > 0 ? maGave.join(', ') : (hasMutualAidOut ? (incident.mutual_aid_department ?? '') : '')
  const maFromNames = maReceived.length > 0 ? maReceived.join(', ') : (hasMutualAidIn && incident.mutual_aid_direction !== 'to' ? (incident.mutual_aid_department ?? '') : '')

  const enrouteTimes = (incApparatus ?? []).map(a => a.enroute_at).filter(Boolean)
  const earliestEnroute = enrouteTimes.length > 0 ? enrouteTimes.reduce((a, b) => (a! < b! ? a : b)) : null

  const deptName = dept?.name ?? 'Fire Department'

  const colSize = Math.ceil(allPersonnel.length / 3)
  const col1 = allPersonnel.slice(0, colSize)
  const col2 = allPersonnel.slice(colSize, colSize * 2)
  const col3 = allPersonnel.slice(colSize * 2)

  const S: Record<string, React.CSSProperties> = {
    page:      { fontFamily: 'Arial, sans-serif', fontSize: '10pt', color: '#000', background: '#fff', padding: '0.6in 0.75in', maxWidth: '8.5in', margin: '0 auto' },
    label:     { fontWeight: 700, marginRight: '0.1in', whiteSpace: 'nowrap' },
    line:      { borderBottom: '1px solid #000', display: 'inline-block', minWidth: '2.5in', verticalAlign: 'bottom' },
    shortLine: { borderBottom: '1px solid #000', display: 'inline-block', minWidth: '1in', verticalAlign: 'bottom' },
    row:       { marginBottom: '0.11in', display: 'flex', alignItems: 'flex-end', gap: '0.1in' },
    divider:   { borderTop: '2px solid #000', margin: '0.15in 0' },
    secHdr:    { fontWeight: 700, textDecoration: 'underline', marginBottom: '0.1in' },
    checkBox:  { display: 'inline-block', width: '14px', height: '14px', border: '1px solid #000', verticalAlign: 'middle', marginRight: '4px', textAlign: 'center', lineHeight: '14px', fontSize: '10pt', flexShrink: 0 },
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 0.5in; size: letter portrait; }
          body { margin: 0; }
        }
      `}</style>
      <PrintButton />

      <div style={S.page}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '0.2in' }}>
          <div style={{ fontWeight: 700, fontSize: '12pt' }}>{deptName.toUpperCase()}</div>
          <div style={{ fontWeight: 700, fontSize: '12pt' }}>RUN FIELD REPORT</div>
        </div>

        {/* Top section: incident info (left) + times (right) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 0.4in', marginBottom: '0.15in' }}>
          <div>
            <div style={S.row}>
              <span style={S.label}>Date of Incident:</span>
              <span style={S.line}>{fmtDate(incident.incident_date)}</span>
            </div>
            <div style={S.row}>
              <span style={S.label}>Incident Address:</span>
              <span style={S.line}>{[incident.address, incident.city, incident.state].filter(Boolean).join(', ')}</span>
            </div>
            <div style={S.row}>
              <span style={S.label}>Incident #:</span>
              <span style={S.line}>{incident.incident_number ?? ''}</span>
            </div>
            <div style={S.row}>
              <span style={S.label}>CAD #:</span>
              <span style={S.line}>{incident.cad_number ?? ''}</span>
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700, textDecoration: 'underline', marginBottom: '0.08in' }}>Incident Time (Military time)</div>
            {([
              ['Paged',             milTime(incident.paged_at ?? incident.call_time)],
              ['Enroute',           milTime(earliestEnroute)],
              ['On Scene',          milTime(incident.first_on_scene_at)],
              ['Finished at Scene', milTime(incident.last_leaving_scene_at)],
              ['Back at Station',   milTime(incident.in_service_at)],
            ] as [string, string][]).map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: '0.1in', marginBottom: '0.08in' }}>
                <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
                <span style={{ ...S.shortLine, minWidth: '1in' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={S.divider} />

        {/* Units Dispatched + Type of Incident */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 0.4in', marginBottom: '0.15in' }}>

          {/* Units — grows with responders listed under each unit */}
          <div>
            <div style={S.secHdr}>Units Dispatched</div>
            {apparatusGroups.length === 0 && (
              <p style={{ fontSize: '9pt', color: '#888' }}>No apparatus logged.</p>
            )}
            {apparatusGroups.map((grp, gi) => (
              <div key={gi} style={{ marginBottom: '0.1in' }}>
                <div style={{ fontWeight: 700, fontSize: '10pt' }}>{grp.unitLabel}</div>
                {grp.members.length === 0 ? (
                  <div style={{ fontSize: '9pt', color: '#888', marginLeft: '0.15in' }}>—</div>
                ) : grp.members.map((name, ni) => (
                  <div key={ni} style={{ fontSize: '9pt', marginLeft: '0.15in', lineHeight: 1.5 }}>{name}</div>
                ))}
              </div>
            ))}
          </div>

          {/* Type of Incident — checkboxes only */}
          <div>
            <div style={S.secHdr}>Type Of Incident</div>
            {([
              ['Fire',     isFire],
              ['Rescue',   isRescue],
              ['Standby',  isStandby],
              ['Meeting',  isMeeting],
              ['Training', isTraining],
            ] as [string, boolean][]).map(([label, checked]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.07in', gap: '0.1in' }}>
                <span style={S.checkBox}>{checked ? '✓' : ''}</span>
                <span style={{ fontWeight: 600 }}>{label}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.07in', gap: '0.1in' }}>
              <span style={S.checkBox}>{isMutualAid ? '✓' : ''}</span>
              <span style={{ fontWeight: 600 }}>Mutual Aid</span>
            </div>
            {isMutualAid && (
              <>
                <div style={S.row}>
                  <span style={{ fontWeight: 600, marginLeft: '0.2in' }}>To</span>
                  <span style={{ ...S.shortLine, flex: 1 }}>{maToNames}</span>
                </div>
                <div style={S.row}>
                  <span style={{ fontWeight: 600, marginLeft: '0.2in' }}>From</span>
                  <span style={{ ...S.shortLine, flex: 1 }}>{maFromNames}</span>
                </div>
              </>
            )}

            <div style={{ ...S.divider, margin: '0.12in 0' }} />

            {/* Additional fields */}
            <div style={S.row}>
              <span style={S.label}>Cause of Incident:</span>
              <span style={{ ...S.shortLine, flex: 1 }} />
            </div>
            <div style={S.row}>
              <span style={S.label}>Est. Dollar Loss:</span>
              <span style={{ ...S.shortLine, flex: 1 }} />
            </div>
            <div style={S.row}>
              <span style={S.label}>Property Lost:</span>
              <span style={{ ...S.shortLine, flex: 1 }} />
            </div>
            <div style={S.row}>
              <span style={S.label}>Vehicle Make:</span>
              <span style={{ ...S.shortLine, flex: 1 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.1in' }}>
              <span style={S.label}>NERIS Report Done?</span>
              <span style={{ ...S.shortLine, minWidth: '0.6in' }}>{incident.neris_reported ? 'YES' : ''}</span>
            </div>
          </div>
        </div>

        {incident.narrative && (
          <>
            <div style={S.divider} />
            <div style={{ marginBottom: '0.12in' }}>
              <div style={S.secHdr}>Narrative / Disposition</div>
              <p style={{ margin: 0, fontSize: '9.5pt', lineHeight: 1.4 }}>{incident.narrative}</p>
            </div>
          </>
        )}

        <div style={S.divider} />

        {/* Full dept roster — 3 columns, checkmark for responders */}
        <div style={{ ...S.secHdr, marginBottom: '0.08in' }}>Firefighters / EMT&apos;s</div>
        <div style={{ border: '1px solid #000', padding: '0.1in' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.02in 0.2in' }}>
            {[col1, col2, col3].map((col, ci) => (
              <div key={ci}>
                {col.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.05in', gap: '0.08in' }}>
                    <span style={{ ...S.checkBox }}>{p.responded ? '✓' : ''}</span>
                    <span style={{ fontSize: '9.5pt' }}>{p.name}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '0.2in', display: 'flex', justifyContent: 'space-between', fontSize: '8pt', color: '#888' }}>
          <span>Generated by FireOps7</span>
          <span>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </div>
    </>
  )
}
