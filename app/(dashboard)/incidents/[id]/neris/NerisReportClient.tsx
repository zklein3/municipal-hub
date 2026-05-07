'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveNerisReport, saveApparatusResponseMode } from '@/app/actions/neris'
import NerisCombobox from '@/components/NerisCombobox'
import {
  NERIS_INCIDENT_TYPES,
  getFilteredIncidentTypes,
  NERIS_PROPERTY_USE,
  NERIS_ACTIONS_TAKEN,
  NERIS_RESPONSE_MODE,
  NERIS_FIRE_CONDITION_ARRIVAL,
  NERIS_BUILDING_DAMAGE,
  NERIS_SUPPRESSION_APPLIANCE,
  NERIS_FIRE_CAUSE_IN,
  NERIS_FIRE_CAUSE_OUT,
  NERIS_AID_TYPE,
  NERIS_AID_DIRECTION,
  NERIS_PATIENT_EVALUATION_CARE,
  NERIS_PATIENT_IMPROVED_STATUS,
  NERIS_MEDICAL_DISPOSITION,
  NERIS_HAZSIT_DISPOSITION,
  NERIS_DOT_HAZARD_CLASS,
  NERIS_RESCUE_TYPE,
  NERIS_CASUALTY_TYPE,
  NERIS_CASUALTY_CAUSE,
  COVER_TYPE_LABEL,
} from '@/lib/neris-value-sets'

const labelCls = "block text-sm font-medium text-zinc-700 mb-1"
const sectionCls = "rounded-xl bg-white border border-zinc-200 p-5 space-y-4"
const inputCls = "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"

function toGroups(codes: { code: string; label: string }[], groupLabel: string) {
  return [{ group: groupLabel, codes }]
}
function formatDT(dt: string | null) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
}

const COVER_TYPE_LABELS: Record<string, string> = {
  fire: 'Fire', rescue: 'Rescue', standby: 'Standby',
  mutual_aid: 'Mutual Aid', special: 'Special', other: 'Other',
}
const FIRE_SUBTYPE_LABELS: Record<string, string> = {
  structure: 'Structure Fire', vehicle: 'Vehicle Fire', grass: 'Grass Fire',
  wildland: 'Wildland Fire', other_fire: 'Other Fire',
}
const APPARATUS_ROLE_LABELS: Record<string, string> = {
  primary: 'Primary', support: 'Support', staging: 'Staging',
}

export default function NerisReportClient({
  incident,
  fireDetails,
  incidentApparatus,
  incidentPersonnel,
  nerisRecord,
  isAdmin,
}: {
  incident: any
  fireDetails: any
  incidentApparatus: { id: string; apparatus_id: string; unit_number: string; apparatus_name: string | null; role: string; response_mode: string | null; paged_at: string | null; on_scene_at: string | null; leaving_scene_at: string | null; available_at: string | null }[]
  incidentPersonnel: { id: string; personnel_id: string; role: string; name: string }[]
  nerisRecord: any
  isAdmin: boolean
}) {
  const router = useRouter()
  const isSubmitted = nerisRecord?.neris_status === 'submitted'

  // Testing mode (admin only) — forces all sections visible
  const [testingMode, setTestingMode] = useState(false)

  const coverType = incident.incident_type
  const isFireType     = testingMode || coverType === 'fire'
  const isMedicalType  = testingMode || coverType === 'rescue'
  const isHazmatType   = testingMode || coverType === 'special'
  const isRescueType   = testingMode || coverType === 'rescue'
  const isOutsideFire  = ['grass', 'wildland', 'other_fire'].includes(incident.fire_subtype ?? '')
  const hasMutualAid   = testingMode || !!(incident.mutual_aid_direction || incident.mutual_aid_department)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Incident type filter toggle
  const [showAllTypes, setShowAllTypes] = useState(false)
  const incidentTypeGroups = showAllTypes ? NERIS_INCIDENT_TYPES : getFilteredIncidentTypes(incident.incident_type)

  // Core fields
  const [nerisType, setNerisType] = useState<string>(nerisRecord?.neris_incident_type ?? '')
  const [propertyUse, setPropertyUse] = useState<string>(nerisRecord?.property_use ?? '')
  const [displacedPersons, setDisplacedPersons] = useState<string>(
    nerisRecord?.displaced_persons != null ? String(nerisRecord.displaced_persons) : ''
  )
  const [actionsTaken, setActionsTaken] = useState<string[]>(nerisRecord?.actions_taken ?? [])

  // Mutual aid
  const [aidType, setAidType] = useState<string>(nerisRecord?.aid_type ?? '')
  const [aidDirection, setAidDirection] = useState<string>(nerisRecord?.aid_direction ?? '')

  // Fire module
  const [fireCondition, setFireCondition] = useState<string>(nerisRecord?.fire_condition_arrival ?? '')
  const [buildingDamage, setBuildingDamage] = useState<string>(nerisRecord?.building_damage ?? '')
  const [suppressionAppliances, setSuppressionAppliances] = useState<string[]>(nerisRecord?.suppression_appliance ?? [])
  const [floorOfOrigin, setFloorOfOrigin] = useState<string>(
    nerisRecord?.floor_of_origin != null ? String(nerisRecord.floor_of_origin) : ''
  )
  const [roomOfOrigin, setRoomOfOrigin] = useState<string>(nerisRecord?.room_of_origin ?? '')
  const [fireCauseCode, setFireCauseCode] = useState<string>(nerisRecord?.fire_cause_code ?? '')

  // Medical module
  const [patientCount, setPatientCount] = useState<string>(
    nerisRecord?.patient_count != null ? String(nerisRecord.patient_count) : ''
  )
  const [patientEvalCare, setPatientEvalCare] = useState<string>(nerisRecord?.patient_evaluation_care ?? '')
  const [patientStatus, setPatientStatus] = useState<string>(nerisRecord?.patient_improved_status ?? '')
  const [medicalDisposition, setMedicalDisposition] = useState<string>(nerisRecord?.medical_disposition ?? '')

  // Hazmat module
  const [hazsitDisposition, setHazsitDisposition] = useState<string>(nerisRecord?.hazsit_disposition ?? '')
  const [hazsitEvacuated, setHazsitEvacuated] = useState<string>(
    nerisRecord?.hazsit_evacuated != null ? String(nerisRecord.hazsit_evacuated) : ''
  )
  const [chemicalName, setChemicalName] = useState<string>(nerisRecord?.chemical_name ?? '')
  const [chemicalDotClass, setChemicalDotClass] = useState<string>(nerisRecord?.chemical_dot_class ?? '')
  const [chemicalReleaseOccurred, setChemicalReleaseOccurred] = useState<boolean>(
    nerisRecord?.chemical_release_occurred ?? false
  )

  // Rescue module
  const [rescueType, setRescueType] = useState<string>(nerisRecord?.rescue_type ?? '')
  const [casualtyType, setCasualtyType] = useState<string>(nerisRecord?.casualty_type ?? '')
  const [casualtyCause, setCasualtyCause] = useState<string>(nerisRecord?.casualty_cause ?? '')

  // Response modes per apparatus
  const [responseModes, setResponseModes] = useState<Record<string, string>>(
    Object.fromEntries(incidentApparatus.map(a => [a.id, a.response_mode ?? '']))
  )
  const [responseModeSaving, setResponseModeSaving] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSaved(false)
    const result = await saveNerisReport(incident.id, {
      neris_incident_type: nerisType || null,
      property_use: propertyUse || null,
      actions_taken: actionsTaken,
      displaced_persons: displacedPersons !== '' ? parseInt(displacedPersons) : null,
      fire_condition_arrival: fireCondition || null,
      building_damage: buildingDamage || null,
      suppression_appliance: suppressionAppliances,
      floor_of_origin: floorOfOrigin !== '' ? parseInt(floorOfOrigin) : null,
      room_of_origin: roomOfOrigin || null,
      fire_cause_code: fireCauseCode || null,
      aid_type: aidType || null,
      aid_direction: aidDirection || null,
      patient_count: patientCount !== '' ? parseInt(patientCount) : null,
      patient_evaluation_care: patientEvalCare || null,
      patient_improved_status: patientStatus || null,
      medical_disposition: medicalDisposition || null,
      hazsit_disposition: hazsitDisposition || null,
      hazsit_evacuated: hazsitEvacuated !== '' ? parseInt(hazsitEvacuated) : null,
      chemical_name: chemicalName || null,
      chemical_dot_class: chemicalDotClass || null,
      chemical_release_occurred: chemicalReleaseOccurred,
      rescue_type: rescueType || null,
      casualty_type: casualtyType || null,
      casualty_cause: casualtyCause || null,
    })
    if (result?.error) { setError(result.error); setLoading(false); return }
    setSaved(true)
    setLoading(false)
  }

  async function handleResponseModeChange(apparatusIncidentId: string, mode: string) {
    setResponseModes(prev => ({ ...prev, [apparatusIncidentId]: mode }))
    setResponseModeSaving(apparatusIncidentId)
    await saveApparatusResponseMode(apparatusIncidentId, mode)
    setResponseModeSaving(null)
  }

  const fireCauseCodes = isOutsideFire ? NERIS_FIRE_CAUSE_OUT : NERIS_FIRE_CAUSE_IN

  return (
    <div>
      {/* Header */}
      <div className="mb-2">
        <div className="flex items-center gap-2 mb-1">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            nerisRecord?.neris_status === 'submitted' ? 'bg-green-100 text-green-700' :
            nerisRecord?.completed_at ? 'bg-blue-100 text-blue-700' :
            nerisRecord ? 'bg-amber-100 text-amber-700' :
            'bg-zinc-100 text-zinc-500'
          }`}>
            NERIS — {
              nerisRecord?.neris_status === 'submitted' ? 'Submitted' :
              nerisRecord?.completed_at ? 'Completed' :
              nerisRecord ? 'In Progress' : 'Not Started'
            }
          </span>
        </div>
        <h1 className="text-xl font-bold text-zinc-900">NERIS Report</h1>
        <p className="text-sm text-zinc-500">
          Incident #{incident.incident_number ?? '—'} · {formatDate(incident.incident_date)}
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <button
          type="button"
          onClick={() => router.push(`/incidents/${incident.id}`)}
          className="rounded-lg bg-white border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm"
        >
          ← Back to Incident
        </button>
      </div>

      {/* Testing mode banner — admin only */}
      {isAdmin && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-amber-800">Testing Mode <span className="text-xs font-normal">(admin only)</span></p>
            <p className="text-xs text-amber-600">Show all modules regardless of incident type — toggle off for adaptive behavior.</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={testingMode}
              onChange={e => setTestingMode(e.target.checked)}
              className="rounded border-zinc-300 text-amber-500 focus:ring-amber-400 w-4 h-4"
            />
            <span className="text-sm font-semibold text-amber-800">Show All</span>
          </label>
        </div>
      )}

      {/* Cover sheet reference */}
      <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-5 space-y-3 mb-4">
        <h2 className="text-sm font-semibold text-zinc-700">Cover Sheet Reference</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-zinc-400 text-xs">Type</span>
            <p className="font-medium text-zinc-800">
              {COVER_TYPE_LABELS[incident.incident_type] ?? incident.incident_type}
              {incident.fire_subtype ? ` — ${FIRE_SUBTYPE_LABELS[incident.fire_subtype] ?? incident.fire_subtype}` : ''}
            </p>
          </div>
          <div>
            <span className="text-zinc-400 text-xs">Address</span>
            <p className="font-medium text-zinc-800">{incident.address ?? '—'}</p>
          </div>
          <div>
            <span className="text-zinc-400 text-xs">Call Time</span>
            <p className="font-medium text-zinc-800">{formatDT(incident.call_time)}</p>
          </div>
          <div>
            <span className="text-zinc-400 text-xs">First On Scene</span>
            <p className="font-medium text-zinc-800">{formatDT(incident.first_on_scene_at)}</p>
          </div>
          {(incident.mutual_aid_direction || incident.mutual_aid_department) && (
            <div className="col-span-2">
              <span className="text-zinc-400 text-xs">Mutual Aid (Cover Sheet)</span>
              <p className="font-medium text-zinc-800 capitalize">
                {incident.mutual_aid_direction === 'to' ? 'Given to' : incident.mutual_aid_direction === 'from' ? 'Received from' : incident.mutual_aid_direction}
                {incident.mutual_aid_department ? ` — ${incident.mutual_aid_department}` : ''}
              </p>
            </div>
          )}
          {incident.narrative && (
            <div className="col-span-2">
              <span className="text-zinc-400 text-xs">Narrative</span>
              <p className="text-zinc-700 line-clamp-2">{incident.narrative}</p>
            </div>
          )}
        </div>
      </div>

      {isSubmitted && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          Submitted to NERIS — ID: {nerisRecord.neris_submission_id ?? '—'}. This report is locked.
        </div>
      )}
      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      {saved && <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">Saved successfully.</div>}

      <form onSubmit={handleSave} className="space-y-5">

        {/* Incident Type */}
        <section className={sectionCls}>
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-sm font-semibold text-zinc-900">NERIS Incident Type</h2>
            <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={showAllTypes}
                onChange={e => setShowAllTypes(e.target.checked)}
                className="rounded border-zinc-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-xs text-zinc-500">Show all types</span>
            </label>
          </div>
          {!showAllTypes && (
            <p className="text-xs text-zinc-400 -mt-2">
              Filtered to <span className="font-medium text-zinc-600">{COVER_TYPE_LABEL[incident.incident_type] ?? incident.incident_type}</span> — check "Show all types" to see every NERIS code.
            </p>
          )}
          <NerisCombobox
            groups={incidentTypeGroups}
            value={nerisType}
            onChange={setNerisType}
            placeholder="Select NERIS incident type…"
            disabled={isSubmitted}
          />
        </section>

        {/* Scene Information */}
        <section className={sectionCls}>
          <h2 className="text-sm font-semibold text-zinc-900">Scene Information</h2>
          <div>
            <label className={labelCls}>Property Use</label>
            <NerisCombobox
              groups={NERIS_PROPERTY_USE}
              value={propertyUse}
              onChange={setPropertyUse}
              placeholder="Select property use…"
              disabled={isSubmitted}
            />
          </div>
          <div>
            <label className={labelCls}>Displaced Persons</label>
            <input
              type="number"
              min={0}
              value={displacedPersons}
              onChange={e => setDisplacedPersons(e.target.value)}
              disabled={isSubmitted}
              placeholder="0"
              className={inputCls}
            />
          </div>
        </section>

        {/* Actions Taken */}
        <section className={sectionCls}>
          <h2 className="text-sm font-semibold text-zinc-900">Actions Taken on Scene</h2>
          <NerisCombobox
            multiple
            groups={NERIS_ACTIONS_TAKEN}
            value={actionsTaken}
            onChange={setActionsTaken}
            placeholder="Select actions taken…"
            disabled={isSubmitted}
          />
        </section>

        {/* Mutual Aid */}
        {hasMutualAid && (
          <section className={sectionCls}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">Mutual Aid</h2>
              {testingMode && !incident.mutual_aid_direction && (
                <span className="text-xs text-amber-600 font-medium">Testing — no mutual aid on cover sheet</span>
              )}
            </div>
            <p className="text-xs text-zinc-400 -mt-1">
              NERIS aid codes — separate from the cover sheet mutual aid fields.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Aid Type</label>
                <NerisCombobox
                  groups={toGroups(NERIS_AID_TYPE, 'Aid Type')}
                  value={aidType}
                  onChange={setAidType}
                  placeholder="Select aid type…"
                  disabled={isSubmitted}
                />
              </div>
              <div>
                <label className={labelCls}>Aid Direction</label>
                <NerisCombobox
                  groups={toGroups(NERIS_AID_DIRECTION, 'Aid Direction')}
                  value={aidDirection}
                  onChange={setAidDirection}
                  placeholder="Given or received…"
                  disabled={isSubmitted}
                />
              </div>
            </div>
          </section>
        )}

        {/* Apparatus — Response Mode */}
        {incidentApparatus.length > 0 && (
          <section className={sectionCls}>
            <h2 className="text-sm font-semibold text-zinc-900">Apparatus Response Mode</h2>
            <p className="text-xs text-zinc-400 -mt-1">Set per-unit whether response was emergent or non-emergent.</p>
            <div className="divide-y divide-zinc-100">
              {incidentApparatus.map(a => (
                <div key={a.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      Unit {a.unit_number}{a.apparatus_name ? ` — ${a.apparatus_name}` : ''}
                    </p>
                    <p className="text-xs text-zinc-400 capitalize">{APPARATUS_ROLE_LABELS[a.role] ?? a.role}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {responseModeSaving === a.id && (
                      <span className="text-xs text-zinc-400">Saving…</span>
                    )}
                    <select
                      value={responseModes[a.id] ?? ''}
                      onChange={e => handleResponseModeChange(a.id, e.target.value)}
                      disabled={isSubmitted}
                      className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    >
                      <option value="">Select…</option>
                      {NERIS_RESPONSE_MODE.map(m => (
                        <option key={m.code} value={m.code}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Personnel — read-only */}
        {incidentPersonnel.length > 0 && (
          <section className={sectionCls}>
            <h2 className="text-sm font-semibold text-zinc-900">Personnel on Scene</h2>
            <p className="text-xs text-zinc-400 -mt-1">From cover sheet — flows directly to NERIS payload.</p>
            <div className="flex flex-wrap gap-1.5">
              {incidentPersonnel.map(p => (
                <span key={p.id} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700">
                  {p.name}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Fire Module */}
        {isFireType && (
          <section className={sectionCls}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">Fire Module</h2>
              {testingMode && incident.incident_type !== 'fire' && (
                <span className="text-xs text-amber-600 font-medium">Testing — not a fire incident</span>
              )}
            </div>

            <div>
              <label className={labelCls}>Condition on Arrival</label>
              <NerisCombobox
                groups={toGroups(NERIS_FIRE_CONDITION_ARRIVAL, 'Condition on Arrival')}
                value={fireCondition}
                onChange={setFireCondition}
                placeholder="Select condition on arrival…"
                disabled={isSubmitted}
              />
            </div>

            <div>
              <label className={labelCls}>Building Damage</label>
              <NerisCombobox
                groups={toGroups(NERIS_BUILDING_DAMAGE, 'Building Damage')}
                value={buildingDamage}
                onChange={setBuildingDamage}
                placeholder="Select building damage…"
                disabled={isSubmitted}
              />
            </div>

            <div>
              <label className={labelCls}>
                Fire Cause
                <span className="ml-1.5 text-xs font-normal text-zinc-400">
                  ({isOutsideFire ? 'outside / vegetation' : 'inside / structure'})
                </span>
              </label>
              <NerisCombobox
                groups={toGroups(fireCauseCodes, isOutsideFire ? 'Outside Fire Cause' : 'Inside Fire Cause')}
                value={fireCauseCode}
                onChange={setFireCauseCode}
                placeholder="Select fire cause…"
                disabled={isSubmitted}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Floor of Origin</label>
                <input
                  type="number"
                  value={floorOfOrigin}
                  onChange={e => setFloorOfOrigin(e.target.value)}
                  disabled={isSubmitted}
                  placeholder="e.g. 1"
                  min={0}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Room / Area of Origin</label>
                <input
                  type="text"
                  value={roomOfOrigin}
                  onChange={e => setRoomOfOrigin(e.target.value)}
                  disabled={isSubmitted}
                  placeholder="e.g. Kitchen"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Suppression Appliances Used</label>
              <NerisCombobox
                multiple
                groups={toGroups(NERIS_SUPPRESSION_APPLIANCE, 'Suppression Appliances')}
                value={suppressionAppliances}
                onChange={setSuppressionAppliances}
                placeholder="Select suppression appliances used…"
                disabled={isSubmitted}
              />
            </div>

            {fireDetails && (
              <div className="rounded-lg bg-zinc-50 border border-zinc-200 px-4 py-3">
                <p className="text-xs font-semibold text-zinc-500 mb-2">Cover Sheet Fire Details (flows to NERIS)</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-zinc-600">
                  {fireDetails.dollar_loss != null && <div><span className="text-zinc-400">Dollar loss: </span>${Number(fireDetails.dollar_loss).toLocaleString()}</div>}
                  {fireDetails.injuries_civilian != null && <div><span className="text-zinc-400">Civilian injuries: </span>{fireDetails.injuries_civilian}</div>}
                  {fireDetails.injuries_firefighter != null && <div><span className="text-zinc-400">FF injuries: </span>{fireDetails.injuries_firefighter}</div>}
                  {fireDetails.fatalities != null && <div><span className="text-zinc-400">Fatalities: </span>{fireDetails.fatalities}</div>}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Medical Module */}
        {isMedicalType && (
          <section className={sectionCls}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">Medical Module</h2>
              {testingMode && coverType !== 'rescue' && (
                <span className="text-xs text-amber-600 font-medium">Testing — not a rescue/medical incident</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Patient Count</label>
                <input
                  type="number" min={0} value={patientCount}
                  onChange={e => setPatientCount(e.target.value)}
                  disabled={isSubmitted} placeholder="0" className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Patient Status After Intervention</label>
                <NerisCombobox
                  groups={toGroups(NERIS_PATIENT_IMPROVED_STATUS, 'Patient Status')}
                  value={patientStatus} onChange={setPatientStatus}
                  placeholder="Select status…" disabled={isSubmitted}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Patient Evaluation / Care</label>
              <NerisCombobox
                groups={toGroups(NERIS_PATIENT_EVALUATION_CARE, 'Evaluation / Care')}
                value={patientEvalCare} onChange={setPatientEvalCare}
                placeholder="Select evaluation / care status…" disabled={isSubmitted}
              />
            </div>
            <div>
              <label className={labelCls}>Medical Disposition</label>
              <NerisCombobox
                groups={toGroups(NERIS_MEDICAL_DISPOSITION, 'Medical Disposition')}
                value={medicalDisposition} onChange={setMedicalDisposition}
                placeholder="Select transport / disposition outcome…" disabled={isSubmitted}
              />
            </div>
          </section>
        )}

        {/* Rescue Module */}
        {isRescueType && (
          <section className={sectionCls}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">Rescue Module</h2>
              {testingMode && coverType !== 'rescue' && (
                <span className="text-xs text-amber-600 font-medium">Testing — not a rescue incident</span>
              )}
            </div>
            <div>
              <label className={labelCls}>Rescue Type</label>
              <NerisCombobox
                groups={toGroups(NERIS_RESCUE_TYPE, 'Rescue Type')}
                value={rescueType} onChange={setRescueType}
                placeholder="Select rescue type…" disabled={isSubmitted}
              />
            </div>
            <div>
              <label className={labelCls}>Casualty Type</label>
              <NerisCombobox
                groups={toGroups(NERIS_CASUALTY_TYPE, 'Casualty Type')}
                value={casualtyType} onChange={setCasualtyType}
                placeholder="Select casualty type…" disabled={isSubmitted}
              />
            </div>
            {casualtyType && casualtyType !== 'UNINJURED' && (
              <div>
                <label className={labelCls}>Casualty Cause</label>
                <NerisCombobox
                  groups={toGroups(NERIS_CASUALTY_CAUSE, 'Casualty Cause')}
                  value={casualtyCause} onChange={setCasualtyCause}
                  placeholder="Select cause of injury…" disabled={isSubmitted}
                />
              </div>
            )}
          </section>
        )}

        {/* Hazmat Module */}
        {isHazmatType && (
          <section className={sectionCls}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">Hazmat Module</h2>
              {testingMode && coverType !== 'special' && (
                <span className="text-xs text-amber-600 font-medium">Testing — not a hazmat incident</span>
              )}
            </div>
            <div>
              <label className={labelCls}>Hazmat Disposition</label>
              <NerisCombobox
                groups={toGroups(NERIS_HAZSIT_DISPOSITION, 'Hazmat Disposition')}
                value={hazsitDisposition} onChange={setHazsitDisposition}
                placeholder="Select hazmat outcome…" disabled={isSubmitted}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Number Evacuated</label>
                <input
                  type="number" min={0} value={hazsitEvacuated}
                  onChange={e => setHazsitEvacuated(e.target.value)}
                  disabled={isSubmitted} placeholder="0" className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Chemical Name</label>
                <input
                  type="text" value={chemicalName}
                  onChange={e => setChemicalName(e.target.value)}
                  disabled={isSubmitted} placeholder="e.g. Natural Gas, Propane"
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>DOT Hazard Class</label>
              <NerisCombobox
                groups={toGroups(NERIS_DOT_HAZARD_CLASS, 'DOT Hazard Class')}
                value={chemicalDotClass} onChange={setChemicalDotClass}
                placeholder="Select DOT hazard classification…" disabled={isSubmitted}
              />
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chemicalReleaseOccurred}
                  onChange={e => setChemicalReleaseOccurred(e.target.checked)}
                  disabled={isSubmitted}
                  className="rounded border-zinc-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm font-medium text-zinc-700">Chemical release occurred</span>
              </label>
            </div>
          </section>
        )}

        {/* Save */}
        {!isSubmitted && (
          <div className="flex gap-3 pb-8">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving…' : 'Save NERIS Report'}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/incidents/${incident.id}`)}
              className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100"
            >
              Cancel
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
