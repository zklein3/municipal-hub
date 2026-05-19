// NERIS value sets — complete lookup data from official NERIS framework CSVs.
// Source: https://github.com/ulfsri/neris-framework/tree/main/core_schemas/value_sets/csv
// NERIS uses string codes, not NFIRS numeric codes.

export type NerisCode = { code: string; label: string }
export type NerisGroup = { group: string; coverTypeFilter?: string[]; codes: NerisCode[] }

// ─── Incident Types ───────────────────────────────────────────────────────────
// Grouped by value_1 + value_2 from type_incident.csv.
// coverTypeFilter: which cover sheet incident_type values show this group by default.

// Incident type codes use NERIS pipe-delimited hierarchy: CATEGORY||SUBCATEGORY||SPECIFIC_TYPE
// Confirmed format from live API: FIRE||OUTSIDE_FIRE||OTHER_OUTSIDE_FIRE etc.
// Other categories follow the same pattern — verify during end-to-end test.
export const NERIS_INCIDENT_TYPES: NerisGroup[] = [
  {
    group: 'Fire — Structure Fire',
    coverTypeFilter: ['fire'],
    codes: [
      { code: 'FIRE||STRUCTURE_FIRE||STRUCTURAL_INVOLVEMENT_FIRE', label: 'Structural Involvement' },
      { code: 'FIRE||STRUCTURE_FIRE||ROOM_AND_CONTENTS_FIRE', label: 'Room and Contents Fire' },
      { code: 'FIRE||STRUCTURE_FIRE||CONFINED_COOKING_APPLIANCE_FIRE', label: 'Confined Cooking / Appliance Fire' },
      { code: 'FIRE||STRUCTURE_FIRE||CHIMNEY_FIRE', label: 'Chimney Fire' },
    ],
  },
  {
    group: 'Fire — Transportation Fire',
    coverTypeFilter: ['fire'],
    codes: [
      { code: 'FIRE||TRANSPORTATION_FIRE||VEHICLE_FIRE_PASSENGER', label: 'Vehicle Fire — Passenger' },
      { code: 'FIRE||TRANSPORTATION_FIRE||VEHICLE_FIRE_COMMERCIAL', label: 'Vehicle Fire — Commercial' },
      { code: 'FIRE||TRANSPORTATION_FIRE||VEHICLE_FIRE_RV', label: 'Vehicle Fire — RV' },
      { code: 'FIRE||TRANSPORTATION_FIRE||VEHICLE_FIRE_FOOD_TRUCK', label: 'Vehicle Fire — Food Truck' },
      { code: 'FIRE||TRANSPORTATION_FIRE||POWERED_MOBILITY_DEVICE_FIRE', label: 'Powered Mobility Device Fire' },
      { code: 'FIRE||TRANSPORTATION_FIRE||BOAT_PERSONAL_WATERCRAFT_BARGE_FIRE', label: 'Boat / Personal Watercraft / Barge Fire' },
      { code: 'FIRE||TRANSPORTATION_FIRE||TRAIN_RAIL_FIRE', label: 'Train / Rail Fire' },
      { code: 'FIRE||TRANSPORTATION_FIRE||AIRCRAFT_FIRE', label: 'Aircraft Emergency' },
    ],
  },
  {
    group: 'Fire — Outside Fire',
    coverTypeFilter: ['fire'],
    codes: [
      { code: 'FIRE||OUTSIDE_FIRE||VEGETATION_GRASS_FIRE', label: 'Vegetation / Grass Fire' },
      { code: 'FIRE||OUTSIDE_FIRE||WILDFIRE_WILDLAND', label: 'Wildfire — Wildland' },
      { code: 'FIRE||OUTSIDE_FIRE||WILDFIRE_URBAN_INTERFACE', label: 'Wildfire — Urban Interface' },
      { code: 'FIRE||OUTSIDE_FIRE||TRASH_RUBBISH_FIRE', label: 'Trash / Rubbish Fire' },
      { code: 'FIRE||OUTSIDE_FIRE||DUMPSTER_OUTDOOR_CONTAINER_FIRE', label: 'Dumpster / Other Outdoor Container Fire' },
      { code: 'FIRE||OUTSIDE_FIRE||CONSTRUCTION_WASTE', label: 'Construction Waste Fire' },
      { code: 'FIRE||OUTSIDE_FIRE||OUTSIDE_TANK_FIRE', label: 'Outside Tank Fire' },
      { code: 'FIRE||OUTSIDE_FIRE||UTILITY_INFRASTRUCTURE_FIRE', label: 'Utility Infrastructure Fire' },
      { code: 'FIRE||OUTSIDE_FIRE||OTHER_OUTSIDE_FIRE', label: 'Other Outside Fire' },
    ],
  },
  {
    group: 'Fire — Special Fire',
    coverTypeFilter: ['fire'],
    codes: [
      { code: 'FIRE||SPECIAL_FIRE||EXPLOSION', label: 'Explosion' },
      { code: 'FIRE||SPECIAL_FIRE||ESS_FIRE', label: 'ESS Fire (Energy Storage System)' },
      { code: 'FIRE||SPECIAL_FIRE||INFRASTRUCTURE_FIRE', label: 'Infrastructure Fire (Tunnel / Bridge)' },
    ],
  },
  {
    group: 'Hazardous Situation — Non-Chemical',
    coverTypeFilter: ['special', 'rescue'],
    codes: [
      { code: 'HAZSIT||HAZARD_NONCHEM||MOTOR_VEHICLE_COLLISION', label: 'Motor Vehicle Collision' },
      { code: 'HAZSIT||HAZARD_NONCHEM||ELEC_POWER_LINE_DOWN_ARCHING_MALFUNC', label: 'Electrical Power Line Down / Arching / Malfunction' },
      { code: 'HAZSIT||HAZARD_NONCHEM||ELEC_HAZARD_SHORT_CIRCUIT', label: 'Electrical Hazard / Short Circuit' },
      { code: 'HAZSIT||HAZARD_NONCHEM||BOMB_THREAT_RESPONSE_SUSPICIOUS_PACKAGE', label: 'Bomb Threat / Response / Suspicious Package' },
    ],
  },
  {
    group: 'Hazardous Situation — Hazardous Materials',
    coverTypeFilter: ['special'],
    codes: [
      { code: 'HAZSIT||HAZARDOUS_MATERIALS||GAS_LEAK_ODOR', label: 'Gas Leak / Gas Odor' },
      { code: 'HAZSIT||HAZARDOUS_MATERIALS||FUEL_SPILL_ODOR', label: 'Fuel Spill / Fuel Odor' },
      { code: 'HAZSIT||HAZARDOUS_MATERIALS||CARBON_MONOXIDE_RELEASE', label: 'Carbon Monoxide Release' },
      { code: 'HAZSIT||HAZARDOUS_MATERIALS||HAZMAT_RELEASE_TRANSPORT', label: 'Hazardous Material Release — Transportation' },
      { code: 'HAZSIT||HAZARDOUS_MATERIALS||HAZMAT_RELEASE_FACILITY', label: 'Hazardous Material Release — Fixed Facility' },
      { code: 'HAZSIT||HAZARDOUS_MATERIALS||BIOLOGICAL_RELEASE_INCIDENT', label: 'Biological Release / Incident' },
      { code: 'HAZSIT||HAZARDOUS_MATERIALS||RADIOACTIVE_RELEASE_INCIDENT', label: 'Radioactive Release / Incident' },
    ],
  },
  {
    group: 'Hazardous Situation — Overpressure',
    coverTypeFilter: ['special'],
    codes: [
      { code: 'HAZSIT||OVERPRESSURE||RUPTURE_WITHOUT_FIRE', label: 'Rupture Without Fire' },
      { code: 'HAZSIT||OVERPRESSURE||NO_RUPTURE', label: 'No Rupture' },
    ],
  },
  {
    group: 'Hazardous Situation — Investigation',
    coverTypeFilter: ['special', 'other'],
    codes: [
      { code: 'HAZSIT||INVESTIGATION||ODOR', label: 'Odor Investigation' },
      { code: 'HAZSIT||INVESTIGATION||SMOKE_INVESTIGATION', label: 'Smoke Investigation' },
    ],
  },
  {
    group: 'Medical — Illness',
    coverTypeFilter: ['rescue', 'special', 'other'],
    codes: [
      { code: 'MEDICAL||ILLNESS||CARDIAC_ARREST', label: 'Cardiac Arrest' },
      { code: 'MEDICAL||ILLNESS||CHEST_PAIN_NON_TRAUMA', label: 'Chest Pain (Non-Trauma)' },
      { code: 'MEDICAL||ILLNESS||BREATHING_PROBLEMS', label: 'Breathing Problems' },
      { code: 'MEDICAL||ILLNESS||STROKE_CVA', label: 'Stroke / CVA' },
      { code: 'MEDICAL||ILLNESS||ALTERED_MENTAL_STATUS', label: 'Altered Mental Status' },
      { code: 'MEDICAL||ILLNESS||UNCONSCIOUS_VICTIM', label: 'Unconscious Victim' },
      { code: 'MEDICAL||ILLNESS||CONVULSIONS_SEIZURES', label: 'Convulsions / Seizures' },
      { code: 'MEDICAL||ILLNESS||DIABETIC_PROBLEMS', label: 'Diabetic Problems' },
      { code: 'MEDICAL||ILLNESS||ALLERGIC_REACTION_STINGS', label: 'Allergic Reaction / Stings' },
      { code: 'MEDICAL||ILLNESS||ABDOMINAL_PAIN', label: 'Abdominal Pain / Problems' },
      { code: 'MEDICAL||ILLNESS||BACK_PAIN_NON_TRAUMA', label: 'Back Pain (Non-Trauma)' },
      { code: 'MEDICAL||ILLNESS||HEADACHE', label: 'Headache' },
      { code: 'MEDICAL||ILLNESS||HEART_PROBLEMS', label: 'Heart Problems' },
      { code: 'MEDICAL||ILLNESS||NAUSEA_VOMITING', label: 'Nausea / Vomiting' },
      { code: 'MEDICAL||ILLNESS||OVERDOSE', label: 'Overdose / Poisoning' },
      { code: 'MEDICAL||ILLNESS||PSYCHOLOGICAL_BEHAVIOR_ISSUES', label: 'Psychological / Behavioral Issues' },
      { code: 'MEDICAL||ILLNESS||PREGNANCY_CHILDBIRTH', label: 'Pregnancy / Childbirth' },
      { code: 'MEDICAL||ILLNESS||PANDEMIC_EPIDEMIC_OUTBREAK', label: 'Pandemic / Epidemic / Outbreak' },
      { code: 'MEDICAL||ILLNESS||SICK_CASE', label: 'Sick Case (General)' },
      { code: 'MEDICAL||ILLNESS||WELL_PERSON_CHECK', label: 'Well Person Check' },
      { code: 'MEDICAL||ILLNESS||UNKNOWN_PROBLEM', label: 'Unknown Problem' },
      { code: 'MEDICAL||ILLNESS||NO_APPROPRIATE_CHOICE', label: 'No Appropriate Choice' },
    ],
  },
  {
    group: 'Medical — Injury',
    coverTypeFilter: ['rescue', 'special', 'other'],
    codes: [
      { code: 'MEDICAL||INJURY||MOTOR_VEHICLE_COLLISION', label: 'Motor Vehicle Collision' },
      { code: 'MEDICAL||INJURY||FALL', label: 'Fall' },
      { code: 'MEDICAL||INJURY||HEMORRHAGE_LACERATION', label: 'Hemorrhage / Laceration' },
      { code: 'MEDICAL||INJURY||GUNSHOT_WOUND', label: 'Gunshot Wound' },
      { code: 'MEDICAL||INJURY||STAB_PENETRATING_TRAUMA', label: 'Stab / Penetrating Trauma' },
      { code: 'MEDICAL||INJURY||ASSAULT', label: 'Assault' },
      { code: 'MEDICAL||INJURY||BURNS_EXPLOSION', label: 'Burns / Explosion' },
      { code: 'MEDICAL||INJURY||CARBON_MONOXIDE_OTHER_INHALATION_INJURY', label: 'Carbon Monoxide / Inhalation Injury' },
      { code: 'MEDICAL||INJURY||CHOKING', label: 'Choking' },
      { code: 'MEDICAL||INJURY||DROWNING_DIVING_SCUBA_ACCIDENT', label: 'Drowning / Diving / SCUBA Accident' },
      { code: 'MEDICAL||INJURY||ELECTROCUTION', label: 'Electrocution' },
      { code: 'MEDICAL||INJURY||EYE_TRAUMA', label: 'Eye Trauma' },
      { code: 'MEDICAL||INJURY||HEAT_COLD_EXPOSURE', label: 'Heat / Cold Exposure' },
      { code: 'MEDICAL||INJURY||INDUSTRIAL_INACCESSIBLE_ENTRAPMENT', label: 'Industrial / Entrapment (Non-Vehicle)' },
      { code: 'MEDICAL||INJURY||ANIMAL_BITES', label: 'Animal Bites' },
      { code: 'MEDICAL||INJURY||POISONING', label: 'Poisoning' },
      { code: 'MEDICAL||INJURY||OTHER_TRAUMATIC_INJURY', label: 'Other Traumatic Injury' },
    ],
  },
  {
    group: 'Medical — Other',
    coverTypeFilter: ['rescue', 'special', 'other'],
    codes: [
      { code: 'MEDICAL||OTHER||MEDICAL_ALARM', label: 'Medical Alarm' },
      { code: 'MEDICAL||OTHER||TRANSFER_INTERFACILITY', label: 'Transfer / Interfacility' },
      { code: 'MEDICAL||OTHER||AIRMEDICAL_TRANSPORT', label: 'Airmedical Transport' },
      { code: 'MEDICAL||OTHER||INTERCEPT_OTHER_UNIT', label: 'Intercept Other Unit' },
      { code: 'MEDICAL||OTHER||STANDBY_REQUEST', label: 'Standby Request' },
      { code: 'MEDICAL||OTHER||HEALTHCARE_PROFESSIONAL_ADMISSION', label: 'Healthcare Professional Admission' },
      { code: 'MEDICAL||OTHER||COMMUNITY_PUBLIC_HEALTH', label: 'Community / Public Health' },
    ],
  },
  {
    group: 'Rescue — Outside',
    coverTypeFilter: ['rescue'],
    codes: [
      { code: 'RESCUE||OUTSIDE||EXTRICATION_ENTRAPPED', label: 'Extrication / Entrapped' },
      { code: 'RESCUE||OUTSIDE||HIGH_ANGLE_RESCUE', label: 'High Angle Rescue' },
      { code: 'RESCUE||OUTSIDE||LOW_ANGLE_RESCUE', label: 'Low Angle Rescue' },
      { code: 'RESCUE||OUTSIDE||STEEP_ANGLE_RESCUE', label: 'Steep Angle Rescue' },
      { code: 'RESCUE||OUTSIDE||CONFINED_SPACE_RESCUE', label: 'Confined Space Rescue' },
      { code: 'RESCUE||OUTSIDE||TRENCH', label: 'Trench Rescue' },
      { code: 'RESCUE||OUTSIDE||BACKCOUNTRY_RESCUE', label: 'Backcountry Rescue' },
      { code: 'RESCUE||OUTSIDE||LIMITED_NO_ACCESS', label: 'Limited / No Access' },
    ],
  },
  {
    group: 'Rescue — Structure',
    coverTypeFilter: ['rescue'],
    codes: [
      { code: 'RESCUE||STRUCTURE||BUILDING_STRUCTURE_COLLAPSE', label: 'Building / Structure Collapse' },
      { code: 'RESCUE||STRUCTURE||ELEVATOR_ESCALATOR_RESCUE', label: 'Elevator / Escalator Rescue' },
      { code: 'RESCUE||STRUCTURE||CONFINED_SPACE_RESCUE', label: 'Confined Space Rescue' },
      { code: 'RESCUE||STRUCTURE||EXTRICATION_ENTRAPPED', label: 'Extrication / Entrapped' },
    ],
  },
  {
    group: 'Rescue — Transportation',
    coverTypeFilter: ['rescue'],
    codes: [
      { code: 'RESCUE||TRANSPORTATION||MOTOR_VEHICLE_EXTRICATION_ENTRAPPED', label: 'Motor Vehicle Collision Extrication / Entrapment' },
      { code: 'RESCUE||TRANSPORTATION||TRAIN_RAIL_COLLISION_DERAILMENT', label: 'Train / Rail Collision or Derailment' },
      { code: 'RESCUE||TRANSPORTATION||AVIATION_COLLISION_CRASH', label: 'Aviation Collision / Crash' },
      { code: 'RESCUE||TRANSPORTATION||AVIATION_STANDBY', label: 'Aviation Standby' },
    ],
  },
  {
    group: 'Rescue — Water',
    coverTypeFilter: ['rescue'],
    codes: [
      { code: 'RESCUE||WATER||PERSON_IN_WATER_STANDING', label: 'Person in Water — Standing Water / Lake' },
      { code: 'RESCUE||WATER||PERSON_IN_WATER_SWIFTWATER', label: 'Person in Water — Swiftwater / River' },
      { code: 'RESCUE||WATER||WATERCRAFT_IN_DISTRESS', label: 'Watercraft in Distress' },
    ],
  },
  {
    group: 'Public Service — Citizen Assist',
    coverTypeFilter: ['standby', 'mutual_aid', 'other'],
    codes: [
      { code: 'PUBSERV||CITIZEN_ASSIST||CITIZEN_ASSIST_SERVICE_CALL', label: 'Citizen Assist / Service Call' },
      { code: 'PUBSERV||CITIZEN_ASSIST||PERSON_IN_DISTRESS', label: 'Person in Distress' },
      { code: 'PUBSERV||CITIZEN_ASSIST||LOST_PERSON', label: 'Lost Person' },
      { code: 'PUBSERV||CITIZEN_ASSIST||LIFT_ASSIST', label: 'Lift Assist' },
    ],
  },
  {
    group: 'Public Service — Alarms',
    coverTypeFilter: ['standby', 'other'],
    codes: [
      { code: 'PUBSERV||ALARMS_NONMED||FIRE_ALARM', label: 'Fire / Smoke Alarm' },
      { code: 'PUBSERV||ALARMS_NONMED||CO_ALARM', label: 'CO Alarm' },
      { code: 'PUBSERV||ALARMS_NONMED||GAS_ALARM', label: 'Gas Alarm' },
      { code: 'PUBSERV||ALARMS_NONMED||OTHER_ALARM', label: 'Other Alarm' },
    ],
  },
  {
    group: 'Public Service — Disaster / Weather',
    coverTypeFilter: ['standby', 'special', 'other'],
    codes: [
      { code: 'PUBSERV||DISASTER_WEATHER||WEATHER_RESPONSE', label: 'Weather Response' },
      { code: 'PUBSERV||DISASTER_WEATHER||DAMAGE_ASSESSMENT', label: 'Damage Assessment' },
    ],
  },
  {
    group: 'Public Service — Other',
    coverTypeFilter: ['standby', 'mutual_aid', 'other'],
    codes: [
      { code: 'PUBSERV||OTHER||STANDBY', label: 'Standby' },
      { code: 'PUBSERV||OTHER||MOVE_UP', label: 'Move-up / Cover Assignment' },
      { code: 'PUBSERV||OTHER||DAMAGED_HYDRANT', label: 'Damaged Hydrant' },
    ],
  },
  {
    group: 'No Emergency — False Alarm',
    coverTypeFilter: ['other'],
    codes: [
      { code: 'NOEMERG||FALSE_ALARM||MALFUNCTIONING_ALARM', label: 'Malfunctioning Alarm' },
      { code: 'NOEMERG||FALSE_ALARM||ACCIDENTAL_ALARM', label: 'Accidental Alarm' },
      { code: 'NOEMERG||FALSE_ALARM||INTENTIONAL_FALSE_ALARM', label: 'Intentional False Alarm' },
      { code: 'NOEMERG||FALSE_ALARM||BOMB_SCARE', label: 'Bomb Scare' },
      { code: 'NOEMERG||FALSE_ALARM||OTHER_FALSE_CALL', label: 'Other False Call' },
    ],
  },
  {
    group: 'No Emergency — Good Intent',
    coverTypeFilter: ['other', 'standby'],
    codes: [
      { code: 'NOEMERG||GOOD_INTENT||NO_INCIDENT_FOUND_LOCATION_ERROR', label: 'No Incident Found / Location Error' },
      { code: 'NOEMERG||GOOD_INTENT||SMOKE_FROM_NONHOSTILE_SOURCE', label: 'Smoke from Nonhostile Source' },
      { code: 'NOEMERG||GOOD_INTENT||CONTROLLED_BURNING_AUTHORIZED', label: 'Controlled Burning (Authorized)' },
      { code: 'NOEMERG||GOOD_INTENT||INVESTIGATE_HAZARDOUS_RELEASE', label: 'Investigate Hazardous Release — Nothing Found' },
    ],
  },
  {
    group: 'No Emergency — Cancelled',
    coverTypeFilter: ['other', 'standby'],
    codes: [
      { code: 'NOEMERG||CANCELLED', label: 'Cancelled / Dispatched and Cancelled En Route' },
    ],
  },
  {
    group: 'Law Enforcement Support',
    coverTypeFilter: ['other', 'standby', 'mutual_aid'],
    codes: [
      { code: 'LAWENFORCE', label: 'Law Enforcement Support' },
    ],
  },
]

export function getFilteredIncidentTypes(coverType: string | null): NerisGroup[] {
  if (!coverType) return NERIS_INCIDENT_TYPES
  const filtered = NERIS_INCIDENT_TYPES.filter(
    g => !g.coverTypeFilter || g.coverTypeFilter.includes(coverType)
  )
  return filtered.length > 0 ? filtered : NERIS_INCIDENT_TYPES
}

export function getIncidentTypeLabel(code: string | null): string {
  if (!code) return '—'
  for (const group of NERIS_INCIDENT_TYPES) {
    const match = group.codes.find(c => c.code === code)
    if (match) return match.label
  }
  return code
}

// ─── Property Use ─────────────────────────────────────────────────────────────
// From type_location_use.csv — code = value_2, group = description_1

export const NERIS_PROPERTY_USE: NerisGroup[] = [
  {
    group: 'Residential',
    codes: [
      { code: 'RESIDENTIAL||DETATCHED_SINGLE_FAMILY_DWELLING', label: 'Detached Single Family Dwelling' },
      { code: 'RESIDENTIAL||ATTACHED_SINGLE_FAMILY_DWELLING', label: 'Attached Single Family Dwelling' },
      { code: 'RESIDENTIAL||MULTI_FAMILY_LOWRISE_DWELLING', label: 'Multi-Family Low-Rise (≤4 Stories)' },
      { code: 'RESIDENTIAL||MULTI_FAMILY_MIDRISE_DWELLING', label: 'Multi-Family Mid-Rise (5–8 Stories)' },
      { code: 'RESIDENTIAL||MULTI_FAMILY_HIGHRISE_DWELLING', label: 'Multi-Family High-Rise (≥9 Stories)' },
      { code: 'RESIDENTIAL||MANUFACTURED_MOBILE_HOME', label: 'Manufactured / Mobile Home' },
      { code: 'RESIDENTIAL||TEMPORARY_LODGING_HOTEL_MOTEL', label: 'Hotel / Motel / Temporary Lodging' },
      { code: 'RESIDENTIAL||CONGREGATE_HOUSING', label: 'Congregate Housing (Dorms / Boarding)' },
      { code: 'RESIDENTIAL||UNHOUSED_TEMPORARY_SHELTER', label: 'Unhoused / Temporary Shelter' },
      { code: 'RESIDENTIAL||DETATCHED_GARAGE', label: 'Detached Garage' },
    ],
  },
  {
    group: 'Assembly',
    codes: [
      { code: 'ASSEMBLY||RELIGIOUS', label: 'Religious (Church / Mosque / Synagogue)' },
      { code: 'ASSEMBLY||COMMUNITY_CENTER', label: 'Community Center' },
      { code: 'ASSEMBLY||CONVENTION_CENTER', label: 'Convention Center' },
      { code: 'ASSEMBLY||INDOOR_ARENA', label: 'Indoor Arena' },
      { code: 'ASSEMBLY||OUTDOOR_ARENA_AMPHITHEATER_PARK', label: 'Outdoor Arena / Amphitheater / Amusement Park' },
      { code: 'ASSEMBLY||TEMP_OUTDOOR_STRUCT_EVENT', label: 'Temporary Outdoor Structure / Event' },
      { code: 'ASSEMBLY||MUSEUM_EXHIBIT_HALL_LIBRARY', label: 'Museum / Exhibit Hall / Library' },
    ],
  },
  {
    group: 'Commercial',
    codes: [
      { code: 'COMMERCIAL||RESTAURANT_CAFE', label: 'Restaurant / Cafe' },
      { code: 'COMMERCIAL||BAR_NIGHTCLUB', label: 'Bar / Nightclub' },
      { code: 'COMMERCIAL||RETAIL_WHOLESALE_TRADE', label: 'Retail / Wholesale / Trade' },
      { code: 'COMMERCIAL||OFFICE_OTHER_TECHNICAL_SERVICES', label: 'Office / Technical Services' },
      { code: 'COMMERCIAL||ENTERTAINMENT_RECREATION', label: 'Entertainment / Recreation' },
      { code: 'COMMERCIAL||THEATERS_STUDIO', label: 'Theater / Studio' },
      { code: 'COMMERCIAL||VEHICLE_REPAIR_SERVICES', label: 'Vehicle Repair Services' },
      { code: 'COMMERCIAL||VEHICLE_FUELING_CHARGING_STATION', label: 'Vehicle Fueling / Charging Station' },
      { code: 'COMMERCIAL||VETERINARY_PET', label: 'Veterinary (Pet)' },
    ],
  },
  {
    group: 'Education',
    codes: [
      { code: 'EDUCATION||K_12_SCHOOLS', label: 'K–12 Schools' },
      { code: 'EDUCATION||PREK_DAYCARE', label: 'Pre-K / Day Care' },
      { code: 'EDUCATION||COLLEGES_UNIVERSITIES', label: 'Colleges / Universities' },
      { code: 'EDUCATION||DORMITORY_HOUSING', label: 'Dormitory / Housing' },
      { code: 'EDUCATION||OTHER_EDUCATIONAL_BUILDINGS', label: 'Other Educational Buildings' },
    ],
  },
  {
    group: 'Health Care',
    codes: [
      { code: 'HEALTH_CARE||HOSPITAL_24_HOUR_MEDICAL_FACILITIES', label: 'Hospital / 24-Hour Medical Facility' },
      { code: 'HEALTH_CARE||NURSING_HOME_ASSISTED_LIVING_RESIDENCE_ONSITE', label: 'Nursing Home / Assisted Living' },
      { code: 'HEALTH_CARE||MEDICAL_OFFICE_CLINIC', label: 'Medical Office / Clinic' },
      { code: 'HEALTH_CARE||ALCOHOL_DRUG_REHABILITATION_CENTER', label: 'Alcohol / Drug Rehabilitation Center' },
    ],
  },
  {
    group: 'Government',
    codes: [
      { code: 'GOVERNMENT||FIRE_MEDICAL_STATION', label: 'Fire Station / Medical Response Station' },
      { code: 'GOVERNMENT||POLICE_EMERGENCY_STATION', label: 'Police Station / Emergency Response' },
      { code: 'GOVERNMENT||JAIL_PRISON_REFORMATORY', label: 'Jail / Prison / Reformatory' },
      { code: 'GOVERNMENT||GENERAL_SERVICES', label: 'Government General Services' },
      { code: 'GOVERNMENT||NON_CIVILIAN_STRUCTURES', label: 'Non-Civilian / Military Structures' },
    ],
  },
  {
    group: 'Industrial',
    codes: [
      { code: 'INDUSTRIAL||LIGHT', label: 'Light Industrial' },
      { code: 'INDUSTRIAL||HEAVY', label: 'Heavy Industrial' },
      { code: 'INDUSTRIAL||CHEMICAL', label: 'Chemical Industrial' },
      { code: 'INDUSTRIAL||FOOD_DRUGS', label: 'Food / Drug Manufacturing' },
      { code: 'INDUSTRIAL||METALS_MINERALS_PROCESSING', label: 'Metals / Minerals Processing' },
      { code: 'INDUSTRIAL||COLD_STORAGE', label: 'Cold Storage' },
    ],
  },
  {
    group: 'Agriculture',
    codes: [
      { code: 'AGRICULTURE_STRUCT||FARM_BUILDING', label: 'Farm Building' },
      { code: 'AGRICULTURE_STRUCT||STORAGE_SILO', label: 'Crop / Product Storage / Silo' },
      { code: 'AGRICULTURE_STRUCT||AUCTION_FEEDLOT', label: 'Auction / Feedlot' },
      { code: 'AGRICULTURE_STRUCT||ANIMAL_PROCESSING', label: 'Animal Processing' },
      { code: 'AGRICULTURE_STRUCT||VETERINARY_LIVESTOCK', label: 'Veterinary (Livestock)' },
    ],
  },
  {
    group: 'Storage',
    codes: [
      { code: 'STORAGE||STORAGE_SINGLE_TENANT', label: 'Storage — Single Tenant' },
      { code: 'STORAGE||STORAGE_MULTI_TENANT', label: 'Storage — Multi-Tenant' },
      { code: 'STORAGE||STORAGE_PORTABLE_BUILDING', label: 'Storage — Portable Building' },
    ],
  },
  {
    group: 'Utility / Infrastructure',
    codes: [
      { code: 'UTILITY_MISC||ENERGY_FACILITY_INFRASTRUCTURE', label: 'Energy Facility / Infrastructure' },
      { code: 'UTILITY_MISC||WATER_SANITATION_FACILITY_INFRASTRUCTURE', label: 'Water / Sanitation Facility' },
      { code: 'UTILITY_MISC||TRASH_RECYCLING_FACILITY', label: 'Trash / Recycling Facility' },
      { code: 'UTILITY_MISC||TRANSPORTATION_STATION_HUB_AREA', label: 'Transportation Station / Hub (Airport / Bus / Train)' },
    ],
  },
  {
    group: 'Roadway / Access',
    codes: [
      { code: 'ROADWAY_ACCESS||STREET', label: 'Street / Road' },
      { code: 'ROADWAY_ACCESS||HIGHWAY_INTERSTATE', label: 'Highway / Interstate' },
      { code: 'ROADWAY_ACCESS||LIMITED_ACCESS_HIGHWAY_INTERSTATE', label: 'Limited Access Highway / Interstate' },
      { code: 'ROADWAY_ACCESS||BRIDGE', label: 'Bridge' },
      { code: 'ROADWAY_ACCESS||TUNNEL', label: 'Tunnel' },
      { code: 'ROADWAY_ACCESS||RAILROAD_RAILYARD', label: 'Railroad / Railyard' },
      { code: 'ROADWAY_ACCESS||PARKING_LOT_GARAGE', label: 'Parking Lot / Parking Garage' },
      { code: 'ROADWAY_ACCESS||SIDEWALK', label: 'Sidewalk' },
    ],
  },
  {
    group: 'Outdoor',
    codes: [
      { code: 'OUTDOOR||GROUND_VACANT_LAND', label: 'Ground / Vacant Land' },
      { code: 'OUTDOOR||FOREST_GRASSLANDS_WOODLAND_WILDLAND_AREAS', label: 'Forest / Grassland / Wildland' },
      { code: 'OUTDOOR||ORCHARD_CROPS_FARMLAND', label: 'Orchard / Crops / Farmland' },
      { code: 'OUTDOOR||PLAYGROUND_PARK_RECREATIONAL_AREA', label: 'Playground / Park / Recreational Area' },
      { code: 'OUTDOOR||CAMP_SITE', label: 'Camp Site' },
      { code: 'OUTDOOR||HIKING_TRAIL', label: 'Hiking Trail' },
      { code: 'OUTDOOR||WATERFRONT', label: 'Waterfront (Beach / Dock)' },
      { code: 'OUTDOOR||OPEN_WATER', label: 'Open Water (Lake / River / Pond / Ocean)' },
    ],
  },
  {
    group: 'Outdoor Industrial',
    codes: [
      { code: 'OUTDOOR_INDUSTRIAL||CONSTRUCTION_SITE', label: 'Construction Site' },
      { code: 'OUTDOOR_INDUSTRIAL||INDUSTRIAL_YARD', label: 'Industrial Yard' },
      { code: 'OUTDOOR_INDUSTRIAL||DUMP_LANDFILL', label: 'Dump / Landfill' },
      { code: 'OUTDOOR_INDUSTRIAL||MINE', label: 'Mine / Oil Field (Non-Building)' },
    ],
  },
  {
    group: 'Unclassified',
    codes: [
      { code: 'UNCLASSIFIED||UNCLASSIFIED', label: 'Unclassified' },
    ],
  },
]

export function getPropertyUseLabel(code: string | null): string {
  if (!code) return '—'
  for (const group of NERIS_PROPERTY_USE) {
    const match = group.codes.find(c => c.code === code)
    if (match) return match.label
  }
  return code
}

// ─── Actions Taken ────────────────────────────────────────────────────────────
// Action codes confirmed from live NERIS API — pipe-delimited format same as incident types.
export const NERIS_ACTIONS_TAKEN: NerisGroup[] = [
  {
    group: 'Emergency Medical Care',
    codes: [
      { code: 'EMERGENCY_MEDICAL_CARE||PATIENT_ASSESSMENT', label: 'Patient Assessment' },
      { code: 'EMERGENCY_MEDICAL_CARE||PROVIDE_BASIC_LIFE_SUPPORT', label: 'Basic Life Support (BLS)' },
      { code: 'EMERGENCY_MEDICAL_CARE||PROVIDE_ADVANCED_LIFE_SUPPORT', label: 'Advanced Life Support (ALS)' },
      { code: 'EMERGENCY_MEDICAL_CARE||PROVIDE_TRANSPORT', label: 'Patient Transport' },
      { code: 'EMERGENCY_MEDICAL_CARE||PATIENT_REFERRAL', label: 'Patient Referral' },
    ],
  },
  {
    group: 'Command and Control',
    codes: [
      { code: 'COMMAND_AND_CONTROL||ESTABLISH_INCIDENT_COMMAND', label: 'Establish Incident Command' },
      { code: 'COMMAND_AND_CONTROL||SAFETY_OFFICER_ASSIGNED', label: 'Safety Officer Assigned' },
      { code: 'COMMAND_AND_CONTROL||ACCOUNTABILITY_OFFICER_ASSIGNED', label: 'Accountability Officer Assigned' },
      { code: 'COMMAND_AND_CONTROL||PIO_ASSIGNED', label: 'PIO Assigned' },
      { code: 'COMMAND_AND_CONTROL||NOTIFY_OTHER_AGENCIES', label: 'Notify Other Agencies' },
      { code: 'COMMAND_AND_CONTROL||INCIDENT_ASSESSMENT_COMPLETED', label: 'Incident Assessment (360°) Completed' },
    ],
  },
  {
    group: 'Suppression — Structure',
    codes: [
      { code: 'SUPPRESSION||STRUCTURAL_FIRE_SUPPRESSION||INTERIOR', label: 'Structural Fire Suppression — Interior' },
      { code: 'SUPPRESSION||STRUCTURAL_FIRE_SUPPRESSION||EXTERIOR', label: 'Structural Fire Suppression — Exterior' },
      { code: 'SUPPRESSION||STRUCTURAL_FIRE_SUPPRESSION||EXTERIOR_AND_INTERIOR', label: 'Structural Fire Suppression — Interior & Exterior' },
    ],
  },
  {
    group: 'Suppression — Outside Fire',
    codes: [
      { code: 'SUPPRESSION||OUTSIDE_FIRE_SUPPRESSION||FIRE_CONTROL_EXTINGUISHMENT', label: 'Outside Fire — Control / Extinguishment' },
      { code: 'SUPPRESSION||OUTSIDE_FIRE_SUPPRESSION||ESTABLISH_FIRE_LINES', label: 'Outside Fire — Establish Fire Lines' },
      { code: 'SUPPRESSION||OUTSIDE_FIRE_SUPPRESSION||STRUCTURE_PROTECTION', label: 'Outside Fire — Structure Protection' },
      { code: 'SUPPRESSION||OUTSIDE_FIRE_SUPPRESSION||CONFINEMENT', label: 'Outside Fire — Confinement' },
      { code: 'SUPPRESSION||OUTSIDE_FIRE_SUPPRESSION||BACKBURN', label: 'Outside Fire — Backburn' },
      { code: 'SUPPRESSION||OUTSIDE_FIRE_SUPPRESSION||FIRE_RETARDANT_DROP', label: 'Outside Fire — Fire Retardant Drop (Aircraft)' },
      { code: 'SUPPRESSION||OUTSIDE_FIRE_SUPPRESSION||WATER_DROP', label: 'Outside Fire — Water Drop (Aircraft)' },
    ],
  },
  {
    group: 'Containment',
    codes: [
      { code: 'CONTAINMENT||OUTSIDE_FIRE_SUPPRESSION||HAND_CREW_FUEL_BREAK', label: 'Hand Crew Fuel Break' },
      { code: 'CONTAINMENT||OUTSIDE_FIRE_SUPPRESSION||DOZER_FUEL_BREAK', label: 'Dozer Fuel Break' },
    ],
  },
  {
    group: 'Ventilation',
    codes: [
      { code: 'VENTILATION||VERTICAL', label: 'Vertical Ventilation' },
      { code: 'VENTILATION||HORIZONTAL', label: 'Horizontal Ventilation' },
      { code: 'VENTILATION||POSITIVE_PRESSURE', label: 'Positive Pressure Ventilation' },
      { code: 'VENTILATION||HYDRAULIC', label: 'Hydraulic Ventilation' },
    ],
  },
  {
    group: 'Search — Structure',
    codes: [
      { code: 'SEARCH_STRUCTURE||DOOR_INITIATED_SEARCH', label: 'Door-Initiated Structure Search' },
      { code: 'SEARCH_STRUCTURE||DOOR_INITIATED_SEARCH||PRIOR_TO_SUPPRESSION', label: 'Door-Initiated Search — Prior to Suppression' },
      { code: 'SEARCH_STRUCTURE||DOOR_INITIATED_SEARCH||DURING_SUPPRESSION', label: 'Door-Initiated Search — During Suppression' },
      { code: 'SEARCH_STRUCTURE||DOOR_INITIATED_SEARCH||POST_SUPPRESSION', label: 'Door-Initiated Search — Post Suppression' },
      { code: 'SEARCH_STRUCTURE||WINDOW_INITIATED_SEARCH', label: 'Window-Initiated Structure Search' },
      { code: 'SEARCH_STRUCTURE||WINDOW_INITIATED_SEARCH||PRIOR_TO_SUPPRESSION', label: 'Window-Initiated Search — Prior to Suppression' },
      { code: 'SEARCH_STRUCTURE||WINDOW_INITIATED_SEARCH||DURING_SUPPRESSION', label: 'Window-Initiated Search — During Suppression' },
      { code: 'SEARCH_STRUCTURE||WINDOW_INITIATED_SEARCH||POST_SUPPRESSION', label: 'Window-Initiated Search — Post Suppression' },
    ],
  },
  {
    group: 'Search — Non-Structure',
    codes: [
      { code: 'NON_STRUCTURE_SEARCH||SEARCH_AREA_OF_COLLAPSE', label: 'Search — Area of Collapse' },
      { code: 'NON_STRUCTURE_SEARCH||SEARCH_UNDERGROUND_INFRASTRUCTURE', label: 'Search — Underground Infrastructure' },
      { code: 'NON_STRUCTURE_SEARCH||WIDE_AREA_OUTDOOR_SEARCH', label: 'Wide Area / Outdoor Search' },
      { code: 'NON_STRUCTURE_SEARCH||SEARCH_WATERWAY', label: 'Search — Waterway' },
      { code: 'NON_STRUCTURE_SEARCH||BODY_RECOVERY', label: 'Body Recovery' },
      { code: 'NON_STRUCTURE_SEARCH||USAR_K9_SEARCH', label: 'USAR K9 Search' },
    ],
  },
  {
    group: 'Salvage and Overhaul',
    codes: [
      { code: 'SALVAGE_AND_OVERHAUL', label: 'Salvage and Overhaul' },
    ],
  },
  {
    group: 'Forcible Entry',
    codes: [
      { code: 'FORCIBLE_ENTRY', label: 'Forcible Entry' },
    ],
  },
  {
    group: 'Investigation',
    codes: [
      { code: 'INVESTIGATION', label: 'Investigation' },
    ],
  },
  {
    group: 'Hazardous Situation Mitigation',
    codes: [
      { code: 'HAZARDOUS_SITUATION_MITIGATION||TAKE_SAMPLES', label: 'Take Samples' },
      { code: 'HAZARDOUS_SITUATION_MITIGATION||ATMOSPHERIC_MONITORING_INTERIOR', label: 'Atmospheric Monitoring — Interior' },
      { code: 'HAZARDOUS_SITUATION_MITIGATION||ATMOSPHERIC_MONITORING_EXTERIOR_FENCELINE', label: 'Atmospheric Monitoring — Exterior / Fenceline' },
      { code: 'HAZARDOUS_SITUATION_MITIGATION||SPILL_CONTROL', label: 'Spill Control' },
      { code: 'HAZARDOUS_SITUATION_MITIGATION||LEAK_STOP', label: 'Leak Stop' },
      { code: 'HAZARDOUS_SITUATION_MITIGATION||REMOVE_HAZARD', label: 'Remove Hazard' },
      { code: 'HAZARDOUS_SITUATION_MITIGATION||DECONTAMINATION', label: 'Decontamination' },
    ],
  },
  {
    group: 'Personnel Contamination Reduction',
    codes: [
      { code: 'PERSONNEL_CONTAMINATION_REDUCTION||ON_SCENE_CONTAMINATION_REDUCTION', label: 'On-Scene Contamination Reduction' },
      { code: 'PERSONNEL_CONTAMINATION_REDUCTION||CLEAN_CAB_TRANSPORT', label: 'Clean Cab Transport' },
      { code: 'PERSONNEL_CONTAMINATION_REDUCTION||PPE_WASHED_POST_INCIDENT', label: 'PPE Washed Post-Incident' },
    ],
  },
  {
    group: 'Evacuation Support',
    codes: [
      { code: 'PROVIDE_EVACUATION_SUPPORT||CONNECTED_INTERIOR_SPACES', label: 'Evacuation — Connected Interior Spaces' },
      { code: 'PROVIDE_EVACUATION_SUPPORT||REMOTE_INTERIOR_SPACES', label: 'Evacuation — Remote Interior Spaces' },
      { code: 'PROVIDE_EVACUATION_SUPPORT||NEARBY_BUILDINGS', label: 'Evacuation — Nearby Buildings' },
      { code: 'PROVIDE_EVACUATION_SUPPORT||LARGE_AREA', label: 'Evacuation — Large Area' },
    ],
  },
  {
    group: 'Provide Equipment',
    codes: [
      { code: 'PROVIDE_EQUIPMENT||PROVIDE_LIGHT', label: 'Provide Light / Scene Lighting' },
      { code: 'PROVIDE_EQUIPMENT||PROVIDE_ELECTRICAL_POWER', label: 'Provide Electrical Power' },
      { code: 'PROVIDE_EQUIPMENT||PROVIDE_SPECIAL_EQUIPMENT', label: 'Provide Special Equipment' },
      { code: 'PROVIDE_EQUIPMENT||PROVIDE_DRONE_VIDEO_EQUIPMENT', label: 'Provide Drone / Video Equipment' },
    ],
  },
  {
    group: 'Provide Services',
    codes: [
      { code: 'PROVIDE_SERVICES||CONTROL_TRAFFIC', label: 'Traffic Control' },
      { code: 'PROVIDE_SERVICES||CONTROL_CROWD', label: 'Crowd Control / Scene Security' },
      { code: 'PROVIDE_SERVICES||ASSIST_UNINJURED_PERSON', label: 'Assist Uninjured Person' },
      { code: 'PROVIDE_SERVICES||ASSIST_ANIMAL', label: 'Assist Animal' },
      { code: 'PROVIDE_SERVICES||REMOVE_WATER', label: 'Remove Water' },
      { code: 'PROVIDE_SERVICES||SECURE_PROPERTY', label: 'Secure Property' },
      { code: 'PROVIDE_SERVICES||RESTORE_SPRINKLER_SYSTEM', label: 'Restore Sprinkler System' },
      { code: 'PROVIDE_SERVICES||RESTORE_RESET_ALARM_SYSTEM', label: 'Restore / Reset Alarm System' },
      { code: 'PROVIDE_SERVICES||SHUT_DOWN_ALARM', label: 'Shut Down Alarm' },
      { code: 'PROVIDE_SERVICES||SHUT_DOWN_SPRINKLER_SYSTEM', label: 'Shut Down Sprinkler System' },
      { code: 'PROVIDE_SERVICES||PROVIDE_APPARATUS_WATER', label: 'Provide Apparatus / Water' },
      { code: 'PROVIDE_SERVICES||DAMAGE_ASSESSMENT', label: 'Damage Assessment' },
    ],
  },
  {
    group: 'Information / Enforcement',
    codes: [
      { code: 'INFORMATION_ENFORCEMENT||PROVIDE_PUBLIC_INFORMATION', label: 'Provide Public Information' },
      { code: 'INFORMATION_ENFORCEMENT||REFER_TO_PROPER_AHJ', label: 'Refer to Proper AHJ' },
      { code: 'INFORMATION_ENFORCEMENT||ENFORCE_CODE_OR_LAW', label: 'Enforce Code or Law' },
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
  { code: 'MODERATE_DAMAGE', label: 'Moderate damage — possible displacement' },
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

// ─── Medical Module ───────────────────────────────────────────────────────────
// From mod_medical.csv — type_medical_patient_care, type_medical_patient_status, type_medical_transport

export const NERIS_PATIENT_EVALUATION_CARE: NerisCode[] = [
  { code: 'PATIENT_EVALUATED_CARE_PROVIDED', label: 'Patient evaluated — care provided' },
  { code: 'PATIENT_EVALUATED_REFUSED_CARE', label: 'Patient evaluated — refused care' },
  { code: 'PATIENT_EVALUATED_NO_CARE_REQUIRED', label: 'Patient evaluated — no care required' },
  { code: 'PATIENT_REFUSED_EVALUATION_CARE', label: 'Patient refused evaluation / care' },
  { code: 'PATIENT_SUPPORT_SERVICES_PROVIDED', label: 'Patient support services provided' },
]

export const NERIS_PATIENT_IMPROVED_STATUS: NerisCode[] = [
  { code: 'IMPROVED', label: 'Improved' },
  { code: 'UNCHANGED', label: 'Unchanged' },
  { code: 'WORSE', label: 'Worse' },
]

export const NERIS_MEDICAL_DISPOSITION: NerisCode[] = [
  { code: 'TRANSPORTED_ALS', label: 'Transported — ALS' },
  { code: 'TRANSPORTED_BLS', label: 'Transported — BLS' },
  { code: 'TRANSPORTED_AIR', label: 'Transported — Air Medical' },
  { code: 'TREATED_RELEASED', label: 'Treated on scene — released' },
  { code: 'TREATED_TRANSFERRED', label: 'Treated on scene — transferred to EMS' },
  { code: 'REFUSED_TRANSPORT', label: 'Refused transport / AMA' },
  { code: 'NO_TREATMENT_REQUIRED', label: 'No treatment required' },
  { code: 'DECEASED_PRIOR', label: 'Deceased prior to arrival' },
  { code: 'DECEASED_ON_SCENE', label: 'Deceased on scene' },
]

// ─── Hazmat Module ────────────────────────────────────────────────────────────
// From mod_hazard.csv — type_hazard_disposition, type_hazard_dot

export const NERIS_HAZSIT_DISPOSITION: NerisCode[] = [
  { code: 'CONTROLLED', label: 'Controlled — hazard mitigated' },
  { code: 'NOT_CONTROLLED', label: 'Not controlled — ongoing hazard' },
  { code: 'MONITORED', label: 'Monitored — no active mitigation needed' },
  { code: 'REFERRED', label: 'Referred to another agency' },
  { code: 'NO_HAZARD_FOUND', label: 'No hazard found' },
]

export const NERIS_DOT_HAZARD_CLASS: NerisCode[] = [
  { code: 'CLASS_1', label: 'Class 1 — Explosives' },
  { code: 'CLASS_2', label: 'Class 2 — Gases' },
  { code: 'CLASS_3', label: 'Class 3 — Flammable Liquids' },
  { code: 'CLASS_4', label: 'Class 4 — Flammable Solids' },
  { code: 'CLASS_5', label: 'Class 5 — Oxidizers / Organic Peroxides' },
  { code: 'CLASS_6', label: 'Class 6 — Toxic / Infectious Materials' },
  { code: 'CLASS_7', label: 'Class 7 — Radioactive Materials' },
  { code: 'CLASS_8', label: 'Class 8 — Corrosives' },
  { code: 'CLASS_9', label: 'Class 9 — Miscellaneous Hazardous Materials' },
  { code: 'NOT_REGULATED', label: 'Not DOT regulated' },
]

// ─── Fire Module — Alarm / Suppression System (structure fires) ──────────────
// Codes are best-guess based on NFIRS patterns; verify on next API submission

export const NERIS_ALARM_SYSTEM: NerisCode[] = [
  { code: 'PRESENT_OPERATED', label: 'Present — operated' },
  { code: 'PRESENT_DID_NOT_OPERATE', label: 'Present — did not operate' },
  { code: 'NOT_PRESENT', label: 'Not present' },
  { code: 'UNDETERMINED', label: 'Undetermined' },
]

// ─── Fire Module — Room of Origin, Water Supply, Investigation ───────────────
// room_of_origin_type confirmed from API validation error 2026-05-19

export const NERIS_ROOM_OF_ORIGIN: NerisCode[] = [
  { code: 'ASSEMBLY', label: 'Assembly Area' },
  { code: 'ATTIC', label: 'Attic' },
  { code: 'BALCONY_PORCH_DECK', label: 'Balcony / Porch / Deck' },
  { code: 'BASEMENT', label: 'Basement' },
  { code: 'BATHROOM', label: 'Bathroom' },
  { code: 'BEDROOM', label: 'Bedroom' },
  { code: 'GARAGE', label: 'Garage' },
  { code: 'HALLWAY_FOYER', label: 'Hallway / Foyer' },
  { code: 'KITCHEN', label: 'Kitchen' },
  { code: 'LIVING_SPACE', label: 'Living Space / Living Room' },
  { code: 'OFFICE', label: 'Office' },
  { code: 'UTILITY_ROOM', label: 'Utility Room' },
  { code: 'OTHER', label: 'Other' },
  { code: 'UNKNOWN', label: 'Unknown' },
]

// water_supply and investigation_types — codes are best-guess; verify on next API submission
// Confirmed from API validation 2026-05-19
export const NERIS_WATER_SUPPLY: NerisCode[] = [
  { code: 'HYDRANT_LESS_500', label: 'Hydrant — < 500 GPM' },
  { code: 'HYDRANT_GREATER_500', label: 'Hydrant — ≥ 500 GPM' },
  { code: 'TANK_WATER', label: 'Tank Water (On-Board)' },
  { code: 'WATER_TENDER_SHUTTLE', label: 'Water Tender Shuttle' },
  { code: 'NURSE_OTHER_APPARATUS', label: 'Nurse / Other Apparatus' },
  { code: 'DRAFT_FROM_STATIC_SOURCE', label: 'Draft from Static Source' },
  { code: 'SUPPLY_FROM_FIRE_BOAT', label: 'Supply from Fire Boat' },
  { code: 'FOAM_ADDITIVE', label: 'Foam Additive' },
  { code: 'NONE', label: 'None' },
]

// Confirmed from API validation 2026-05-19 — enum, not boolean
export const NERIS_INVESTIGATION_NEEDED: NerisCode[] = [
  { code: 'NO', label: 'No' },
  { code: 'YES', label: 'Yes' },
  { code: 'NO_CAUSE_OBVIOUS', label: 'No — Cause Obvious' },
  { code: 'NOT_EVALUATED', label: 'Not Evaluated' },
  { code: 'NOT_APPLICABLE', label: 'Not Applicable' },
  { code: 'OTHER', label: 'Other' },
]

// investigation_types — valid values TBD from next API submission
export const NERIS_INVESTIGATION_TYPES: NerisCode[] = [
  { code: 'CAUSE_AND_ORIGIN', label: 'Cause and Origin' },
  { code: 'ARSON', label: 'Arson / Suspected Arson' },
  { code: 'FIRE_MARSHAL', label: 'Fire Marshal Investigation' },
  { code: 'UNDETERMINED', label: 'Undetermined' },
]

// ─── Rescue Module ────────────────────────────────────────────────────────────
// From mod_rescue_nonff.csv — type_rescue, type_casualty, type_casualty_cause

export const NERIS_RESCUE_TYPE: NerisCode[] = [
  { code: 'FIREFIGHTER_RESCUED', label: 'Firefighter rescued by crew' },
  { code: 'FIREFIGHTER_ASSISTED_EVACUATION', label: 'Firefighter-assisted evacuation' },
  { code: 'SELF_EVACUATED', label: 'Occupant self-evacuated' },
  { code: 'NO_RESCUE', label: 'No rescue required' },
]

export const NERIS_CASUALTY_TYPE: NerisCode[] = [
  { code: 'UNINJURED', label: 'Uninjured' },
  { code: 'INJURED_NONFATALLY', label: 'Injured — nonfatally' },
  { code: 'INJURED_FATALLY', label: 'Injured — fatally' },
]

export const NERIS_CASUALTY_CAUSE: NerisCode[] = [
  { code: 'BURNS', label: 'Burns' },
  { code: 'SMOKE_INHALATION', label: 'Smoke inhalation' },
  { code: 'TRAUMA', label: 'Trauma' },
  { code: 'CARDIAC', label: 'Cardiac event' },
  { code: 'FALL', label: 'Fall' },
  { code: 'OTHER', label: 'Other' },
]

// ─── Vehicle-specific rescue fields ──────────────────────────────────────────
// Used when incident type is a motor vehicle collision / extrication

export const NERIS_VEHICLE_TYPE: NerisCode[] = [
  { code: 'PASSENGER_CAR', label: 'Passenger car' },
  { code: 'SUV_PICKUP', label: 'SUV / pickup truck' },
  { code: 'VAN', label: 'Van / minivan' },
  { code: 'MOTORCYCLE', label: 'Motorcycle / moped' },
  { code: 'COMMERCIAL_TRUCK', label: 'Commercial truck / semi' },
  { code: 'BUS', label: 'Bus / transit vehicle' },
  { code: 'RV', label: 'RV / motorhome' },
  { code: 'FARM_EQUIPMENT', label: 'Farm / off-road equipment' },
  { code: 'OTHER', label: 'Other vehicle' },
  { code: 'UNKNOWN', label: 'Unknown' },
]

export const NERIS_SAFETY_DEVICE: NerisCode[] = [
  { code: 'SEATBELT', label: 'Seatbelt worn' },
  { code: 'CHILD_RESTRAINT', label: 'Child restraint / car seat' },
  { code: 'AIRBAG_DEPLOYED', label: 'Airbag deployed' },
  { code: 'HELMET', label: 'Helmet worn' },
  { code: 'NONE', label: 'None / not worn' },
  { code: 'UNKNOWN', label: 'Unknown' },
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

// ─── Cover sheet type → human label ──────────────────────────────────────────
export const COVER_TYPE_LABEL: Record<string, string> = {
  fire: 'Fire',
  rescue: 'Rescue / EMS',
  standby: 'Service / Standby',
  mutual_aid: 'Mutual Aid',
  special: 'Special / Hazmat',
  other: 'Other',
}
