// NERIS value sets — static lookup data for all NERIS code fields.
// Source: https://github.com/ulfsri/neris-framework/tree/main/core_schemas/value_sets/csv
// coverTypeFilter: which cover sheet incident_type values should show this group.

export type NerisCode = { code: string | number; label: string }
export type NerisGroup<T extends NerisCode = NerisCode> = {
  group: string
  coverTypeFilter?: string[] // if set, only show when cover type matches
  codes: T[]
}

// ─── Incident Types ───────────────────────────────────────────────────────────
// Numeric codes from type_incident.csv. Grouped for the form picker.
// coverTypeFilter maps the cover sheet incident_type to the relevant groups.

export const NERIS_INCIDENT_TYPES: NerisGroup<{ code: number; label: string }>[] = [
  {
    group: 'Structure Fire',
    coverTypeFilter: ['fire'],
    codes: [
      { code: 111, label: 'Structure fire' },
      { code: 114, label: 'Building fire' },
      { code: 115, label: 'Manufactured/mobile home structure fire' },
      { code: 121, label: 'Fire in mobile home used as fixed residence' },
      { code: 123, label: 'Fire in portable building, fixed location' },
    ],
  },
  {
    group: 'Transportation Fire',
    coverTypeFilter: ['fire'],
    codes: [
      { code: 130, label: 'Mobile property (vehicle) fire, other' },
      { code: 131, label: 'Passenger vehicle fire' },
      { code: 132, label: 'Road freight/transport vehicle fire' },
      { code: 135, label: 'Aircraft fire' },
      { code: 137, label: 'Camper/recreational vehicle fire' },
      { code: 138, label: 'Off-road vehicle fire' },
    ],
  },
  {
    group: 'Outside / Vegetation Fire',
    coverTypeFilter: ['fire'],
    codes: [
      { code: 140, label: 'Natural vegetation fire, other' },
      { code: 141, label: 'Forest/woods fire' },
      { code: 142, label: 'Brush or brush-and-grass mixture fire' },
      { code: 143, label: 'Grass fire' },
      { code: 151, label: 'Outside rubbish fire, other' },
      { code: 154, label: 'Dumpster fire' },
      { code: 161, label: 'Outside storage fire' },
      { code: 162, label: 'Outside gas or vapor combustion explosion' },
    ],
  },
  {
    group: 'Rescue / EMS',
    coverTypeFilter: ['rescue'],
    codes: [
      { code: 300, label: 'Rescue, EMS incident, other' },
      { code: 311, label: 'Medical assist, assist EMS crew' },
      { code: 312, label: 'Patient assist' },
      { code: 321, label: 'EMS call, excluding vehicle accident with injury' },
      { code: 322, label: 'Motor vehicle accident with injuries' },
      { code: 323, label: 'Motor vehicle/pedestrian accident' },
      { code: 324, label: 'Motor vehicle accident with no injuries' },
      { code: 341, label: 'Search for person on land' },
      { code: 342, label: 'Search for person in water' },
      { code: 351, label: 'Extrication, rescue, other' },
      { code: 352, label: 'Extrication of victim(s) from building/structure' },
      { code: 353, label: 'Extrication of victim(s) from vehicle' },
      { code: 354, label: 'Removal of victim(s) from stalled elevator' },
      { code: 355, label: 'Rescue or EMS standby' },
      { code: 356, label: 'High angle rescue' },
      { code: 361, label: 'Swimming/recreational water areas rescue' },
      { code: 362, label: 'Ice rescue' },
      { code: 363, label: 'Swift water rescue' },
    ],
  },
  {
    group: 'Hazardous Materials',
    coverTypeFilter: ['special', 'other'],
    codes: [
      { code: 400, label: 'Hazardous condition, other' },
      { code: 411, label: 'Gasoline or other flammable liquid spill' },
      { code: 412, label: 'Gas leak (natural gas or LPG)' },
      { code: 413, label: 'Oil or other combustible liquid spill' },
      { code: 422, label: 'Chemical spill or leak' },
      { code: 424, label: 'Carbon monoxide incident' },
      { code: 440, label: 'Electrical wiring/equipment problem, other' },
      { code: 444, label: 'Power line down' },
      { code: 445, label: 'Arcing, shorted electrical equipment' },
      { code: 451, label: 'Biological hazard, confirmed or suspected' },
      { code: 461, label: 'Building or structure weakened or collapsed' },
    ],
  },
  {
    group: 'Service Call',
    coverTypeFilter: ['standby', 'special', 'mutual_aid', 'other'],
    codes: [
      { code: 500, label: 'Service call, other' },
      { code: 511, label: 'Lock-out' },
      { code: 521, label: 'Water evacuation' },
      { code: 522, label: 'Water or steam leak' },
      { code: 531, label: 'Smoke or odor removal' },
      { code: 541, label: 'Animal problem' },
      { code: 542, label: 'Animal rescue' },
      { code: 551, label: 'Assist police or other governmental agency' },
      { code: 553, label: 'Public service' },
      { code: 554, label: 'Assist invalid' },
      { code: 555, label: 'Defective elevator, no occupants' },
    ],
  },
  {
    group: 'Good Intent Call',
    coverTypeFilter: ['standby', 'other', 'mutual_aid'],
    codes: [
      { code: 611, label: 'Dispatched and cancelled enroute' },
      { code: 621, label: 'Wrong location' },
      { code: 622, label: 'No incident found on arrival' },
      { code: 631, label: 'Authorized controlled burning' },
      { code: 651, label: 'Smoke scare, odor of smoke' },
      { code: 652, label: 'Steam, vapor, fog, or dust thought to be smoke' },
      { code: 671, label: 'Hazmat release, canceled or unfounded' },
    ],
  },
  {
    group: 'False Alarm / Alarm System',
    coverTypeFilter: ['other'],
    codes: [
      { code: 700, label: 'False alarm or false call, other' },
      { code: 711, label: 'Municipal alarm system, malicious false alarm' },
      { code: 721, label: 'Bomb scare — no bomb' },
      { code: 733, label: 'Smoke detector activation — malfunction, no fire' },
      { code: 735, label: 'Alarm system sounded — malfunction' },
      { code: 736, label: 'CO detector activation — malfunction' },
      { code: 743, label: 'Smoke detector activation — no fire, unintentional' },
      { code: 745, label: 'Alarm system sounded — no fire, unintentional' },
      { code: 746, label: 'Carbon monoxide detector activation — no CO' },
    ],
  },
  {
    group: 'Severe Weather / Disaster',
    coverTypeFilter: ['special', 'other'],
    codes: [
      { code: 800, label: 'Disaster, major incident, other' },
      { code: 812, label: 'Wind storm, tornado/hurricane assessment' },
      { code: 813, label: 'Ice storm assessment' },
      { code: 814, label: 'Flood assessment' },
      { code: 815, label: 'Lightning strike (no fire)' },
    ],
  },
]

// Returns only the groups relevant to a given cover sheet incident_type.
// Falls back to all groups if no filter matches.
export function getFilteredIncidentTypes(coverType: string | null) {
  if (!coverType) return NERIS_INCIDENT_TYPES
  const filtered = NERIS_INCIDENT_TYPES.filter(
    g => !g.coverTypeFilter || g.coverTypeFilter.includes(coverType)
  )
  return filtered.length > 0 ? filtered : NERIS_INCIDENT_TYPES
}

export function getIncidentTypeLabel(code: number | null): string {
  if (!code) return '—'
  for (const group of NERIS_INCIDENT_TYPES) {
    const match = group.codes.find(c => c.code === code)
    if (match) return `${code} — ${match.label}`
  }
  return String(code)
}

// ─── Property Use ─────────────────────────────────────────────────────────────
export const NERIS_PROPERTY_USE: NerisGroup[] = [
  {
    group: 'Residential',
    codes: [
      { code: '419', label: '1 or 2 family dwelling' },
      { code: '429', label: 'Multifamily dwelling' },
      { code: '439', label: 'Boarding/rooming house, residential hotel' },
      { code: '449', label: 'Hotel/motel, commercial' },
      { code: '460', label: 'Dormitory-type residence, other' },
    ],
  },
  {
    group: 'Assembly',
    codes: [
      { code: '130', label: 'Church, mosque, synagogue, temple' },
      { code: '150', label: 'Restaurant or cafeteria' },
      { code: '160', label: 'Bar or nightclub' },
      { code: '170', label: 'Athletic facility' },
      { code: '182', label: 'Movie theater' },
    ],
  },
  {
    group: 'Commercial / Business',
    codes: [
      { code: '511', label: 'Convenience store' },
      { code: '519', label: 'Grocery store' },
      { code: '571', label: 'Service station, gas station' },
      { code: '579', label: 'Motor vehicle dealer, showroom' },
      { code: '592', label: 'Bank, savings and loan' },
      { code: '599', label: 'Business office' },
    ],
  },
  {
    group: 'Educational',
    codes: [
      { code: '200', label: 'Educational, other' },
      { code: '213', label: 'Elementary school' },
      { code: '215', label: 'High school / junior high school' },
      { code: '241', label: 'Adult education center' },
      { code: '250', label: 'Daycare in commercial property' },
    ],
  },
  {
    group: 'Health Care',
    codes: [
      { code: '311', label: 'Nursing home, 24-hour care' },
      { code: '331', label: 'Hospital' },
      { code: '342', label: 'Doctor / dentist office' },
    ],
  },
  {
    group: 'Government / Public Safety',
    codes: [
      { code: '361', label: 'Jail, prison' },
      { code: '365', label: 'Police station' },
    ],
  },
  {
    group: 'Industrial / Agriculture',
    codes: [
      { code: '600', label: 'Industrial, utility, defense, other' },
      { code: '629', label: 'Laboratory or science laboratory' },
      { code: '700', label: 'Manufacturing, processing, other' },
      { code: '819', label: 'Livestock / poultry storage (barn)' },
      { code: '882', label: 'Greenhouse' },
      { code: '891', label: 'Forest, timberland, woodland' },
    ],
  },
  {
    group: 'Outside / Other',
    codes: [
      { code: '900', label: 'Outside or special property, other' },
      { code: '919', label: 'Dump or sanitary landfill' },
      { code: '924', label: 'Vacant lot' },
      { code: '926', label: 'Outbuilding or shed' },
      { code: '931', label: 'Open land or field' },
      { code: '936', label: 'Vacant building' },
      { code: '941', label: 'Transportation way' },
      { code: '952', label: 'Roadway' },
    ],
  },
]

export function getPropertyUseLabel(code: string | null): string {
  if (!code) return '—'
  for (const group of NERIS_PROPERTY_USE) {
    const match = group.codes.find(c => c.code === code)
    if (match) return `${code} — ${match.label}`
  }
  return code
}

// ─── Actions Taken ────────────────────────────────────────────────────────────
export const NERIS_ACTIONS_TAKEN: NerisGroup[] = [
  {
    group: 'Command & Control',
    codes: [
      { code: 'INCIDENT_COMMAND', label: 'Incident command' },
      { code: 'SAFETY_OFFICER', label: 'Safety officer' },
      { code: 'PERSONNEL_ACCOUNTABILITY', label: 'Personnel accountability' },
      { code: 'EVACUATION_ORDERED', label: 'Evacuation ordered' },
      { code: 'PIO', label: 'Public information officer' },
    ],
  },
  {
    group: 'Fire Suppression',
    codes: [
      { code: 'STRUCTURAL_FIRE_SUPPRESSION', label: 'Structural fire suppression' },
      { code: 'EXTERIOR_FIRE_SUPPRESSION', label: 'Exterior fire suppression' },
      { code: 'VEHICLE_FIRE_SUPPRESSION', label: 'Vehicle fire suppression' },
      { code: 'WILDLAND_FIRE_SUPPRESSION', label: 'Wildland fire suppression' },
      { code: 'STANDPIPE_OPS', label: 'Standpipe operations' },
      { code: 'MASTER_STREAM_OPS', label: 'Master stream operations' },
    ],
  },
  {
    group: 'Ventilation',
    codes: [
      { code: 'VERTICAL_VENTILATION', label: 'Vertical ventilation' },
      { code: 'HORIZONTAL_VENTILATION', label: 'Horizontal ventilation' },
      { code: 'POSITIVE_PRESSURE_VENTILATION', label: 'Positive pressure ventilation' },
      { code: 'HYDRAULIC_VENTILATION', label: 'Hydraulic ventilation' },
    ],
  },
  {
    group: 'Search & Rescue',
    codes: [
      { code: 'STRUCTURE_SEARCH', label: 'Structure search' },
      { code: 'VICTIM_RESCUE', label: 'Victim rescue from structure' },
      { code: 'VEHICLE_EXTRICATION', label: 'Vehicle extrication' },
      { code: 'HIGH_ANGLE_RESCUE', label: 'High angle rescue' },
      { code: 'WATER_RESCUE', label: 'Water rescue' },
      { code: 'AREA_SEARCH', label: 'Area / land search' },
    ],
  },
  {
    group: 'Emergency Medical',
    codes: [
      { code: 'PATIENT_ASSESSMENT', label: 'Patient assessment' },
      { code: 'BLS_CARE', label: 'Basic life support care' },
      { code: 'ALS_CARE', label: 'Advanced life support care' },
      { code: 'CPR_AED', label: 'CPR / AED' },
      { code: 'PATIENT_TRANSPORT', label: 'Patient transport' },
      { code: 'PATIENT_TRANSFER', label: 'Patient transfer to EMS' },
      { code: 'TRIAGE', label: 'Triage' },
    ],
  },
  {
    group: 'Hazmat',
    codes: [
      { code: 'HAZMAT_MITIGATION', label: 'Hazmat mitigation' },
      { code: 'DECONTAMINATION', label: 'Decontamination' },
      { code: 'SPILL_CONTROL', label: 'Spill control / containment' },
      { code: 'AIR_MONITORING', label: 'Sampling / air monitoring' },
    ],
  },
  {
    group: 'Overhaul & Salvage',
    codes: [
      { code: 'OVERHAUL', label: 'Overhaul' },
      { code: 'SALVAGE', label: 'Salvage operations' },
      { code: 'UTILITY_CONTROL', label: 'Utility control (gas/electric/water)' },
      { code: 'SCENE_SECURITY', label: 'Scene security / crowd control' },
    ],
  },
  {
    group: 'Service / Standby',
    codes: [
      { code: 'STANDBY_ONLY', label: 'Standby only' },
      { code: 'MUTUAL_AID_GIVEN', label: 'Mutual aid given' },
      { code: 'MUTUAL_AID_RECEIVED', label: 'Mutual aid received' },
      { code: 'INVESTIGATION', label: 'Investigation' },
      { code: 'PUBLIC_ASSIST', label: 'Public assist' },
    ],
  },
]

export function getActionLabel(code: string): string {
  for (const group of NERIS_ACTIONS_TAKEN) {
    const match = group.codes.find(c => c.code === code)
    if (match) return match.label
  }
  return code
}

// ─── Response Mode ────────────────────────────────────────────────────────────
export const NERIS_RESPONSE_MODE: NerisCode[] = [
  { code: 'EMERGENT', label: 'Emergent (lights & siren)' },
  { code: 'NON_EMERGENT', label: 'Non-emergent' },
]

// ─── Fire Condition on Arrival ────────────────────────────────────────────────
export const NERIS_FIRE_CONDITION_ARRIVAL: NerisCode[] = [
  { code: 'NO_SMOKE_FIRE_SHOWING', label: 'Nothing showing — no smoke or fire' },
  { code: 'SMOKE_SHOWING', label: 'Smoke showing' },
  { code: 'SMOKE_FIRE_SHOWING', label: 'Smoke and fire showing' },
  { code: 'STRUCTURE_INVOLVED', label: 'Structure involved in fire' },
  { code: 'FIRE_SPREAD_BEYOND_STRUCTURE', label: 'Fire spread beyond structure of origin' },
  { code: 'FIRE_OUT_UPON_ARRIVAL', label: 'Fire out upon arrival' },
]

// ─── Building Damage ──────────────────────────────────────────────────────────
export const NERIS_BUILDING_DAMAGE: NerisCode[] = [
  { code: 'NO_DAMAGE', label: 'No damage' },
  { code: 'MINOR_DAMAGE', label: 'Minor damage — limited, no displacement' },
  { code: 'MODERATE_DAMAGE', label: 'Moderate damage — flame/water/smoke, possible displacement' },
  { code: 'MAJOR_DAMAGE', label: 'Major damage — total loss, occupant displacement' },
]

// ─── Suppression Appliance ────────────────────────────────────────────────────
export const NERIS_SUPPRESSION_APPLIANCE: NerisCode[] = [
  { code: 'NONE', label: 'None' },
  { code: 'FIRE_EXTINGUISHER', label: 'Fire extinguisher' },
  { code: 'BOOSTER_FIRE_HOSE', label: 'Booster / reel hose' },
  { code: 'SMALL_DIAMETER_FIRE_HOSE', label: 'Small diameter hose (1½"–1¾")' },
  { code: 'MEDIUM_DIAMETER_FIRE_HOSE', label: 'Medium diameter hose (2½")' },
  { code: 'GROUND_MONITOR', label: 'Ground monitor / deck gun' },
  { code: 'MASTER_STREAM', label: 'Master stream' },
  { code: 'ELEVATED_MASTER_STREAM_STANDPIPE', label: 'Elevated master stream / standpipe' },
  { code: 'BUILDING_STANDPIPE', label: 'Building standpipe' },
  { code: 'BUILDING_FDC', label: 'Building FDC (fire dept connection)' },
  { code: 'AIRATTACK_HELITACK', label: 'Air attack / helitack' },
  { code: 'OTHER', label: 'Other' },
]

// ─── Fire Cause — Interior ────────────────────────────────────────────────────
export const NERIS_FIRE_CAUSE_IN: NerisCode[] = [
  { code: 'OPERATING_EQUIPMENT', label: 'Operating equipment / appliance' },
  { code: 'ELECTRICAL', label: 'Electrical (wiring, outlet, breaker)' },
  { code: 'BATTERY_POWER_STORAGE', label: 'Battery / power storage system' },
  { code: 'HEAT_FROM_ANOTHER_OBJECT', label: 'Heat from another object' },
  { code: 'EXPLOSIVES_FIREWORKS', label: 'Explosives / fireworks' },
  { code: 'SMOKING_MATERIALS_ILLICIT_DRUGS', label: 'Smoking materials / illicit drugs' },
  { code: 'OPEN_FLAME', label: 'Open flame (candle, lighter, match)' },
  { code: 'COOKING', label: 'Cooking' },
  { code: 'CHEMICAL', label: 'Chemical reaction' },
  { code: 'ACT_OF_NATURE', label: 'Act of nature (lightning, earthquake)' },
  { code: 'INCENDIARY', label: 'Incendiary / intentional' },
  { code: 'OTHER_HEAT_SOURCE', label: 'Other heat source' },
  { code: 'UNABLE_TO_BE_DETERMINED', label: 'Unable to be determined' },
]

// ─── Fire Cause — Exterior / Outside ─────────────────────────────────────────
export const NERIS_FIRE_CAUSE_OUT: NerisCode[] = [
  { code: 'NATURAL', label: 'Natural (lightning, spontaneous combustion)' },
  { code: 'EQUIPMENT_VEHICLE_USE', label: 'Equipment / vehicle use' },
  { code: 'SMOKING_MATERIALS_ILLICIT_DRUGS', label: 'Smoking materials / illicit drugs' },
  { code: 'RECREATION_CEREMONY', label: 'Recreation / ceremony (campfire, bonfire)' },
  { code: 'DEBRIS_OPEN_BURNING', label: 'Debris / open burning' },
  { code: 'RAILROAD_OPS_MAINTENANCE', label: 'Railroad operations / maintenance' },
  { code: 'FIREARMS_EXPLOSIVES', label: 'Firearms / explosives' },
  { code: 'FIREWORKS', label: 'Fireworks' },
  { code: 'POWER_GEN_TRANS_DIST', label: 'Power generation / transmission / distribution' },
  { code: 'STRUCTURE', label: 'Spread from structure fire' },
  { code: 'INCENDIARY', label: 'Incendiary / intentional' },
  { code: 'BATTERY_POWER_STORAGE', label: 'Battery / power storage system' },
  { code: 'SPREAD_FROM_CONTROLLED_BURN', label: 'Spread from controlled burn' },
  { code: 'UNABLE_TO_BE_DETERMINED', label: 'Unable to be determined' },
]

// ─── Aid Type ─────────────────────────────────────────────────────────────────
export const NERIS_AID_TYPE: NerisCode[] = [
  { code: 'SUPPORT_AID', label: 'Support aid — assisting the primary entity' },
  { code: 'IN_LIEU_AID', label: 'In-lieu aid — substituting for another entity' },
  { code: 'ACTING_AS_AID', label: 'Acting as aid — operating as another entity' },
]

// ─── Aid Direction ────────────────────────────────────────────────────────────
export const NERIS_AID_DIRECTION: NerisCode[] = [
  { code: 'GIVEN', label: 'Given (we assisted another department)' },
  { code: 'RECEIVED', label: 'Received (another department assisted us)' },
]

// ─── Cover sheet incident_type → NERIS category label ────────────────────────
export const COVER_TYPE_LABEL: Record<string, string> = {
  fire: 'Fire',
  rescue: 'Rescue / EMS',
  standby: 'Service / Standby',
  mutual_aid: 'Mutual Aid',
  special: 'Special / Hazmat',
  other: 'Other',
}
