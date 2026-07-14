import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import PrintButton from '../training-signin/PrintButton'

export default async function EventRunSheetPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  if (!id) return <p style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Missing event id.</p>

  const adminClient = createAdminClient()

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (!ctx.departmentId && !ctx.isSysAdmin) redirect('/login')

  const { data: instance } = await adminClient.from('event_instances').select('*').eq('id', id).single()
  if (!instance) return <p style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Event not found.</p>

  const { data: series } = await adminClient.from('event_series').select('*').eq('id', instance.series_id).single()
  if (!series) return <p style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Event not found.</p>
  if (ctx.departmentId && ctx.departmentId !== series.department_id) {
    return <p style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Event not found.</p>
  }

  const { data: dept } = await adminClient.from('departments').select('name').eq('id', series.department_id).single()

  const { data: attendanceRows } = await adminClient
    .from('event_attendance')
    .select('personnel_id, status')
    .eq('instance_id', id)

  const attendanceMap = Object.fromEntries((attendanceRows ?? []).map(a => [a.personnel_id, a.status]))

  const { data: deptPersonnelRaw } = await adminClient
    .from('department_personnel')
    .select('personnel_id, personnel(id, first_name, last_name)')
    .eq('department_id', series.department_id)
    .eq('active', true)

  // Certs marked show_on_run_report by the dept — same convention as the incident run sheet
  const { data: runReportTypes } = await adminClient
    .from('certification_types')
    .select('id')
    .eq('department_id', series.department_id)
    .eq('show_on_run_report', true)
    .eq('active', true)

  const runReportTypeIds = (runReportTypes ?? []).map(ct => ct.id)

  const { data: medCertRows } = runReportTypeIds.length > 0
    ? await adminClient
        .from('member_certifications')
        .select('personnel_id, cert_name')
        .eq('department_id', series.department_id)
        .eq('active', true)
        .in('certification_type_id', runReportTypeIds)
    : { data: [] }

  const medLabelMap: Record<string, string> = {}
  for (const cert of medCertRows ?? []) {
    const existing = medLabelMap[cert.personnel_id]
    medLabelMap[cert.personnel_id] = existing ? `${existing}, ${cert.cert_name}` : cert.cert_name
  }

  const allPersonnel: { id: string; name: string; present: boolean; statusLabel: string | null; medLabel?: string }[] = []
  const STATUS_LABELS: Record<string, string> = { excused: 'Excused', excused_pending: 'Excused (pending)' }

  for (const dp of deptPersonnelRaw ?? []) {
    const p = dp.personnel as any
    const pid = p?.id ?? dp.personnel_id
    const name = `${p?.last_name ?? ''}, ${p?.first_name ?? ''}`.trim().replace(/^,\s*/, '')
    const status = attendanceMap[pid] ?? null
    allPersonnel.push({
      id: pid,
      name,
      present: status === 'present',
      statusLabel: status && status !== 'present' && status !== 'absent' ? (STATUS_LABELS[status] ?? null) : null,
      medLabel: medLabelMap[pid],
    })
  }
  allPersonnel.sort((a, b) => a.name.localeCompare(b.name))

  function milTime(timeStr: string | null) {
    if (!timeStr) return ''
    const [h, m] = timeStr.split(':')
    return `${h.padStart(2, '0')}${(m ?? '00').padStart(2, '0')}`
  }
  function milEndTime(startTime: string | null, durationMinutes: number | null) {
    if (!startTime || !durationMinutes) return ''
    const [h, m] = startTime.split(':').map(Number)
    const total = h * 60 + m + durationMinutes
    const endH = Math.floor(total / 60) % 24
    const endM = total % 60
    return `${String(endH).padStart(2, '0')}${String(endM).padStart(2, '0')}`
  }
  function fmtDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
  }

  const title = instance.title_override ?? series.title
  const description = instance.description_override ?? series.description
  const isMeeting  = series.event_type === 'meeting'
  const isTraining = series.event_type === 'training'
  const isSpecial  = series.event_type === 'special'

  const deptName = dept?.name ?? 'Fire Department'

  const colSize = Math.ceil(allPersonnel.length / 3)
  const col1 = allPersonnel.slice(0, colSize)
  const col2 = allPersonnel.slice(colSize, colSize * 2)
  const col3 = allPersonnel.slice(colSize * 2)

  const S: Record<string, React.CSSProperties> = {
    page:      { fontFamily: 'Arial, sans-serif', fontSize: '10pt', color: '#000', background: '#fff', padding: '0.35in 0.5in', maxWidth: '8.5in', margin: '0 auto' },
    label:     { fontWeight: 700, marginRight: '0.1in', whiteSpace: 'nowrap' },
    line:      { borderBottom: '1px solid #000', display: 'inline-block', minWidth: '2.5in', verticalAlign: 'bottom' },
    shortLine: { borderBottom: '1px solid #000', display: 'inline-block', minWidth: '1in', verticalAlign: 'bottom' },
    row:       { marginBottom: '0.09in', display: 'flex', alignItems: 'flex-end', gap: '0.1in' },
    divider:   { borderTop: '2px solid #000', margin: '0.1in 0' },
    secHdr:    { fontWeight: 700, textDecoration: 'underline', marginBottom: '0.08in' },
    checkBox:  { display: 'inline-block', width: '14px', height: '14px', border: '1px solid #000', verticalAlign: 'middle', marginRight: '4px', textAlign: 'center', lineHeight: '14px', fontSize: '10pt', flexShrink: 0 },
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 0.35in; size: letter portrait; }
          body { margin: 0; }
        }
      `}</style>
      <PrintButton />

      <div style={S.page}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '0.12in' }}>
          <div style={{ fontWeight: 700, fontSize: '12pt' }}>{deptName.toUpperCase()}</div>
          <div style={{ fontWeight: 700, fontSize: '12pt' }}>RUN FIELD REPORT</div>
        </div>

        {/* Top section: event info (left) + time (right) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 0.4in', marginBottom: '0.15in' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.35in 1fr', rowGap: '0.09in', alignItems: 'flex-end' }}>
            <span style={S.label}>Date of Event:</span>
            <span style={S.line}>{fmtDate(instance.event_date)}</span>
            <span style={S.label}>Event:</span>
            <span style={S.line}>{title}</span>
            <span style={S.label}>Location:</span>
            <span style={S.line}>{instance.location ?? ''}</span>
          </div>

          <div style={{ width: '100%' }}>
            <div style={{ fontWeight: 700, textDecoration: 'underline', marginBottom: '0.08in' }}>Event Time (Military time)</div>
            {([
              ['Start', milTime(instance.start_time)],
              ['End',   milEndTime(instance.start_time, series.duration_minutes)],
            ] as [string, string][]).map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%', marginBottom: '0.08in' }}>
                <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
                <span style={{ ...S.shortLine, minWidth: '1in', textAlign: 'center' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={S.divider} />

        {/* Type of Event */}
        <div style={{ width: '50%' }}>
          <div style={S.secHdr}>Type Of Event</div>
          {([
            ['Meeting',  isMeeting],
            ['Training', isTraining],
            ['Special',  isSpecial],
          ] as [string, boolean][]).map(([label, checked]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '50%', marginBottom: '0.07in' }}>
              <span style={{ fontWeight: 600 }}>{label}</span>
              <span style={S.checkBox}>{checked ? '✓' : ''}</span>
            </div>
          ))}
        </div>

        {description && (
          <>
            <div style={S.divider} />
            <div style={{ marginBottom: '0.12in' }}>
              <div style={S.secHdr}>Narrative / Notes</div>
              <p style={{ margin: 0, fontSize: '9.5pt', lineHeight: 1.4 }}>{description}</p>
            </div>
          </>
        )}

        <div style={S.divider} />

        {/* Full dept roster — 3 columns, checkmark for who attended */}
        <div style={{ ...S.secHdr, marginBottom: '0.08in' }}>Firefighters / EMT&apos;s</div>
        <div style={{ border: '1px solid #000', padding: '0.1in' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.02in 0.2in' }}>
            {[col1, col2, col3].map((col, ci) => (
              <div key={ci}>
                {col.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.05in', gap: '0.08in' }}>
                    <span style={{ ...S.checkBox }}>{p.present ? '✓' : ''}</span>
                    <span style={{ fontSize: '9.5pt' }}>
                      {p.name}
                      {p.statusLabel && <span style={{ fontSize: '8.5pt', color: '#333' }}> ({p.statusLabel})</span>}
                      {p.medLabel && <span style={{ fontSize: '8.5pt', color: '#333' }}> — {p.medLabel}</span>}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '0.08in', display: 'flex', justifyContent: 'space-between', fontSize: '8pt', color: '#888' }}>
          <span>Generated by FireOps7</span>
          <span>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </div>
    </>
  )
}
