'use client'

import { useRouter, usePathname } from 'next/navigation'
import type { TotalSizeGroup, PassFailSizeGroup, ResultRow } from './page'
import HelpText from '@/components/HelpText'

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

export default function HoseTestingReportClient({
  departmentName, report, dateFrom, dateTo, total, passFail,
}: {
  departmentName: string
  report: 'total' | 'passfail'
  dateFrom: string
  dateTo: string
  total: TotalSizeGroup[]
  passFail: PassFailSizeGroup[]
}) {
  const router = useRouter()
  const pathname = usePathname()

  function go(updates: { report?: string; from?: string; to?: string }) {
    const params = new URLSearchParams({ report, from: dateFrom, to: dateTo, ...updates })
    router.push(`${pathname}?${params.toString()}`)
  }

  const inputCls = 'rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 bg-white'
  const tabCls = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${active ? 'bg-red-700 text-white' : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`

  const totalCount = total.reduce((n, g) => n + g.hoses.length, 0)
  const pf = passFail.reduce(
    (a, g) => ({ f: a.f + g.failed.length, p: a.p + g.passed.length, n: a.n + g.notTested.length }),
    { f: 0, p: 0, n: 0 },
  )

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3 print:mb-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">
            {report === 'total' ? 'Total Hose' : 'Hose Pass / Fail'}
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {departmentName}
            {report === 'passfail' && <> — tests {fmtDate(dateFrom)} to {fmtDate(dateTo)}</>}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="print:hidden shrink-0 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 transition-colors"
        >
          Print / Save PDF
        </button>
      </div>

      <div className="print:hidden mb-4 flex gap-2">
        <button onClick={() => go({ report: 'total' })} className={tabCls(report === 'total')}>Total Hose</button>
        <button onClick={() => go({ report: 'passfail' })} className={tabCls(report === 'passfail')}>Pass / Fail</button>
      </div>

      {report === 'total' ? (
        <>
          <HelpText className="mb-4">
            Every hose on file, grouped by size. Retired hose is left out.
          </HelpText>
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
      ) : (
        <>
          <HelpText className="mb-4">
            Each size lists failed hose first, then passed. A hose's result is its latest test in the date range, so a
            hose that failed and then passed a retest shows under Passed, marked (retest). Hose with no test in the
            range is listed last so nothing goes missing.
          </HelpText>

          <div className="print:hidden mb-5 rounded-xl bg-white border border-zinc-200 shadow-sm p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">From</label>
              <input type="date" value={dateFrom} onChange={e => e.target.value && go({ from: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">To</label>
              <input type="date" value={dateTo} onChange={e => e.target.value && go({ to: e.target.value })} className={inputCls} />
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
    </div>
  )
}
