import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getCurrentDepartmentContext } from '@/lib/current-department'

const TX_LABELS: Record<string, string> = {
  received: 'Received',
  dispensed: 'Dispensed',
  wasted: 'Wasted',
  transferred_out: 'Transfer Out',
  transferred_in: 'Transfer In',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default async function MedicalCSLogPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; storeroom_id?: string; supply_type_id?: string }>
}) {
  const { from, to, storeroom_id, supply_type_id } = await searchParams

  const adminClient = createAdminClient()

  const ctx = await getCurrentDepartmentContext()
  if (!ctx) redirect('/login')
  if (ctx.hasMultipleDepartments && !ctx.departmentId) redirect('/select-department')
  if (!ctx.departmentId) redirect('/login')

  const isOfficerOrAbove = ['admin', 'officer'].includes(ctx.systemRole ?? '') || ctx.isSysAdmin
  if (!isOfficerOrAbove) redirect('/medical')

  const department_id = ctx.departmentId

  // Date range defaults — current month
  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
  const fromDate = from ? new Date(from).toISOString() : defaultFrom
  const toDate = to ? new Date(to + 'T23:59:59').toISOString() : defaultTo

  // Dept info
  const { data: deptList } = await adminClient.from('departments').select('name').eq('id', department_id)
  const deptName = deptList?.[0]?.name ?? 'Department'

  // Storerooms for this dept
  const { data: storerooms } = await adminClient
    .from('medical_storerooms')
    .select('id, name')
    .eq('department_id', department_id)
    .eq('active', true)

  const storeroomIds = (storerooms ?? []).map(s => s.id)
  const storeroomMap = Object.fromEntries((storerooms ?? []).map(s => [s.id, s.name]))

  // Controlled supply type IDs for this dept
  const { data: csTypes } = await adminClient
    .from('medical_supply_types')
    .select('id, name')
    .eq('department_id', department_id)
    .eq('is_controlled', true)
    .eq('active', true)

  const csTypeIds = (csTypes ?? []).map(s => s.id)
  const supplyMap = Object.fromEntries((csTypes ?? []).map(s => [s.id, s.name]))

  if (csTypeIds.length === 0 || storeroomIds.length === 0) {
    return <p style={{ padding: '2rem', fontFamily: 'sans-serif' }}>No controlled substances configured.</p>
  }

  // Transactions — controlled supplies only, filtered by date + optional storeroom/supply
  let query = adminClient
    .from('medical_stock_transactions')
    .select('id, storeroom_id, supply_type_id, lot_id, transaction_type, quantity, performed_by, signer_1_id, signer_2_id, notes, created_at')
    .in('storeroom_id', storeroomIds)
    .in('supply_type_id', csTypeIds)
    .gte('created_at', fromDate)
    .lte('created_at', toDate)
    .order('created_at', { ascending: true })

  if (storeroom_id) query = query.eq('storeroom_id', storeroom_id)
  if (supply_type_id) query = query.eq('supply_type_id', supply_type_id)

  const { data: transactions } = await query

  // Lot number lookup
  const lotIds = [...new Set((transactions ?? []).map(t => t.lot_id).filter(Boolean))] as string[]
  const { data: lots } = lotIds.length > 0
    ? await adminClient.from('medical_stock_lots').select('id, lot_number').in('id', lotIds)
    : { data: [] }
  const lotMap = Object.fromEntries((lots ?? []).map(l => [l.id, l.lot_number]))

  // Personnel lookup
  const personnelIds = [...new Set([
    ...(transactions ?? []).map(t => t.performed_by),
    ...(transactions ?? []).map(t => t.signer_1_id),
    ...(transactions ?? []).map(t => t.signer_2_id),
  ].filter(Boolean))] as string[]
  const { data: personnelList } = personnelIds.length > 0
    ? await adminClient.from('personnel').select('id, first_name, last_name').in('id', personnelIds)
    : { data: [] }
  const personnelMap = Object.fromEntries(
    (personnelList ?? []).map(p => [p.id, `${p.first_name} ${p.last_name}`.trim()])
  )

  const fromLabel = new Date(fromDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const toLabel = new Date(toDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const filterStoreroomName = storeroom_id ? storeroomMap[storeroom_id] : null
  const filterSupplyName = supply_type_id ? supplyMap[supply_type_id] : null

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          @page { margin: 0.6in; size: letter portrait; }
        }
        body { font-family: 'Times New Roman', serif; font-size: 11pt; color: #000; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #000; padding: 4px 6px; vertical-align: top; }
        th { background: #f0f0f0; font-weight: bold; font-size: 10pt; }
        td { font-size: 10pt; }
      `}</style>

      <div className="no-print" style={{ padding: '1rem', background: '#fef3c7', borderBottom: '2px solid #d97706', fontFamily: 'sans-serif', fontSize: '13px' }}>
        <strong>Print preview</strong> — use your browser's Print function (Ctrl+P / ⌘+P).
        <button onClick={() => window.print()} style={{ marginLeft: '1rem', padding: '4px 12px', background: '#b91c1c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
          Print
        </button>
      </div>

      <div style={{ padding: '0.5in' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '0.25in' }}>
          <div style={{ fontSize: '16pt', fontWeight: 'bold' }}>{deptName}</div>
          <div style={{ fontSize: '13pt', fontWeight: 'bold', marginTop: '4px' }}>Controlled Substance Transaction Log</div>
          <div style={{ fontSize: '10pt', marginTop: '4px' }}>
            {fromLabel} — {toLabel}
            {filterStoreroomName && <span> · {filterStoreroomName}</span>}
            {filterSupplyName && <span> · {filterSupplyName}</span>}
          </div>
          <div style={{ fontSize: '9pt', color: '#555', marginTop: '2px' }}>
            Generated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </div>
        </div>

        {(transactions ?? []).length === 0 ? (
          <p style={{ textAlign: 'center', padding: '2rem', fontStyle: 'italic', color: '#555' }}>
            No controlled substance transactions found for this period.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: '14%' }}>Date / Time</th>
                <th style={{ width: '16%' }}>Supply</th>
                <th style={{ width: '8%' }}>Type</th>
                <th style={{ width: '6%' }}>Qty</th>
                <th style={{ width: '10%' }}>Lot #</th>
                <th style={{ width: '13%' }}>Storeroom</th>
                <th style={{ width: '13%' }}>Performed By</th>
                <th style={{ width: '10%' }}>Signer 1</th>
                <th style={{ width: '10%' }}>Signer 2</th>
              </tr>
            </thead>
            <tbody>
              {(transactions ?? []).map(tx => (
                <tr key={tx.id}>
                  <td>{fmtDate(tx.created_at)}</td>
                  <td>{supplyMap[tx.supply_type_id] ?? '—'}</td>
                  <td>{TX_LABELS[tx.transaction_type] ?? tx.transaction_type}</td>
                  <td style={{ textAlign: 'center' }}>{tx.quantity}</td>
                  <td>{tx.lot_id ? (lotMap[tx.lot_id] ?? 'No lot #') : '—'}</td>
                  <td>{storeroomMap[tx.storeroom_id] ?? '—'}</td>
                  <td>{tx.performed_by ? (personnelMap[tx.performed_by] ?? '—') : '—'}</td>
                  <td>{tx.signer_1_id ? (personnelMap[tx.signer_1_id] ?? '—') : '—'}</td>
                  <td>{tx.signer_2_id ? (personnelMap[tx.signer_2_id] ?? '—') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Signature lines */}
        <div style={{ marginTop: '0.4in', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4in' }}>
          <div>
            <div style={{ borderTop: '1px solid #000', paddingTop: '4px', fontSize: '9pt' }}>Officer Signature / Date</div>
          </div>
          <div>
            <div style={{ borderTop: '1px solid #000', paddingTop: '4px', fontSize: '9pt' }}>Witness Signature / Date</div>
          </div>
        </div>

        <div style={{ marginTop: '0.3in', fontSize: '8pt', color: '#555', textAlign: 'center' }}>
          Total transactions: {(transactions ?? []).length} · FireOps7
        </div>
      </div>
    </>
  )
}
