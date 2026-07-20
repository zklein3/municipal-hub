# FireOps7 — Module Design Details

## Equipment / Inspection System

### Item Type Flags
- `tracks_quantity` — count-based | `tracks_assets` — individual tracking
- `requires_presence_check` — verified during apparatus check
- `requires_inspection` — has template + schedule | `tracks_expiration` — expiry date
- Asset Statuses (DB exact): `IN SERVICE` | `OUT OF SERVICE` | `RETIRED`
- ASSET_LINK step type fully removed. Do not re-introduce.

### Two Check Modes
- **Daily Check** — presence-only (`?mode=presence`). Present/missing + qty per item, no checklist. Logs to `compartment_presence_check_logs`. Available from `/inspections` → "Daily Check" or compartment page.
- **Full Inspection** — asset-tracked items with template → N slots driven by `expected_quantity`. Each slot: pick asset → run checklist → submit separate log row.
- Rule: `presenceOnly || !(requires_inspection && templates.length > 0)` → presence. Otherwise → full inspection.

### Inspection Sessions
- `inspection_sessions`: apparatus_id, department_id, status (`in_progress`|`completed`|`expired`), 12h expiry
- `inspection_session_compartments`: per-compartment status, claim/release/complete flow
- One person per compartment at a time; officer/admin can release stuck compartments
- `notify-expired-sessions` Edge Function runs hourly — emails active officers/admins when sessions expire
- "Start Inspection Session" button on apparatus detail → `/inspections/apparatus/[id]`

### QR System
- Apparatus: `fireops7.com/scan?type=apparatus&code=ENGINE-32`
- Compartment: `fireops7.com/scan?type=compartment&code=ENGINE-32-D1`
- `/scan` looks up code across all types, redirects to destination page
- QR label print at `/print/qr?type=...&code=...&title=...&subtitle=...`
- `qrcode.react` generates QR SVGs client-side

### Inspection Template Builder
- Primary path: Dept Setup → Items & Assets → Inspection Templates tab
- Step types: BOOLEAN, NUMERIC, TEXT, LONG_TEXT
- Multiple templates per item type allowed (Daily/Weekly/Monthly)

---

## Attendance Module
- `requires_verification` defaults TRUE — admin opts out consciously
- Self-report window: 12 hours from event start_time
- Officer/admin can log retroactively at any time
- Close Event: marks all unrecorded active members absent, sets instance `completed`
- Auto-close cron: `auto-close-events` Edge Function, nightly 2 AM UTC, 7-day threshold

### DB Tables
- `excuse_types`, `participation_requirements`
- `event_series`, `event_instances`, `event_attendance`

---

## Training Module

### Three Scenarios
1. **Certification Course** — Admin creates course + units, enrolls member, member submits progress, officer verifies → cert record
2. **Direct Cert Entry** — Admin logs cert directly (no course)
3. **Training Event** — Officer/admin creates event, logs attendance, no cert attached

### Key Rules
- Expiration configurable per cert type (FF1 Nebraska = none, EMT-B = 24 months)
- Renewals create new cert record — history kept
- Digital signatures via `SignaturePadModal`, stored in Supabase Storage `signatures/`

### DB Tables
- `certification_types`, `certification_course_units`, `course_enrollments`
- `member_course_progress`, `member_certifications`
- `training_events`, `training_event_attendance` (+ `signature_url`, `signed_at`)

---

## Incident Log Module
- Build order: 1) Manual entry ✅ → 2) CAD email parsing → 3) CAD API/webhook
- EMS reporting NOT in scope
- `first_enroute_at` auto-computed as min `enroute_at` across apparatus entries
- Apparatus times pre-populate from incident-level times when adding apparatus

### DB Tables
- `incidents`, `incident_apparatus`, `incident_personnel`, `incident_fire_details`

---

## ISO Audit Module

### What's Built
- Apparatus specs (`apparatus_iso_specs`) — edited from apparatus detail, shown in `/iso/report`
- Hose inventory + NFPA 1962 service tests (`/iso/hoses`)
- Hydrant flow tests (`/iso/hydrants`)
- Mutual aid log on incident detail
- `/iso/report` — consolidated: apparatus spec coverage, hose compliance, hydrant compliance, mutual aid

### Mutual Aid — Three-Tier Roadmap
1. **Manual entry** — dept admin enters partner name + equipment (table: `mutual_aid_partners`)
2. **Partner self-entry** — token-gated page, partner fills own data (no FireOps7 account needed)
3. **Cross-dept pull** — if partner is on FireOps7, data shares automatically with consent

### `apparatus.exclude_from_iso`
- Boolean flag (admin only). ISO report excludes these from specs coverage stats; shows dimmed with "Excluded" badge.

---

## Fire School Module
- Public, no auth required
- Uses BarcodeDetector Web API, rear camera via getUserMedia
- Scan → extract bottle ID → auto-trigger `handleCheck()`
- Bottle IDs are public/shared across depts — separate from main app QR system
- `/print/qr?type=bottle` for bottle QR labels

---

## Future Integrations (Research / Roadmap)

### ImageTrend Elite — EMS Run Data Push
**Status:** Future research — not started
**Context:** Nebraska (and most Midwest states) provide ImageTrend Elite free to departments for NEMSIS 3.5 EMS reporting. Most fire departments in the region run dual fire/EMS.

**Concept:** FireOps7 acts like a CAD system — pushes run logistics to ImageTrend when an incident is created, pre-populating the draft PCR so medics only need to add clinical data.

**What FireOps7 would push:**
- Incident number (join key between systems)
- Address and incident type
- Dispatch, en route, on scene, cleared times
- Apparatus that responded
- Personnel on scene (mapped to ImageTrend responder IDs)

**Path to build:**
1. Apply to ImageTrend vendor/partner integration program (fee required for test environment access)
2. Nebraska DHHS EMS division may require separate state-level approval for third-party vendor access
3. Build push via ImageTrend Elite REST API — same pattern as NERIS
4. Gate behind a `module_imagetrend` flag per department

**Key unknowns:**
- ImageTrend vendor program cost
- Whether Nebraska DHHS allows agency-level third-party API connections
- How ImageTrend maps personnel IDs (need a sync step or manual mapping per dept)

**Do not build** a full ePCR/PCR module — the state provides that for free. Integration only.

### State Controlled-Burn Database — Burn Info Sheet + Export
**Status:** Future research — not started (flagged 2026-07-20)
**Context:** The state is building a database for controlled burn / burn permit data. FireOps7 already has a burn permit workflow (`burn_permits` table + `/dept/[slug]/burn-permit` public form + officer approval in Inbox), but that only captures the *permit* — applicant, requested address/date/description, approval, signatures. It has no record of what actually happened at the burn itself.

**Concept:** Add a burn "info sheet" — an after-action record captured alongside (linked to) the existing permit — so the department has structured burn-event data on file. Once the state's database and interaction point exist, build an export from this data to their system (same shape as the NERIS integration: FireOps7 as the source of truth, push/export to the state).

**What's missing today (gap vs. a state DB's likely needs):** actual burn date/time (vs. requested), duration, material/fuel type, acreage or pile size, weather conditions (wind speed/direction, humidity), supervising officer/personnel on scene, any incidents or complaints during the burn, extinguish/all-clear time. Exact field list still needs to come from Zach or from the state's eventual data spec.

**Path to build:**
1. Get the state's field requirements (or best guess if their spec isn't public yet) — determines the info sheet schema
2. New table (e.g. `burn_permit_records`) linked to `burn_permits`, filled in by the officer after the burn (mirrors the permit's own officer-signs-off pattern)
3. Build the export once the state publishes their database/API — format unknown until then

**Key unknowns:** state's data spec/format, submission mechanism (API vs. file upload vs. manual portal entry), timeline for when their system goes live.
