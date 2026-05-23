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

  // Fetch incident
  const { data: incident } = await adminClient
    .from('incidents')
    .select('*')
    .eq('id', id)
    .single()
  if (!incident) return <p style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Incident not found.</p>

  // Dept name
  const { data: dept } = await adminClient
    .from('departments').select('name').eq('id', incident.department_id).single()

  // Apparatus on incident
  const { data: incApparatus } = await adminClient
    .from('incident_apparatus')
    .select('id, apparatus_id, paged_at, enroute_at, on_scene_at, leaving_scene_at, available_at')
    .eq('incident_id', id)

  const apparatusIds = (incApparatus ?? []).map(a => a.apparatus_id).filter(Boolean)
  const { data: apparatusNames } = apparatusIds.length > 0
    ? await adminClient.from('apparatus').select('id, unit_number').in('id', apparatusIds)
    : { data: [] }
  const apparatusNameMap = Object.fromEntries((apparatusNames ?? []).map(a => [a.id, a.unit_number]))

  // Personnel on incident
  const { data: incPersonnel } = await adminClient
    .from('incident_personnel')
    .select('personnel_id, apparatus_id, role, status')
    .eq('incident_id', id)
    .neq('status', 'absent')

  const respondedIds = new Set((incPersonnel ?? []).map(p => p.personnel_id))

  // Personnel count per apparatus
  const personnelPerApparatus: Record<string, number> = {}
  for (const p of incPersonnel ?? []) {
    if (p.apparatus_id) {
      personnelPerApparatus[p.apparatus_id] = (personnelPerApparatus[p.apparatus_id] ?? 0) + 1
    }
  }

  // All dept personnel for the roster
  const { data: deptPersonnelRaw } = await adminClient
    .from('department_personnel')
    .select('personnel_id, personnel(id, first_name, last_name)')
    .eq('department_id', incident.department_id)
    .eq('active', true)

  const allPersonnel = (deptPersonnelRaw ?? [])
    .map(dp => {
      const p = dp.personnel as any
      return {
        id: p?.id ?? dp.personnel_id,
        name: `${p?.last_name ?? ''}, ${p?.first_name ?? ''}`.trim().replace(/^,\s*/, ''),
        responded: respondedIds.has(p?.id ?? dp.personnel_id),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  // Mutual aid
  const { data: mutualAid } = await adminClient
    .from('incident_mutual_aid')
    .select('external_department_name, role')
    .eq('incident_id', id)
    .limit(1)
  const ma = mutualAid?.[0] ?? null

  function milTime(dt: string | null) {
    if (!dt) return ''
    const d = new Date(dt)
    const h = String(d.getUTCHours()).padStart(2, '0')
    const m = String(d.getUTCMinutes()).padStart(2, '0')
    return `${h}${m}`
  }

  function fmtDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
      month: '2-digit', day: '2-digit', year: 'numeric',
    })
  }

  const incType = incident.incident_type ?? ''
  const isFire     = incType === 'fire'
  const isRescue   = incType === 'rescue'
  const isStandby  = incType === 'standby'
  const isMeeting  = incType === 'meeting' || incType === 'special'
  const isTraining = incType === 'training'
  const isMutualAid = incType === 'mutual_aid' || !!incident.mutual_aid_direction

  const hasMutualAidOut = incident.mutual_aid_direction === 'to' || incident.mutual_aid_direction === 'both'
  const hasMutualAidIn  = incident.mutual_aid_direction === 'from' || incident.mutual_aid_direction === 'both'

  // Earliest enroute across apparatus
  const enrouteTimes = (incApparatus ?? []).map(a => a.enroute_at).filter(Boolean)
  const earliestEnroute = enrouteTimes.length > 0
    ? enrouteTimes.reduce((a, b) => (a! < b! ? a : b))
    : null

  const deptName = dept?.name ?? 'Fire Department'

  // Chunk personnel into 3 columns
  const colSize = Math.ceil(allPersonnel.length / 3)
  const col1 = allPersonnel.slice(0, colSize)
  const col2 = allPersonnel.slice(colSize, colSize * 2)
  const col3 = allPersonnel.slice(colSize * 2)

  const S: Record<string, React.CSSProperties> = {
    page:       { fontFamily: 'Arial, sans-serif', fontSize: '10pt', color: '#000', background: '#fff', padding: '0.6in 0.75in', maxWidth: '8.5in', margin: '0 auto' },
    center:     { textAlign: 'center' },
    bold:       { fontWeight: 700 },
    line:       { borderBottom: '1px solid #000', display: 'inline-block', minWidth: '2.5in', verticalAlign: 'bottom' },
    shortLine:  { borderBottom: '1px solid #000', display: 'inline-block', minWidth: '1.4in', verticalAlign: 'bottom' },
    label:      { fontWeight: 700, marginRight: '0.1in', whiteSpace: 'nowrap' },
    row:        { marginBottom: '0.12in', display: 'flex', alignItems: 'flex-end', gap: '0.1in' },
    divider:    { borderTop: '2px solid #000', margin: '0.15in 0' },
    thinDiv:    { borderTop: '1px solid #000', margin: '0.1in 0' },
    sectionHdr: { fontWeight: 700, textDecoration: 'underline', marginBottom: '0.1in' },
    check:      { display: 'inline-block', width: '16px', textAlign: 'center', fontWeight: 700 },
    checkBox:   { display: 'inline-block', width: '14px', height: '14px', border: '1px solid #000', verticalAlign: 'middle', marginRight: '4px', textAlign: 'center', lineHeight: '14px', fontSize: '10pt' },
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

        {/* Top two-column section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 0.4in', marginBottom: '0.15in' }}>
          {/* Left: incident info */}
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
              <span style={S.label}>Incident Type:</span>
              <span style={S.line}>{incType ? incType.charAt(0).toUpperCase() + incType.slice(1).replace('_', ' ') : ''}</span>
            </div>
          </div>

          {/* Right: times */}
          <div>
            <div style={{ ...S.bold, marginBottom: '0.08in', textDecoration: 'underline' }}>Incident Time (Military time)</div>
            {[
              ['Paged',                    milTime(incident.paged_at ?? incident.call_time)],
              ['Enroute',                  milTime(earliestEnroute)],
              ['On Scene',                 milTime(incident.first_on_scene_at)],
              ['Finished at Scene',        milTime(incident.last_leaving_scene_at)],
              ['Back at Station',          milTime(incident.in_service_at)],
            ].map(([label, val]) => (
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
          {/* Units */}
          <div>
            <div style={S.sectionHdr}>Units Dispatched</div>
            {(incApparatus ?? []).length === 0 && (
              <p style={{ fontSize: '9pt', color: '#888' }}>No apparatus logged.</p>
            )}
            {(incApparatus ?? []).map(a => {
              const unit = apparatusNameMap[a.apparatus_id] ?? '—'
              const count = personnelPerApparatus[a.apparatus_id] ?? 0
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'flex-end', gap: '0.1in', marginBottom: '0.08in' }}>
                  <span style={{ fontWeight: 600, minWidth: '1.2in' }}>{unit}</span>
                  <span style={{ fontSize: '9pt', color: '#555', marginRight: '0.05in' }}>
                    ({count} personnel)
                  </span>
                  <span style={{ ...S.shortLine, flex: 1 }} />
                </div>
              )
            })}
          </div>

          {/* Type of Incident */}
          <div>
            <div style={S.sectionHdr}>Type Of Incident</div>
            {[
              ['Fire',     isFire],
              ['Rescue',   isRescue],
              ['Standby',  isStandby],
              ['Meeting',  isMeeting],
              ['Training', isTraining],
            ].map(([label, checked]) => (
              <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.06in' }}>
                <span style={{ fontWeight: 600 }}>{label as string}</span>
                <span style={{ ...S.shortLine, minWidth: '1.8in' }}>{checked ? '✓' : ''}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.06in' }}>
              <span style={{ fontWeight: 600 }}>Mutual Aid</span>
              <span>
                <span style={{ marginRight: '0.15in' }}>
                  <span style={S.checkBox}>{isMutualAid ? '✓' : ''}</span> YES
                </span>
                <span>
                  <span style={S.checkBox}>{!isMutualAid ? '✓' : ''}</span> NO
                </span>
              </span>
            </div>
            <div style={S.row}>
              <span style={{ fontWeight: 600 }}>To</span>
              <span style={{ ...S.shortLine, flex: 1 }}>
                {hasMutualAidOut ? (incident.mutual_aid_department ?? ma?.external_department_name ?? '') : ''}
              </span>
            </div>
            <div style={S.row}>
              <span style={{ fontWeight: 600 }}>From</span>
              <span style={{ ...S.shortLine, flex: 1 }}>
                {hasMutualAidIn ? (ma?.external_department_name ?? '') : ''}
              </span>
            </div>
          </div>
        </div>

        <div style={S.divider} />

        {/* Fire-specific fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.06in 0.4in', marginBottom: '0.15in' }}>
          <div style={S.row}>
            <span style={S.label}>Cause of Fire/Incident:</span>
            <span style={{ ...S.line, flex: 1 }} />
          </div>
          <div style={S.row}>
            <span style={S.label}>Property Lost:</span>
            <span style={{ ...S.line, flex: 1 }} />
          </div>
          <div style={S.row}>
            <span style={S.label}>Est. Dollar Loss:</span>
            <span style={{ ...S.line, flex: 1 }} />
          </div>
          <div style={S.row}>
            <span style={S.label}>Vehicle Make:</span>
            <span style={{ ...S.line, flex: 1 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.1in' }}>
            <span style={S.label}>NERIS Report Done?</span>
            <span style={{ ...S.shortLine, minWidth: '0.8in' }}>{incident.neris_reported ? 'YES' : ''}</span>
          </div>
          <div style={S.row}>
            <span style={S.label}>CAD #:</span>
            <span style={{ ...S.line, flex: 1 }}>{incident.cad_number ?? ''}</span>
          </div>
        </div>

        {incident.narrative && (
          <div style={{ marginBottom: '0.15in' }}>
            <div style={S.sectionHdr}>Narrative / Disposition</div>
            <p style={{ margin: 0, fontSize: '9.5pt', lineHeight: 1.4 }}>{incident.narrative}</p>
          </div>
        )}

        <div style={S.divider} />

        {/* Firefighters / EMTs — 3-column roster, all dept members */}
        <div style={{ ...S.sectionHdr, marginBottom: '0.08in' }}>Firefighters / EMT&apos;s</div>
        <div style={{ border: '1px solid #000', padding: '0.1in' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.02in 0.2in' }}>
            {[col1, col2, col3].map((col, ci) => (
              <div key={ci}>
                {col.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.05in', gap: '0.08in' }}>
                    <span style={{ ...S.checkBox, flexShrink: 0 }}>{p.responded ? '✓' : ''}</span>
                    <span style={{ fontSize: '9.5pt' }}>{p.name}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '0.2in', display: 'flex', justifyContent: 'space-between', fontSize: '8pt', color: '#888' }}>
          <span>Generated by FireOps7</span>
          <span>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </div>
    </>
  )
}
