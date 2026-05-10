# NERIS Compliance Reference

**Current build status:** Partially unblocked. FireOps7 has NERIS test vendor access, but certified auth mode and enrollment are still pending FSRI confirmation. Keep API auth isolated so Basic vs OAuth is a small env/config change.

**Source:** https://github.com/ulfsri/neris-framework
**API (Production):** https://api.neris.fsri.org/v1 — Swagger: /docs | Redoc: /redoc
**API (Test):** https://api-test.neris.fsri.org/v1
**Helpdesk:** https://neris.atlassian.net/servicedesk/customer/portals

---

## What NERIS Is

NERIS (National Emergency Response Information System) is replacing NFIRS as the national fire incident reporting standard. Departments submit incident data via REST API. Third-party software like FireOps7 can integrate directly. Most fields are submitted by the dept/vendor; some (`computed: true`) are auto-populated by NERIS from geographic data.

---

## Incident Modules

Schema files live in `/core_schemas/modules/csv/incident/` in the repo. Modules are conditional — only the relevant ones activate per incident type.

| Module File | When Active |
|---|---|
| `core_mod_incident.csv` | Every incident |
| `mod_fire.csv` | Incident type includes fire |
| `mod_medical.csv` | Medical incidents |
| `mod_rescue_ff.csv` | FF rescue involved |
| `mod_rescue_nonff.csv` | Civilian rescue involved |
| `mod_hazard.csv` | Hazmat incidents |
| `mod_exposure.csv` | Exposures |
| `mod_emerging_hazard.csv` | EV/solar/emerging hazards |
| `mod_risk_reduction.csv` | Risk reduction activities |

---

## Incident Type Codes

NERIS uses numeric codes from `type_incident.csv` (similar to NFIRS). FireOps7 currently uses fire/rescue/standby/mutual_aid/special/other — these need to map to NERIS codes.

| Category | Codes |
|---|---|
| Structure Fire | 111–123 |
| Transportation Fire | 130–138 |
| Outside Fire | 140–173 |
| Rescue / EMS | 300–365 |
| Hazmat | 400–431 |
| Public Service / Assist | 480–555 |
| Good Intent (cancelled, wrong location) | 600–672 |
| False Alarm / Alarm System | 641, 700–751 |
| Disaster / Weather | 800–815 |

---

## Gap Analysis — FireOps7 vs NERIS Core Fields

| Field | FireOps7 Now | NERIS Requirement |
|---|---|---|
| Incident type | fire/rescue/standby/mutual_aid/special/other | Numeric code from `type_incident.csv` |
| Address | Text field | Text + WGS84 lat/lng (NERIS geocodes if coords not submitted) |
| Property use | ❌ Missing | Code from `type_location_use.csv` |
| Actions taken | ❌ Missing | Multi-select from `type_action_tactic.csv` |
| Mutual aid | Direction + dept name | `type_aid.csv` + `type_aid_direction.csv` codes |
| Displaced persons | ❌ Missing | Integer count |
| Apparatus / units | ✅ With timestamps | Also needs response mode (`type_response_mode.csv`) |
| Narrative | ✅ Text | Same |
| Fire module fields | Basic (cause, dollar loss, injuries) | Arrival condition, building damage, suppression method, floor/room of origin |
| NERIS submitted flag | ✅ `neris_reported` checkbox | Replace with actual API submission confirmation |

---

## Key Value Set Files (dropdowns to build)

All live in `/core_schemas/value_sets/csv/` in the repo.

| File | Used For |
|---|---|
| `type_incident.csv` | Incident type codes |
| `type_location_use.csv` | Property use (residential, commercial, etc.) |
| `type_action_tactic.csv` | Actions taken on scene |
| `type_aid.csv` | Aid type |
| `type_aid_direction.csv` | Aid given vs received |
| `type_fire_cause_in.csv` | Inside fire cause |
| `type_fire_cause_out.csv` | Outside fire cause |
| `type_fire_condition_arrival.csv` | Fire conditions on arrival |
| `type_fire_bldg_damage.csv` | Building damage extent |
| `type_suppress_appliance.csv` | Suppression method/appliance |
| `type_response_mode.csv` | Emergency vs non-emergency response |
| `type_casualty.csv` | Casualty type |
| `type_casualty_cause.csv` | Cause of casualty |

---

## Build Plan

1. **Download value set CSVs** — seed key ones into a static lookup file or `neris_value_sets` table
2. **Replace incident type dropdown** — NERIS numeric codes with friendly labels; keep current type as a fallback mapping
3. **Add property use field** — required for most incidents, dropdown from `type_location_use.csv`
4. **Add actions taken** — multi-select from `type_action_tactic.csv`
5. **Add displaced persons count** — integer field
6. **Expand fire module** — match `mod_fire.csv`: arrival condition, building damage, suppression details, floor/room of origin
7. **Add NERIS API submission** — POST to `api.neris.fsri.org/v1`, replace `neris_reported` checkbox with actual confirmation
8. **Nebraska-specific** — check with Nebraska State Fire Marshal for any state-layer requirements on top of NERIS core

---

## Vendor Integration Architecture

NERIS uses a two-sided enrollment model — FireOps7 is the **vendor**, departments are the **enrollers**.

### Step 1 — FireOps7 gets a Vendor Client ID (one-time)
- Register FireOps7 as a vendor with FSRI via the helpdesk: https://neris.atlassian.net/servicedesk/customer/portals
- **✅ DONE — Ticket: HLPDSK-31956 (Conor Brady, FSRI)**
- **FireOps7 Vendor ID (test): `VN03615504`** — Vendor Admin access
- **FSRI Test Department: `FD35049607`** — use this for all dev/compatibility work
- Welcome email sent to zklein3@outlook.com with portal login + temp password
- After logging into https://app-test.neris.fsri.org — verify whether certified vendor auth uses HTTP Basic auth or OAuth2 client credentials
- Store common values as: `NERIS_VENDOR_ID`, `NERIS_TEST_DEPT_ID`, `NERIS_USE_TEST=true`
- If OAuth2 is required, also store: `NERIS_AUTH_MODE=oauth`, `NERIS_CLIENT_ID`, `NERIS_CLIENT_SECRET`
- If Basic auth is approved, also store: `NERIS_AUTH_MODE=basic`, `NERIS_VENDOR_PASSWORD`
- This is a single credential set for the entire FireOps7 platform — not per-department
- Local smoke test after credentials are saved:
  - Set `NERIS_USE_TEST=true`
  - Run `npm run neris:smoke`
  - Expected OAuth success: token request OK, then entity fetch OK for the FSRI test department
  - Expected Basic success: entity fetch OK for the FSRI test department
- Current FSRI question: Zachary asked Conor Brady whether HTTP Basic auth is acceptable for certified vendor integration or OAuth2 client credentials are required

### Compatibility Badge Requirements (must complete after receiving Client ID)
1. Enroll with the FSRI Fire Department (test dept) — Request Enrollment for NERIS Compatibility Badge
2. POST a valid incident from that integration connection
3. PUT/PATCH an update to that incident using its UID
4. POST a new station to the FSRI Fire Department
5. POST a unit to that created station
6. Submit compatibility check request — Request Compatibility Check
- Software passing these steps is considered **Version 1 Data Exchange Compatible**

### Station Required Fields (POST)
- `station_id` — agency NERIS ID + "S" + 3-digit number (e.g. `[NERIS_ID]S001`)
- `station_address_1`, `station_city`, `station_state`, `station_zip`
- `station_point` — WGS84 coordinates (lat/lng)
- `station_staffing` — minimum staffing at station level

### Unit Required Fields (POST)
- `station_unit_id_1` — unit's CAD designation
- `station_unit_staffing` — minimum staffing required to dispatch
- `station_unit_capability` — type classification (value set TBD)

### Test Strategy
- Create a dedicated NERIS test department in FireOps7 with fully NERIS-compliant data
- Use the test API (`api-test.neris.fsri.org/v1`) to validate the full push path end-to-end before compatibility submission
- Test flow: FireOps7 test dept → incidents/stations/units → NERIS test API → verify response → then submit against FSRI Fire Dept for badge
- All submissions for the compatibility check target the **FSRI Fire Department** (their test dept), not a real department

### Step 2 — Each department enrolls FireOps7 (per-department, done by dept admin)
1. Dept admin logs into NERIS at https://app.neris.fsri.org
2. Select **Enrollments** from the left menu
3. Enter FireOps7's **Client ID** (not their NERIS ID)
4. Select **Enroll Integration** → confirm permissions popup
5. FireOps7 now has API access to that department's data

**Permissions granted per enrollment:**
- View, create, and modify incident data for their entity
- View and modify entity attributes (location, stations, staffing, units)

### FireOps7 implementation notes
- Store the FireOps7 Client ID / API credentials in `.env.local` and Vercel env vars (not per-department)
- Each department that has enrolled will be accessible via the API — scope submissions by department
- Departments can revoke access at any time by deleting the enrollment in NERIS

### Alternatives
- **Self-report option**: Departments can get their own NERIS credentials and submit directly without a vendor. FireOps7 could support this as a fallback (store dept-level API key in `departments` table), but vendor enrollment is the cleaner long-term path.

---

## Notes

- NERIS ID is epoch milliseconds of incident start time (system-generated, not dept-assigned)
- Departments keep their own internal incident number separately
- `computed: true` fields are auto-populated by NERIS from geo/parcel data — don't need to submit those
- ResponseRack is an example of an already-enrolled vendor — same model FireOps7 will follow
