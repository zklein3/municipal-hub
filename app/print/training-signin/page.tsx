import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import PrintButton from './PrintButton'

export default async function TrainingSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ event_id?: string; personnel_id?: string }>
}) {
  const { event_id, personnel_id } = await searchParams
  if (!event_id) return <p style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Missing event_id parameter.</p>

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()

  // Fetch event
  const { data: evt } = await adminClient
    .from('training_events')
    .select('id, topic, event_date, start_time, hours, location, description, department_id')
    .eq('id', event_id)
    .single()
  if (!evt) return <p style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Event not found.</p>

  const ctx = await getCurrentDepartmentContext()
  if (ctx?.departmentId && ctx.departmentId !== evt.department_id) {
    return <p style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Event not found.</p>
  }

  // Fetch department name
  const { data: dept } = await adminClient
    .from('departments')
    .select('name')
    .eq('id', evt.department_id)
    .single()

  // Fetch attendance — all members or single member
  let attendanceQuery = adminClient
    .from('training_event_attendance')
    .select('id, personnel_id, status, signed_at, signature_url')
    .eq('event_id', event_id)
    .order('personnel_id')
  if (personnel_id) attendanceQuery = attendanceQuery.eq('personnel_id', personnel_id)
  const { data: attendanceRaw } = await attendanceQuery

  // Fetch personnel names
  const pIds = [...new Set((attendanceRaw ?? []).map(a => a.personnel_id))]
  const { data: pList } = pIds.length > 0
    ? await adminClient.from('personnel').select('id, first_name, last_name').in('id', pIds)
    : { data: [] }
  const pMap = Object.fromEntries((pList ?? []).map((p: { id: string; first_name: string; last_name: string }) => [
    p.id,
    `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
  ]))

  // Generate signed URLs for signatures (1-hour expiry — enough for printing)
  const signedUrlMap: Record<string, string> = {}
  for (const a of attendanceRaw ?? []) {
    if (a.signature_url) {
      const { data: urlData } = await adminClient.storage
        .from('signatures')
        .createSignedUrl(a.signature_url, 3600)
      if (urlData?.signedUrl) signedUrlMap[a.personnel_id] = urlData.signedUrl
    }
  }

  const attendance = (attendanceRaw ?? []).map(a => ({
    personnel_id: a.personnel_id,
    name: pMap[a.personnel_id] ?? 'Unknown',
    status: a.status,
    signed_at: a.signed_at,
    signature_src: signedUrlMap[a.personnel_id] ?? null,
  })).sort((a, b) => a.name.localeCompare(b.name))

  function formatDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }
  function formatTime(t: string | null) {
    if (!t) return null
    const [h, m] = t.split(':')
    const hour = parseInt(h)
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
  }

  const S: Record<string, React.CSSProperties> = {
    page: { fontFamily: 'Arial, sans-serif', fontSize: '11pt', color: '#000', background: '#fff', padding: '1.5in 1in', maxWidth: '8.5in', margin: '0 auto' },
    heading: { textAlign: 'center', marginBottom: '0.25in' },
    title: { fontSize: '18pt', fontWeight: 700, margin: 0 },
    subtitle: { fontSize: '11pt', color: '#444', margin: '4px 0 0' },
    divider: { borderTop: '2px solid #000', margin: '0.15in 0' },
    thinDivider: { borderTop: '1px solid #ccc', margin: '0.1in 0' },
    infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 1.5rem', marginBottom: '0.15in' },
    label: { fontWeight: 700, fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#555' },
    value: { fontSize: '11pt' },
    table: { width: '100%', borderCollapse: 'collapse', marginTop: '0.1in' },
    th: { borderBottom: '2px solid #000', padding: '5px 8px', textAlign: 'left', fontSize: '9pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' },
    td: { borderBottom: '1px solid #ddd', padding: '6px 8px', verticalAlign: 'middle' },
    sigImg: { maxHeight: '40px', maxWidth: '140px', display: 'block' },
    sigLine: { borderBottom: '1px solid #000', height: '36px', minWidth: '140px' },
    footer: { marginTop: '0.4in' },
    footerRow: { display: 'flex', gap: '2rem', marginTop: '0.25in' },
    footerField: { flex: 1 },
    footerLabel: { fontSize: '9pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#555', marginBottom: '0.35in' },
    footerLine: { borderBottom: '2px solid #000' },
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 0; }
          body { margin: 0; }
        }
      `}</style>

      <PrintButton />

      <div style={S.page}>
        {/* Header */}
        <div style={S.heading}>
          <p style={S.title}>{personnel_id ? 'Training Attendance Record' : 'Training Sign-In Sheet'}</p>
          <p style={S.subtitle}>{dept?.name ?? 'Fire Department'}</p>
        </div>
        <div style={S.divider} />

        {/* Event details */}
        <div style={S.infoGrid}>
          <div>
            <div style={S.label}>Topic</div>
            <div style={S.value}>{evt.topic}</div>
          </div>
          <div>
            <div style={S.label}>Date</div>
            <div style={S.value}>{formatDate(evt.event_date)}</div>
          </div>
          {evt.start_time && (
            <div>
              <div style={S.label}>Time</div>
              <div style={S.value}>{formatTime(evt.start_time)}</div>
            </div>
          )}
          {evt.hours && (
            <div>
              <div style={S.label}>Hours</div>
              <div style={S.value}>{evt.hours}</div>
            </div>
          )}
          {evt.location && (
            <div>
              <div style={S.label}>Location</div>
              <div style={S.value}>{evt.location}</div>
            </div>
          )}
        </div>
        <div style={S.divider} />

        {/* Attendance table */}
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: '24px' }}>#</th>
              <th style={S.th}>Name</th>
              <th style={{ ...S.th, width: '80px' }}>Status</th>
              <th style={{ ...S.th, width: '160px' }}>Signature</th>
              <th style={{ ...S.th, width: '110px' }}>Signed At</th>
            </tr>
          </thead>
          <tbody>
            {attendance.length === 0 && (
              <tr>
                <td colSpan={5} style={{ ...S.td, color: '#888', textAlign: 'center', padding: '1rem' }}>
                  No attendance records for this event.
                </td>
              </tr>
            )}
            {attendance.map((a, i) => (
              <tr key={a.personnel_id}>
                <td style={{ ...S.td, color: '#888', fontSize: '9pt' }}>{i + 1}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{a.name}</td>
                <td style={{ ...S.td, fontSize: '9pt', textTransform: 'capitalize' }}>{a.status}</td>
                <td style={S.td}>
                  {a.signature_src
                    ? <img src={a.signature_src} alt={`${a.name} signature`} style={S.sigImg} />
                    : <div style={S.sigLine} />
                  }
                </td>
                <td style={{ ...S.td, fontSize: '9pt', color: '#555' }}>
                  {a.signed_at ? new Date(a.signed_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit' }) : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Instructor certification block */}
        <div style={S.footer}>
          <div style={S.thinDivider} />
          <p style={{ fontSize: '9pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
            Instructor Certification
          </p>
          <p style={{ fontSize: '10pt', color: '#333', marginBottom: '0.2in' }}>
            I certify that the above-listed personnel attended this training session and that the information recorded is accurate.
          </p>
          <div style={S.footerRow}>
            <div style={S.footerField}>
              <div style={S.footerLabel}>Instructor Name (print)</div>
              <div style={S.footerLine} />
            </div>
            <div style={S.footerField}>
              <div style={S.footerLabel}>Date</div>
              <div style={S.footerLine} />
            </div>
          </div>
          <div style={{ ...S.footerRow, marginTop: '0.3in' }}>
            <div style={S.footerField}>
              <div style={S.footerLabel}>Instructor Signature</div>
              <div style={S.footerLine} />
            </div>
            <div style={S.footerField}>
              <div style={S.footerLabel}>Rank / Title</div>
              <div style={S.footerLine} />
            </div>
          </div>
        </div>

        <div style={{ ...S.thinDivider, marginTop: '0.3in' }} />
        <p style={{ fontSize: '8pt', color: '#999', textAlign: 'center', marginTop: '6px' }}>
          Generated by FireOps7 &middot; {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
    </>
  )
}
