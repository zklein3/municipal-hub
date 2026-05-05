import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import PrintButton from '../training-signin/PrintButton'

function formatDate(d: string | null) {
  if (!d) return '___________________________'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default async function BurnPermitPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  if (!id) return <p style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Missing permit id.</p>

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()

  const { data: permit } = await adminClient
    .from('burn_permits')
    .select('id, contact_name, contact_phone, burn_address, burn_date, status, permit_expiry_date, issued_date, approved_by_personnel_id, confirmation_code, department_id, officer_signature_url, applicant_signature_url')
    .eq('id', id)
    .single()

  if (!permit) return <p style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Permit not found.</p>
  if (permit.status !== 'approved') return <p style={{ padding: '2rem', fontFamily: 'sans-serif' }}>This permit has not been approved yet.</p>

  const { data: dept } = await adminClient
    .from('departments')
    .select('name, burn_permit_restrictions, burn_permit_county_info')
    .eq('id', permit.department_id)
    .single()

  const { data: officerData } = permit.approved_by_personnel_id
    ? await adminClient.from('personnel').select('first_name, last_name').eq('id', permit.approved_by_personnel_id).single()
    : { data: null }

  const officerName = officerData ? `${officerData.first_name} ${officerData.last_name}` : '___________________________'

  // Generate signed URLs for signatures
  const [officerSigUrl, applicantSigUrl] = await Promise.all([
    permit.officer_signature_url
      ? adminClient.storage.from('signatures').createSignedUrl(permit.officer_signature_url, 3600).then(r => r.data?.signedUrl ?? null)
      : Promise.resolve(null),
    permit.applicant_signature_url
      ? adminClient.storage.from('signatures').createSignedUrl(permit.applicant_signature_url, 3600).then(r => r.data?.signedUrl ?? null)
      : Promise.resolve(null),
  ])

  const restrictions = dept?.burn_permit_restrictions ?? 'Brush'
  const countyInfo = dept?.burn_permit_county_info ?? ''
  const deptName = dept?.name ?? 'Fire Department'

  const S: Record<string, React.CSSProperties> = {
    page: { fontFamily: 'Arial, sans-serif', fontSize: '11pt', color: '#000', background: '#fff', padding: '1in', maxWidth: '8.5in', margin: '0 auto' },
    center: { textAlign: 'center' },
    bold: { fontWeight: 700 },
    h1: { fontSize: '16pt', fontWeight: 700, textAlign: 'center', margin: '0 0 4px' },
    h2: { fontSize: '14pt', fontWeight: 700, textAlign: 'center', margin: '0 0 20px' },
    fieldRow: { marginBottom: '10px' },
    label: { fontWeight: 700 },
    underline: { borderBottom: '1px solid #000', display: 'inline-block', minWidth: '260px', marginLeft: '6px' },
    divider: { borderTop: '1px solid #000', margin: '16px 0' },
    bigBold: { fontSize: '13pt', fontWeight: 700, textAlign: 'center', margin: '16px 0 8px' },
    legal: { fontSize: '9pt', lineHeight: '1.5', marginBottom: '10px' },
    sigRow: { marginTop: '12px', fontWeight: 700 },
    voidBanner: { fontSize: '15pt', fontWeight: 700, textAlign: 'center', margin: '20px 0 0', borderTop: '2px solid #000', paddingTop: '10px' },
    confirmCode: { fontSize: '8pt', color: '#999', textAlign: 'right', marginTop: '4px' },
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
        <p style={S.h1}>{deptName}</p>
        <p style={S.h2}>Burning Permit</p>

        {/* Core permit fields */}
        <div style={S.fieldRow}>
          <span style={S.label}>Date Issued</span>
          <span style={S.underline}>{formatDate(permit.issued_date)}</span>
        </div>
        <div style={S.fieldRow}>
          <span style={S.label}>This permit issued to</span>
          <span style={S.underline}>{permit.contact_name}</span>
        </div>
        <div style={S.fieldRow}>
          <span style={S.label}>To have an open fire at</span>
          <span style={S.underline}>{permit.burn_address}</span>
        </div>

        <div style={{ margin: '18px 0 6px' }}>
          <p style={{ ...S.bold, fontSize: '12pt', marginBottom: '4px' }}>
            The Permit holder can burn {restrictions} until 1900 daily.
          </p>
          <p style={{ ...S.bold, fontSize: '12pt' }}>
            This Permit Expires{' '}
            <span style={{ ...S.underline, minWidth: '200px' }}>{formatDate(permit.permit_expiry_date)}</span>
          </p>
        </div>

        {/* Liability line */}
        <div style={{ margin: '16px 0' }}>
          I <span style={{ fontWeight: 700, borderBottom: '1px solid #000', paddingBottom: '1px' }}>{permit.contact_name}</span> Accept all financial Responsibility for any costs incurred if fire becomes out of control.
        </div>

        <div style={S.divider} />

        {/* Legal boilerplate */}
        <p style={S.legal}>
          This permit is being issued in accordance with Nebraska Statute 81-520.01<br />
          Air quality regulations may necessitate an additional permit from the Department of Environmental Control. Phone (402) 471-2186.
        </p>
        <p style={S.legal}>
          81-520.01 Statewide open burning ban; waiver; permit. (1) There shall be a statewide open burning ban on all bonfires, outdoor rubbish fires, and fires for the purpose of clearing land. (2) The Fire Chief of a local fire department or his or her designee may waive an open burning ban under subsection (1) of this section for an area under his or her jurisdiction by issuing an open burning permit to a person requesting permission to conduct open burning.
        </p>
        <p style={S.legal}>
          The permit issued by the fire chief to persons desiring to conduct open burning shall be in writing, signed by the chief, &amp; on a form prescribed by the State Fire Marshall. The State Fire Marshall shall provide local departments with such forms. (3) The Fire Chief of a local fire department or his or her designee may waive the open burning ban in his or her district when conditions are acceptable to the Chief. Anyone burning in such district when the open burning ban has been waived must notify the department of his or her intention to burn.
        </p>

        <div style={S.divider} />

        {/* Sheriff notice */}
        <p style={{ ...S.bigBold, fontSize: '12pt', fontWeight: 700, textAlign: 'center' }}>
          CALL SHERIFF&apos;S OFFICE AND GIVE EXACT LOCATION OF FIRE<br />
          BEFORE BURNING. LET THEM KNOW YOU HAVE A PERMIT.
        </p>

        {/* County info */}
        {countyInfo && (
          <div style={{ margin: '12px 0', fontWeight: 700 }}>
            {countyInfo.split('\n').map((line: string, i: number) => (
              <p key={i} style={{ margin: '4px 0' }}>{line}</p>
            ))}
          </div>
        )}

        <div style={S.divider} />

        {/* Signature block */}
        <div style={S.sigRow}>(Signature of Applicant)</div>
        {applicantSigUrl
          ? <img src={applicantSigUrl} alt="Applicant signature" style={{ maxHeight: '50px', maxWidth: '220px', display: 'block', margin: '6px 0 12px' }} />
          : <div style={{ borderBottom: '1px solid #000', marginTop: '28px', marginBottom: '12px' }} />
        }

        <div style={S.sigRow}>
          (Phone # of Applicant){' '}
          <span style={{ fontWeight: 400 }}>{permit.contact_phone ?? ''}</span>
        </div>
        <div style={{ borderBottom: '1px solid #000', marginTop: '28px', marginBottom: '12px' }} />

        <div style={S.sigRow}>
          (Fire Department Officer){' '}
          <span style={{ fontStyle: 'italic' }}>{officerName}</span>
        </div>
        {officerSigUrl
          ? <img src={officerSigUrl} alt="Officer signature" style={{ maxHeight: '50px', maxWidth: '220px', display: 'block', margin: '6px 0 4px' }} />
          : <div style={{ borderBottom: '1px solid #000', marginTop: '10px', marginBottom: '4px' }} />
        }

        {/* Void banner */}
        <p style={S.voidBanner}>VOID IF WIND EXCEEDS 10 MPH.</p>

        <p style={S.confirmCode}>Confirmation: {permit.confirmation_code}</p>
      </div>
    </>
  )
}
