'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updateApparatus } from '@/app/actions/apparatus'
import { assignCompartmentToApparatus, removeCompartmentFromApparatus } from '@/app/actions/compartments'
import { upsertApparatusIsoSpecs, savePumpTest, getPumpTestDocUrl } from '@/app/actions/iso'
import QrPrintLabel from '@/components/QrPrintLabel'
import BackButton from '@/components/BackButton'

interface Station {
  id: string
  station_number: string | null
  station_name: string
}

interface ApparatusType {
  id: string
  name: string
  sort_order: number
}

interface CompartmentItem {
  item_name: string
  expected_quantity: number
}

interface Compartment {
  id: string
  active: boolean
  notes: string | null
  compartment_name: {
    id: string
    compartment_code: string
    compartment_name: string | null
    sort_order: number | null
  } | null
  items: CompartmentItem[]
}

interface CompartmentName {
  id: string
  compartment_code: string
  compartment_name: string | null
  sort_order: number | null
}

interface Apparatus {
  id: string
  unit_number: string
  apparatus_name: string | null
  make: string | null
  model: string | null
  model_year: number | null
  vin: string | null
  license_plate: string | null
  active: boolean
  in_service_date: string | null
  out_of_service_date: string | null
  notes: string | null
  apparatus_type_id: string | null
  station_id: string | null
  qr_code: string | null
  exclude_from_iso: boolean
  has_air_brakes: boolean
  has_engine_hours: boolean
  apparatus_type: { id: string; name: string } | null
  station: { id: string; station_name: string; station_number: string | null } | null
}

type HoseLoad = { diameter_in: number; length_ft: number }

type PumpTest = {
  id: string
  test_date: string
  vendor: string
  passed: boolean
  notes: string | null
  document_path: string | null
  created_at: string
}

type IsoSpecs = {
  pump_rating_gpm: number | null
  tank_capacity_gal: number | null
  foam_capacity_gal: number | null
  aerial_length_ft: number | null
  turning_radius_ft: number | null
  gvwr_lbs: number | null
  hose_loads: HoseLoad[] | null
} | null

export default function ApparatusDetailClient({
  apparatus,
  stations,
  apparatusTypes,
  compartments,
  compartmentNames,
  isAdmin,
  isOfficerOrAbove,
  departmentId,
  isoSpecs,
  pumpTests,
  medicalBag,
}: {
  apparatus: Apparatus
  stations: Station[]
  apparatusTypes: ApparatusType[]
  compartments: Compartment[]
  compartmentNames: CompartmentName[]
  isAdmin: boolean
  isOfficerOrAbove: boolean
  departmentId: string
  isoSpecs: IsoSpecs
  pumpTests: PumpTest[]
  medicalBag: { storeroom_id: string; name: string; supply_count: number; alert_count: number } | null
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [compError, setCompError] = useState<string | null>(null)
  const [compLoading, setCompLoading] = useState(false)
  const [selectedCompartmentId, setSelectedCompartmentId] = useState('')
  const [isoError, setIsoError] = useState<string | null>(null)
  const [isoSuccess, setIsoSuccess] = useState<string | null>(null)
  const [isoLoading, setIsoLoading] = useState(false)
  const [hoseLoads, setHoseLoads] = useState<HoseLoad[]>(isoSpecs?.hose_loads ?? [])
  const [showPumpForm, setShowPumpForm] = useState(false)
  const [pumpLoading, setPumpLoading] = useState(false)
  const [pumpError, setPumpError] = useState<string | null>(null)
  const [pumpSuccess, setPumpSuccess] = useState<string | null>(null)
  const [pumpPassed, setPumpPassed] = useState(true)

  async function handleSubmit(formData: FormData) {
    setError(null); setSuccess(null); setLoading(true)
    formData.set('apparatus_id', apparatus.id)
    const result = await updateApparatus(formData)
    if (result?.error) setError(result.error)
    else setSuccess('Apparatus updated successfully.')
    setLoading(false)
  }

  async function handleAssignCompartment() {
    if (!selectedCompartmentId) return
    setCompError(null); setCompLoading(true)
    // Pass departmentId so sys admin (no dept record) is correctly verified
    const result = await assignCompartmentToApparatus(apparatus.id, selectedCompartmentId, departmentId)
    if (result?.error) setCompError(result.error)
    else setSelectedCompartmentId('')
    setCompLoading(false)
  }

  async function handleIsoSubmit(formData: FormData) {
    setIsoError(null); setIsoSuccess(null); setIsoLoading(true)
    formData.set('apparatus_id', apparatus.id)
    formData.set('hose_loads', JSON.stringify(hoseLoads))
    const result = await upsertApparatusIsoSpecs(formData)
    if (result?.error) setIsoError(result.error)
    else setIsoSuccess('ISO specs saved.')
    setIsoLoading(false)
  }

  async function handlePumpTestSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPumpError(null); setPumpSuccess(null); setPumpLoading(true)
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('apparatus_id', apparatus.id)
    formData.set('passed', String(pumpPassed))
    const result = await savePumpTest(formData)
    if (result?.error) setPumpError(result.error)
    else {
      setPumpSuccess('Pump test saved.')
      setShowPumpForm(false)
      setPumpPassed(true)
      form.reset()
      router.refresh()
    }
    setPumpLoading(false)
  }

  async function handleViewDoc(path: string) {
    const url = await getPumpTestDocUrl(path)
    if (url) window.open(url, '_blank')
  }

  async function handleRemoveCompartment(compartmentId: string) {
    setCompError(null); setCompLoading(true)
    // Pass departmentId so sys admin (no dept record) is correctly verified
    const result = await removeCompartmentFromApparatus(compartmentId, apparatus.id, departmentId)
    if (result?.error) setCompError(result.error)
    setCompLoading(false)
  }

  const assignedNameIds = new Set(compartments.map(c => c.compartment_name?.id).filter(Boolean))
  const availableCompartments = compartmentNames.filter(cn => !assignedNameIds.has(cn.id))

  const typeName = apparatus.apparatus_type?.name ?? '—'
  const stationLabel = apparatus.station
    ? `Station ${apparatus.station.station_number} — ${apparatus.station.station_name}`
    : 'No station assigned'

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <BackButton />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 truncate">
            Unit {apparatus.unit_number}{apparatus.apparatus_name ? ` — ${apparatus.apparatus_name}` : ''}
          </h1>
          <p className="text-sm text-zinc-500">{typeName} · {stationLabel}</p>
        </div>
        <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          apparatus.active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'
        }`}>
          {apparatus.active ? 'Active' : 'Inactive'}
        </span>
        {isOfficerOrAbove && (
          <Link
            href={`/reports/inventory?apparatusId=${apparatus.id}`}
            className="shrink-0 text-xs font-medium text-red-700 hover:underline"
          >
            View Reports
          </Link>
        )}
        {apparatus.qr_code && (
          <QrPrintLabel
            code={apparatus.qr_code}
            type="apparatus"
            title={`Unit ${apparatus.unit_number}${apparatus.apparatus_name ? ` — ${apparatus.apparatus_name}` : ''}`}
            buttonClassName="shrink-0 text-xs font-medium text-red-700 hover:underline print:hidden"
          />
        )}
      </div>

      {/* Apparatus Info */}
      <div className="rounded-xl bg-white shadow-sm border border-zinc-200 p-5 mb-5">
        <h2 className="text-base font-semibold text-zinc-900 mb-4">Apparatus Information</h2>
        {success && <Alert type="success" message={success} />}
        {error && <Alert type="error" message={error} />}

        {isOfficerOrAbove ? (
          <form action={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-zinc-700">Apparatus Name</label>
                <input name="apparatus_name" type="text" defaultValue={apparatus.apparatus_name ?? ''}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>
              <div className="sm:w-48">
                <label className="mb-1 block text-sm font-medium text-zinc-700">Type</label>
                <select name="apparatus_type_id" defaultValue={apparatus.apparatus_type_id ?? ''}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                  <option value="">Select type...</option>
                  {apparatusTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Station Assignment</label>
              <select name="station_id" defaultValue={apparatus.station_id ?? ''}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                <option value="">No station assigned</option>
                {stations.map(s => <option key={s.id} value={s.id}>Station {s.station_number} — {s.station_name}</option>)}
              </select>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-zinc-700">Make</label>
                <input name="make" type="text" defaultValue={apparatus.make ?? ''}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-zinc-700">Model</label>
                <input name="model" type="text" defaultValue={apparatus.model ?? ''}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>
              <div className="sm:w-24">
                <label className="mb-1 block text-sm font-medium text-zinc-700">Year</label>
                <input name="model_year" type="number" defaultValue={apparatus.model_year ?? ''}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-zinc-700">VIN</label>
                <input name="vin" type="text" defaultValue={apparatus.vin ?? ''}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>
              <div className="sm:w-36">
                <label className="mb-1 block text-sm font-medium text-zinc-700">License Plate</label>
                <input name="license_plate" type="text" defaultValue={apparatus.license_plate ?? ''}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-zinc-700">In Service Date</label>
                <input name="in_service_date" type="date" defaultValue={apparatus.in_service_date ?? ''}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>
              {isAdmin && (
                <div className="sm:w-36">
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Status</label>
                  <select name="active" defaultValue={apparatus.active ? 'true' : 'false'}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">QR Code</label>
              <input name="qr_code" type="text" defaultValue={apparatus.qr_code ?? ''}
                placeholder="e.g. ENGINE-32"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono uppercase focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              <p className="mt-1 text-xs text-zinc-400">Unique code printed on the QR label for this apparatus. Will be uppercased automatically.</p>
            </div>
            {isAdmin && (
              <div className="flex flex-col gap-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    name="exclude_from_iso"
                    type="checkbox"
                    defaultChecked={apparatus.exclude_from_iso}
                    className="h-4 w-4 rounded border-zinc-300 text-red-700 focus:ring-red-500"
                  />
                  <span className="text-sm font-medium text-zinc-700">Exclude from ISO calculations</span>
                  <span className="text-xs text-zinc-400">(ambulances, support vehicles, etc.)</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    name="has_air_brakes"
                    type="checkbox"
                    defaultChecked={apparatus.has_air_brakes}
                    className="h-4 w-4 rounded border-zinc-300 text-red-700 focus:ring-red-500"
                  />
                  <span className="text-sm font-medium text-zinc-700">Has air brakes</span>
                  <span className="text-xs text-zinc-400">(enables air brake inspection section on vehicle checks)</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    name="has_engine_hours"
                    type="checkbox"
                    defaultChecked={apparatus.has_engine_hours}
                    className="h-4 w-4 rounded border-zinc-300 text-red-700 focus:ring-red-500"
                  />
                  <span className="text-sm font-medium text-zinc-700">Track engine hours</span>
                  <span className="text-xs text-zinc-400">(shows engine hours field on vehicle checks)</span>
                </label>
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <ReadField label="Unit Number" value={apparatus.unit_number} />
            <ReadField label="Type" value={typeName} />
            <ReadField label="Make" value={apparatus.make} />
            <ReadField label="Model" value={apparatus.model} />
            <ReadField label="Year" value={apparatus.model_year?.toString()} />
            <ReadField label="Station" value={stationLabel} />
            <ReadField label="VIN" value={apparatus.vin} />
            <ReadField label="License Plate" value={apparatus.license_plate} />
            <ReadField label="In Service" value={apparatus.in_service_date} />
            <ReadField label="QR Code" value={apparatus.qr_code} />
          </div>
        )}
      </div>

      {/* Medical Bag */}
      {medicalBag && (
        <div className="rounded-xl bg-white shadow-sm border border-zinc-200 p-5 mb-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-zinc-900">Medical Bag</h2>
            <a href="/medical" className="text-xs font-semibold text-red-600 hover:text-red-800">
              View Storeroom →
            </a>
          </div>
          <p className="text-sm text-zinc-500 mb-3">{medicalBag.name}</p>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-zinc-900">{medicalBag.supply_count}</p>
              <p className="text-xs text-zinc-400">supply type{medicalBag.supply_count !== 1 ? 's' : ''}</p>
            </div>
            {medicalBag.alert_count > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2">
                <span className="text-red-600 font-bold text-sm">⚠</span>
                <p className="text-sm font-semibold text-red-700">
                  {medicalBag.alert_count} item{medicalBag.alert_count !== 1 ? 's' : ''} need attention
                </p>
              </div>
            )}
            {medicalBag.alert_count === 0 && medicalBag.supply_count > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-2">
                <p className="text-sm font-semibold text-green-700">All stock good</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ISO Specs */}
      {isOfficerOrAbove && (
        <div className="rounded-xl bg-white shadow-sm border border-zinc-200 p-5 mt-5">
          <h2 className="text-base font-semibold text-zinc-900 mb-4">ISO Specifications</h2>
          {isoSuccess && <Alert type="success" message={isoSuccess} />}
          {isoError && <Alert type="error" message={isoError} />}
          <form action={handleIsoSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-zinc-700">Pump Rating (GPM)</label>
                <input name="pump_rating_gpm" type="number" min="0" defaultValue={isoSpecs?.pump_rating_gpm ?? ''}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-zinc-700">Tank Capacity (gal)</label>
                <input name="tank_capacity_gal" type="number" min="0" defaultValue={isoSpecs?.tank_capacity_gal ?? ''}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-zinc-700">Foam Capacity (gal)</label>
                <input name="foam_capacity_gal" type="number" min="0" defaultValue={isoSpecs?.foam_capacity_gal ?? ''}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>
              <div className="sm:w-32">
                <label className="mb-1 block text-sm font-medium text-zinc-700">Aerial Length (ft)</label>
                <input name="aerial_length_ft" type="number" min="0" defaultValue={isoSpecs?.aerial_length_ft ?? ''}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-zinc-700">Turning Radius (ft)</label>
                <input name="turning_radius_ft" type="number" min="0" defaultValue={isoSpecs?.turning_radius_ft ?? ''}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-zinc-700">GVWR (lbs)</label>
                <input name="gvwr_lbs" type="number" min="0" defaultValue={isoSpecs?.gvwr_lbs ?? ''}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-zinc-700">Hose Loads</label>
                <button
                  type="button"
                  onClick={() => setHoseLoads(prev => [...prev, { diameter_in: 1.75, length_ft: 0 }])}
                  className="flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
                >
                  + Add Hose Load
                </button>
              </div>
              {hoseLoads.length === 0 ? (
                <p className="text-xs text-zinc-400">No hose loads added yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {hoseLoads.map((load, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select
                        value={load.diameter_in}
                        onChange={e => setHoseLoads(prev => prev.map((l, j) => j === i ? { ...l, diameter_in: parseFloat(e.target.value) } : l))}
                        className="rounded-lg border border-zinc-300 px-2 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                      >
                        {[1, 1.5, 1.75, 2, 2.5, 3, 4, 5, 6].map(d => (
                          <option key={d} value={d}>{d}&quot;</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        value={load.length_ft || ''}
                        onChange={e => setHoseLoads(prev => prev.map((l, j) => j === i ? { ...l, length_ft: parseInt(e.target.value) || 0 } : l))}
                        placeholder="Length (ft)"
                        className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                      <button
                        type="button"
                        onClick={() => setHoseLoads(prev => prev.filter((_, j) => j !== i))}
                        className="text-zinc-400 hover:text-red-600 text-xl leading-none px-1 transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button type="submit" disabled={isoLoading}
              className="w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors">
              {isoLoading ? 'Saving...' : 'Save ISO Specs'}
            </button>
          </form>
        </div>
      )}

      {/* Pump Tests */}
      {isOfficerOrAbove && (
        <div className="rounded-xl bg-white shadow-sm border border-zinc-200 p-5 mt-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-zinc-900">Pump Tests (NFPA 1911)</h2>
            {!showPumpForm && (
              <button
                onClick={() => { setShowPumpForm(true); setPumpError(null); setPumpSuccess(null) }}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                + Add Test
              </button>
            )}
          </div>

          {pumpSuccess && <Alert type="success" message={pumpSuccess} />}
          {pumpError && <Alert type="error" message={pumpError} />}

          {showPumpForm && (
            <form onSubmit={handlePumpTestSubmit} className="flex flex-col gap-3 mb-5 p-4 rounded-lg bg-zinc-50 border border-zinc-200">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Test Date</label>
                  <input name="test_date" type="date" required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Vendor / Tester</label>
                  <input name="vendor" type="text" required placeholder="Company name"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Result</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPumpPassed(true)}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold border transition-colors ${pumpPassed ? 'bg-green-600 text-white border-green-600' : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50'}`}>
                    Pass
                  </button>
                  <button type="button" onClick={() => setPumpPassed(false)}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold border transition-colors ${!pumpPassed ? 'bg-red-600 text-white border-red-600' : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50'}`}>
                    Fail
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Notes (optional)</label>
                <input name="notes" type="text" placeholder="Any notes about the test"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Test Sheet (PDF or image)</label>
                <input name="document" type="file" accept=".pdf,.jpg,.jpeg,.png"
                  className="w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-red-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-red-700 hover:file:bg-red-100" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={pumpLoading}
                  className="flex-1 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors">
                  {pumpLoading ? 'Saving...' : 'Save Test'}
                </button>
                <button type="button" onClick={() => setShowPumpForm(false)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {pumpTests.length === 0 ? (
            <p className="text-sm text-zinc-400">No pump tests recorded yet.</p>
          ) : (
            <div className="flex flex-col divide-y divide-zinc-100">
              {pumpTests.map(t => (
                <div key={t.id} className="flex items-center justify-between py-3 gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {t.passed ? 'Pass' : 'Fail'}
                      </span>
                      <span className="text-sm font-medium text-zinc-800">{t.vendor}</span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {new Date(t.test_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {t.notes && ` · ${t.notes}`}
                    </p>
                  </div>
                  {t.document_path && (
                    <button
                      onClick={() => handleViewDoc(t.document_path!)}
                      className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
                    >
                      View Doc
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compartments */}
      <div className="rounded-xl bg-white shadow-sm border border-zinc-200 p-5 mt-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-zinc-900">
            Compartments ({compartments.filter(c => c.active).length} active)
          </h2>
          <div className="flex items-center gap-2">
            {isOfficerOrAbove && compartments.filter(c => c.active).length > 0 && (
              <Link
                href={`/equipment/${apparatus.id}`}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Manage Equipment
              </Link>
            )}
            {compartments.filter(c => c.active).length > 0 && (
              <Link
                href={`/inspections/apparatus/${apparatus.id}`}
                className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 transition-colors"
              >
                Start Inspection Session
              </Link>
            )}
          </div>
        </div>
        {compError && <Alert type="error" message={compError} />}

        {compartments.length === 0 ? (
          <p className="text-sm text-zinc-400 mb-4">No compartments assigned to this apparatus yet.</p>
        ) : (
          <div className="flex flex-col gap-2 mb-4">
            {[...compartments]
              .sort((a, b) => (a.compartment_name?.sort_order ?? 999) - (b.compartment_name?.sort_order ?? 999))
              .map(c => (
                <div key={c.id} className="rounded-lg border border-zinc-100 bg-zinc-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center rounded-lg bg-red-50 border border-red-100 px-2.5 py-1 text-sm font-mono font-bold text-red-700">
                        {c.compartment_name?.compartment_code ?? '—'}
                      </span>
                      {c.compartment_name?.compartment_name && (
                        <span className="text-sm text-zinc-600">{c.compartment_name.compartment_name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/equipment/${apparatus.id}/${c.id}`}
                        className="text-xs font-semibold text-red-600 hover:text-red-800"
                      >
                        View →
                      </Link>
                      <span className={`text-xs rounded-full px-2 py-0.5 ${c.active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-400'}`}>
                        {c.active ? 'Active' : 'Inactive'}
                      </span>
                      {isAdmin && (
                        <button onClick={() => handleRemoveCompartment(c.id)} disabled={compLoading}
                          className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50">
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  {c.items.length > 0 && (
                    <div className="border-t border-zinc-100 px-4 py-2 flex flex-col gap-1.5">
                      {c.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between gap-3">
                          <span className="text-sm text-zinc-700">{item.item_name}</span>
                          <span className="text-xs text-zinc-400 shrink-0">qty {item.expected_quantity}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}

        {isAdmin && (
          <div>
            {compartmentNames.length === 0 ? (
              <p className="text-xs text-zinc-400">
                No compartment names defined yet. Go to{' '}
                <a href="/dept-admin/compartments" className="text-red-600 hover:underline">Dept Admin → Compartments</a> to add them.
              </p>
            ) : availableCompartments.length === 0 ? (
              <p className="text-xs text-zinc-400">All department compartments have been assigned to this apparatus.</p>
            ) : (
              <div className="flex gap-3 pt-3 border-t border-zinc-100">
                <select value={selectedCompartmentId} onChange={e => setSelectedCompartmentId(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
                  <option value="">Add compartment...</option>
                  {availableCompartments
                    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
                    .map(cn => (
                      <option key={cn.id} value={cn.id}>
                        {cn.compartment_code}{cn.compartment_name ? ` — ${cn.compartment_name}` : ''}
                      </option>
                    ))}
                </select>
                <button onClick={handleAssignCompartment} disabled={!selectedCompartmentId || compLoading}
                  className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors">
                  {compLoading ? '...' : 'Add'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ReadField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-zinc-900">{value || '—'}</p>
    </div>
  )
}

function Alert({ type, message }: { type: 'success' | 'error'; message: string }) {
  return (
    <div className={`mb-4 rounded-lg px-4 py-3 text-sm border ${
      type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
    }`}>
      {message}
    </div>
  )
}
