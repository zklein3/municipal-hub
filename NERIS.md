# NERIS Compliance Reference

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

## Notes

- NERIS ID is epoch milliseconds of incident start time (system-generated, not dept-assigned)
- Departments keep their own internal incident number separately
- `computed: true` fields are auto-populated by NERIS from geo/parcel data — don't need to submit those
- API authentication details to be confirmed when ready to build
