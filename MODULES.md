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
