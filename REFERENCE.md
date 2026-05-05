# FireOps7 — Reference (Historical / Pull When Needed)

## What's Built & Working ✅
- Full auth flow + middleware routing
- Role-aware sidebar + mobile hamburger drawer
- Sys admin dashboard — department cards with stats
- Sys admin — Departments, Users, System Logs (full log viewer with resolve/resolve-all, tab filters, metadata expand, show-resolved toggle)
- Sys admin dept drill-in — `/admin/dept/[id]` tabbed
- Dept Admin — Dept Setup, Items, Attendance Settings, Training
- Personnel roster + profile (role-based editing, change password)
- Apparatus list + detail (edit, compartment assign/remove)
- Stations list + detail
- Compartment names management + assignment to apparatus
- Equipment pages — `/equipment` + `/equipment/[id]` (quantity item view, assign/remove)
- Item management — 3 tabs: Categories, Items (with asset expansion), Assets
- Asset tracking — create/edit assets, linked asset flag, has_linked_asset + linked_item_type_id
- Inspection template builder — create templates per item type, add/edit/delete steps, reassign to different item type
- Inspection run UI — `/inspections` select apparatus+compartment → `/inspections/run` checklist with asset picker, presence checks, all step types, submit logs to DB (apparatus_id, compartment_id, presence checks all persisted)
- Multi-asset inspection — `expected_quantity` on asset-tracked items drives N inspection slots per item type; each slot gets its own asset picker (cross-slot deduplication) + full checklist; each submits a separate inspection log row
- Daily Check mode — `/inspections` → compartment → "Daily Check" button, or compartment QR/page → Verify Present; presence-only run (present/missing + qty for all items, no checklist); `?mode=presence` param
- Member activity report (`/reports/my-activity`) — self-view: attendance (present/excused/absent/pending counts + table), inspections (pass/fail counts + table), incidents (count + table); date range filter; all roles
- Inspection report (`/reports/inspections`) — flat table with asset inspection rows (PASS/FAIL + step detail) and presence check rows (Present/Missing); filters: date range, apparatus, inspector, pass/fail toggle; expandable rows show all step responses; asset tag click drills into per-asset history; printable
- Inventory Reports — `/reports/inventory` — apparatus cards, date range filter, flagged item reference cards, window.print() print view; linked from apparatus detail page
- Training/Cert Report (`/reports/training`) — officer/admin, filters by member/cert type/date range, expiry flagging, printable screen view
- Attendance Report (`/reports/attendance`) — officer/admin, participation rates, threshold flagging, date/member/event type filters, printable
- Department announcements — `/announcements` plus dashboard unread banner; officers/admins create, admins pin/unpin/delete, all roles mark read
- Training signatures — `SignaturePadModal` component, saves to Supabase Storage `signatures/`, embedded on `/print/training-signin`
- Member training record print — `/print/member-training?personnel_id=xxx&from=xxx&to=xxx`
- Public-facing department sites — `/dept/[slug]/*` path-based, per-dept on/off via `departments.public_site_enabled + public_slug`
- Burn permit system — public form, officer inbox approval, signatures (officer + applicant), printable Nebraska state permit
- Records request system — public form, officer inbox review flow
- Public Inbox (`/inbox`) — burn permits + records requests with pending count badge
- `apparatus.exclude_from_iso` — flag to exclude vehicles from ISO calculations
- Burn permit signature flow — officer signs in inbox, resident signs or acknowledges on permit-status page, both signatures embedded on printed permit
- Equipment move — Move button on each item in equipment detail → modal to pick any apparatus + compartment, single-step reassign (cross-truck supported)
- Equipment quantity edit — click quantity number inline to edit expected count; officers/admins only; asset items show "assets" label, quantity items show "expected"
- Attendance module — fully built including verification queue (approve/reject with reason, approve all)
- Training module — DB migrated, cert types + course units, enrollments, member progress + verification, direct cert entry, training events with self-report + officer log + verification queue + digital signatures
- Incident log module — DB migrated, manual entry, apparatus + per-unit times, personnel with POV support, fire details, officer verification + finalize flow
- ISO audit baseline — hose inventory/tests, hydrants/flow tests, apparatus ISO specs, mutual aid log, `/iso/report`
- Sys admin dept drill-in — mobile layout fixed (responsive grid forms)
- Incident new form — paged/in-service times auto-fill from apparatus entries
- Dashboard with real data + upcoming events/training this week with personal attendance status
- Error logging + email notifications
- FeedbackButton with React Portal
- Mobile header overlap fixed, input text color fixed
- Fire School — QR scanning fully working
- Vercel deployed + fireops7.com DNS configured

## What's Placeholder / Not Yet Built
- Permit submission notification email to department (next build — see CLAUDE.md)
- Inspection schedule settings (daily/weekly/monthly per dept)
- Supabase auth allowed URLs for custom domain
- Resend from address → custom domain (blocked until fireops7.com verified, ~1 month)
- Public site subdomain routing (blocked until Vercel Pro)
- Officer personnel inline edit on roster cards

## User Roles & Permissions

### signup_status values
| Status | Redirect |
|---|---|
| `temp_password` | /change-password |
| `profile_setup` | /profile-setup |
| `active` | /dashboard |
| `awaiting_approval` | /pending |
| `denied` | /denied |

### User Roles
| Field | Table | Purpose |
|---|---|---|
| `is_sys_admin` | `personnel` | Global — all departments, no dept record needed |
| `system_role` | `department_personnel` | `admin / officer / member` within dept |
| `department_id` | `department_personnel` | Scopes all data to their department |

### Permission Matrix
| Action | Member | Officer | Admin | Sys Admin |
|---|---|---|---|---|
| View roster/stations/apparatus/equipment | ✅ | ✅ | ✅ | ✅ |
| Run inspections | ✅ | ✅ | ✅ | ✅ |
| Submit training/certification progress | ✅ | ✅ | ✅ | ✅ |
| Log own attendance (within window) | ✅ | ✅ | ✅ | ✅ |
| Edit own profile | ✅ | ✅ | ✅ | ✅ |
| Verify/approve attendance | ❌ | ✅ | ✅ | ✅ |
| Create events / bulk log attendance | ❌ | ✅ | ✅ | ✅ |
| Log retroactive attendance | ❌ | ✅ | ✅ | ✅ |
| Create/log incidents | ❌ | ✅ | ✅ | ✅ |
| Edit anyone's basic info | ❌ | ✅ | ✅ | ✅ |
| Edit apparatus/station info | ❌ | ✅ | ✅ | ✅ |
| Assign items to compartments | ❌ | ✅ | ✅ | ✅ |
| Add/deactivate apparatus/stations | ❌ | ❌ | ✅ | ✅ |
| Manage compartments/items/categories/assets | ❌ | ❌ | ✅ | ✅ |
| Add/manage personnel | ❌ | ✅* | ✅ | ✅ |
| Create certification types + courses | ❌ | ❌ | ✅ | ✅ |
| Enroll members in certification courses | ❌ | ❌ | ✅ | ✅ |
| Set participation requirements | ❌ | ❌ | ✅ | ✅ |
| Define excuse types | ❌ | ❌ | ✅ | ✅ |
| Generate/print QR labels | ❌ | ❌ | ✅ | ✅ |

* Officers can add officers/members and edit operational profile fields from main nav pages. Admin-only setup/structure and admin role assignment stay under `/dept-admin/setup`.

## Attendance Module Detail

### DB Tables
- `excuse_types` — department defined excuse reasons
- `participation_requirements` — minimum % thresholds per event type
- `event_series` — recurring event definitions
- `event_instances` — individual occurrences generated from series
- `event_attendance` — attendance records per member per instance

### Key Rules
- `requires_verification` defaults to TRUE on all events — admin consciously opts out
- Self-report window: 12 hours from event start time (members only)
- Officer/admin can log retroactively at any time, no restriction
- Warning banner shown when editing past events with existing attendance records
- Members see only own attendance; dept-level aggregates on dashboard

## QR + Compartment Page + Inspection Session — Built Design

### Core Principles
- Scanning is ADDITIVE — never required. Every page works without it
- Manual navigation always available everywhere
- Two scan modes: phone camera outside app, in-app scanner
- QR codes use human-readable codes, not UUIDs — app looks up UUID internally

### Human-Readable Code Format
- Apparatus: unit number (e.g. `ENGINE-32`, `TANKER-1`)
- Compartment: apparatus + code (e.g. `ENGINE-32-D1`, `ENGINE-32-P1`)
- Asset: asset tag (e.g. `CHAINSAW-1`, `SAP-1`)
- SCBA bottle: bottle ID (e.g. `B-0001`) — already in use

### DB Changes Applied
- `qr_code` text field added to `apparatus` and `apparatus_compartments`; asset scan redirects use asset tags via `/equipment/assets?search=...`.
- `inspection_session_id` UUID added to `item_asset_inspection_logs` — groups all compartment submissions from one weekly sweep into one session.
- Admin can type human-readable apparatus/compartment codes in the app.

### Two Scan Modes
**Mode 1 — Phone camera outside app:**
- QR encodes URL: `https://www.fireops7.com/scan?type=compartment&code=ENGINE-32-D1`
- Not logged in → redirected to login → after auth → back to `/scan` → resolves → redirects
- Logged in → `/scan` looks up code → redirects to destination

**Mode 2 — In-app scanner:**
- User already logged in, taps scan button on relevant page
- BarcodeDetector/getUserMedia (already working in Fire School — extract to reusable `QRScanner` component)
- Reads QR, navigates internally — no redirect needed

### New Routes & Pages

| Route | Purpose |
|---|---|
| `/equipment/[apparatus_id]/[compartment_id]` | Compartment page — QR scan landing |
| `/inspections/apparatus/[id]` | Weekly inspection session — full apparatus sweep |
| `/scan` | QR lookup + auth redirect |

### Compartment Page (`/equipment/[apparatus_id]/[compartment_id]`)
- Header: apparatus name + compartment name/code
- Item list: each item with expected quantity, current asset status
- Three action buttons:
  - **Verify Present** — lightweight presence-check-only flow (no asset checklists); logs to `compartment_presence_check_logs`; designed for daily shift checks. Already available from `/inspections` → "Daily Check" button; QR scan will pre-fill apparatus + compartment via `?mode=presence`
  - **Start Inspection** — launches existing inspection run pre-filled with apparatus + compartment (skips selection screen)
  - **View History** — recent inspection logs for this compartment
- Accessible via QR scan or manual nav from apparatus detail page

### Inspection Session (`/inspections/apparatus/[id]`) ✅ BUILT
- `inspection_sessions` table: apparatus_id, department_id, status (`in_progress`|`completed`|`expired`), started_by, started_at, expires_at (12h), completed_at
- `inspection_session_compartments` table: session_id, compartment_id, status (`pending`|`in_progress`|`completed`), claimed_by, claimed_at, completed_at, completed_by, released_by, released_at
- `item_asset_inspection_logs.inspection_session_id` FK — groups all submissions from one session
- **Lazy expiry + cron notification** — on page open, if `expires_at` is past, session is marked `expired` and a fresh one is created. The `notify-expired-sessions` Edge Function also runs hourly, marks stale sessions expired, sets `notified_at`, and emails active officers/admins.
- **One person per compartment** — compartment claimed (`in_progress`) when user clicks Inspect. Others see it as locked. Officer/admin can release a stuck compartment back to `pending`.
- **Auto-join** — navigating to apparatus session page auto-joins the open session; no invite needed.
- **Auto-complete** — session marked `completed` when all compartments done. Officer/admin "Close Session" force-closes regardless.
- **"Start Inspection Session"** button on apparatus detail Compartments section (all roles, only shown when active compartments exist).

### Use Case Mapping
- **Daily check (career dept shift change):** Scan compartment → compartment page → Verify Present → done
- **Weekly full inspection:** Apparatus detail → Start Weekly Inspection → session view → work through each compartment
- **Ad hoc single compartment inspection:** Scan or navigate → compartment page → Start Inspection

### QR Label Generation & Printing
- `qrcode.react` npm package — generates QR as SVG client-side, no third party
- QR encodes the full scan URL (e.g. `https://www.fireops7.com/scan?type=compartment&code=ENGINE-32-D1`)
- "Print QR Label" button on apparatus detail + compartment page
- Print layout: QR image + code text + apparatus/compartment name — uses `window.print()` (same as inventory reports)

### Build Order (completed)
1. ✅ DB migration: `qr_code` on apparatus + apparatus_compartments; `inspection_session_id` on item_asset_inspection_logs; `inspection_sessions` + `inspection_session_compartments` tables
2. ✅ Compartment page (`/equipment/[apparatus_id]/[compartment_id]`) — item list, asset status badges, Verify Present + Start Inspection buttons, recent activity, QR code admin form
3. ✅ Inspection session (`/inspections/apparatus/[id]`) — compartment checklist, claim/release, auto-complete, officer close
4. ✅ `/scan` route — type+code lookup, redirects to apparatus/compartment/asset roster
5. ✅ `QRScanner` component — extracted from fire school, `QRScanButton` wrapper, scan buttons on apparatus/compartment/asset pages
6. ✅ QR label print layout + "Print QR Label" buttons on apparatus detail + compartment page
7. ✅ Admin UI: qr_code field on apparatus edit form + compartment detail page

## Training Module Detail

### Three Training Scenarios
1. **Certification Course Logging** — Admin creates course + chapters, enrolls members, member submits progress, officer verifies, admin logs test result → cert record
2. **Direct Certification Entry** — Admin logs cert directly, no course history required
3. **Regular Training Event** — Officer/admin creates event, logs attendance, no cert attached

### Data Model
```
certification_types
  ├── cert_name, issuing_body
  ├── does_expire (boolean)
  ├── expiration_interval_months (null if no expiration — e.g. FF1 Nebraska)
  └── is_structured_course (boolean)

certification_course_units
  └── unit_title, unit_description, required_hours, sort_order

course_enrollments (admin assigns — gate to submit)
  └── personnel_id, certification_type_id, status: active/withdrawn/completed

member_course_progress (member submits)
  ├── enrollment_id, unit_id, hours_submitted, completed_date, notes
  └── status: pending/verified/rejected + verified_by, verified_at, rejection_reason

member_certifications (actual cert records)
  ├── personnel_id, certification_type_id, cert_number, issued_by, issued_date
  ├── expiration_date (auto-calc from issue_date + interval, manual override allowed)
  └── source: course_completion | direct_entry

training_events + training_event_attendance
```

### Key Rules
- Expiration: FF1 Nebraska = no expiration. EMT-B/CPR = 24 months (configurable per type)
- Renewals create new cert record — old records kept for history
- Dashboard flags certs expiring within configurable window

## Incident Log Module Detail

### Background
- CAD email (CFS PDF) received after each call — currently transcribed manually into NERIS
- Goal: bring incident logging into FireOps7, eventually replace NERIS workflow
- EMS reporting NOT in scope
- Build order: 1) Manual entry ✅  2) CAD email parsing via Edge Function  3) CAD API/webhook

### Data Model
```
incidents
  ├── department_id, incident_number (internal), cad_number
  ├── incident_date, call_time, completed_time, address
  ├── incident_type (fire/rescue/standby/mutual_aid/special/other)
  ├── mutual_aid_direction (to/from) + mutual_aid_department
  ├── disposition, narrative, neris_reported (boolean)
  └── created_by

incident_times — paged, page_acknowledged, enroute, on_scene, leaving_scene, back_at_station
incident_apparatus — apparatus_id, role (primary/support/staging)
incident_personnel — personnel_id, apparatus_id, status (pending/present/absent)
incident_fire_details — property_lost, dollar_loss, cause_of_fire, vehicle_make, insurance_info
```

## Database Tables

### Fire Department (auth-protected, RLS)
- `departments`, `stations`, `apparatus`, `apparatus_types`
- `apparatus_compartments`, `compartment_names`
- `personnel`, `department_personnel`, `personnel_roles`
- `items`, `item_categories`, `item_assets`, `item_location_standards`
- `item_inspection_templates`, `item_inspection_template_steps`
- `item_asset_inspection_logs` (+ apparatus_id, compartment_id columns), `item_asset_inspection_log_steps`
- `compartment_presence_check_logs`
- `inspection_sessions`, `inspection_session_compartments`
- `excuse_types`, `participation_requirements`
- `event_series`, `event_instances`, `event_attendance`
- `certification_types`, `certification_course_units`, `course_enrollments`
- `member_course_progress`, `member_certifications`
- `training_events`, `training_event_attendance`
- `incidents`, `incident_apparatus`, `incident_personnel`, `incident_fire_details`
- `announcements`, `announcement_reads`
- `apparatus_iso_specs`, `hoses`, `hose_tests`, `hydrants`, `hydrant_flow_tests`, `incident_mutual_aid`
- `scba_bottles`, `scba_fill_logs`, `scba_maintenance_logs`, `scba_cylinder_specs`
- `system_logs`

### DB Migrations Applied
- `item_assets`: added `has_linked_asset`, `linked_item_type_id`
- `item_inspection_template_steps`: added `step_type`, `linked_item_type_id`
- Attendance module: `excuse_types`, `participation_requirements`, `event_series`, `event_instances`, `event_attendance`
- Training module: `certification_types`, `certification_course_units`, `course_enrollments`, `member_course_progress`, `member_certifications`, `training_events`, `training_event_attendance`
- Incident module: `incidents`, `incident_apparatus`, `incident_personnel`, `incident_fire_details`
- Inspection logs: added `apparatus_id`, `compartment_id` to `item_asset_inspection_logs`; new `compartment_presence_check_logs` table
- Inspection sessions: `inspection_sessions`, `inspection_session_compartments`, `inspection_sessions.notified_at`, `item_asset_inspection_logs.inspection_session_id`
- QR fields: `apparatus.qr_code`, `apparatus_compartments.qr_code`
- Announcements: `announcements`, `announcement_reads`
- Training signatures: `training_event_attendance.signature_url`, `training_event_attendance.signed_at`, Supabase Storage bucket `signatures`
- ISO baseline: `apparatus_iso_specs`, `hoses`, `hose_tests`, `hydrants`, `hydrant_flow_tests`, `incident_mutual_aid`

### Fire School (public, no auth)
- `fire_school_bottles`, `fire_school_fill_logs`

## Fire School — QR Scanning
- Uses BarcodeDetector Web API, rear camera via getUserMedia
- Scan → extracts bottle ID → calls handleCheck() directly
- Fire school IDs are generic (public, shared across depts) — separate from main app QR system

## ISO Audit Reporting — Design & Roadmap

### What's Reportable Today (covered by existing data)
- **Apparatus inspections** — by truck, date range, inspector, pass/fail, step responses
- **Training + certifications** — by member, cert type, expiration tracking, course completions
- **Attendance** — participation rates by member and event type
- **Incidents** — call volume, incident type breakdown, apparatus and personnel response

### ISO Sections Built So Far

**Hose inventory log**
- Built at `/iso/hoses`: hose inventory plus NFPA 1962 service test log per hose.
- Reported in `/iso/report` with tested/overdue/failed compliance status.

**Apparatus + pump specs**
- Built as `apparatus_iso_specs`, edited from apparatus detail.
- Reported in `/iso/report` as apparatus spec coverage.

**Hydrant flow logs**
- Built at `/iso/hydrants`: hydrant list plus flow-test history.
- Reported in `/iso/report` with recent test/compliance visibility.

**Mutual aid log**
- Built on incident detail: officers can log mutual aid given/received, apparatus description, personnel count, and times.
- Reported in `/iso/report` as recent mutual aid activity.

### Mutual Aid — Three-Tier Design

**Tier 1 — Manual entry (build first)**
- Dept admin manually enters partner name, their apparatus list, pump GPM, tank capacity, hose inventory
- New table: `mutual_aid_partners` + `mutual_aid_apparatus`
- Simple admin form under Dept Admin

**Tier 2 — Partner self-entry page (build second)**
- Dept admin generates a share link for a mutual aid partner
- Partner opens a public/token-gated page and enters their own equipment data directly
- No FireOps7 account required — similar to fire school pattern
- Data lands in requesting dept's mutual aid table, attributed to that partner

**Tier 3 — Cross-department data pull (future, when multiple customers)**
- If partner is already on FireOps7, their apparatus/equipment data already exists in the system
- Partner dept enables a "share with mutual aid partners" toggle
- Requesting dept sends a link request → partner approves → data populates automatically and stays current
- Network effect: more FireOps7 customers = less manual data entry for everyone

### ISO Report Format
- ISO audits are a recognized format accepted by nearly all agencies
- Build what data exists now, add sections as logs are built
- Each section: filterable by date range, grouped appropriately, printable via `window.print()`
- Print layout consistent with inventory reports pattern already established

## Reference Documents
- Winslow Run Sheet (Excel) — uploaded April 16, 2026
- CAD CFS Report (PDF) — uploaded April 16, 2026 (Dodge County 9-1-1)
  - Current workflow: received via email after call → manually transcribed into NERIS

---

## Session History

### 2026-05-05 — Burn Permit Signatures + Public Site Completion
- Config validation in inbox: yellow banner if county/sheriff info missing, blocks approval server-side
- Burn permit signature flow (5 steps): DB migration → officer signs in inbox → resident signs/acknowledges on permit-status → signatures embedded on printed permit
- `PermitSignatureModal` — reuses signature_pad, saves to `signatures/permits/officer/{id}.png`
- `ApplicantSignatureSection` — public client component: choose (sign digitally / print and sign), inline canvas, acknowledgement path
- Both print pages updated: applicant signature above (Signature of Applicant), officer signature below (Fire Department Officer)
- Applicant name filled into "I ___ Accept all financial Responsibility" line
- `.claude/settings.json` created with `npm run build*` allowlist

### 2026-05-04, session 2 — Public Site + Inbox + Burn Permit
- Public site at `/dept/[slug]/*` — landing, events, burn permit form, records request form
- Permit status + public print pages (`/dept/[slug]/permit-status`, `/dept/[slug]/permit-print`)
- Sys admin Public Site config tab on `/admin/dept/[id]` (5th tab)
- Officer event public/private toggle from `/events` manage panel
- Public Inbox (`/inbox`) — burn permits tab + records requests tab, pending badges in nav
- Printable Nebraska state burn permit (NE Statute 81-520.01 legal text, county sheriff info)
- `send-permit-approval` Edge Function deployed (email to resident on approval — awaiting domain verification)
- Approval email currently via logEvent (→ sys admin inbox) until fireops7.com verified in Resend
- `apparatus.exclude_from_iso` flag — checkbox on apparatus edit, ISO report excludes from stats

### 2026-05-04, session 1 — Announcements + Training Signatures
- `/announcements` — newest-first, pinned float, officer/admin create, admin pin/delete, all mark read
- Dashboard unread announcement banner (DashboardAnnouncementBanner)
- `signature_pad` installed, `SignaturePadModal` built
- Training signatures: members sign own records, officers collect, `/print/training-signin` embeds images

### 2026-05-03, session 2 — Setup Flow Polish + Permission Model
- Inspection Templates tab in Dept Setup flow
- HelpPrompt dismissable help system with localStorage persistence
- Officer add personnel capability (PersonnelAddForm on /personnel)
- Dashboard profile card (replaced stat cards)
- Role-adaptive quick links on dashboard
- Nav: "Training" → "Certifications", Incidents → Operations group
- Permission model finalized: setup = admin only, operational pages = role-adaptive

### 2026-05-03, session 1 — Dept Setup Flow
- `/dept-admin/setup` five-step rail (Stations → Apparatus → Personnel → Compartments → Items & Assets)
- Desktop sidebar + mobile horizontal scrollable tab bar
- Each step: existing records as cards with inline edit + add

### 2026-04-30 — Flow & Presentation Polish
- Dashboard: removed SCBA Bottles stat card
- Personnel: card grid replacing scrolling table
- Nav: split Apparatus into Apparatus + Equipment groups

### 2026-04-28 — QR Printing, Session Expiry Notifications, ISO Baseline
- `/print/qr` dedicated print page
- Bottle QR labels + fill station auto-check on scan
- `notify-expired-sessions` Edge Function (hourly cron)
- ISO DB tables + hose/hydrant/mutual aid pages + apparatus ISO specs card

### 2026-04-27 — Inspection Sessions, Asset Roster, Compartment Detail, QR Infrastructure
- Inspection sessions (`/inspections/apparatus/[id]`) with claim/release, 12h expiry
- Asset Roster (`/equipment/assets`) with apparatus assignment
- Compartment detail page (`/equipment/[id]/[compartment_id]`)
- QR code columns on apparatus + compartments, `/scan` route
- Incident attendance self-log + officer verification
- Excused absence flow, Close Event, auto-close cron
