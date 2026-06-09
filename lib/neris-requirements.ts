export type NerisRequirementSection =
  | 'incident'
  | 'location'
  | 'actions'
  | 'units'
  | 'personnel'
  | 'fire'
  | 'medical'
  | 'hazmat'
  | 'casualty'
  | 'mutual_aid'
  | 'api'

export type NerisRequirementSeverity = 'required' | 'conditional' | 'recommended' | 'computed' | 'blocked'
export type NerisRequirementStatus = 'complete' | 'missing' | 'not_applicable' | 'computed' | 'blocked'
export type NerisSectionStatus = 'complete' | 'needs_info' | 'blocked' | 'not_started'

export type NerisIncidentInput = {
  incident_type?: string | null
  fire_subtype?: string | null
  incident_number?: string | null
  cad_number?: string | null
  incident_date?: string | null
  call_time?: string | null
  in_service_at?: string | null
  address?: string | null
  narrative?: string | null
  mutual_aid_direction?: string | null
  mutual_aid_department?: string | null
}

export type NerisRecordInput = {
  neris_incident_type?: string | null
  property_use?: string | null
  actions_taken?: string[] | null
  no_action_reason?: string | null
  displaced_persons?: number | null
  outside_fire_acres?: number | null
  fire_condition_arrival?: string | null
  building_damage?: string | null
  suppression_appliance?: string[] | null
  floor_of_origin?: number | null
  room_of_origin?: string | null
  fire_cause_code?: string | null
  aid_type?: string | null
  aid_direction?: string | null
  incident_persons?: {
    record_type?: string;
    person_type: string; rescue_performed_by: string; rescue_mode: string;
    rescue_actions: string[]; rescue_impediments: string[]; presence_known: string;
    entrapped: boolean; vehicle_type: string; safety_device: string;
    casualty_type: string; casualty_cause: string;
    evaluation_care: string; improved_status: string; disposition: string
  }[] | null
  hazsit_disposition?: string | null
  hazsit_evacuated?: number | null
  chemical_name?: string | null
  chemical_dot_class?: string | null
  chemical_release_occurred?: boolean | null
  vehicles_involved?: number | null
  neris_narrative?: string | null
}

export type NerisApparatusInput = {
  id?: string | null
  response_mode?: string | null
  staffing_count?: number | null
  paged_at?: string | null
  enroute_at?: string | null
  on_scene_at?: string | null
  leaving_scene_at?: string | null
  available_at?: string | null
}

export type NerisMutualAidInput = {
  id?: string | null
  external_department_name?: string | null
  role?: string | null
}

export type NerisRequirementContext = {
  incident: NerisIncidentInput
  nerisRecord?: NerisRecordInput | null
  incidentApparatus?: NerisApparatusInput[]
  incidentPersonnel?: unknown[]
  mutualAidRows?: NerisMutualAidInput[]
  apiEnrollmentReady?: boolean
}

export type NerisRequirement = {
  id: string
  section: NerisRequirementSection
  label: string
  severity: NerisRequirementSeverity
  status: NerisRequirementStatus
  source: 'fireops7' | 'neris_report' | 'neris_computed' | 'not_collected' | 'external'
  detail?: string
}

export type NerisRequirementSummary = {
  requirements: NerisRequirement[]
  sections: NerisSectionSummary[]
  totalApplicable: number
  fillable: number
  complete: number
  missing: number
  blocked: number
  computed: number
  readyForLocalCompletion: boolean
  readyForApiValidation: boolean
  activeModules: {
    fire: boolean
    medical: boolean
    hazmat: boolean
    casualty: boolean
    mutualAid: boolean
  }
}

export type NerisSectionSummary = {
  section: NerisRequirementSection
  label: string
  status: NerisSectionStatus
  requirements: NerisRequirement[]
  total: number
  complete: number
  missing: number
  blocked: number
  computed: number
  requiredMissing: number
  firstOpenRequirement?: NerisRequirement
}

export const NERIS_SECTION_LABELS: Record<NerisRequirementSection, string> = {
  incident: 'Incident',
  location: 'Location',
  actions: 'Actions',
  units: 'Units',
  personnel: 'Personnel',
  fire: 'Fire',
  medical: 'Medical',
  hazmat: 'Hazmat',
  casualty: 'Casualty',
  mutual_aid: 'Mutual Aid',
  api: 'API',
}

const NERIS_SECTION_ORDER: NerisRequirementSection[] = [
  'incident',
  'location',
  'actions',
  'units',
  'personnel',
  'fire',
  'medical',
  'hazmat',
  'casualty',
  'mutual_aid',
  'api',
]

const STRUCTURE_FIRE_CODES = new Set([
  'STRUCTURAL_INVOLVEMENT_FIRE',
  'ROOM_AND_CONTENTS_FIRE',
  'CONFINED_COOKING_APPLIANCE_FIRE',
  'CHIMNEY_FIRE',
])

const OUTSIDE_FIRE_CODES = new Set([
  'VEGETATION_GRASS_FIRE',
  'WILDFIRE_WILDLAND',
  'WILDFIRE_URBAN_INTERFACE',
  'TRASH_RUBBISH_FIRE',
  'DUMPSTER_OUTDOOR_CONTAINER_FIRE',
  'CONSTRUCTION_WASTE',
  'OUTSIDE_TANK_FIRE',
  'UTILITY_INFRASTRUCTURE_FIRE',
  'OTHER_OUTSIDE_FIRE',
])

const MEDICAL_CODE_MARKERS = [
  'CARDIAC',
  'CHEST_PAIN',
  'BREATHING',
  'STROKE',
  'UNCONSCIOUS',
  'CONVULSIONS',
  'DIABETIC',
  'ALLERGIC',
  'OVERDOSE',
  'SICK_CASE',
  'MEDICAL',
]

const HAZMAT_CODE_MARKERS = [
  'GAS_',
  'FUEL_',
  'CARBON_MONOXIDE',
  'HAZMAT',
  'BIOLOGICAL_RELEASE',
  'RADIOACTIVE_RELEASE',
]

const RESCUE_CODE_MARKERS = [
  'RESCUE',
  'EXTRICATION',
  'ENTRAPMENT',
  'WATER',
  'ICE',
  'CONFINED_SPACE',
  'TECHNICAL',
  'ELEVATOR',
]

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function hasNumber(value: number | null | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value)
}

function hasItems<T>(value: T[] | null | undefined): boolean {
  return Array.isArray(value) && value.length > 0
}

function completeIf(condition: boolean): NerisRequirementStatus {
  return condition ? 'complete' : 'missing'
}

function hasAnyMarker(code: string | null | undefined, markers: string[]): boolean {
  if (!code) return false
  return markers.some(marker => code.includes(marker))
}

function getSectionStatus(summary: {
  complete: number
  missing: number
  blocked: number
  requiredMissing: number
  total: number
}): NerisSectionStatus {
  if (summary.total === 0) return 'not_started'
  if (summary.blocked > 0) return 'blocked'
  if (summary.requiredMissing > 0) return 'needs_info'
  if (summary.complete > 0) return 'complete'
  return 'not_started'
}

export function summarizeNerisRequirementSections(
  requirements: NerisRequirement[]
): NerisSectionSummary[] {
  const sections: NerisSectionSummary[] = []

  for (const section of NERIS_SECTION_ORDER) {
    const sectionRequirements = requirements.filter(requirement =>
      requirement.section === section && requirement.status !== 'not_applicable'
    )
    if (sectionRequirements.length === 0) continue

    const complete = sectionRequirements.filter(requirement => requirement.status === 'complete').length
    const missing = sectionRequirements.filter(requirement => requirement.status === 'missing').length
    const blocked = sectionRequirements.filter(requirement => requirement.status === 'blocked').length
    const computed = sectionRequirements.filter(requirement => requirement.status === 'computed').length
    const requiredMissing = sectionRequirements.filter(requirement =>
      requirement.status === 'missing' && ['required', 'conditional'].includes(requirement.severity)
    ).length
    const firstOpenRequirement = sectionRequirements.find(requirement =>
      requirement.status === 'missing' || requirement.status === 'blocked'
    )

    sections.push({
      section,
      label: NERIS_SECTION_LABELS[section],
      status: getSectionStatus({
        complete,
        missing,
        blocked,
        requiredMissing,
        total: sectionRequirements.length,
      }),
      requirements: sectionRequirements,
      total: sectionRequirements.length,
      complete,
      missing,
      blocked,
      computed,
      requiredMissing,
      firstOpenRequirement,
    })
  }

  return sections
}

export function getNerisActiveModules(context: NerisRequirementContext): NerisRequirementSummary['activeModules'] {
  const incident = context.incident
  const nerisCode = context.nerisRecord?.neris_incident_type ?? null
  const mutualAidRows = context.mutualAidRows ?? []

  const coverType = incident.incident_type ?? null
  const isFireCover = coverType === 'fire'
  const isHazmatCover = coverType === 'special'

  return {
    fire: isFireCover || STRUCTURE_FIRE_CODES.has(nerisCode ?? '') || OUTSIDE_FIRE_CODES.has(nerisCode ?? ''),
    medical: hasAnyMarker(nerisCode, MEDICAL_CODE_MARKERS),
    hazmat: isHazmatCover || hasAnyMarker(nerisCode, HAZMAT_CODE_MARKERS),
    casualty: isFireCover || hasAnyMarker(nerisCode, RESCUE_CODE_MARKERS),
    mutualAid: mutualAidRows.length > 0 || hasText(incident.mutual_aid_direction) || hasText(incident.mutual_aid_department),
  }
}

function codeSegmentMatches(nerisCode: string | null | undefined, set: Set<string>): boolean {
  if (!nerisCode) return false
  return nerisCode.split('||').some(seg => set.has(seg))
}

export function isNerisStructureFire(incident: NerisIncidentInput, nerisCode?: string | null): boolean {
  return incident.fire_subtype === 'structure' || codeSegmentMatches(nerisCode, STRUCTURE_FIRE_CODES)
}

export function isNerisOutsideFire(incident: NerisIncidentInput, nerisCode?: string | null): boolean {
  return ['grass', 'wildland', 'other_fire'].includes(incident.fire_subtype ?? '') || codeSegmentMatches(nerisCode, OUTSIDE_FIRE_CODES)
}

export function evaluateNerisRequirements(context: NerisRequirementContext): NerisRequirementSummary {
  const incident = context.incident
  const neris = context.nerisRecord ?? {}
  const apparatus = context.incidentApparatus ?? []
  const personnel = context.incidentPersonnel ?? []
  const modules = getNerisActiveModules(context)
  const structureFire = isNerisStructureFire(incident, neris.neris_incident_type)
  const outsideFire = isNerisOutsideFire(incident, neris.neris_incident_type)
  const requirements: NerisRequirement[] = []

  const add = (requirement: NerisRequirement) => requirements.push(requirement)

  add({
    id: 'incident.neris_type',
    section: 'incident',
    label: 'NERIS incident type',
    severity: 'required',
    status: completeIf(hasText(neris.neris_incident_type)),
    source: 'neris_report',
    detail: 'Required to determine which NERIS modules apply.',
  })

  add({
    id: 'incident.start_time',
    section: 'incident',
    label: 'Incident start time',
    severity: 'required',
    status: completeIf(hasText(incident.call_time) || hasText(incident.incident_date)),
    source: 'fireops7',
    detail: 'Uses call time when available, otherwise incident date.',
  })

  add({
    id: 'incident.number',
    section: 'incident',
    label: 'Local incident number',
    severity: 'recommended',
    status: completeIf(hasText(incident.incident_number)),
    source: 'fireops7',
  })

  add({
    id: 'incident.narrative',
    section: 'incident',
    label: 'Narrative / comments',
    severity: 'recommended',
    status: completeIf(hasText(neris.neris_narrative) || hasText(incident.narrative)),
    source: 'fireops7',
  })

  add({
    id: 'location.address',
    section: 'location',
    label: 'Incident address',
    severity: 'required',
    status: completeIf(hasText(incident.address)),
    source: 'fireops7',
  })

  add({
    id: 'location.property_use',
    section: 'location',
    label: 'Property use',
    severity: 'required',
    status: completeIf(hasText(neris.property_use)),
    source: 'neris_report',
  })

  add({
    id: 'location.point',
    section: 'location',
    label: 'WGS84 incident point',
    severity: 'computed',
    status: 'computed',
    source: 'neris_computed',
    detail: 'NERIS can compute geographic fields when a usable address is supplied; exact API behavior still needs validation.',
  })

  const hasActionsTaken = hasItems(neris.actions_taken)
  const hasNoActionReason = hasText(neris.no_action_reason)
  add({
    id: 'actions.taken',
    section: 'actions',
    label: 'Actions taken or no-action reason',
    severity: 'required',
    status: completeIf(hasActionsTaken || hasNoActionReason),
    source: 'neris_report',
    detail: hasNoActionReason && !hasActionsTaken ? 'No-action reason supplied instead of actions taken.' : undefined,
  })

  if (apparatus.length > 0) {
    const missingModes = apparatus.filter(unit => !hasText(unit.response_mode)).length
    add({
      id: 'units.response_mode',
      section: 'units',
      label: 'Response mode for each apparatus',
      severity: 'required',
      status: completeIf(missingModes === 0),
      source: 'neris_report',
      detail: missingModes > 0 ? `${missingModes} unit${missingModes === 1 ? '' : 's'} missing response mode.` : undefined,
    })

    const missingDispatchTimes = apparatus.filter(unit => !hasText(unit.paged_at)).length
    add({
      id: 'units.dispatch_times',
      section: 'units',
      label: 'Unit dispatch timestamps',
      severity: 'recommended',
      status: completeIf(missingDispatchTimes === 0),
      source: 'fireops7',
      detail: missingDispatchTimes > 0 ? `${missingDispatchTimes} unit${missingDispatchTimes === 1 ? '' : 's'} missing paged time.` : undefined,
    })
  } else {
    add({
      id: 'units.response',
      section: 'units',
      label: 'Responding apparatus',
      severity: 'recommended',
      status: 'missing',
      source: 'fireops7',
      detail: 'No apparatus are attached to this incident.',
    })
  }

  if (apparatus.length > 0) {
    const missingStaffing = apparatus.filter(unit => !hasNumber(unit.staffing_count)).length
    add({
      id: 'units.staffing',
      section: 'units',
      label: 'Unit staffing at dispatch',
      severity: 'required',
      status: completeIf(missingStaffing === 0),
      source: 'neris_report',
      detail: missingStaffing > 0 ? `${missingStaffing} unit${missingStaffing === 1 ? '' : 's'} missing staffing count.` : undefined,
    })
  }

  add({
    id: 'personnel.roster',
    section: 'personnel',
    label: 'Personnel on incident',
    severity: 'recommended',
    status: completeIf(personnel.length > 0),
    source: 'fireops7',
  })

  if (modules.mutualAid) {
    add({
      id: 'mutual_aid.type',
      section: 'mutual_aid',
      label: 'Aid type',
      severity: 'required',
      status: completeIf(hasText(neris.aid_type)),
      source: 'neris_report',
    })
    add({
      id: 'mutual_aid.direction',
      section: 'mutual_aid',
      label: 'Aid direction',
      severity: 'required',
      status: completeIf(hasText(neris.aid_direction)),
      source: 'neris_report',
    })
  }

  if (modules.fire) {
    add({
      id: 'fire.cause',
      section: 'fire',
      label: outsideFire ? 'Outside fire cause' : 'Fire cause',
      severity: 'required',
      status: completeIf(hasText(neris.fire_cause_code)),
      source: 'neris_report',
    })
    add({
      id: 'fire.suppression_appliance',
      section: 'fire',
      label: 'Suppression appliances used',
      severity: 'recommended',
      status: completeIf(hasItems(neris.suppression_appliance)),
      source: 'neris_report',
    })

    if (structureFire) {
      add({
        id: 'fire.condition_arrival',
        section: 'fire',
        label: 'Fire condition on arrival',
        severity: 'required',
        status: completeIf(hasText(neris.fire_condition_arrival)),
        source: 'neris_report',
      })
      add({
        id: 'fire.building_damage',
        section: 'fire',
        label: 'Building damage',
        severity: 'required',
        status: completeIf(hasText(neris.building_damage)),
        source: 'neris_report',
      })
      add({
        id: 'fire.floor_origin',
        section: 'fire',
        label: 'Floor of origin',
        severity: 'required',
        status: completeIf(hasNumber(neris.floor_of_origin)),
        source: 'neris_report',
      })
      add({
        id: 'fire.room_origin',
        section: 'fire',
        label: 'Room or area of origin',
        severity: 'required',
        status: completeIf(hasText(neris.room_of_origin)),
        source: 'neris_report',
      })
    }

    if (outsideFire) {
      add({
        id: 'fire.outside_acres',
        section: 'fire',
        label: 'Outside fire acres burned',
        severity: 'conditional',
        status: completeIf(hasNumber(neris.outside_fire_acres)),
        source: 'neris_report',
        detail: 'Needed for grass, wildland, and other outside fire types.',
      })
    }
  }

  if (modules.medical) {
    const patientCount = (neris.incident_persons ?? []).filter(p => p.record_type === 'patient' || (!p.record_type && p.evaluation_care)).length
    add({
      id: 'medical.patients',
      section: 'medical',
      label: 'At least one patient record',
      severity: 'required',
      status: completeIf(patientCount > 0),
      source: 'neris_report',
      detail: patientCount > 0 ? `${patientCount} patient${patientCount === 1 ? '' : 's'} recorded` : undefined,
    })
  }

  if (modules.hazmat) {
    add({
      id: 'hazmat.disposition',
      section: 'hazmat',
      label: 'Hazmat disposition',
      severity: 'required',
      status: completeIf(hasText(neris.hazsit_disposition)),
      source: 'neris_report',
    })
    add({
      id: 'hazmat.chemical',
      section: 'hazmat',
      label: 'Chemical name / DOT class',
      severity: 'conditional',
      status: completeIf(hasText(neris.chemical_name) || hasText(neris.chemical_dot_class)),
      source: 'neris_report',
      detail: 'Needed when a specific hazardous substance is known.',
    })
  }

  if (modules.casualty) {
    const victimCount = (neris.incident_persons ?? []).filter(p => p.record_type === 'casualty' || (!p.record_type && p.rescue_performed_by)).length
    add({
      id: 'casualty.victims',
      section: 'casualty',
      label: 'At least one casualty/victim record',
      severity: 'required',
      status: completeIf(victimCount > 0),
      source: 'neris_report',
      detail: victimCount > 0 ? `${victimCount} victim${victimCount === 1 ? '' : 's'} recorded` : undefined,
    })
  }

  add({
    id: 'api.enrollment',
    section: 'api',
    label: 'NERIS test enrollment / API authorization',
    severity: 'blocked',
    status: context.apiEnrollmentReady ? 'complete' : 'blocked',
    source: 'external',
    detail: context.apiEnrollmentReady ? undefined : 'Pending FSRI enrollment or auth confirmation.',
  })

  const applicable = requirements.filter(requirement => requirement.status !== 'not_applicable')
  const missing = applicable.filter(requirement => requirement.status === 'missing').length
  const blocked = applicable.filter(requirement => requirement.status === 'blocked').length
  const computed = applicable.filter(requirement => requirement.status === 'computed').length
  const complete = applicable.filter(requirement => requirement.status === 'complete').length
  const sections = summarizeNerisRequirementSections(requirements)
  const localBlockingMissing = applicable.filter(requirement =>
    requirement.status === 'missing' && ['required', 'conditional'].includes(requirement.severity)
  ).length

  // fillable = items a user can actually act on (excludes computed + blocked)
  const fillable = applicable.filter(r => r.status !== 'computed' && r.status !== 'blocked').length

  return {
    requirements,
    sections,
    totalApplicable: applicable.length,
    fillable,
    complete,
    missing,
    blocked,
    computed,
    readyForLocalCompletion: localBlockingMissing === 0,
    readyForApiValidation: localBlockingMissing === 0 && blocked === 0,
    activeModules: modules,
  }
}
