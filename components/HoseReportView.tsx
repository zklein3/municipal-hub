'use client'

import type { HoseReportData, ResultRow, TestSessionReport, TestSessionSummary } from '@/lib/hose-report'

// Presentational hose report, used by the dashboard page and the PIN-gated
// public page. Navigation is delegated so each host decides how state changes
// (URL params in the dashboard, local state on the public page).

export type ReportTab = 'total' | 'passfail' | 'tests'
export type ReportNav = { report?: ReportTab; from?: string; to?: string; session?: string | null }

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const th = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500'
const td = 'px-3 py-1.5 text-sm text-zinc-800'

function ResultTable({ rows, tone }: { rows: ResultRow[]; tone: 'fail' | 'pass' | 'none' }) {
  return (
    <table className="w-full">
      <thead className="bg-zinc-50">
        <tr>
          <th className={th}>Hose #</th>
          <th className={th}>Length</th>
          {tone !== 'none' && <th className={th}>Tested</th>}
          {tone !== 'none' && <th className={th}>PSI</th>}
          {tone === 'fail' && <th className={th}>Reason</th>}
          {tone !== 'none' && <th className={th}>Tester</th>}
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-100">
        {rows.map(r => (
          <tr key={r.hose_identifier + (r.test_date ?? '')}>
            <td className={`${td} font-mono font-semibold`}>
              {r.hose_identifier}
              {r.retested && <span className="ml-2 text-xs font-normal text-zinc-500">(retest)</span>}
            </td>
            <td className={td}>{r.length_ft} ft</td>
            {tone !== 'none' && <td className={td}>{r.test_date ? fmtDate(r.test_date) : '—'}</td>}
            {tone !== 'none' && <td className={td}>{r.test_pressure_psi ?? '—'}</td>}
            {tone === 'fail' && <td className={td}>{r.failure_reason || '—'}</td>}
            {tone !== 'none' && <td className={td}>{r.tester || '—'}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function HoseReportView({
  departmentName, report, dateFrom, dateTo, data, sessions, sessionReport, onNavigate,
}: {
  departmentName: string
  report: ReportTab
  dateFrom: string
  dateTo: string
  data: HoseReportData
  sessions: TestSessionSummary[]
  sessionReport: TestSessionReport | null
  onNavigate: (nav: ReportNav) => void
}) {
  const { total, passFail } = data
  const inputCls = 'rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 bg-white'
  const tabCls = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${active ? 'bg-red-700 text-white' : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`

  const totalCount = total.reduce((n, g) => n + g.hoses.length, 0)
  const pf = passFail.reduce(
    (a, g) => ({ f: a.f + g.failed.length, p: a.p + g.passed.length, n: a.n + g.notTested.length }),
    { f: 0, p: 0, n: 0 },
  )

  const title = report === 'total' ? 'Total Hose' : report === 'passfail' ? 'Hose Pass / Fail' : sessionReport ? 'Hose Test Report' : 'Hose Tests'

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3 print:mb-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">{title}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {departmentName}
            {report === 'passfail' && <> — tests {fmtDate(dateFrom)} to {fmtDate(dateTo)}</>}
            {report === 'tests' && sessionReport && <> — {fmtDate(sessionReport.testDate)}</>}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="print:hidden shrink-0 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 transition-colors"
        >
          Print / Save PDF
        </button>
      </div>

      <div className="print:hidden mb-4 flex flex-wrap gap-2">
        <button onClick={() => onNavigate({ report: 'total', session: null })} className={tabCls(report === 'total')}>Total Hose</button>
        <button onClick={() => onNavigate({ report: 'passfail', session: null })} className={tabCls(report === 'passfail')}>Pass / Fail</button>
        <button onClick={() => onNavigate({ report: 'tests', session: null })} className={tabCls(report === 'tests')}>By Test</button>
      </div>

      {report === 'total' && (
        <>
          <p className="mb-3 text-sm font-medium text-zinc-700">
            {totalCount} hoses total — {total.map(g => `${g.hoses.length} × ${g.diameter_in}"`).join(', ')}
          </p>
          {total.map(g => (
            <section key={g.diameter_in} className="mb-5 rounded-xl bg-white border border-zinc-200 shadow-sm overflow-hidden print:shadow-none print:break-inside-avoid">
              <h2 className="px-4 py-3 border-b border-zinc-100 text-sm font-semibold text-zinc-900">
                {g.diameter_in}" hose — {g.hoses.length}
              </h2>
              <table className="w-full">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className={th}>Hose #</th>
                    <th className={th}>Length</th>
                    <th className={th}>Type</th>
                    <th className={th}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {g.hoses.map((h, i) => (
                    <tr key={`${h.hose_identifier}-${i}`}>
                      <td className={`${td} font-mono font-semibold`}>{h.hose_identifier}</td>
                      <td className={td}>{h.length_ft} ft</td>
                      <td className={`${td} capitalize`}>{h.hose_type}</td>
                      <td className={`${td} capitalize`}>{h.status.replace(/_/g, ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </>
      )}

      {report === 'passfail' && (
        <>
          <div className="print:hidden mb-5 rounded-xl bg-white border border-zinc-200 shadow-sm p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">From</label>
              <input type="date" value={dateFrom} onChange={e => e.target.value && onNavigate({ from: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">To</label>
              <input type="date" value={dateTo} onChange={e => e.target.value && onNavigate({ to: e.target.value })} className={inputCls} />
            </div>
          </div>

          <p className="mb-3 text-sm font-medium text-zinc-700">
            {pf.f} failed · {pf.p} passed · {pf.n} not tested
          </p>

          {passFail.map(g => (
            <section key={g.diameter_in} className="mb-5 rounded-xl bg-white border border-zinc-200 shadow-sm overflow-hidden print:shadow-none">
              <h2 className="px-4 py-3 border-b border-zinc-200 bg-zinc-100 text-sm font-bold text-zinc-900">
                {g.diameter_in}" hose
              </h2>

              <h3 className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-red-700 bg-red-50 border-b border-red-100">
                Failed ({g.failed.length})
              </h3>
              {g.failed.length === 0
                ? <p className="px-4 py-3 text-sm text-zinc-400">None failed.</p>
                : <ResultTable rows={g.failed} tone="fail" />}

              <h3 className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-green-700 bg-green-50 border-y border-green-100">
                Passed ({g.passed.length})
              </h3>
              {g.passed.length === 0
                ? <p className="px-4 py-3 text-sm text-zinc-400">None passed.</p>
                : <ResultTable rows={g.passed} tone="pass" />}

              {g.notTested.length > 0 && (
                <>
                  <h3 className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 border-y border-amber-100">
                    Not tested in this range ({g.notTested.length})
                  </h3>
                  <ResultTable rows={g.notTested} tone="none" />
                </>
              )}
            </section>
          ))}
        </>
      )}

      {report === 'tests' && !sessionReport && (
        sessions.length === 0 ? (
          <p className="rounded-xl bg-white border border-zinc-200 p-6 text-sm text-zinc-500">No finished tests yet.</p>
        ) : (
          <div className="rounded-xl bg-white border border-zinc-200 shadow-sm overflow-hidden divide-y divide-zinc-100">
            {sessions.map(s => (
              <button key={s.id} onClick={() => onNavigate({ report: 'tests', session: s.id })}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-50">
                <span className="text-sm text-zinc-800">
                  <span className="font-semibold">{fmtDate(s.testDate)}</span>
                  <span className="text-zinc-500 ml-2">{s.testerName || 'Unknown'} · {s.pressurePsi ?? '—'} psi</span>
                </span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {s.hoseCount} hose{s.hoseCount !== 1 ? 's' : ''}
                  {s.failedCount > 0 && <span className="ml-2 font-semibold text-red-700">{s.failedCount} failed</span>}
                </span>
              </button>
            ))}
          </div>
        )
      )}

      {report === 'tests' && sessionReport && (
        <>
          <button onClick={() => onNavigate({ report: 'tests', session: null })}
            className="print:hidden mb-3 text-sm font-semibold text-red-700 hover:text-red-900">← All tests</button>
          <div className="mb-4 rounded-xl bg-white border border-zinc-200 p-4 text-sm text-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-3 print:border-zinc-400">
            <div><div className="text-xs text-zinc-500">Date</div>{fmtDate(sessionReport.testDate)}</div>
            <div><div className="text-xs text-zinc-500">Tester</div>{sessionReport.testerName || '—'}</div>
            <div><div className="text-xs text-zinc-500">Pressure</div>{sessionReport.pressurePsi ?? '—'} psi</div>
            <div><div className="text-xs text-zinc-500">Duration</div>{sessionReport.durationMin ?? '—'} min</div>
          </div>
          <p className="mb-3 text-sm font-medium text-zinc-700">
            {sessionReport.hoses.length} hoses · {sessionReport.hoses.filter(h => h.passed).length} passed · {sessionReport.hoses.filter(h => !h.passed).length} failed
          </p>
          <section className="rounded-xl bg-white border border-zinc-200 shadow-sm overflow-hidden print:shadow-none">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className={th}>Hose #</th>
                  <th className={th}>Size</th>
                  <th className={th}>Length</th>
                  <th className={th}>Result</th>
                  <th className={th}>Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {sessionReport.hoses.map(h => (
                  <tr key={h.hose_identifier + h.diameter_in}>
                    <td className={`${td} font-mono font-semibold`}>{h.hose_identifier}</td>
                    <td className={td}>{h.diameter_in}&quot;</td>
                    <td className={td}>{h.length_ft} ft</td>
                    <td className={`${td} font-semibold ${h.passed ? 'text-green-700' : 'text-red-700'}`}>{h.passed ? 'Pass' : 'Fail'}</td>
                    <td className={td}>{h.failure_reason || ''}{h.retired && <span className="ml-2 text-xs text-zinc-500">(taken out of service)</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  )
}
