import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'
import PrintButton from '../training-signin/PrintButton'

export default async function MemberTrainingRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ personnel_id?: string; from?: string; to?: string }>
}) {
  const { personnel_id, from, to } = await searchParams

  if (!personnel_id) {
    return <p style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Missing personnel_id parameter.</p>
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()

  const defaultTo = new Date()
  const defaultFrom = new Date()
  defaultFrom.setFullYear(defaultFrom.getFullYear() - 1)
  const dateFrom = from ?? defaultFrom.toISOString().split('T')[0]
  const dateTo = to ?? defaultTo.toISOString().split('T')[0]

  // Member info
  const { data: person } = await adminClient
    .from('personnel')
    .select('id, first_name, last_name')
    .eq('id', personnel_id)
    .single()
  if (!person) {
    return <p style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Member not found.</p>
  }

  // Dept + role
  const { data: deptPersonnelList } = await adminClient
    .from('department_personnel')
    .select('department_id, system_role, role_id')
    .eq('personnel_id', personnel_id)
    .eq('active', true)
    .limit(1)
  const deptPersonnel = deptPersonnelList?.[0]
  const department_id = deptPersonnel?.department_id ?? null

  const ctx = await getCurrentDepartmentContext()
  if (ctx?.departmentId && department_id && ctx.departmentId !== department_id && !ctx.isSysAdmin) {
    return <p style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Record not found.</p>
  }

  const [deptResult, roleResult] = await Promise.all([
    department_id
      ? adminClient.from('departments').select('name').eq('id', department_id).single()
      : Promise.resolve({ data: null }),
    deptPersonnel?.role_id
      ? adminClient.from('personnel_roles').select('name').eq('id', deptPersonnel.role_id).single()
      : Promise.resolve({ data: null }),
  ])

  const deptName = deptResult.data?.name ?? 'Fire Department'
  const roleDisplay = roleResult.data?.name
    ?? (deptPersonnel?.system_role
      ? deptPersonnel.system_role.charAt(0).toUpperCase() + deptPersonnel.system_role.slice(1)
      : 'Member')

  // Training events in date range
  const { data: eventsRaw } = department_id
    ? await adminClient
        .from('training_events')
        .select('id, event_date, topic, hours, location')
        .eq('department_id', department_id)
        .gte('event_date', dateFrom)
        .lte('event_date', dateTo)
        .order('event_date', { ascending: false })
    : { data: [] as { id: string; event_date: string; topic: string; hours: number | null; location: string | null }[] }

  const eventIds = (eventsRaw ?? []).map(e => e.id)
  const eventMap = Object.fromEntries((eventsRaw ?? []).map(e => [e.id, e]))

  const { data: attendanceRaw } = eventIds.length > 0
    ? await adminClient
        .from('training_event_attendance')
        .select('id, event_id, status, signed_at')
        .eq('personnel_id', personnel_id)
        .in('event_id', eventIds)
    : { data: [] as { id: string; event_id: string; status: string; signed_at: string | null }[] }

  const trainingEvents = (attendanceRaw ?? [])
    .map(a => {
      const ev = eventMap[a.event_id]
      return {
        id: a.id,
        event_date: ev?.event_date ?? '',
        topic: ev?.topic ?? '—',
        hours: ev?.hours ?? null,
        location: ev?.location ?? null,
        status: a.status,
        signed_at: a.signed_at,
      }
    })
    .sort((a, b) => b.event_date.localeCompare(a.event_date))

  // All active certifications (unfiltered — full credential record)
  const { data: certsRaw } = await adminClient
    .from('member_certifications')
    .select('id, cert_name, issuing_body, cert_number, issued_date, expiration_date')
    .eq('personnel_id', personnel_id)
    .eq('active', true)
    .order('issued_date', { ascending: false })

  const certs = certsRaw ?? []

  const totalHours = trainingEvents
    .filter(e => e.status === 'verified' || e.status === 'pending')
    .reduce((sum, e) => sum + (e.hours ?? 0), 0)

  function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  }

  function formatDisplayDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    })
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
    sectionTitle: { fontSize: '12pt', fontWeight: 700, margin: '0.25in 0 0.1in' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { borderBottom: '2px solid #000', padding: '5px 8px', textAlign: 'left', fontSize: '9pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' },
    td: { borderBottom: '1px solid #ddd', padding: '6px 8px', verticalAlign: 'middle', fontSize: '10pt' },
    badge: { display: 'inline-block', padding: '1px 6px', borderRadius: '3px', fontSize: '8pt', fontWeight: 700 },
  }

  function statusLabel(status: string) {
    switch (status) {
      case 'verified': return 'Verified'
      case 'pending': return 'Pending'
      case 'absent': return 'Absent'
      default: return status.charAt(0).toUpperCase() + status.slice(1)
    }
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
          <p style={S.title}>Member Training Record</p>
          <p style={S.subtitle}>{deptName}</p>
        </div>
        <div style={S.divider} />

        {/* Member info */}
        <div style={S.infoGrid}>
          <div>
            <div style={S.label}>Member</div>
            <div style={{ ...S.value, fontWeight: 700 }}>
              {person.first_name} {person.last_name}
            </div>
          </div>
          <div>
            <div style={S.label}>Role</div>
            <div style={S.value}>{roleDisplay}</div>
          </div>
          <div>
            <div style={S.label}>Department</div>
            <div style={S.value}>{deptName}</div>
          </div>
          <div>
            <div style={S.label}>Period</div>
            <div style={S.value}>{formatDisplayDate(dateFrom)} — {formatDisplayDate(dateTo)}</div>
          </div>
        </div>
        <div style={S.divider} />

        {/* Training Events */}
        <div style={S.sectionTitle}>
          Training Events
          {trainingEvents.length > 0 && totalHours > 0 && (
            <span style={{ fontSize: '10pt', fontWeight: 400, color: '#555', marginLeft: '1rem' }}>
              {trainingEvents.length} event{trainingEvents.length !== 1 ? 's' : ''} &middot; {Math.round(totalHours * 10) / 10} hrs
            </span>
          )}
        </div>

        {trainingEvents.length === 0 ? (
          <p style={{ color: '#888', fontSize: '10pt', margin: '0.1in 0' }}>
            No training events attended in this period.
          </p>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, width: '100px' }}>Date</th>
                <th style={S.th}>Topic</th>
                <th style={{ ...S.th, width: '55px' }}>Hours</th>
                <th style={{ ...S.th, width: '130px' }}>Location</th>
                <th style={{ ...S.th, width: '70px' }}>Status</th>
                <th style={{ ...S.th, width: '65px' }}>Signed</th>
              </tr>
            </thead>
            <tbody>
              {trainingEvents.map(ev => (
                <tr key={ev.id}>
                  <td style={{ ...S.td, whiteSpace: 'nowrap' }}>{formatDate(ev.event_date)}</td>
                  <td style={{ ...S.td, fontWeight: 600 }}>{ev.topic}</td>
                  <td style={{ ...S.td, textAlign: 'center' }}>{ev.hours ?? '—'}</td>
                  <td style={{ ...S.td, color: '#555' }}>{ev.location ?? '—'}</td>
                  <td style={S.td}>{statusLabel(ev.status)}</td>
                  <td style={{ ...S.td, textAlign: 'center' }}>
                    {ev.signed_at ? (
                      <span style={{ color: '#166534', fontWeight: 700 }}>&#10003;</span>
                    ) : (
                      <span style={{ color: '#aaa' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Certifications */}
        <div style={{ ...S.sectionTitle, marginTop: '0.35in' }}>
          Certifications
          {certs.length > 0 && (
            <span style={{ fontSize: '10pt', fontWeight: 400, color: '#555', marginLeft: '1rem' }}>
              {certs.length} on record
            </span>
          )}
        </div>

        {certs.length === 0 ? (
          <p style={{ color: '#888', fontSize: '10pt', margin: '0.1in 0' }}>
            No active certifications on record.
          </p>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Certification</th>
                <th style={{ ...S.th, width: '140px' }}>Issuing Body</th>
                <th style={{ ...S.th, width: '110px' }}>Cert #</th>
                <th style={{ ...S.th, width: '100px' }}>Issued</th>
                <th style={{ ...S.th, width: '100px' }}>Expires</th>
              </tr>
            </thead>
            <tbody>
              {certs.map(c => {
                const isExpired = c.expiration_date && new Date(c.expiration_date + 'T00:00:00') < new Date()
                return (
                  <tr key={c.id}>
                    <td style={{ ...S.td, fontWeight: 600 }}>{c.cert_name}</td>
                    <td style={{ ...S.td, color: '#555' }}>{c.issuing_body ?? '—'}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '9pt' }}>{c.cert_number ?? '—'}</td>
                    <td style={{ ...S.td, whiteSpace: 'nowrap' }}>{formatDate(c.issued_date)}</td>
                    <td style={{ ...S.td, whiteSpace: 'nowrap', color: isExpired ? '#991b1b' : 'inherit', fontWeight: isExpired ? 700 : 400 }}>
                      {c.expiration_date ? formatDate(c.expiration_date) : 'No exp.'}
                      {isExpired && <span style={{ marginLeft: '4px', fontSize: '8pt' }}>(exp)</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Footer */}
        <div style={{ borderTop: '1px solid #ccc', margin: '0.4in 0 0' }} />
        <p style={{ fontSize: '8pt', color: '#999', textAlign: 'center', marginTop: '8px' }}>
          Printed by FireOps7 &middot; Generated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
    </>
  )
}
