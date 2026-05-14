import PrintButton from './PrintButton'

interface BottleRow {
  bottle_id: string
  department_name: string | null
  type_label: string
  psi: number | null
  requal_expires: string | null
  service_life_ends: string | null
  status_label: string
  in_spec: boolean
  fills: number
  last_fill: string | null
}

export default function ReportView({
  bottles,
  totalFills,
  generatedAt,
}: {
  bottles: BottleRow[]
  totalFills: number
  generatedAt: string
}) {
  const totalBottles = bottles.length
  const inSpec = bottles.filter(b => b.in_spec).length
  const outOfSpec = bottles.filter(b => !b.in_spec).length

  return (
    <div className="min-h-screen bg-white p-8 font-sans text-zinc-900">
      <div className="print:hidden mb-6 flex justify-end">
        <PrintButton />
      </div>

      {/* Header */}
      <div className="mb-6 pb-4 border-b-2 border-zinc-800 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">SCBA Cylinder Status Report</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Fire School — FireOps7</p>
        </div>
        <div className="text-right text-sm text-zinc-500">
          <p className="text-xs uppercase tracking-wide">Generated</p>
          <p className="font-medium text-zinc-700 mt-0.5">{generatedAt}</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <SummaryCard label="Total Bottles" value={totalBottles} />
        <SummaryCard label="In Spec" value={inSpec} color="green" />
        <SummaryCard label="Out of Spec" value={outOfSpec} color={outOfSpec > 0 ? 'red' : 'green'} />
        <SummaryCard label="Total Fills" value={totalFills} />
      </div>

      {/* Table */}
      {bottles.length === 0 ? (
        <p className="text-center text-zinc-400 py-12 text-sm">No bottles registered.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="pb-2 pr-3 font-semibold">Bottle ID</th>
              <th className="pb-2 pr-3 font-semibold">Department</th>
              <th className="pb-2 pr-3 font-semibold">Type</th>
              <th className="pb-2 pr-3 font-semibold">PSI</th>
              <th className="pb-2 pr-3 font-semibold">Requal Expires</th>
              <th className="pb-2 pr-3 font-semibold">Svc Life Ends</th>
              <th className="pb-2 pr-3 font-semibold">Status</th>
              <th className="pb-2 pr-3 font-semibold text-right">Fills</th>
              <th className="pb-2 font-semibold">Last Fill</th>
            </tr>
          </thead>
          <tbody>
            {bottles.map(b => (
              <tr
                key={b.bottle_id}
                className={`border-b border-zinc-100 ${!b.in_spec ? 'bg-red-50' : ''}`}
              >
                <td className="py-1.5 pr-3 font-mono font-bold text-zinc-900">{b.bottle_id}</td>
                <td className="py-1.5 pr-3 text-zinc-600">{b.department_name ?? '—'}</td>
                <td className="py-1.5 pr-3 text-zinc-600">{b.type_label}</td>
                <td className="py-1.5 pr-3 text-zinc-600">{b.psi ?? '—'}</td>
                <td className="py-1.5 pr-3 text-zinc-600">{b.requal_expires ?? '—'}</td>
                <td className="py-1.5 pr-3 text-zinc-600">{b.service_life_ends ?? '—'}</td>
                <td className="py-1.5 pr-3">
                  <span className={`font-semibold text-xs ${b.in_spec ? 'text-green-700' : 'text-red-700'}`}>
                    {b.status_label}
                  </span>
                </td>
                <td className="py-1.5 pr-3 text-right text-zinc-700 font-medium">{b.fills}</td>
                <td className="py-1.5 text-zinc-500 text-xs">{b.last_fill ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-8 text-xs text-zinc-400 text-center print:block hidden">
        FireOps7 — Confidential — Generated {generatedAt}
      </p>
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number; color?: 'red' | 'green' }) {
  const valueClass =
    color === 'red' ? 'text-red-600' :
    color === 'green' ? 'text-green-700' :
    'text-zinc-900'
  return (
    <div className="rounded-lg border border-zinc-200 p-4 text-center">
      <div className={`text-3xl font-bold ${valueClass}`}>{value}</div>
      <div className="text-xs font-medium text-zinc-500 mt-1 uppercase tracking-wide">{label}</div>
    </div>
  )
}
