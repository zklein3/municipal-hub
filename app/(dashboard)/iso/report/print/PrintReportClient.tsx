'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatLocalDateTime } from '@/lib/format-datetime'
import { saveIsoReportSettings } from '@/app/actions/departments'

type Apparatus = {
  id: string; unit_number: string; apparatus_name: string | null
  make: string | null; model: string | null; model_year: number | null
  spec: { pump_rating_gpm: number | null; tank_capacity_gal: number | null; foam_capacity_gal: number | null; aerial_length_ft: number | null; turning_radius_ft: number | null; gvwr_lbs: number | null; hose_loads: unknown } | null
  pumpTest: { test_date: string; passed: boolean } | null
}
type HoseRow = { diameter: number; owned: number; onTruck: number; inStorage: number; gap: boolean }
type ActiveHose = { id: string; hose_identifier: string; hose_type: string; diameter_in: number; length_ft: number; tested: boolean; failed: boolean }
type Hydrant = { id: string; hydrant_number: string; location_description: string | null; out_of_service: boolean; tested: boolean; last_flow: { test_date: string; flow_gpm: number | null } | null }
type MutualAidApp = { identifier: string; pump_gpm: number | null; tank_gal: number | null; hose_loads: { diameter_in: number; length_ft: number }[] }
type MutualAid = { id: string; partner_department: string; agreement_type: string; expiration_date: string | null; apparatus: MutualAidApp[] }
type ResponseRun = { incident_number: string | null; incident_type: string | null; call_time: string; address: string; dispatch_min: number | null; response_min: number; travel_min: number | null }

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wide border-b-2 border-zinc-900 pb-1 mb-3 mt-6 first:mt-0">
      {children}
    </h2>
  )
}

const DEFAULT_SECTIONS = {
  apparatus: true, staffing: true, training: true, certifications: true,
  hoseInventory: true, hoseTesting: true, hydrants: true, preplans: true,
  mutualAid: true, responseTimes: true,
}

export default function PrintReportClient({
  deptName, months, generatedAt,
  apparatus, staffing, hoseInventory, activeHoses,
  hydrants, training, certSummary, preplans, mutualAid, responseTimes,
  departmentTimezone, departmentId, isAdmin, defaultAuditDate, defaultAuditorName, defaultSections,
}: {
  deptName: string
  months: number
  generatedAt: string
  apparatus: Apparatus[]
  staffing: { total: number; admin: number; officer: number; member: number }
  hoseInventory: HoseRow[]
  activeHoses: ActiveHose[]
  hydrants: Hydrant[]
  training: { events: number; hours: number; roster: { name: string; hours: number }[] }
  certSummary: { name: string; total: number; expired: number }[]
  preplans: { id: string; location_name: string; address: string | null; surveyed_date: string | null }[]
  mutualAid: MutualAid[]
  responseTimes: { runs: ResponseRun[]; avgResponseMin: number | null; avgDispatchMin: number | null; total: number }
  departmentTimezone: string
  departmentId: string
  isAdmin: boolean
  defaultAuditDate: string | null
  defaultAuditorName: string | null
  defaultSections: Record<string, boolean>
}) {
  const router = useRouter()
  const [auditDate, setAuditDate] = useState(defaultAuditDate ?? '')
  const [auditorName, setAuditorName] = useState(defaultAuditorName ?? '')
  const [selectedMonths, setSelectedMonths] = useState(months)
  const [sections, setSections] = useState({ ...DEFAULT_SECTIONS, ...defaultSections })
  const [savingDefaults, setSavingDefaults] = useState(false)
  const [savedDefaults, setSavedDefaults] = useState(false)

  function toggleSection(key: keyof typeof sections) {
    setSections(s => ({ ...s, [key]: !s[key] }))
  }

  function handleMonthsChange(m: number) {
    setSelectedMonths(m)
    router.push(`/iso/report/print?months=${m}`)
  }

  async function handleSaveDefaults() {
    setSavingDefaults(true)
    setSavedDefaults(false)
    const result = await saveIsoReportSettings(departmentId, {
      auditDate: auditDate || null,
      auditorName: auditorName || null,
      defaultMonths: selectedMonths,
      sections,
    })
    setSavingDefaults(false)
    if (!result?.error) {
      setSavedDefaults(true)
      setTimeout(() => setSavedDefaults(false), 2500)
    }
  }

  const generatedDate = formatLocalDateTime(generatedAt, departmentTimezone, { month: 'long', day: 'numeric', year: 'numeric', hour: undefined, minute: undefined })
  const hosesTestedCount = activeHoses.filter(h => h.tested).length
  const hosesTestedPct = activeHoses.length > 0 ? Math.round(hosesTestedCount / activeHoses.length * 100) : null
  const hydrantsTestedCount = hydrants.filter(h => h.tested).length
  const hydrantsTestedPct = hydrants.length > 0 ? Math.round(hydrantsTestedCount / hydrants.length * 100) : null

  return (
    <div className="max-w-4xl">

      {/* ── Config Panel (hidden on print) ──────────────────────────────────── */}
      <div className="print:hidden mb-8 rounded-xl bg-white border border-zinc-200 p-5">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-base font-bold text-zinc-900">ISO Report Builder</h1>
          <div className="flex items-center gap-2">
            {savedDefaults && <span className="text-xs font-medium text-green-600">✓ Saved</span>}
            {isAdmin && (
              <button
                onClick={handleSaveDefaults}
                disabled={savingDefaults}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
              >
                {savingDefaults ? 'Saving…' : 'Save as Default'}
              </button>
            )}
            <Link href="/iso/report" className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50">
              ← Back
            </Link>
            <button
              onClick={() => window.print()}
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 transition-colors"
            >
              Print / Save PDF
            </button>
          </div>
        </div>
        {isAdmin && (
          <p className="text-xs text-zinc-400 mb-4">
            "Save as Default" stores these fields and section choices on the department — they'll pre-fill the next time anyone opens this report.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Audit Date</label>
            <input type="date" value={auditDate} onChange={e => setAuditDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Auditor Name</label>
            <input type="text" value={auditorName} onChange={e => setAuditorName(e.target.value)}
              placeholder="ISO auditor name"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Training / Testing Period</label>
            <select value={selectedMonths} onChange={e => handleMonthsChange(parseInt(e.target.value))}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
              <option value={6}>6 months</option>
              <option value={12}>12 months</option>
              <option value={24}>24 months</option>
              <option value={36}>36 months</option>
            </select>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Include Sections</p>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(sections) as [keyof typeof sections, boolean][]).map(([key, on]) => (
              <button key={key} onClick={() => toggleSection(key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${on ? 'bg-red-700 text-white border-red-700' : 'bg-white text-zinc-500 border-zinc-300 hover:border-red-300'}`}>
                {key === 'apparatus' ? 'Apparatus' :
                 key === 'staffing' ? 'Staffing' :
                 key === 'training' ? 'Training Hours' :
                 key === 'certifications' ? 'Certifications' :
                 key === 'hoseInventory' ? 'Hose Inventory' :
                 key === 'hoseTesting' ? 'Hose Testing' :
                 key === 'hydrants' ? 'Hydrants' :
                 key === 'preplans' ? 'Pre-Fire Plans' :
                 key === 'mutualAid' ? 'Mutual Aid' : 'Response Times'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Print Report ─────────────────────────────────────────────────────── */}
      <div className="bg-white p-8 print:p-0 print:shadow-none rounded-xl border border-zinc-200 print:border-0">

        {/* Report Header */}
        <div className="border-b-4 border-zinc-900 pb-4 mb-6">
          <h1 className="text-2xl font-bold text-zinc-900">{deptName}</h1>
          <h2 className="text-lg font-semibold text-zinc-700 mt-0.5">ISO Audit Report</h2>
          <div className="flex gap-6 mt-2 text-sm text-zinc-500">
            {auditDate && <span>Audit Date: <strong className="text-zinc-800">{fmtDate(auditDate)}</strong></span>}
            {auditorName && <span>Auditor: <strong className="text-zinc-800">{auditorName}</strong></span>}
            <span>Period: <strong className="text-zinc-800">{months} months</strong></span>
            <span>Generated: <strong className="text-zinc-800">{generatedDate}</strong></span>
          </div>
        </div>

        {/* Apparatus Specifications */}
        {sections.apparatus && (
          <div className="print:break-inside-avoid">
            <SectionHeading>Apparatus Specifications</SectionHeading>
            <table className="w-full text-xs mb-2">
              <thead>
                <tr className="bg-zinc-100 text-left">
                  <th className="px-2 py-1.5 font-semibold">Unit</th>
                  <th className="px-2 py-1.5 font-semibold">Year/Make/Model</th>
                  <th className="px-2 py-1.5 font-semibold text-right">Pump (GPM)</th>
                  <th className="px-2 py-1.5 font-semibold text-right">Tank (gal)</th>
                  <th className="px-2 py-1.5 font-semibold text-right">Foam (gal)</th>
                  <th className="px-2 py-1.5 font-semibold text-right">Turn Radius (ft)</th>
                  <th className="px-2 py-1.5 font-semibold text-right">GVWR (lbs)</th>
                  <th className="px-2 py-1.5 font-semibold text-center">Pump Test</th>
                </tr>
              </thead>
              <tbody>
                {apparatus.map((a, i) => {
                  const pt = a.pumpTest
                  const overdue = pt ? new Date(pt.test_date + 'T00:00:00') < new Date(new Date().setFullYear(new Date().getFullYear() - 1)) : false
                  return (
                    <tr key={a.id} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}>
                      <td className="px-2 py-1.5 font-bold">{a.unit_number}{a.apparatus_name ? ` — ${a.apparatus_name}` : ''}</td>
                      <td className="px-2 py-1.5">{[a.model_year, a.make, a.model].filter(Boolean).join(' ') || '—'}</td>
                      <td className="px-2 py-1.5 text-right">{a.spec?.pump_rating_gpm ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right">{a.spec?.tank_capacity_gal ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right">{a.spec?.foam_capacity_gal ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right">{a.spec?.turning_radius_ft ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right">{a.spec?.gvwr_lbs != null ? a.spec.gvwr_lbs.toLocaleString() : '—'}</td>
                      <td className="px-2 py-1.5 text-center">
                        {!pt ? 'No record' : overdue ? 'Overdue' : `${pt.passed ? 'Pass' : 'Fail'} · ${fmtDate(pt.test_date)}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Staffing */}
        {sections.staffing && (
          <div className="print:break-inside-avoid">
            <SectionHeading>Personnel &amp; Staffing</SectionHeading>
            <div className="grid grid-cols-4 gap-3 mb-2">
              {[
                { label: 'Total Active', value: staffing.total },
                { label: 'Admins / Chiefs', value: staffing.admin },
                { label: 'Officers', value: staffing.officer },
                { label: 'Members', value: staffing.member },
              ].map(s => (
                <div key={s.label} className="border border-zinc-200 rounded p-3 text-center">
                  <p className="text-2xl font-bold text-zinc-900">{s.value}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Training Hours */}
        {sections.training && (
          <div className="print:break-inside-avoid">
            <SectionHeading>Training Hours ({months}-Month Period)</SectionHeading>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="border border-zinc-200 rounded p-3 text-center">
                <p className="text-2xl font-bold">{training.events}</p>
                <p className="text-xs text-zinc-500">Events</p>
              </div>
              <div className="border border-zinc-200 rounded p-3 text-center">
                <p className="text-2xl font-bold">{training.hours}</p>
                <p className="text-xs text-zinc-500">Total Hours</p>
              </div>
              <div className="border border-zinc-200 rounded p-3 text-center">
                <p className="text-2xl font-bold">
                  {training.roster.length > 0 ? Math.round(training.roster.reduce((s, r) => s + r.hours, 0) / training.roster.length * 10) / 10 : '—'}
                </p>
                <p className="text-xs text-zinc-500">Avg / Member</p>
              </div>
            </div>
            {training.roster.length > 0 && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-zinc-100">
                    <th className="px-2 py-1.5 font-semibold text-left">Member</th>
                    <th className="px-2 py-1.5 font-semibold text-right">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {training.roster.map((r, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}>
                      <td className="px-2 py-1.5">{r.name}</td>
                      <td className="px-2 py-1.5 text-right font-semibold">{r.hours} hrs</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Certifications */}
        {sections.certifications && certSummary.length > 0 && (
          <div className="print:break-inside-avoid">
            <SectionHeading>Training Certifications</SectionHeading>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-100">
                  <th className="px-2 py-1.5 font-semibold text-left">Certification</th>
                  <th className="px-2 py-1.5 font-semibold text-right">Members Certified</th>
                  <th className="px-2 py-1.5 font-semibold text-right">Expired</th>
                </tr>
              </thead>
              <tbody>
                {certSummary.map((c, i) => (
                  <tr key={c.name} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}>
                    <td className="px-2 py-1.5 font-medium">{c.name}</td>
                    <td className="px-2 py-1.5 text-right font-bold">{c.total}</td>
                    <td className="px-2 py-1.5 text-right">{c.expired > 0 ? <span className="text-red-700 font-semibold">{c.expired}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Hose Inventory */}
        {sections.hoseInventory && hoseInventory.length > 0 && (
          <div className="print:break-inside-avoid">
            <SectionHeading>Hose Inventory Summary</SectionHeading>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-100">
                  <th className="px-2 py-1.5 font-semibold text-left">Diameter</th>
                  <th className="px-2 py-1.5 font-semibold text-right">Total Owned</th>
                  <th className="px-2 py-1.5 font-semibold text-right">On Trucks</th>
                  <th className="px-2 py-1.5 font-semibold text-right">In Storage</th>
                  <th className="px-2 py-1.5 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {hoseInventory.map((h, i) => (
                  <tr key={h.diameter} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}>
                    <td className="px-2 py-1.5 font-medium">{h.diameter}&quot;</td>
                    <td className="px-2 py-1.5 text-right">{h.owned > 0 ? `${h.owned} ft` : '—'}</td>
                    <td className="px-2 py-1.5 text-right">{h.onTruck > 0 ? `${h.onTruck} ft` : '—'}</td>
                    <td className="px-2 py-1.5 text-right">{h.gap ? '—' : `${h.inStorage} ft`}</td>
                    <td className="px-2 py-1.5 text-center">{h.gap ? <span className="text-amber-700 font-semibold">Incomplete</span> : 'OK'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Hose Testing */}
        {sections.hoseTesting && activeHoses.length > 0 && (
          <div className="print:break-inside-avoid">
            <SectionHeading>Hose Test Compliance — NFPA 1962 ({months} months)</SectionHeading>
            <p className="text-xs text-zinc-500 mb-2">
              {activeHoses.filter(h => h.tested).length} of {activeHoses.length} in-service hoses tested
              {hosesTestedPct != null ? ` (${hosesTestedPct}%)` : ''}
            </p>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-100">
                  <th className="px-2 py-1.5 font-semibold text-left">ID</th>
                  <th className="px-2 py-1.5 font-semibold text-left">Type</th>
                  <th className="px-2 py-1.5 font-semibold text-right">Diameter</th>
                  <th className="px-2 py-1.5 font-semibold text-right">Length</th>
                  <th className="px-2 py-1.5 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {activeHoses.map((h, i) => (
                  <tr key={h.id} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}>
                    <td className="px-2 py-1.5 font-mono font-bold">{h.hose_identifier}</td>
                    <td className="px-2 py-1.5 capitalize">{h.hose_type.replace('_', ' ')}</td>
                    <td className="px-2 py-1.5 text-right">{h.diameter_in}&quot;</td>
                    <td className="px-2 py-1.5 text-right">{h.length_ft} ft</td>
                    <td className="px-2 py-1.5 text-center font-semibold">
                      {h.failed ? <span className="text-red-700">Failed</span> : h.tested ? <span className="text-green-700">Tested</span> : <span className="text-amber-700">Overdue</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Hydrants */}
        {sections.hydrants && hydrants.length > 0 && (
          <div className="print:break-inside-avoid">
            <SectionHeading>Hydrant Flow Test Compliance ({months} months)</SectionHeading>
            <p className="text-xs text-zinc-500 mb-2">
              {hydrantsTestedCount} of {hydrants.length} hydrants tested
              {hydrantsTestedPct != null ? ` (${hydrantsTestedPct}%)` : ''}
            </p>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-100">
                  <th className="px-2 py-1.5 font-semibold text-left">Hydrant #</th>
                  <th className="px-2 py-1.5 font-semibold text-left">Location</th>
                  <th className="px-2 py-1.5 font-semibold text-right">Last Flow (GPM)</th>
                  <th className="px-2 py-1.5 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {hydrants.map((h, i) => (
                  <tr key={h.id} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}>
                    <td className="px-2 py-1.5 font-mono font-bold">{h.hydrant_number}</td>
                    <td className="px-2 py-1.5">{h.location_description ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right">{h.last_flow?.flow_gpm ?? '—'}</td>
                    <td className="px-2 py-1.5 text-center font-semibold">
                      {h.out_of_service ? <span className="text-red-700">OOS</span> : h.tested ? <span className="text-green-700">Tested</span> : <span className="text-amber-700">Overdue</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pre-Fire Plans */}
        {sections.preplans && preplans.length > 0 && (
          <div className="print:break-inside-avoid">
            <SectionHeading>Pre-Fire Plans</SectionHeading>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-100">
                  <th className="px-2 py-1.5 font-semibold text-left">Location</th>
                  <th className="px-2 py-1.5 font-semibold text-left">Address</th>
                  <th className="px-2 py-1.5 font-semibold text-right">Date Surveyed</th>
                </tr>
              </thead>
              <tbody>
                {preplans.map((p, i) => (
                  <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}>
                    <td className="px-2 py-1.5 font-medium">{p.location_name}</td>
                    <td className="px-2 py-1.5">{p.address ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right">{fmtDate(p.surveyed_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Mutual Aid Agreements */}
        {sections.mutualAid && mutualAid.length > 0 && (
          <div className="print:break-inside-avoid">
            <SectionHeading>Mutual Aid Agreements</SectionHeading>
            {mutualAid.map(a => (
              <div key={a.id} className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-bold text-zinc-900">{a.partner_department}</p>
                  <span className="text-xs text-zinc-500">
                    {a.agreement_type === 'automatic_aid' ? 'Automatic Aid' : a.agreement_type === 'mutual_aid' ? 'Mutual Aid' : 'Other'}
                    {a.expiration_date ? ` · Expires ${fmtDate(a.expiration_date)}` : ''}
                  </span>
                </div>
                {(a.apparatus ?? []).length > 0 && (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-zinc-100">
                        <th className="px-2 py-1 font-semibold text-left">Apparatus</th>
                        <th className="px-2 py-1 font-semibold text-right">Pump (GPM)</th>
                        <th className="px-2 py-1 font-semibold text-right">Tank (gal)</th>
                        <th className="px-2 py-1 font-semibold text-left">Hose</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.apparatus.map((app, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}>
                          <td className="px-2 py-1 font-medium">{app.identifier || '—'}</td>
                          <td className="px-2 py-1 text-right">{app.pump_gpm ?? '—'}</td>
                          <td className="px-2 py-1 text-right">{app.tank_gal ?? '—'}</td>
                          <td className="px-2 py-1">
                            {(app.hose_loads ?? []).length === 0 ? '—' : app.hose_loads.map(h => `${h.length_ft}ft ${h.diameter_in}"`).join(', ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Response Times */}
        {sections.responseTimes && (
          <div className="print:break-inside-avoid">
            <SectionHeading>Response Times ({months}-Month Period)</SectionHeading>
            {responseTimes.total === 0 ? (
              <p className="text-xs text-zinc-400 mb-2">No incidents with complete response time data in this period.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="border border-zinc-200 rounded p-3 text-center">
                    <p className="text-2xl font-bold">{responseTimes.total}</p>
                    <p className="text-xs text-zinc-500">Incidents</p>
                  </div>
                  <div className="border border-zinc-200 rounded p-3 text-center">
                    <p className="text-2xl font-bold">{responseTimes.avgResponseMin != null ? `${responseTimes.avgResponseMin} min` : '—'}</p>
                    <p className="text-xs text-zinc-500">Avg Total Response</p>
                  </div>
                  <div className="border border-zinc-200 rounded p-3 text-center">
                    <p className="text-2xl font-bold">{responseTimes.avgDispatchMin != null ? `${responseTimes.avgDispatchMin} min` : '—'}</p>
                    <p className="text-xs text-zinc-500">Avg Dispatch Time</p>
                  </div>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-100">
                      <th className="px-2 py-1.5 font-semibold text-left">Incident #</th>
                      <th className="px-2 py-1.5 font-semibold text-left">Date</th>
                      <th className="px-2 py-1.5 font-semibold text-left">Type</th>
                      <th className="px-2 py-1.5 font-semibold text-left">Location</th>
                      <th className="px-2 py-1.5 font-semibold text-right">Dispatch</th>
                      <th className="px-2 py-1.5 font-semibold text-right">Travel</th>
                      <th className="px-2 py-1.5 font-semibold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {responseTimes.runs.map((r, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}>
                        <td className="px-2 py-1.5 font-mono font-bold">{r.incident_number ?? '—'}</td>
                        <td className="px-2 py-1.5">{new Date(r.call_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td className="px-2 py-1.5 capitalize">{r.incident_type ?? '—'}</td>
                        <td className="px-2 py-1.5">{r.address}</td>
                        <td className="px-2 py-1.5 text-right">{r.dispatch_min != null ? `${r.dispatch_min} min` : '—'}</td>
                        <td className="px-2 py-1.5 text-right">{r.travel_min != null ? `${r.travel_min} min` : '—'}</td>
                        <td className="px-2 py-1.5 text-right font-semibold">{r.response_min} min</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-zinc-300 text-xs text-zinc-400 text-center print:mt-4">
          {deptName} · ISO Audit Report · Generated {generatedDate}
        </div>
      </div>
    </div>
  )
}
