// NERIS value sets — complete lookup data from official NERIS framework CSVs.
// Source: https://github.com/ulfsri/neris-framework/tree/main/core_schemas/value_sets/csv
// NERIS uses string codes, not NFIRS numeric codes.

export type NerisCode = { code: string; label: string }
export type NerisGroup = { group: string; coverTypeFilter?: string[]; codes: NerisCode[] }

// ─── Incident Types ───────────────────────────────────────────────────────────
// Grouped by value_1 + value_2 from type_incident.csv.
// coverTypeFilter: which cover sheet incident_type values show this group by default.

export const NERIS_INCIDENT_TYPES: NerisGroup[] = [
  {
    group: 'Fire — Structure Fire',
    coverTypeFilter: ['fire'],
    codes: [
      { code: 'STRUCTURAL_INVOLVEMENT_FIRE', label: 'Structural Involvement' },
      { code: 'ROOM_AND_CONTENTS_FIRE', label: 'Room and Contents Fire' },
      { code: 'CONFINED_COOKING_APPLIANCE_FIRE', label: 'Confined Cooking / Appliance Fire' },
      { code: 'CHIMNEY_FIRE', label: 'Chimney Fire' },
    ],
  },
  {
    group: 'Fire — Transportation Fire',
    coverTypeFilter: ['fire'],
    codes: [
      { code: 'VEHICLE_FIRE_PASSENGER', label: 'Vehicle Fire — Passenger' },
      { code: 'VEHICLE_FIRE_COMMERCIAL', label: 'Vehicle Fire — Commercial' },
      { code: 'VEHICLE_FIRE_RV', label: 'Vehicle Fire — RV' },
      { code: 'VEHICLE_FIRE_FOOD_TRUCK', label: 'Vehicle Fire — Food Truck' },
      { code: 'POWERED_MOBILITY_DEVICE_FIRE', label: 'Powered Mobility Device Fire' },
      { code: 'BOAT_PERSONAL_WATERCRAFT_BARGE_FIRE', label: 'Boat / Personal Watercraft / Barge Fire' },
      { code: 'TRAIN_RAIL_FIRE', label: 'Train / Rail Fire' },
      { code: 'AIRCRAFT_FIRE', label: 'Aircraft Emergency' },
    ],
  },
  {
    group: 'Fire — Outside Fire',
    coverTypeFilter: ['fire'],
    codes: [
      { code: 'VEGETATION_GRASS_FIRE', label: 'Vegetation / Grass Fire' },
      { code: 'WILDFIRE_WILDLAND', label: 'Wildfire — Wildland' },
      { code: 'WILDFIRE_URBAN_INTERFACE', label: 'Wildfire — Urban Interface' },
      { code: 'TRASH_RUBBISH_FIRE', label: 'Trash / Rubbish Fire' },
      { code: 'DUMPSTER_OUTDOOR_CONTAINER_FIRE', label: 'Dumpster / Other Outdoor Container Fire' },
      { code: 'CONSTRUCTION_WASTE', label: 'Construction Waste Fire' },
      { code: 'OUTSIDE_TANK_FIRE', label: 'Outside Tank Fire' },
      { code: 'UTILITY_INFRASTRUCTURE_FIRE', label: 'Utility Infrastructure Fire' },
      { code: 'OTHER_OUTSIDE_FIRE', label: 'Other Outside Fire' },
    ],
  },
  {
    group: 'Fire — Special Fire',
    coverTypeFilter: ['fire'],
    codes: [
      { code: 'EXPLOSION', label: 'Explosion' },
      { code: 'ESS_FIRE', label: 'ESS Fire (Energy Storage System)' },
      { code: 'INFRASTRUCTURE_FIRE', label: 'Infrastructure Fire (Tunnel / Bridge)' },
    ],
  },
  {
    group: 'Hazardous Situation — Non-Chemical',
    coverTypeFilter: ['special', 'rescue'],
    codes: [
      { code: 'MOTOR_VEHICLE_COLLISION', label: 'Motor Vehicle Collision' },
      { code: 'ELEC_POWER_LINE_DOWN_ARCHING_MALFUNC', label: 'Electrical Power Line Down / Arching / Malfunction' },
      { code: 'ELEC_HAZARD_SHORT_CIRCUIT', label: 'Electrical Hazard / Short Circuit' },
      { code: 'BOMB_THREAT_RESPONSE_SUSPICIOUS_PACKAGE', label: 'Bomb Threat / Response / Suspicious Package' },
    ],
  },
  {
    group: 'Hazardous Situation — Hazardous Materials',
    coverTypeFilter: ['special'],
    codes: [
      { code: 'GAS_LEAK_ODOR', label: 'Gas Leak / Gas Odor' },
      { code: 'FUEL_SPILL_ODOR', label: 'Fuel Spill / Fuel Odor' },
      { code: 'CARBON_MONOXIDE_RELEASE', label: 'Carbon Monoxide Release' },
      { code: 'HAZMAT_RELEASE_TRANSPORT', label: 'Hazardous Material Release — Transportation' },
      { code: 'HAZMAT_RELEASE_FACILITY', label: 'Hazardous Material Release — Fixed Facility' },
      { code: 'BIOLOGICAL_RELEASE_INCIDENT', label: 'Biological Release / Incident' },
      { code: 'RADIOACTIVE_RELEASE_INCIDENT', label: 'Radioactive Release / Incident' },
    ],
  },
  {
    group: 'Hazardous Situation — Overpressure',
    coverTypeFilter: ['special'],
    codes: [
      { code: 'RUPTURE_WITHOUT_FIRE', label: 'Rupture Without Fire' },
      { code: 'NO_RUPTURE', label: 'No Rupture' },
    ],
  },
  {
    group: 'Hazardous Situation — Investigation',
    coverTypeFilter: ['special', 'other'],
    codes: [
      { code: 'ODOR', label: 'Odor Investigation' },
      { code: 'SMOKE_INVESTIGATION', label: 'Smoke Investigation' },
    ],
  },
  {
    group: 'Medical — Illness',
    coverTypeFilter: ['rescue'],
    codes: [
      { code: 'CARDIAC_ARREST', label: 'Cardiac Arrest' },
      { code: 'CHEST_PAIN_NON_TRAUMA', label: 'Chest Pain (Non-Trauma)' },
      { code: 'BREATHING_PROBLEMS', label: 'Breathing Problems' },
      { code: 'STROKE_CVA', label: 'Stroke / CVA' },
      { code: 'ALTERED_MENTAL_STATUS', label: 'Altered Mental Status' },
      { code: 'UNCONSCIOUS_VICTIM', label: 'Unconscious Victim' },
      { code: 'CONVULSIONS_SEIZURES', label: 'Convulsions / Seizures' },
      { code: 'DIABETIC_PROBLEMS', label: 'Diabetic Problems' },
      { code: 'ALLERGIC_REACTION_STINGS', label: 'Allergic Reaction / Stings' },
      { code: 'ABDOMINAL_PAIN', label: 'Abdominal Pain / Problems' },
      { code: 'BACK_PAIN_NON_TRAUMA', label: 'Back Pain (Non-Trauma)' },
      { code: 'HEADACHE', label: 'Headache' },
      { code: 'HEART_PROBLEMS', label: 'Heart Problems' },
      { code: 'NAUSEA_VOMITING', label: 'Nausea / Vomiting' },
      { code: 'OVERDOSE', label: 'Overdose / Poisoning' },
      { code: 'PSYCHOLOGICAL_BEHAVIOR_ISSUES', label: 'Psychological / Behavioral Issues' },
      { code: 'PREGNANCY_CHILDBIRTH', label: 'Pregnancy / Childbirth' },
      { code: 'PANDEMIC_EPIDEMIC_OUTBREAK', label: 'Pandemic / Epidemic / Outbreak' },
      { code: 'SICK_CASE', label: 'Sick Case (General)' },
      { code: 'WELL_PERSON_CHECK', label: 'Well Person Check' },
      { code: 'UNKNOWN_PROBLEM', label: 'Unknown Problem' },
      { code: 'NO_APPROPRIATE_CHOICE', label: 'No Appropriate Choice' },
    ],
  },
  {
    group: 'Medical — Injury / Trauma',
    coverTypeFilter: ['rescue'],
    codes: [
      { code: 'MOTOR_VEHICLE_COLLISION', label: 'Motor Vehicle Collision' },
      { code: 'FALL', label: 'Fall' },
      { code: 'HEMORRHAGE_LACERATION', label: 'Hemorrhage / Laceration' },
      { code: 'GUNSHOT_WOUND', label: 'Gunshot Wound' },
      { code: 'STAB_PENETRATING_TRAUMA', label: 'Stab / Penetrating Trauma' },
      { code: 'ASSAULT', label: 'Assault' },
      { code: 'BURNS_EXPLOSION', label: 'Burns / Explosion' },
      { code: 'CARBON_MONOXIDE_OTHER_INHALATION_INJURY', label: 'Carbon Monoxide / Inhalation Injury' },
      { code: 'CHOKING', label: 'Choking' },
      { code: 'DROWNING_DIVING_SCUBA_ACCIDENT', label: 'Drowning / Diving / SCUBA Accident' },
      { code: 'ELECTROCUTION', label: 'Electrocution' },
      { code: 'EYE_TRAUMA', label: 'Eye Trauma' },
      { code: 'HEAT_COLD_EXPOSURE', label: 'Heat / Cold Exposure' },
      { code: 'INDUSTRIAL_INACCESSIBLE_ENTRAPMENT', label: 'Industrial / Entrapment (Non-Vehicle)' },
      { code: 'ANIMAL_BITES', label: 'Animal Bites' },
      { code: 'POISONING', label: 'Poisoning' },
      { code: 'OTHER_TRAUMATIC_INJURY', label: 'Other Traumatic Injury' },
    ],
  },
  {
    group: 'Medical — Other',
    coverTypeFilter: ['rescue'],
    codes: [
      { code: 'MEDICAL_ALARM', label: 'Medical Alarm' },
      { code: 'TRANSFER_INTERFACILITY', label: 'Transfer / Interfacility' },
      { code: 'AIRMEDICAL_TRANSPORT', label: 'Airmedical Transport' },
      { code: 'INTERCEPT_OTHER_UNIT', label: 'Intercept Other Unit' },
      { code: 'STANDBY_REQUEST', label: 'Standby Request' },
      { code: 'HEALTHCARE_PROFESSIONAL_ADMISSION', label: 'Healthcare Professional Admission' },
      { code: 'COMMUNITY_PUBLIC_HEALTH', label: 'Community / Public Health' },
    ],
  },
  {
    group: 'Rescue — Outside',
    coverTypeFilter: ['rescue'],
    codes: [
      { code: 'EXTRICATION_ENTRAPPED', label: 'Extrication / Entrapped' },
      { code: 'HIGH_ANGLE_RESCUE', label: 'High Angle Rescue' },
      { code: 'LOW_ANGLE_RESCUE', label: 'Low Angle Rescue' },
      { code: 'STEEP_ANGLE_RESCUE', label: 'Steep Angle Rescue' },
      { code: 'CONFINED_SPACE_RESCUE', label: 'Confined Space Rescue' },
      { code: 'TRENCH', label: 'Trench Rescue' },
      { code: 'BACKOUNTRY_RESCUE', label: 'Backcountry Rescue' },
      { code: 'LIMITED_NO_ACCESS', label: 'Limited / No Access' },
    ],
  },
  {
    group: 'Rescue — Structure',
    coverTypeFilter: ['rescue'],
    codes: [
      { code: 'BUILDING_STRUCTURE_COLLAPSE', label: 'Building / Structure Collapse' },
      { code: 'ELEVATOR_ESCALATOR_RESCUE', label: 'Elevator / Escalator Rescue' },
      { code: 'CONFINED_SPACE_RESCUE', label: 'Confined Space Rescue' },
      { code: 'EXTRICATION_ENTRAPPED', label: 'Extrication / Entrapped' },
    ],
  },
  {
    group: 'Rescue — Transportation',
    coverTypeFilter: ['rescue'],
    codes: [
      { code: 'MOTOR_VEHICLE_EXTRICATION_ENTRAPPED', label: 'Motor Vehicle Collision Extrication / Entrapment' },
      { code: 'TRAIN_RAIL_COLLISION_DERAILMENT', label: 'Train / Rail Collision or Derailment' },
      { code: 'AVIATION_COLLISION_CRASH', label: 'Aviation Collision / Crash' },
      { code: 'AVIATION_STANDBY', label: 'Aviation Standby' },
    ],
  },
  {
    group: 'Rescue — Water',
    coverTypeFilter: ['rescue'],
    codes: [
      { code: 'PERSON_IN_WATER_STANDING', label: 'Person in Water — Standing Water / Lake' },
      { code: 'PERSON_IN_WATER_SWIFTWATER', label: 'Person in Water — Swiftwater / River' },
      { code: 'WATERCRAFT_IN_DISTRESS', label: 'Watercraft in Distress' },
    ],
  },
  {
    group: 'Public Service — Citizen Assist',
    coverTypeFilter: ['standby', 'mutual_aid', 'other'],
    codes: [
      { code: 'CITIZEN_ASSIST_SERVICE_CALL', label: 'Citizen Assist / Service Call' },
      { code: 'PERSON_IN_DISTRESS', label: 'Person in Distress' },
      { code: 'LOST_PERSON', label: 'Lost Person' },
      { code: 'LIFT_ASSIST', label: 'Lift Assist' },
    ],
  },
  {
    group: 'Public Service — Alarms',
    coverTypeFilter: ['standby', 'other'],
    codes: [
      { code: 'FIRE_ALARM', label: 'Fire / Smoke Alarm' },
      { code: 'CO_ALARM', label: 'CO Alarm' },
      { code: 'GAS_ALARM', label: 'Gas Alarm' },
      { code: 'OTHER_ALARM', label: 'Other Alarm' },
    ],
  },
  {
    group: 'Public Service — Disaster / Weather',
    coverTypeFilter: ['standby', 'special', 'other'],
    codes: [
      { code: 'WEATHER_RESPONSE', label: 'Weather Response' },
      { code: 'DAMAGE_ASSESSMENT', label: 'Damage Assessment' },
    ],
  },
  {
    group: 'Public Service — Other',
    coverTypeFilter: ['standby', 'mutual_aid', 'other'],
    codes: [
      { code: 'STANDBY', label: 'Standby' },
      { code: 'MOVE_UP', label: 'Move-up / Cover Assignment' },
      { code: 'DAMAGED_HYDRANT', label: 'Damaged Hydrant' },
    ],
  },
  {
    group: 'No Emergency — False Alarm',
    coverTypeFilter: ['other'],
    codes: [
      { code: 'MALFUNCTIONING_ALARM', label: 'Malfunctioning Alarm' },
      { code: 'ACCIDENTAL_ALARM', label: 'Accidental Alarm' },
      { code: 'INTENTIONAL_FALSE_ALARM', label: 'Intentional False Alarm' },
      { code: 'BOMB_SCARE', label: 'Bomb Scare' },
      { code: 'OTHER_FALSE_CALL', label: 'Other False Call' },
    ],
  },
  {
    group: 'No Emergency — Good Intent',
    coverTypeFilter: ['other', 'standby'],
    codes: [
      { code: 'NO_INCIDENT_FOUND_LOCATION_ERROR', label: 'No Incident Found / Location Error' },
      { code: 'SMOKE_FROM_NONHOSTILE_SOURCE', label: 'Smoke from Nonhostile Source' },
      { code: 'CONTROLLED_BURNING_AUTHORIZED', label: 'Controlled Burning (Authorized)' },
      { code: 'INVESTIGATE_HAZARDOUS_RELEASE', label: 'Investigate Hazardous Release — Nothing Found' },
    ],
  },
  {
    group: 'No Emergency — Cancelled',
    coverTypeFilter: ['other', 'standby'],
    codes: [
      { code: 'CANCELLED', label: 'Cancelled / Dispatched and Cancelled En Route' },
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
      { code: 'DETATCHED_SINGLE_FAMILY_DWELLING', label: 'Detached Single Family Dwelling' },
      { code: 'ATTACHED_SINGLE_FAMILY_DWELLING', label: 'Attached Single Family Dwelling' },
      { code: 'MULTI_FAMILY_LOWRISE_DWELLING', label: 'Multi-Family Low-Rise (≤4 Stories)' },
      { code: 'MULTI_FAMILY_MIDRISE_DWELLING', label: 'Multi-Family Mid-Rise (5–8 Stories)' },
      { code: 'MULTI_FAMILY_HIGHRISE_DWELLING', label: 'Multi-Family High-Rise (≥9 Stories)' },
      { code: 'MANUFACTURED_MOBILE_HOME', label: 'Manufactured / Mobile Home' },
      { code: 'TEMPORARY_LODGING_HOTEL_MOTEL', label: 'Hotel / Motel / Temporary Lodging' },
      { code: 'CONGREGATE_HOUSING', label: 'Congregate Housing (Dorms / Boarding)' },
      { code: 'UNHOUSED_TEMPORARY_SHELTER', label: 'Unhoused / Temporary Shelter' },
      { code: 'DETATCHED_GARAGE', label: 'Detached Garage' },
    ],
  },
  {
    group: 'Assembly',
    codes: [
      { code: 'RELIGIOUS', label: 'Religious (Church / Mosque / Synagogue)' },
      { code: 'COMMUNITY_CENTER', label: 'Community Center' },
      { code: 'CONVENTION_CENTER', label: 'Convention Center' },
      { code: 'INDOOR_ARENA', label: 'Indoor Arena' },
      { code: 'OUTDOOR_ARENA_AMPHITHEATER_PARK', label: 'Outdoor Arena / Amphitheater / Amusement Park' },
      { code: 'TEMP_OUTDOOR_STRUCT_EVENT', label: 'Temporary Outdoor Structure / Event' },
      { code: 'MUSEUM_EXHIBIT_HALL_LIBRARY', label: 'Museum / Exhibit Hall / Library' },
    ],
  },
  {
    group: 'Commercial',
    codes: [
      { code: 'RESTAURANT_CAFE', label: 'Restaurant / Cafe' },
      { code: 'BAR_NIGHTCLUB', label: 'Bar / Nightclub' },
      { code: 'RETAIL_WHOLESALE_TRADE', label: 'Retail / Wholesale / Trade' },
      { code: 'OFFICE_OTHER_TECHNICAL_SERVICES', label: 'Office / Technical Services' },
      { code: 'ENTERTAINMENT_RECREATION', label: 'Entertainment / Recreation' },
      { code: 'THEATERS_STUDIO', label: 'Theater / Studio' },
      { code: 'VEHICLE_REPAIR_SERVICES', label: 'Vehicle Repair Services' },
      { code: 'VEHICLE_FUELING_CHARGING_STATION', label: 'Vehicle Fueling / Charging Station' },
      { code: 'VETERINARY_PET', label: 'Veterinary (Pet)' },
    ],
  },
  {
    group: 'Education',
    codes: [
      { code: 'K_12_SCHOOLS', label: 'K–12 Schools' },
      { code: 'PREK_DAYCARE', label: 'Pre-K / Day Care' },
      { code: 'COLLEGES_UNIVERSITIES', label: 'Colleges / Universities' },
      { code: 'OTHER_EDUCATIONAL_BUILDINGS', label: 'Other Educational Buildings' },
    ],
  },
  {
    group: 'Health Care',
    codes: [
      { code: 'HOSPITAL_24_HOUR_MEDICAL_FACILITIES', label: 'Hospital / 24-Hour Medical Facility' },
      { code: 'NURSING_HOME_ASSISTED_LIVING_RESIDENCE_ONSITE', label: 'Nursing Home / Assisted Living' },
      { code: 'MEDICAL_OFFICE_CLINIC', label: 'Medical Office / Clinic' },
      { code: 'ALCOHOL_DRUG_REHABILITATION_CENTER', label: 'Alcohol / Drug Rehabilitation Center' },
    ],
  },
  {
    group: 'Government',
    codes: [
      { code: 'FIRE_MEDICAL_STATION', label: 'Fire Station / Medical Response Station' },
      { code: 'POLICE_EMERGENCY_STATION', label: 'Police Station / Emergency Response' },
      { code: 'JAIL_PRISON_REFORMATORY', label: 'Jail / Prison / Reformatory' },
      { code: 'GENERAL_SERVICES', label: 'Government General Services' },
      { code: 'NON_CIVILIAN_STRUCTURES', label: 'Non-Civilian / Military Structures' },
    ],
  },
  {
    group: 'Industrial',
    codes: [
      { code: 'LIGHT', label: 'Light Industrial' },
      { code: 'HEAVY', label: 'Heavy Industrial' },
      { code: 'CHEMICAL', label: 'Chemical Industrial' },
      { code: 'FOOD_DRUGS', label: 'Food / Drug Manufacturing' },
      { code: 'METALS_MINERALS_PROCESSING', label: 'Metals / Minerals Processing' },
      { code: 'COLD_STORAGE', label: 'Cold Storage' },
    ],
  },
  {
    group: 'Agriculture',
    codes: [
      { code: 'FARM_BUILDING', label: 'Farm Building' },
      { code: 'STORAGE_SILO', label: 'Crop / Product Storage / Silo' },
      { code: 'AUCTION_FEEDLOT', label: 'Auction / Feedlot' },
      { code: 'ANIMAL_PROCESSING', label: 'Animal Processing' },
      { code: 'VETERINARY_LIVESTOCK', label: 'Veterinary (Livestock)' },
    ],
  },
  {
    group: 'Storage',
    codes: [
      { code: 'STORAGE_SINGLE_TENANT', label: 'Storage — Single Tenant' },
      { code: 'STORAGE_MULTI_TENANT', label: 'Storage — Multi-Tenant' },
      { code: 'STORAGE_PORTABLE_BUILDING', label: 'Storage — Portable Building' },
    ],
  },
  {
    group: 'Utility / Infrastructure',
    codes: [
      { code: 'ENERGY_FACILITY_INFRASTRUCTURE', label: 'Energy Facility / Infrastructure' },
      { code: 'WATER_SANITATION_FACILITY_INFRASTRUCTURE', label: 'Water / Sanitation Facility' },
      { code: 'TRASH_RECYCLING_FACILITY', label: 'Trash / Recycling Facility' },
      { code: 'TRANSPORTATION_STATION_HUB_AREA', label: 'Transportation Station / Hub (Airport / Bus / Train)' },
    ],
  },
  {
    group: 'Roadway / Access',
    codes: [
      { code: 'STREET', label: 'Street / Road' },
      { code: 'HIGHWAY_INTERSTATE', label: 'Highway / Interstate' },
      { code: 'LIMITED_ACCESS_HIGHWAY_INTERSTATE', label: 'Limited Access Highway / Interstate' },
      { code: 'BRIDGE', label: 'Bridge' },
      { code: 'TUNNEL', label: 'Tunnel' },
      { code: 'RAILROAD_RAILYARD', label: 'Railroad / Railyard' },
      { code: 'PARKING_LOT_GARAGE', label: 'Parking Lot / Parking Garage' },
      { code: 'SIDEWALK', label: 'Sidewalk' },
    ],
  },
  {
    group: 'Outdoor',
    codes: [
      { code: 'GROUND_VACANT_LAND', label: 'Ground / Vacant Land' },
      { code: 'FOREST_GRASSLANDS_WOODLAND_WILDLAND_AREAS', label: 'Forest / Grassland / Wildland' },
      { code: 'ORCHARD_CROPS_FARMLAND', label: 'Orchard / Crops / Farmland' },
      { code: 'PLAYGROUND_PARK_RECREATIONAL_AREA', label: 'Playground / Park / Recreational Area' },
      { code: 'CAMP_SITE', label: 'Camp Site' },
      { code: 'HIKING_TRAIL', label: 'Hiking Trail' },
      { code: 'WATERFRONT', label: 'Waterfront (Beach / Dock)' },
      { code: 'OPEN_WATER', label: 'Open Water (Lake / River / Pond / Ocean)' },
    ],
  },
  {
    group: 'Outdoor Industrial',
    codes: [
      { code: 'CONSTRUCTION_SITE', label: 'Construction Site' },
      { code: 'INDUSTRIAL_YARD', label: 'Industrial Yard' },
      { code: 'DUMP_LANDFILL', label: 'Dump / Landfill' },
      { code: 'MINE', label: 'Mine / Oil Field (Non-Building)' },
    ],
  },
  {
    group: 'Unclassified',
    codes: [
      { code: 'UNCLASSIFIED', label: 'Unclassified' },
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
// From type_action_tactic.csv — code = value_2 (or value_1 if no value_2).
// Sub-variants (value_3) collapsed into parent where granularity not needed.

export const NERIS_ACTIONS_TAKEN: NerisGroup[] = [
  {
    group: 'Emergency Medical Care',
    codes: [
      { code: 'PATIENT_ASSESSMENT', label: 'Patient Assessment' },
      { code: 'PROVIDE_BASIC_LIFE_SUPPORT', label: 'Basic Life Support (BLS)' },
      { code: 'PROVIDE_ADVANCED_LIFE_SUPPORT', label: 'Advanced Life Support (ALS)' },
      { code: 'PROVIDE_TRANSPORT', label: 'Patient Transport' },
      { code: 'PATIENT_REFERRAL', label: 'Patient Referral' },
    ],
  },
  {
    group: 'Command and Control',
    codes: [
      { code: 'ESTABLISH_INCIDENT_COMMAND', label: 'Establish Incident Command' },
      { code: 'SAFETY_OFFICER_ASSIGNED', label: 'Safety Officer Assigned' },
      { code: 'ACCOUNTABILITY_OFFICER_ASSIGNED', label: 'Accountability Officer Assigned' },
      { code: 'PIO_ASSIGNED', label: 'PIO Assigned' },
      { code: 'NOTIFY_OTHER_AGENCIES', label: 'Notify Other Agencies' },
      { code: 'INCIDENT_ASSESSMENT_COMPLETED', label: 'Incident Assessment (360°) Completed' },
    ],
  },
  {
    group: 'Suppression',
    codes: [
      { code: 'STRUCTURAL_FIRE_SUPPRESSION.INTERIOR', label: 'Structural Fire Suppression — Interior' },
      { code: 'STRUCTURAL_FIRE_SUPPRESSION.EXTERIOR', label: 'Structural Fire Suppression — Exterior' },
      { code: 'STRUCTURAL_FIRE_SUPPRESSION.EXTERIOR_AND_INTERIOR', label: 'Structural Fire Suppression — Interior & Exterior' },
      { code: 'OUTSIDE_FIRE_SUPPRESSION.FIRE_CONTROL_EXTINGUISHMENT', label: 'Outside Fire — Control / Extinguishment' },
      { code: 'OUTSIDE_FIRE_SUPPRESSION.ESTABLISH_FIRE_LINES', label: 'Outside Fire — Establish Fire Lines' },
      { code: 'OUTSIDE_FIRE_SUPPRESSION.STRUCTURE_PROTECTION', label: 'Outside Fire — Structure Protection' },
      { code: 'OUTSIDE_FIRE_SUPPRESSION.CONFINEMENT', label: 'Outside Fire — Confinement' },
      { code: 'OUTSIDE_FIRE_SUPPRESSION.BACKBURN', label: 'Outside Fire — Backburn' },
      { code: 'OUTSIDE_FIRE_SUPPRESSION.FIRE_RETARDANT_DROP', label: 'Outside Fire — Fire Retardant Drop (Aircraft)' },
      { code: 'OUTSIDE_FIRE_SUPPRESSION.WATER_DROP', label: 'Outside Fire — Water Drop (Aircraft)' },
    ],
  },
  {
    group: 'Containment',
    codes: [
      { code: 'HAND_CREW_FUEL_BREAK', label: 'Hand Crew Fuel Break' },
      { code: 'DOZER_FUEL_BREAK', label: 'Dozer Fuel Break' },
    ],
  },
  {
    group: 'Ventilation',
    codes: [
      { code: 'VERTICAL', label: 'Vertical Ventilation' },
      { code: 'HORIZONTAL', label: 'Horizontal Ventilation' },
      { code: 'POSITIVE_PRESSURE', label: 'Positive Pressure Ventilation' },
      { code: 'HYDRAULIC', label: 'Hydraulic Ventilation' },
    ],
  },
  {
    group: 'Search',
    codes: [
      { code: 'DOOR_INITIATED_SEARCH', label: 'Door-Initiated Structure Search' },
      { code: 'WINDOW_INITIATED_SEARCH', label: 'Window-Initiated Structure Search' },
      { code: 'SEARCH_AREA_OF_COLLAPSE', label: 'Search — Area of Collapse' },
      { code: 'SEARCH_UNDERGROUND_INFRASTRUCTURE', label: 'Search — Underground Infrastructure' },
      { code: 'WIDE_AREA_OUTDOOR_SEARCH', label: 'Wide Area / Outdoor Search' },
      { code: 'SEARCH_WATERWAY', label: 'Search — Waterway' },
      { code: 'BODY_RECOVERY', label: 'Body Recovery' },
      { code: 'USAR_K9_SEARCH', label: 'USAR K9 Search' },
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
      { code: 'TAKE_SAMPLES', label: 'Take Samples' },
      { code: 'ATMOSPHERIC_MONITORING_INTERIOR', label: 'Atmospheric Monitoring — Interior' },
      { code: 'ATMOSPHERIC_MONITORING_EXTERIOR_FENCELINE', label: 'Atmospheric Monitoring — Exterior / Fenceline' },
      { code: 'SPILL_CONTROL', label: 'Spill Control' },
      { code: 'LEAK_STOP', label: 'Leak Stop' },
      { code: 'REMOVE_HAZARD', label: 'Remove Hazard' },
      { code: 'DECONTAMINATION', label: 'Decontamination' },
    ],
  },
  {
    group: 'Personnel Contamination Reduction',
    codes: [
      { code: 'ON_SCENE_CONTAMINATION_REDUCTION', label: 'On-Scene Contamination Reduction' },
      { code: 'CLEAN_CAB_TRANSPORT', label: 'Clean Cab Transport' },
      { code: 'PPE_WASHED_POST_INCIDENT', label: 'PPE Washed Post-Incident' },
    ],
  },
  {
    group: 'Evacuation',
    codes: [
      { code: 'EVACUATION_CONNECTED_INTERIOR', label: 'Evacuation — Connected Interior Spaces' },
      { code: 'EVACUATION_REMOTE_INTERIOR', label: 'Evacuation — Remote Interior Spaces' },
      { code: 'EVACUATION_NEARBY_BUILDINGS', label: 'Evacuation — Nearby Buildings' },
      { code: 'EVACUATION_LARGE_AREA', label: 'Evacuation — Large Area' },
    ],
  },
  {
    group: 'Provide Equipment',
    codes: [
      { code: 'PROVIDE_LIGHT', label: 'Provide Light / Scene Lighting' },
      { code: 'PROVIDE_ELECTRICAL_POWER', label: 'Provide Electrical Power' },
      { code: 'PROVIDE_SPECIAL_EQUIPMENT', label: 'Provide Special Equipment' },
      { code: 'PROVIDE_DRONE_VIDEO_EQUIPMENT', label: 'Provide Drone / Video Equipment' },
    ],
  },
  {
    group: 'Provide Services',
    codes: [
      { code: 'CONTROL_TRAFFIC', label: 'Traffic Control' },
      { code: 'CONTROL_CROWD', label: 'Crowd Control / Scene Security' },
      { code: 'ASSIST_UNINJURED_PERSON', label: 'Assist Uninjured Person' },
      { code: 'ASSIST_ANIMAL', label: 'Assist Animal' },
      { code: 'REMOVE_WATER', label: 'Remove Water' },
      { code: 'SECURE_PROPERTY', label: 'Secure Property' },
      { code: 'RESTORE_SPRINKLER_SYSTEM', label: 'Restore Sprinkler System' },
      { code: 'RESTORE_RESET_ALARM_SYSTEM', label: 'Restore / Reset Alarm System' },
      { code: 'SHUT_DOWN_ALARM', label: 'Shut Down Alarm' },
      { code: 'SHUT_DOWN_SPRINKLER_SYSTEM', label: 'Shut Down Sprinkler System' },
      { code: 'PROVIDE_APPARATUS_WATER', label: 'Provide Apparatus / Water' },
      { code: 'DAMAGE_ASSESSMENT', label: 'Damage Assessment' },
    ],
  },
  {
    group: 'Information / Enforcement',
    codes: [
      { code: 'PROVIDE_PUBLIC_INFORMATION', label: 'Provide Public Information' },
      { code: 'REFER_TO_PROPER_AHJ', label: 'Refer to Proper AHJ' },
      { code: 'ENFORCE_CODE_OR_LAW', label: 'Enforce Code or Law' },
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
