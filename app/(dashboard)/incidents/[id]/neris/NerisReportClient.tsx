'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveNerisReport, saveApparatusResponseMode, markNerisComplete, reopenNerisReport, submitToNeris, previewNerisPayload } from '@/app/actions/neris'
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
  NERIS_VEHICLE_TYPE,
  NERIS_SAFETY_DEVICE,
  COVER_TYPE_LABEL,
} from '@/lib/neris-value-sets'
import type { NerisRequirementSummary } from '@/lib/neris-requirements'

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
function sectionStatusLabel(status: string) {
  if (status === 'complete') return 'Complete'
  if (status === 'blocked') return 'Blocked'
  if (status === 'needs_info') return 'Needs Info'
  return 'Not Started'
}
function sectionStatusCls(status: string) {
  if (status === 'complete') return 'bg-green-100 text-green-700'
  if (status === 'blocked') return 'bg-red-50 text-red-600'
  if (status === 'needs_info') return 'bg-amber-100 text-amber-700'
  return 'bg-zinc-100 text-zinc-500'
}
const SECTION_ANCHORS: Record<string, string | null> = {
  incident: 'neris-section-incident',
  location: 'neris-section-location',
  actions: 'neris-section-actions',
  units: 'neris-section-units',
  personnel: 'neris-section-personnel',
  fire: 'neris-section-fire',
  medical: 'neris-section-medical',
  hazmat: 'neris-section-hazmat',
  rescue: 'neris-section-rescue',
  mutual_aid: 'neris-section-mutual-aid',
  api: null,
}

// Same marker sets as getNerisActiveModules in lib/neris-requirements.ts — keep in sync
const FIRE_NERIS_CODES = new Set(['STRUCTURAL_INVOLVEMENT_FIRE','ROOM_AND_CONTENTS_FIRE','CONFINED_COOKING_APPLIANCE_FIRE','CHIMNEY_FIRE','VEGETATION_GRASS_FIRE','WILDFIRE_WILDLAND','WILDFIRE_URBAN_INTERFACE','TRASH_RUBBISH_FIRE','DUMPSTER_OUTDOOR_CONTAINER_FIRE','CONSTRUCTION_WASTE','OUTSIDE_TANK_FIRE','UTILITY_INFRASTRUCTURE_FIRE','OTHER_OUTSIDE_FIRE'])
const MEDICAL_MARKERS = ['CARDIAC','CHEST_PAIN','BREATHING','STROKE','UNCONSCIOUS','CONVULSIONS','DIABETIC','ALLERGIC','OVERDOSE','SICK_CASE','MEDICAL']
const HAZMAT_MARKERS  = ['GAS_','FUEL_','CARBON_MONOXIDE','HAZMAT','BIOLOGICAL_RELEASE','RADIOACTIVE_RELEASE']
const RESCUE_MARKERS  = ['RESCUE','EXTRICATION','ENTRAPMENT','WATER','ICE','CONFINED_SPACE','TECHNICAL','ELEVATOR']

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
  mutualAidRows,
  requirementSummary,
  isAdmin,
  isOfficerOrAbove,
}: {
  incident: any
  fireDetails: any
  incidentApparatus: { id: string; apparatus_id: string; unit_number: string; apparatus_name: string | null; role: string; response_mode: string | null; staffing_count: number | null; notes: string | null; paged_at: string | null; on_scene_at: string | null; leaving_scene_at: string | null; available_at: string | null }[]
  incidentPersonnel: { id: string; personnel_id: string; apparatus_id: string | null; role: string; status: string | null; name: string; unit_number: string | null }[]
  nerisRecord: any
  mutualAidRows: { id: string; external_department_name: string; role: string; apparatus_description: string | null; personnel_count: number | null }[]
  requirementSummary: NerisRequirementSummary
  isAdmin: boolean
  isOfficerOrAbove: boolean
}) {
  const router = useRouter()
  const isSubmitted = nerisRecord?.neris_status === 'submitted'

  // Testing mode (admin only) — forces all sections visible
  const [testingMode, setTestingMode] = useState(false)

  const coverType = incident.incident_type
  const isOutsideFire = ['grass', 'wildland', 'other_fire'].includes(incident.fire_subtype ?? '')
  const hasMutualAid  = testingMode || mutualAidRows.length > 0 || !!(incident.mutual_aid_direction || incident.mutual_aid_department)
  const hasOpenUnitsWork = requirementSummary.sections.some(section => section.section === 'units' && !!section.firstOpenRequirement)
  const hasOpenPersonnelWork = requirementSummary.sections.some(section => section.section === 'personnel' && !!section.firstOpenRequirement)
  const showUnitsSection = testingMode || incidentApparatus.length > 0 || hasOpenUnitsWork
  const showPersonnelSection = testingMode || incidentPersonnel.length > 0 || hasOpenPersonnelWork

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [readyGuardOpen, setReadyGuardOpen] = useState(false)

  // Payload preview
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewData, setPreviewData] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Incident type filter toggle
  const [showAllTypes, setShowAllTypes] = useState(false)
  const incidentTypeGroups = showAllTypes ? NERIS_INCIDENT_TYPES : getFilteredIncidentTypes(incident.incident_type)

  // Core fields
  const [nerisType, setNerisType] = useState<string>(nerisRecord?.neris_incident_type ?? '')

  // Module visibility — mirrors getNerisActiveModules, also driven by selected NERIS code
  const codeMatchesAny = (markers: string[]) => markers.some(m => nerisType.includes(m))
  const isFireType    = testingMode || coverType === 'fire'    || FIRE_NERIS_CODES.has(nerisType)
  const isMedicalType = testingMode || coverType === 'rescue'  || codeMatchesAny(MEDICAL_MARKERS)
  const isHazmatType  = testingMode || coverType === 'special' || codeMatchesAny(HAZMAT_MARKERS)
  const isRescueType  = testingMode || coverType === 'rescue'  || codeMatchesAny(RESCUE_MARKERS)
  const isMotorVehicle = testingMode || nerisType.includes('MOTOR_VEHICLE') || nerisType.includes('EXTRICATION')

  // Which rescue types show vehicle fields vs entrapment-only vs neither
  const VEHICLE_RESCUE_TYPES = new Set(['MOTOR_VEHICLE_EXTRICATION_ENTRAPPED'])
  const ENTRAPMENT_RESCUE_TYPES = new Set(['MOTOR_VEHICLE_EXTRICATION_ENTRAPPED', 'BUILDING_STRUCTURE_COLLAPSE', 'CONFINED_SPACE_RESCUE', 'EXTRICATION_ENTRAPPED', 'TRENCH'])
  function showVehicleFields(rescueType: string) { return VEHICLE_RESCUE_TYPES.has(rescueType) || isMotorVehicle }
  function showEntrapmentField(rescueType: string) { return ENTRAPMENT_RESCUE_TYPES.has(rescueType) || isMotorVehicle }
  const [propertyUse, setPropertyUse] = useState<string>(nerisRecord?.property_use ?? '')
  const [propertyNormalUse, setPropertyNormalUse] = useState<string>(nerisRecord?.property_normal_use ?? '')
  const [nerisNarrative, setNerisNarrative] = useState<string>(nerisRecord?.neris_narrative ?? '')
  const [displacedPersons, setDisplacedPersons] = useState<string>(
    nerisRecord?.displaced_persons != null ? String(nerisRecord.displaced_persons) : ''
  )
  const [actionsTaken, setActionsTaken] = useState<string[]>(nerisRecord?.actions_taken ?? [])
  const [noActionReason, setNoActionReason] = useState<string>(nerisRecord?.no_action_reason ?? '')

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
  const [outsideFireAcres, setOutsideFireAcres] = useState<string>(
    nerisRecord?.outside_fire_acres != null ? String(nerisRecord.outside_fire_acres) : ''
  )

  // Unified persons — rescue + medical per person
  type IncidentPerson = { _id: string; rescue_type: string; casualty_type: string; casualty_cause: string; entrapped: boolean; vehicle_type: string; safety_device: string; evaluation_care: string; improved_status: string; disposition: string }
  const initPersons = (): IncidentPerson[] => {
    const saved = nerisRecord?.incident_persons
    if (Array.isArray(saved) && saved.length > 0) {
      return saved.map((p: any, i: number) => ({ _id: String(i), rescue_type: p.rescue_type ?? '', casualty_type: p.casualty_type ?? '', casualty_cause: p.casualty_cause ?? '', entrapped: p.entrapped ?? false, vehicle_type: p.vehicle_type ?? '', safety_device: p.safety_device ?? '', evaluation_care: p.evaluation_care ?? '', improved_status: p.improved_status ?? '', disposition: p.disposition ?? '' }))
    }
    return []
  }
  const [incidentPersons, setIncidentPersons] = useState<IncidentPerson[]>(initPersons)

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

  const [vehiclesInvolved, setVehiclesInvolved] = useState<string>(
    nerisRecord?.vehicles_involved != null ? String(nerisRecord.vehicles_involved) : ''
  )

  // Response modes per apparatus
  const [responseModes, setResponseModes] = useState<Record<string, string>>(
    Object.fromEntries(incidentApparatus.map(a => [a.id, a.response_mode ?? '']))
  )
  const [staffingCounts, setStaffingCounts] = useState<Record<string, string>>(
    Object.fromEntries(incidentApparatus.map(a => [a.id, a.staffing_count != null ? String(a.staffing_count) : '']))
  )
  const [apparatusNotes, setApparatusNotes] = useState<Record<string, string>>(
    Object.fromEntries(incidentApparatus.map(a => [a.id, a.notes ?? '']))
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
      property_normal_use: propertyNormalUse || null,
      neris_narrative: nerisNarrative || null,
      actions_taken: actionsTaken,
      no_action_reason: actionsTaken.length === 0 ? noActionReason.trim() || null : null,
      displaced_persons: displacedPersons !== '' ? parseInt(displacedPersons) : null,
      outside_fire_acres: outsideFireAcres !== '' ? parseFloat(outsideFireAcres) : null,
      fire_condition_arrival: fireCondition || null,
      building_damage: buildingDamage || null,
      suppression_appliance: suppressionAppliances,
      floor_of_origin: floorOfOrigin !== '' ? parseInt(floorOfOrigin) : null,
      room_of_origin: roomOfOrigin || null,
      fire_cause_code: fireCauseCode || null,
      aid_type: aidType || null,
      aid_direction: aidDirection || null,
      incident_persons: incidentPersons.map(p => ({ rescue_type: p.rescue_type, casualty_type: p.casualty_type, casualty_cause: p.casualty_cause, entrapped: p.entrapped, vehicle_type: p.vehicle_type, safety_device: p.safety_device, evaluation_care: p.evaluation_care, improved_status: p.improved_status, disposition: p.disposition })),
      hazsit_disposition: hazsitDisposition || null,
      hazsit_evacuated: hazsitEvacuated !== '' ? parseInt(hazsitEvacuated) : null,
      chemical_name: chemicalName || null,
      chemical_dot_class: chemicalDotClass || null,
      chemical_release_occurred: chemicalReleaseOccurred,
      vehicles_involved: vehiclesInvolved !== '' ? parseInt(vehiclesInvolved) : null,
    })
    if (result?.error) { setError(result.error); setLoading(false); return }
    setSaved(true)
    setLoading(false)
  }

  async function handleResponseModeChange(apparatusIncidentId: string, mode: string) {
    setResponseModes(prev => ({ ...prev, [apparatusIncidentId]: mode }))
    setResponseModeSaving(apparatusIncidentId)
    const staffingValue = staffingCounts[apparatusIncidentId]
    await saveApparatusResponseMode(apparatusIncidentId, mode, staffingValue !== '' ? parseInt(staffingValue) : null, apparatusNotes[apparatusIncidentId] || null)
    setResponseModeSaving(null)
  }

  async function handleStaffingCountBlur(apparatusIncidentId: string) {
    setResponseModeSaving(apparatusIncidentId)
    const staffingValue = staffingCounts[apparatusIncidentId]
    await saveApparatusResponseMode(apparatusIncidentId, responseModes[apparatusIncidentId] ?? '', staffingValue !== '' ? parseInt(staffingValue) : null, apparatusNotes[apparatusIncidentId] || null)
    setResponseModeSaving(null)
  }

  async function handleApparatusNotesBlur(apparatusIncidentId: string) {
    setResponseModeSaving(apparatusIncidentId)
    const staffingValue = staffingCounts[apparatusIncidentId]
    await saveApparatusResponseMode(apparatusIncidentId, responseModes[apparatusIncidentId] ?? '', staffingValue !== '' ? parseInt(staffingValue) : null, apparatusNotes[apparatusIncidentId] || null)
    setResponseModeSaving(null)
  }

  const fireCauseCodes = isOutsideFire ? NERIS_FIRE_CAUSE_OUT : NERIS_FIRE_CAUSE_IN
  const localOpenRequirements = requirementSummary.requirements.filter(req =>
    req.status === 'missing' && ['required', 'conditional'].includes(req.severity)
  )

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
            <p className="text-xs text-amber-600">Show all modules and readiness sections regardless of incident type — toggle off for adaptive behavior.</p>
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

      {/* Payload preview — admin / testing mode */}
      {(isAdmin || testingMode) && (
        <div className="mb-4 rounded-lg border border-zinc-200 bg-white overflow-hidden">
          <button
            type="button"
            onClick={async () => {
              if (previewOpen) { setPreviewOpen(false); return }
              setPreviewLoading(true)
              setPreviewError(null)
              setPreviewData(null)
              const result = await previewNerisPayload(incident.id)
              if (result?.error) {
                setPreviewError(result.error)
              } else {
                setPreviewData(JSON.stringify(result.payload, null, 2))
              }
              setPreviewLoading(false)
              setPreviewOpen(true)
            }}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-mono text-zinc-500">JSON</span>
              Preview NERIS Payload
            </span>
            <span className="text-zinc-400 text-xs">{previewOpen ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {previewLoading && (
            <div className="px-4 pb-3 text-xs text-zinc-400">Building payload…</div>
          )}
          {previewError && (
            <div className="px-4 pb-3 text-xs text-red-600">{previewError}</div>
          )}
          {previewOpen && previewData && (
            <div className="border-t border-zinc-100">
              <div className="px-4 py-2 flex items-center justify-between">
                <p className="text-xs text-zinc-400">This is the exact JSON that will be sent to NERIS. Field names marked <span className="font-mono bg-zinc-100 px-1 rounded">TODO(api-review)</span> need verification against the NERIS openapi.json once credentials are active.</p>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(previewData)}
                  className="ml-3 shrink-0 rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50"
                >
                  Copy
                </button>
              </div>
              <pre className="overflow-x-auto bg-zinc-950 text-green-400 text-xs p-4 max-h-[480px] overflow-y-auto font-mono leading-relaxed">
                {previewData}
              </pre>
            </div>
          )}
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
      <div className="mb-4 rounded-xl bg-white border border-zinc-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">NERIS Readiness</h2>
            <p className="text-xs text-zinc-500 mt-1">
              {requirementSummary.readyForLocalCompletion
                ? 'All fillable fields complete — ready to mark for submission.'
                : 'Required or conditional NERIS fields are still missing.'}
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0 ${
            requirementSummary.readyForLocalCompletion ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {requirementSummary.complete}/{requirementSummary.fillable} fields complete
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-zinc-50 border border-zinc-100 px-2 py-2">
            <p className="text-lg font-bold text-zinc-900">{requirementSummary.missing}</p>
            <p className="text-[11px] font-medium text-zinc-500">Missing</p>
          </div>
          <div className="rounded-lg bg-zinc-50 border border-zinc-100 px-2 py-2">
            <p className="text-lg font-bold text-zinc-900">{requirementSummary.computed}</p>
            <p className="text-[11px] font-medium text-zinc-500">NERIS Computed</p>
          </div>
          <div className="rounded-lg bg-zinc-50 border border-zinc-100 px-2 py-2">
            <p className="text-lg font-bold text-zinc-900">
              {Object.values(requirementSummary.activeModules).filter(Boolean).length}
            </p>
            <p className="text-[11px] font-medium text-zinc-500">Modules Active</p>
          </div>
        </div>

        {/* API enrollment — submission prerequisite, not a form field */}
        {!requirementSummary.readyForApiValidation && (
          <div className="mt-3 rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-2 flex items-center gap-2">
            <span className="rounded-full bg-zinc-200 text-zinc-500 text-[10px] font-bold px-1.5 py-0.5">PENDING</span>
            <p className="text-xs text-zinc-500">Submission requires FSRI enrollment / API authorization — not a form item.</p>
          </div>
        )}

        <div className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
          {requirementSummary.sections.map(section => (
            <div key={section.section} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-zinc-900">{section.label}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${sectionStatusCls(section.status)}`}>
                    {sectionStatusLabel(section.status)}
                  </span>
                </div>
                {section.firstOpenRequirement ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    {section.firstOpenRequirement.label}
                    {section.firstOpenRequirement.detail ? ` — ${section.firstOpenRequirement.detail}` : ''}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-zinc-400">
                    {section.computed > 0 ? `${section.computed} computed by NERIS` : 'No open items in this section.'}
                  </p>
                )}
                {section.firstOpenRequirement && SECTION_ANCHORS[section.section] && (
                  <a
                    href={`#${SECTION_ANCHORS[section.section]}`}
                    className="mt-2 inline-flex rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50"
                  >
                    Go to section
                  </a>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-zinc-900">{section.complete}/{section.total}</p>
                <p className="text-[11px] text-zinc-400">
                  {section.missing > 0 && `${section.missing} missing`}
                  {section.missing > 0 && section.blocked > 0 && ' · '}
                  {section.blocked > 0 && `${section.blocked} blocked`}
                  {section.missing === 0 && section.blocked === 0 && 'complete'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      {saved && <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">Saved successfully.</div>}
      {readyGuardOpen && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">Complete required NERIS fields before marking ready.</p>
          <p className="mt-1 text-xs text-amber-700">You can save this draft and finish it later. Use the readiness links above to jump to the missing sections.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            {localOpenRequirements.slice(0, 6).map(req => (
              <li key={req.id}>{req.label}</li>
            ))}
          </ul>
          {localOpenRequirements.length > 6 && (
            <p className="mt-2 text-xs text-amber-700">And {localOpenRequirements.length - 6} more required item{localOpenRequirements.length - 6 === 1 ? '' : 's'}.</p>
          )}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">

        {/* Incident Type */}
        <section id="neris-section-incident" className={`${sectionCls} scroll-mt-6`}>
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
          <div>
            <label className={labelCls}>
              NERIS Narrative <span className="text-zinc-400 font-normal text-xs">— overrides cover sheet narrative for NERIS submission</span>
            </label>
            <p className="text-xs text-zinc-400 mb-1">Leave blank to use the cover sheet narrative as-is.</p>
            <textarea
              rows={3}
              value={nerisNarrative}
              onChange={e => setNerisNarrative(e.target.value)}
              disabled={isSubmitted}
              placeholder="Optional — enter a NERIS-specific narrative if needed…"
              className={inputCls}
            />
            {!nerisNarrative && incident.narrative && (
              <p className="mt-1 text-xs text-zinc-400 line-clamp-2">
                <span className="font-medium text-zinc-500">Cover sheet: </span>{incident.narrative}
              </p>
            )}
          </div>
        </section>

        {/* Scene Information */}
        <section id="neris-section-location" className={`${sectionCls} scroll-mt-6`}>
          <h2 className="text-sm font-semibold text-zinc-900">Scene Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                Property Use <span className="text-zinc-400 font-normal text-xs">— in use at time of incident</span>
              </label>
              <NerisCombobox
                groups={NERIS_PROPERTY_USE}
                value={propertyUse}
                onChange={setPropertyUse}
                placeholder="Select use at time of incident…"
                disabled={isSubmitted}
              />
            </div>
            <div>
              <label className={labelCls}>
                Normal / Intended Use <span className="text-zinc-400 font-normal text-xs">— property&apos;s typical use</span>
              </label>
              <NerisCombobox
                groups={NERIS_PROPERTY_USE}
                value={propertyNormalUse}
                onChange={setPropertyNormalUse}
                placeholder="Select normal use…"
                disabled={isSubmitted}
              />
            </div>
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
        <section id="neris-section-actions" className={`${sectionCls} scroll-mt-6`}>
          <h2 className="text-sm font-semibold text-zinc-900">Actions Taken on Scene</h2>
          <NerisCombobox
            multiple
            groups={NERIS_ACTIONS_TAKEN}
            value={actionsTaken}
            onChange={setActionsTaken}
            placeholder="Select actions taken…"
            disabled={isSubmitted}
          />
          <div>
            <label className={labelCls}>No-Action Reason <span className="text-zinc-400 font-normal">(if no actions were taken)</span></label>
            <input
              type="text"
              value={noActionReason}
              onChange={e => setNoActionReason(e.target.value)}
              disabled={isSubmitted || actionsTaken.length > 0}
              placeholder="e.g. Cancelled enroute, no emergency found"
              className={inputCls}
            />
          </div>
        </section>

        {/* Mutual Aid */}
        {hasMutualAid && (
          <section id="neris-section-mutual-aid" className={`${sectionCls} scroll-mt-6`}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">Mutual Aid</h2>
              {testingMode && mutualAidRows.length === 0 && !incident.mutual_aid_direction && (
                <span className="text-xs text-amber-600 font-medium">Testing — no mutual aid on cover sheet</span>
              )}
            </div>

            {/* Cover sheet mutual aid rows — read-only reference */}
            {mutualAidRows.length > 0 && (
              <div className="rounded-lg bg-zinc-50 border border-zinc-200 px-4 py-3">
                <p className="text-xs font-semibold text-zinc-500 mb-2">From Cover Sheet</p>
                <div className="space-y-2">
                  {mutualAidRows.map(row => (
                    <div key={row.id} className="text-sm">
                      <span className="font-medium text-zinc-800">{row.external_department_name}</span>
                      <span className="text-zinc-400 mx-1.5">·</span>
                      <span className="text-zinc-600 capitalize">{row.role?.replace(/_/g, ' ')}</span>
                      {row.apparatus_description && (
                        <span className="text-zinc-400"> — {row.apparatus_description}</span>
                      )}
                      {row.personnel_count != null && (
                        <span className="text-zinc-400"> · {row.personnel_count} personnel</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-zinc-400">Select the NERIS aid classification codes for this mutual aid.</p>
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
        {showUnitsSection && (
          <section id="neris-section-units" className={`${sectionCls} scroll-mt-6`}>
            <h2 className="text-sm font-semibold text-zinc-900">Apparatus Response Mode</h2>
            <p className="text-xs text-zinc-400 -mt-1">Staffing is prefilled from cover sheet personnel assigned to each unit; adjust if needed.</p>
            {incidentApparatus.length === 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-semibold text-amber-800">No apparatus are attached to this incident.</p>
                <p className="mt-1 text-xs text-amber-700">Add responding apparatus from the incident detail page, then return here to set staffing and response mode.</p>
                <button
                  type="button"
                  onClick={() => router.push(`/incidents/${incident.id}`)}
                  className="mt-3 rounded-lg bg-white border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                >
                  Back to Incident
                </button>
              </div>
            )}
            {incidentApparatus.length > 0 && (
            <div className="divide-y divide-zinc-100">
              {incidentApparatus.map(a => (
                <div key={a.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      Unit {a.unit_number}{a.apparatus_name ? ` — ${a.apparatus_name}` : ''}
                    </p>
                    <p className="text-xs text-zinc-400 capitalize">{APPARATUS_ROLE_LABELS[a.role] ?? a.role}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {responseModeSaving === a.id && (
                      <span className="text-xs text-zinc-400">Saving…</span>
                    )}
                    <input
                      type="number"
                      min={0}
                      value={staffingCounts[a.id] ?? ''}
                      onChange={e => setStaffingCounts(prev => ({ ...prev, [a.id]: e.target.value }))}
                      onBlur={() => handleStaffingCountBlur(a.id)}
                      disabled={isSubmitted}
                      placeholder="Staff"
                      aria-label={`Staffing count for ${a.unit_number}`}
                      className="w-20 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
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
                  <div className="mt-2">
                    <input
                      type="text"
                      value={apparatusNotes[a.id] ?? ''}
                      onChange={e => setApparatusNotes(prev => ({ ...prev, [a.id]: e.target.value }))}
                      onBlur={() => handleApparatusNotesBlur(a.id)}
                      disabled={isSubmitted}
                      placeholder={`Notes for ${a.unit_number} (optional)`}
                      className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                </div>
              ))}
            </div>
            )}
          </section>
        )}

        {/* Personnel — read-only */}
        {showPersonnelSection && (
          <section id="neris-section-personnel" className={`${sectionCls} scroll-mt-6`}>
            <h2 className="text-sm font-semibold text-zinc-900">Personnel on Scene</h2>
            <p className="text-xs text-zinc-400 -mt-1">From cover sheet — flows directly to NERIS payload.</p>
            {incidentPersonnel.length === 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-semibold text-amber-800">No personnel are attached to this incident.</p>
                <p className="mt-1 text-xs text-amber-700">Add personnel from the incident detail page if responders should be included in the NERIS record.</p>
                <button
                  type="button"
                  onClick={() => router.push(`/incidents/${incident.id}`)}
                  className="mt-3 rounded-lg bg-white border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                >
                  Back to Incident
                </button>
              </div>
            )}
            {incidentPersonnel.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {incidentPersonnel.map(p => (
                <span key={p.id} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700">
                  {p.name}{p.unit_number ? ` - ${p.unit_number}` : ''}
                </span>
              ))}
            </div>
            )}
          </section>
        )}

        {/* Fire Module */}
        {isFireType && (
          <section id="neris-section-fire" className={`${sectionCls} scroll-mt-6`}>
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

            {isOutsideFire && (
              <div>
                <label className={labelCls}>Outside Fire Acres Burned</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={outsideFireAcres}
                  onChange={e => setOutsideFireAcres(e.target.value)}
                  disabled={isSubmitted}
                  placeholder="0.00"
                  className={inputCls}
                />
              </div>
            )}

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

        {/* Unified Persons on Scene — rescue + medical per person */}
        {(isMedicalType || isRescueType) && (
          <section id="neris-section-medical" className={`${sectionCls} scroll-mt-6`}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">Persons on Scene</h2>
              {testingMode && coverType !== 'rescue' && (
                <span className="text-xs text-amber-600 font-medium">Testing — not a rescue/medical incident</span>
              )}
            </div>
            <p className="text-xs text-zinc-400 -mt-1">One card per person. Rescue and medical info are linked — Person 1 is both Victim 1 and Patient 1 in the NERIS submission.</p>

            {isRescueType && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Vehicles Involved</label>
                  <input
                    type="number" min={0} value={vehiclesInvolved}
                    onChange={e => setVehiclesInvolved(e.target.value)}
                    disabled={isSubmitted} placeholder="0" className={inputCls}
                  />
                </div>
              </div>
            )}

            {incidentPersons.length === 0 && (
              <p className="text-sm text-zinc-400 italic">No persons added yet.</p>
            )}

            <div className="space-y-4">
              {incidentPersons.map((p, i) => (
                <div key={p._id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-zinc-800">Person {i + 1}</p>
                    {!isSubmitted && (
                      <button
                        type="button"
                        onClick={() => setIncidentPersons(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-xs text-red-500 hover:text-red-700 font-medium">
                        Remove
                      </button>
                    )}
                  </div>

                  {/* Rescue fields */}
                  {isRescueType && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Rescue Type</label>
                          <NerisCombobox
                            groups={toGroups(NERIS_RESCUE_TYPE, 'Rescue Type')}
                            value={p.rescue_type}
                            onChange={val => setIncidentPersons(prev => prev.map((x, idx) => idx === i ? { ...x, rescue_type: val as string } : x))}
                            placeholder="Select rescue type…"
                            disabled={isSubmitted}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Casualty Type</label>
                          <NerisCombobox
                            groups={toGroups(NERIS_CASUALTY_TYPE, 'Casualty Type')}
                            value={p.casualty_type}
                            onChange={val => setIncidentPersons(prev => prev.map((x, idx) => idx === i ? { ...x, casualty_type: val as string } : x))}
                            placeholder="Select casualty type…"
                            disabled={isSubmitted}
                          />
                        </div>
                      </div>

                      {p.casualty_type && p.casualty_type !== 'UNINJURED' && (
                        <div>
                          <label className={labelCls}>Casualty Cause</label>
                          <NerisCombobox
                            groups={toGroups(NERIS_CASUALTY_CAUSE, 'Casualty Cause')}
                            value={p.casualty_cause}
                            onChange={val => setIncidentPersons(prev => prev.map((x, idx) => idx === i ? { ...x, casualty_cause: val as string } : x))}
                            placeholder="Select cause of injury…"
                            disabled={isSubmitted}
                          />
                        </div>
                      )}

                      {/* Entrapment — confined space, structure, or vehicle */}
                      {showEntrapmentField(p.rescue_type) && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={p.entrapped}
                            onChange={e => setIncidentPersons(prev => prev.map((x, idx) => idx === i ? { ...x, entrapped: e.target.checked } : x))}
                            disabled={isSubmitted}
                            className="rounded border-zinc-300 text-red-600 focus:ring-red-500"
                          />
                          <span className="text-sm font-medium text-zinc-700">Person was entrapped</span>
                        </label>
                      )}

                      {/* Vehicle fields — motor vehicle / extrication only */}
                      {showVehicleFields(p.rescue_type) && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelCls}>Vehicle Type</label>
                            <NerisCombobox
                              groups={toGroups(NERIS_VEHICLE_TYPE, 'Vehicle Type')}
                              value={p.vehicle_type}
                              onChange={val => setIncidentPersons(prev => prev.map((x, idx) => idx === i ? { ...x, vehicle_type: val as string } : x))}
                              placeholder="Select vehicle type…"
                              disabled={isSubmitted}
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Safety Device</label>
                            <NerisCombobox
                              groups={toGroups(NERIS_SAFETY_DEVICE, 'Safety Device')}
                              value={p.safety_device}
                              onChange={val => setIncidentPersons(prev => prev.map((x, idx) => idx === i ? { ...x, safety_device: val as string } : x))}
                              placeholder="Select safety device…"
                              disabled={isSubmitted}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Medical fields */}
                  {isMedicalType && (
                    <div className={`space-y-3 ${isRescueType ? 'border-t border-zinc-200 pt-3' : ''}`}>
                      {isRescueType && <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Medical</p>}
                      <div>
                        <label className={labelCls}>Evaluation / Care</label>
                        <NerisCombobox
                          groups={toGroups(NERIS_PATIENT_EVALUATION_CARE, 'Evaluation / Care')}
                          value={p.evaluation_care}
                          onChange={val => setIncidentPersons(prev => prev.map((x, idx) => idx === i ? { ...x, evaluation_care: val as string } : x))}
                          placeholder="Select evaluation / care…"
                          disabled={isSubmitted}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Status After Intervention</label>
                          <NerisCombobox
                            groups={toGroups(NERIS_PATIENT_IMPROVED_STATUS, 'Patient Status')}
                            value={p.improved_status}
                            onChange={val => setIncidentPersons(prev => prev.map((x, idx) => idx === i ? { ...x, improved_status: val as string } : x))}
                            placeholder="Select status…"
                            disabled={isSubmitted}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Disposition</label>
                          <NerisCombobox
                            groups={toGroups(NERIS_MEDICAL_DISPOSITION, 'Medical Disposition')}
                            value={p.disposition}
                            onChange={val => setIncidentPersons(prev => prev.map((x, idx) => idx === i ? { ...x, disposition: val as string } : x))}
                            placeholder="Select disposition…"
                            disabled={isSubmitted}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {!isSubmitted && (
              <button
                type="button"
                onClick={() => setIncidentPersons(prev => [...prev, { _id: String(Date.now()), rescue_type: '', casualty_type: '', casualty_cause: '', entrapped: false, vehicle_type: '', safety_device: '', evaluation_care: '', improved_status: '', disposition: '' }])}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors">
                + Add Person
              </button>
            )}
          </section>
        )}

        {/* Hazmat Module */}
        {isHazmatType && (
          <section id="neris-section-hazmat" className={`${sectionCls} scroll-mt-6`}>
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

        {/* Save / Mark Ready */}
        {!isSubmitted && (
          <div className="flex flex-wrap gap-3 pb-8">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving…' : 'Save'}
            </button>
            {isOfficerOrAbove && nerisRecord && !nerisRecord.completed_at && (
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  if (!requirementSummary.readyForLocalCompletion) {
                    setReadyGuardOpen(true)
                    setError(null)
                    setSaved(false)
                    return
                  }
                  setLoading(true)
                  setError(null)
                  setReadyGuardOpen(false)
                  // Save current state first, then mark complete
                  const saveResult = await saveNerisReport(incident.id, {
                    neris_incident_type: nerisType || null,
                    property_use: propertyUse || null,
      property_normal_use: propertyNormalUse || null,
      neris_narrative: nerisNarrative || null,
                    actions_taken: actionsTaken,
                    no_action_reason: actionsTaken.length === 0 ? noActionReason.trim() || null : null,
                    displaced_persons: displacedPersons !== '' ? parseInt(displacedPersons) : null,
                    outside_fire_acres: outsideFireAcres !== '' ? parseFloat(outsideFireAcres) : null,
                    fire_condition_arrival: fireCondition || null,
                    building_damage: buildingDamage || null,
                    suppression_appliance: suppressionAppliances,
                    floor_of_origin: floorOfOrigin !== '' ? parseInt(floorOfOrigin) : null,
                    room_of_origin: roomOfOrigin || null,
                    fire_cause_code: fireCauseCode || null,
                    aid_type: aidType || null,
                    aid_direction: aidDirection || null,
                    incident_persons: incidentPersons.map(p => ({ rescue_type: p.rescue_type, casualty_type: p.casualty_type, casualty_cause: p.casualty_cause, entrapped: p.entrapped, vehicle_type: p.vehicle_type, safety_device: p.safety_device, evaluation_care: p.evaluation_care, improved_status: p.improved_status, disposition: p.disposition })),
                    hazsit_disposition: hazsitDisposition || null,
                    hazsit_evacuated: hazsitEvacuated !== '' ? parseInt(hazsitEvacuated) : null,
                    chemical_name: chemicalName || null,
                    chemical_dot_class: chemicalDotClass || null,
                    chemical_release_occurred: chemicalReleaseOccurred,
                    vehicles_involved: vehiclesInvolved !== '' ? parseInt(vehiclesInvolved) : null,
                  })
                  if (saveResult?.error) { setError(saveResult.error); setLoading(false); return }
                  const markResult = await markNerisComplete(incident.id)
                  if (markResult?.error) { setError(markResult.error); setLoading(false); return }
                  router.refresh()
                  setLoading(false)
                }}
                className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Saving…' : 'Mark Ready to Submit'}
              </button>
            )}
            {nerisRecord?.completed_at && !isSubmitted && isAdmin && (
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  if (!confirm('Submit this incident to NERIS? This cannot be undone.')) return
                  setLoading(true)
                  setError(null)
                  const result = await submitToNeris(incident.id)
                  if (result?.error) { setError(result.error); setLoading(false); return }
                  router.refresh()
                  setLoading(false)
                }}
                className="rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Submitting…' : 'Submit to NERIS'}
              </button>
            )}
            {nerisRecord?.completed_at && !isSubmitted && (
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setLoading(true)
                  await reopenNerisReport(incident.id)
                  router.refresh()
                  setLoading(false)
                }}
                className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 transition-colors"
              >
                Reopen for Editing
              </button>
            )}
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
