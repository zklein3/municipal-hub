import { getAgilityTestForPrint } from '@/app/actions/agility-tests'
import { formatSeconds } from '@/lib/agility-test-spec'
import PrintButton from '../training-signin/PrintButton'

// Public, no-login print page — keyed by the test's own unguessable id (see
// getAgilityTestForPrint's comment for why this one skips the usual
// getCurrentDepartmentContext() gate every other /print/* page has). This is
// the printout an officer hands straight to Chief/HR for a hiring candidate,
// who has no FireOps7 account to log in with.
export default async function AgilityTestPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  if (!id) return <p style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Missing test id.</p>

  const data = await getAgilityTestForPrint(id)
  if (!data) return <p style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Test not found.</p>

  const { test, departmentName, evolutions } = data
  const dateStr = new Date(test.test_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div style={{ fontFamily: 'sans-serif', color: '#18181b', maxWidth: '750px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <PrintButton jobName={`Physical Agility Test - ${test.candidate_name}`} />

      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <p style={{ fontSize: '0.8rem', color: '#71717a', margin: 0 }}>{departmentName}</p>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0.25rem 0' }}>Physical Agility Test</h1>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #18181b', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <p style={{ fontSize: '0.7rem', color: '#71717a', margin: 0 }}>Candidate&apos;s Name</p>
          <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{test.candidate_name}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '0.7rem', color: '#71717a', margin: 0 }}>Date</p>
          <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{dateStr}</p>
        </div>
      </div>

      <div style={{
        textAlign: 'center', margin: '1rem 0', padding: '0.75rem',
        border: `3px solid ${test.overall_result === 'pass' ? '#15803d' : '#b91c1c'}`,
        borderRadius: '8px',
      }}>
        <span style={{ fontSize: '2rem', fontWeight: 900, color: test.overall_result === 'pass' ? '#15803d' : '#b91c1c', letterSpacing: '0.1em' }}>
          {test.overall_result === 'pass' ? 'PASS' : 'FAIL'}
        </span>
      </div>

      <p style={{ fontSize: '0.75rem', color: '#71717a', textAlign: 'center', marginBottom: '1.5rem' }}>
        Failure to complete any evolution within the time allocated constitutes failure of that evolution and the test. The candidate is not permitted to proceed further.
      </p>

      {evolutions.map(ev => (
        <div key={ev.evolution_number}>
          {ev.rest_before_seconds !== null && (
            <p style={{ fontSize: '0.75rem', color: '#92400e', textAlign: 'center', margin: '0 0 0.35rem 0' }}>
              Between evolution rest: {formatSeconds(ev.rest_before_seconds)}
            </p>
          )}
          <div style={{ border: '2px solid #18181b', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '0.75rem' }}>
          <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: '0 0 0.4rem 0' }}>
            {ev.evolution_number}. {ev.evolution_name.toUpperCase()}
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span>Time: <strong>{formatSeconds(ev.time_seconds)}</strong> (cutoff {formatSeconds(ev.cutoff_seconds)})</span>
            <span style={{ fontWeight: 700, color: ev.result === 'pass' ? '#15803d' : '#b91c1c' }}>{ev.result.toUpperCase()}</span>
          </div>
          {ev.sub_checks && Object.keys(ev.sub_checks).length > 0 && (
            <ul style={{ fontSize: '0.8rem', color: '#3f3f46', margin: '0.4rem 0 0 0', paddingLeft: '1.1rem' }}>
              {Object.entries(ev.sub_checks as Record<string, boolean | number>).map(([k, v]) => (
                <li key={k}>{k.replace(/_/g, ' ')}: {typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v}</li>
              ))}
            </ul>
          )}
          </div>
        </div>
      ))}

      {test.notes && (
        <div style={{ marginTop: '1rem' }}>
          <p style={{ fontSize: '0.7rem', color: '#71717a', margin: 0 }}>Notes</p>
          <p style={{ fontSize: '0.85rem', margin: 0 }}>{test.notes}</p>
        </div>
      )}

      <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #d4d4d8', fontSize: '0.85rem' }}>
        Administered by: <strong>{test.administered_by_name}</strong>
      </div>
    </div>
  )
}
