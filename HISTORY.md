# FireOps7 — Build History & DB Reference

## What's Built & Working ✅
- Full auth flow + middleware routing
- Hub-and-spoke navigation — sidebar 6 items only (Dashboard, Operations, Personnel, Training, Inventory, Reports). Each leads to a card-grid hub page. Dept Admin is a single link → hub with tiles.
- `HubCard` component — reusable card with title, description, stat badge, alert state
- `PageNavBar` — global Back + hub breadcrumb on every dashboard page (pathname-driven, no per-page wiring)
- Operations hub (`/operations`) — Incidents, Announcements, Fuel Log, Public Inbox cards + recent incidents list
- Inventory page (`/equipment`) — member-focused. Station Storage card at top + apparatus list grouped by station. Each apparatus card: Vehicle Check (blue), View Inventory (red), Fuel Log → link. No admin hub cards for members.
- Asset Roster (`/reports/assets` via `/equipment/assets`) — moved to Reports hub as read-only officer/admin audit view. Apparatus assignment now lives in Equipment Setup → Items → Assets tab.
- Compartment display — `[unit_number] - [code]` (e.g. `24 - D1`) everywhere a compartment appears in apparatus context (inventory detail, inspection pages, move dropdowns). Setup screen stays universal (code only).
- Reports hub (`/reports`) — tile grid, role-adaptive (members see My Activity only, officers+ see all)
- Dept Admin hub (`/dept-admin`) — Personnel, **Events**, Training, Equipment Setup, Inspections, ISO (conditional), NERIS (conditional), Public Site (conditional)
- ISO sub-hub (`/iso`) — Hose Inventory, Hydrants, Mutual Aid, Pre-Fire Plans, ISO Report
- Training hub card row — Events, My Certifications (expiry alert), Print Training Card
- My Profile link in sidebar footer (name links to own personnel profile)
- Equipment Setup (Dept Admin) — 4 tabs: Stations, Apparatus, Compartments, Items. Items tab has 3 sub-tabs: Items → Asset Categories (with inspection templates nested per item) → Assets (with inline apparatus assignment). Compartments tab has Active/All toggle (defaults Active). Assets tab removed from outer shell — lives inside Items.
- Personnel hub — 2 tabs: Members (card grid), Attendance Settings
- Training hub — 4 tabs: Cert Types, Enrollments, Pending, Events (left rail + mobile scroll)
- Sys admin dashboard, Departments, Users, System Logs, NERIS panel
- Sys admin dept drill-in `/admin/dept/[id]` — 5 tabs
- Personnel roster + profile (role-based editing, change password, officer add)
- Apparatus list + detail (edit, compartment assign/remove, Manage Equipment link)
- Stations list + detail
- Equipment management — `/equipment/[id]` assign/remove/move items; Back button below header
- Compartment detail — items with Move + Remove for ALL roles, Back button action row, Print QR
- Asset Roster — `/equipment/assets` dept-wide with status filters, inline apparatus assignment
- Inspection template builder (inline via Dept Setup)
- Inspection run — presence checks + full asset checklist, all step types
- Inspection sessions — claim/release, 12h expiry, expired-session email notifications
- Inspections landing page — grouped by station → apparatus cards → compartments with View / Inspect / Daily Check / Vehicle Check
- Daily Check mode (presence-only)
- Vehicle Check system (`/inspections/vehicle-check/[id]`) — standalone truck check separate from compartment inspection. Dept-configurable checklist (24 items, 7 groups: Fluids, Mechanical, Lights, Communications, Emergency Equipment, Cleaning, Air Brakes). Per-apparatus toggles: `has_air_brakes` (shows Air Brakes group), `has_engine_hours` (shows engine hours field). Instructions on every item (procedure, what to look for, pass/fail) — shown expanded by default, toggle to hide. Odometer + engine hours fields. Progress bar, issue count, history panel (last 10 checks). On submit → `/inspections?checked=[id]`. "Do inventory on this vehicle?" link → compartment session
- Vehicle check items admin — Dept Admin → Inspections → Vehicle Check Items tab. Add/edit/disable per item, instructions textarea, reset to defaults. Items are dept-owned and seeded from code defaults on first use
- Apparatus detail page — ISO Specifications + Pump Tests section now appears before Compartments. Admin toggles for `has_air_brakes` and `has_engine_hours` in admin settings section
- Equipment Setup → Apparatus — collapsed to single Edit button (links to `/apparatus/[id]`); removed redundant Load and ISO Specs buttons
- QR system — human-readable codes, `/scan` redirect, print labels
- Announcements — pinning, unread tracking, dashboard banner
- Events + attendance — full lifecycle, excused absence, close event, auto-close cron. `/events` is member-only clean view; `/dept-admin/events` is officer management (bulk log, pending queue, edit, cancel, delete, close). Events have a Training toggle (hours + cert type) that auto-creates linked `training_events` rows and auto-issues certs on attendance verification.
- Training/Certifications — courses, enrollments, verification, direct cert entry, training events, digital signatures. Training-linked events show on `/training` page with "via [Event Title]" badge. Standalone training events have Cancel button.
- Incidents — manual entry, apparatus/personnel tracking, mutual aid, officer verify + finalize
- Incident run signatures — NERIS submit triggers signature rows for all responders; members sign via Inbox; officer sees signed/pending roster on incident detail page
- ISO audit — hose inventory (add/edit/remove/log test), hydrant flow tests (add/edit/remove/log test), apparatus specs (pump, tank, foam, aerial, turning radius, GVWR), mutual aid log, `/iso/report`
- Reports — inspections, inventory, training, attendance, my-activity (all with print)
- Member training record print
- Run Sheet print page (`/print/run-sheet?id=xxx`) — matches paper Run Field Report: apparatus groups with member names, POV group, Station group (standby), mutual aid To/From, full dept roster with checkmarks, fits on one letter sheet
- Run Sheet — role labels (IC, Driver, Officer, FF) right of name; cert labels below name; members sorted by role order within each apparatus group; cert display driven by `show_on_run_report` flag on cert types; address includes zip; incident info labels tab-aligned; incident time + type of incident columns span full width; type checkboxes right-aligned; single "Incident Role" column header at top of Units Dispatched
- Run Report page (`/reports/run-report`) — filterable by date range + incident type; incident list with type badge, address, unit/responder counts; Print button per row opens run sheet
- Training Admin — Member Certs tab: officers read-only, admins can edit cert records (dates, cert number, issuing body, active); direct cert entry form stacked for all screen sizes
- `certification_types.show_on_run_report` boolean — dept admin toggles per cert type whether it appears on run sheets (EMT yes, CPR no); set in Cert Types create/edit form
- Public department sites — `/dept/[slug]/*`, per-dept on/off toggle
- Burn permit system — public form, inbox sign-then-approve flow, officer + applicant signatures, printable Nebraska state permit
- Burn permit submission notification → logEvent → sys admin email
- Records request system — public form, inbox review flow
- Public Inbox — burn permits + records tabs, pending count badge; all members see Signatures tab
- Login show/hide password toggle
- BackButton component — `href` prop for explicit dest, else `router.back()`; always below header in action row
- Fire School — QR scanning, bottle tracking, fill log, realtime fill log, fill verification, timezone settings, on/off marketing toggle
- Training — unified member training page, direct cert entry, dept-wide enrollment, cert signatures, auto-cert issuance from events
- Outside training submissions — member-initiated log for external classes/conferences. Photo upload → Claude Haiku AI parse pre-fills fields. Purpose + NREMT category dropdowns (AIRWAY/CARDIOLOGY/TRAUMA/MEDICAL/OPERATIONS). Officer/admin reviews via Submissions tab in Training Admin; approval optionally links to cert type and auto-issues cert record. All submissions visible on member `/training` page with status + reviewer notes.
- NERIS Special Incident Modifiers section added to `NERIS.md` — FIFA World Cup 2026 modifier documented with when-to-apply guidance
- Security: enabled RLS on `qr_debug_scans` (was fully open — resolved Supabase critical alert)
- Storage bucket `training-docs` created for outside training document photos
- Error logging + email via notify-on-log Edge Function
- Vercel deployed + fireops7.com DNS live

## What's Not Yet Built
- Immediate next build: inventory / equipment storage system. Build the unassigned item pool, member add-from-storage, move logging, and restore the quantity guard in `removeItemFromCompartment` (`app/actions/equipment.ts`) so quantity items move to storage instead of disappearing.
- NERIS compliance/API integration is intentionally blocked until FSRI/vendor permission and credentials are granted.
- Officer sub-menu — elevated access for officers (not yet designed)
- Permit approval email direct to resident (blocked until fireops7.com verified in Resend, ~1 month)
- Inspection schedule settings (daily/weekly/monthly per dept)
- Subdomain routing `slug.fireops7.com` (blocked until Vercel Pro)
- Officer personnel inline edit on roster cards
- Public site Option B — API keys (on demand only)
- CAD email parsing for incidents
- Mutual aid partners manual entry table

## UI/UX Cleanup Backlog
Items flagged during development — address during next cleanup pass:
- `/dept-admin/items` page is duplicated by `/dept-admin/setup` (ItemsStep.tsx). Nav points to setup; `/dept-admin/items` only reachable via asset roster deep link and direct URL. Options: delete `/dept-admin/items` and update the asset roster link, or extract a shared component. Low urgency — admin-only, off-nav.
- `/equipment/page.tsx` (hub index) is an orphan — equipment is now accessed via Inspections apparatus cards. Can be removed; update the asset roster link (`/dept-admin/items?tab=assets`) to point elsewhere.

---

## Database Tables

### Core App (auth-protected, RLS)
- `departments`, `stations`, `apparatus`, `apparatus_types`
- `apparatus_compartments`, `compartment_names`
- `personnel`, `department_personnel`

### Equipment
- `items`, `item_categories`, `item_assets`, `item_location_standards`
- `item_inspection_templates`, `item_inspection_template_steps`
- `item_asset_inspection_logs`, `item_asset_inspection_log_steps`
- `compartment_presence_check_logs`
- `inspection_sessions`, `inspection_session_compartments`
- `vehicle_check_items` — dept-owned checklist items (`department_id`, `label`, `group_name`, `sort_order`, `has_amount_field`, `requires_air_brakes`, `instructions`, `active`); seeded from code defaults on first use
- `vehicle_inspections` — one record per vehicle check (`apparatus_id`, `department_id`, `inspected_by`, `odometer`, `engine_hours`, `notes`, `status`, `inspected_at`)
- `vehicle_inspection_results` — one row per item per inspection (`inspection_id`, `item_id`, `result` ok/issue/na, `amount_added`, `notes`)

### Attendance
- `excuse_types`, `participation_requirements`
- `event_series`, `event_instances`, `event_attendance`

### Training
- `certification_types`, `certification_course_units`, `course_enrollments`
- `member_course_progress`, `member_certifications`
- `training_events`, `training_event_attendance`

### Incidents
- `incidents`, `incident_apparatus`, `incident_personnel`, `incident_fire_details`
- `incident_signatures` — `incident_id`, `personnel_id`, `department_id`, `signed_at` (null = unsigned), `signature_data` (base64 PNG); unique on `(incident_id, personnel_id)`

### Comms / Content
- `announcements`, `announcement_reads`
- `burn_permits`, `public_record_requests`
- `system_logs`

### ISO
- `apparatus_iso_specs`, `hoses`, `hose_tests`, `hydrants`, `hydrant_flow_tests`, `incident_mutual_aid`

### Training (additions)
- `member_certifications.signature_url`, `.signed_at` — member signature on cert records
- `course_enrollments.training_date`, `.session_logged_at`, `.session_status` — simple cert session flow
- `training_events.certification_type_id` — auto-issues cert to verified attendees
- `system_settings` table — key/value global config (fire_school_enabled)

### Fire School (public, no auth)
- `fire_school_bottles`, `fire_school_fill_logs`
- `fire_school_fill_logs.verified_at` — timestamptz, null = unverified
- Realtime enabled on `fire_school_fill_logs` (supabase_realtime publication)
- Anon SELECT policy on `fire_school_fill_logs` (required for realtime subscription)

### Debug / Scratch
- `qr_debug_scans` — raw QR scan strings for format analysis. RLS disabled. Not for production use.

### Key Fields Added Over Time
- `apparatus.qr_code`, `apparatus.exclude_from_iso`
- `apparatus_compartments.qr_code`
- `item_assets.apparatus_id` — which truck an asset lives on
- `inspection_sessions.notified_at` — prevents double email on expiry
- `item_asset_inspection_logs.inspection_session_id`
- `training_event_attendance.signature_url`, `.signed_at`
- `burn_permits.officer_signature_url`, `.officer_signed_at`, `.applicant_signature_url`, `.applicant_signed_at`
- `departments.public_slug`, `.public_site_enabled`, `.public_phone/email/address/tagline/about`
- `departments.burn_permit_county_info`, `.burn_permit_restrictions`
- `event_series.is_public`

---

## Session History

### 2026-05-23 — Incident Signatures + Run Sheet Print

**Incident run signature system:**
- `incident_signatures` table — unique on `(incident_id, personnel_id)`. `signed_at` null = pending, timestamp = signed. `signature_data` stores base64 PNG.
- Trigger: after successful NERIS submit, signature rows upserted for all non-absent `incident_personnel` (`app/actions/neris.ts`)
- `app/actions/signatures.ts` — 4 actions: `getPendingSignatureCount`, `getPendingSignatures`, `saveIncidentSignature`, `getIncidentSignatureRoster`
- Inbox (`/inbox`) opened to all members (was officer-only redirect). New **Signatures** tab always first; Permits + Records tabs only visible to officers+. Members can sign from inbox via `IncidentSignaturePadModal`.
- Layout badge (`opsBadge`) includes pending signature count for all members
- Incident detail page — Run Signatures section (officer/admin): shows signed/pending roster, signed count
- `standby` added to `incident_personnel_role_check` DB constraint

**Run Sheet print page (`/print/run-sheet?id=xxx`):**
- Matches dept paper Run Field Report (one letter sheet, portrait)
- Top-left: Date, Address, Incident #, CAD # — Top-right: military times (Paged / Enroute / On Scene / Finished at Scene / Back at Station)
- Middle-left: Units Dispatched — each apparatus with member names listed; **POV** group for non-standby no-apparatus personnel; **Station** group for role=standby no-apparatus personnel
- Middle-right: Type of Incident checkboxes + Mutual Aid (To/From with dept name) + Cause / Dollar Loss / Property Lost / Vehicle Make / NERIS Done fields
- Narrative block if present
- Bottom: full dept roster in 3-column grid, checkmark for each responder
- Mutual aid reads from `incident_mutual_aid` table: `gave_aid` → To, `received_aid` → From; falls back to `incidents.mutual_aid_direction/department`
- Spacing tuned to fit on one sheet: `@page margin: 0.35in`, div padding `0.35in 0.5in`
- PrintButton hardened: `type="button"`, z-index 9999, shadow, "Print / Save PDF"
- "Print Run Sheet" button on incident detail page → opens `/print/run-sheet?id=...` in new tab

### 2026-05-22 — NERIS Rescue Module + Payload Validation
- **Rescue module rebuilt** — `NERIS_RESCUE_TYPE` removed (codes didn't exist in spec); replaced with correct spec-sourced enums:
  - `NERIS_PERSON_TYPE` (FF | NONFF), `NERIS_RESCUE_PERFORMED_BY` (6 rescue outcome codes), `NERIS_RESCUE_MODE` (EXTRICATION etc.), `NERIS_RESCUE_ACTIONS` (TypeRescueActionValue), `NERIS_RESCUE_IMPEDIMENTS`, `NERIS_PRESENCE_KNOWN`
  - `NERIS_CASUALTY_TYPE` codes fixed: INJURED_NONFATAL / INJURED_FATAL (not NONFATALLY / FATALLY)
- **Medical module field names confirmed** from spec — `patient_care_evaluation`, `patient_status`, `transport_disposition`; top-level key is `medical_details` (was wrong `medical_patients`)
- **`NERIS_MEDICAL_DISPOSITION` rebuilt** from `TypeMedicalTransportValue` — TRANSPORT_BY_EMS_UNIT | OTHER_AGENCY_TRANSPORT | NONPATIENT_TRANSPORT | PATIENT_REFUSED_TRANSPORT | NO_TRANSPORT
- **Hazmat key fixed** — `hazsit_detail` (was `hazardous_situation`); inner field names still TODO(api-review)
- **Payload builder** (`buildNerisPayload`) — built actual `CasualtyRescuePayload` with correct discriminated union nesting; built `medical_details` and `hazsit_detail` (were all TODO)
- **`presence_known` bug fixed** — was gated on `!isFfRescue`; corrected to `person_type === 'NONFF'` (a NONFF rescued by a FF still needs presence_known)
- **Outside fire form fixed** — condition on arrival, building damage, floor/room of origin now hidden for outside/wildland fires (were shown for all non-transportation fires)
- **Requirements checker fixed** — `fire_condition_arrival`, building damage, floor/room now structure-fire-only; `OUTSIDE_FIRE_CODES` / `STRUCTURE_FIRE_CODES` matching fixed to split pipe-delimited codes by `||` segment
- **Ventilation timing variants added** — 12 new action codes (PRIOR_TO_SUPPRESSION / DURING_SUPPRESSION / POST_SUPPRESSION for all 4 ventilation types)
- **Payload preview copy button fixed** — fallback to `execCommand` for HTTP localhost; shows "✓ Copied" confirmation
- **Auth clarification** — production credentials don't work with test API (separate OAuth servers); test credentials were retired when badge was issued; local dev uses preview only
- **Confirmed clean payloads**: motor vehicle extrication (FFD26-1819) and wildland fire (UEH26-0017)

### 2026-05-20 — Hub-and-Spoke Nav + NERIS Production + Admin Troubleshooting
- Sidebar trimmed to 6 top-level items: Dashboard, Operations, Personnel, Training, Equipment, Reports
- Dept Admin collapsed to single link → `/dept-admin` hub page with conditional tiles (ISO, NERIS, Public Site)
- New hub pages: `/operations`, `/reports`, `/iso` (sub-hub under Dept Admin)
- Enhanced existing pages as hubs: `/equipment` (section cards + apparatus grid), `/training` (Events/Certs/Print cards), `/personnel` (subtitle)
- `HubCard` component (`components/HubCard.tsx`) — shared card with stat badge + alert state
- `PageNavBar` component (`components/PageNavBar.tsx`) — auto Back + parent hub link on every page, pathname-driven
- NERIS V1 Compatible badge earned — passed FSRI compatibility check (2026-05-20)
- NERIS production credentials obtained from neris.fsri.org, set in Vercel + .env.local
- NERIS dept enrollment UI (`/dept-admin/neris`) rebuilt — full 4-step guide (NERIS account signup → entity ID → FireOps7 integration enrollment → connect), FireOps7 Client ID displayed with copy button, Test Connection button pings NERIS API
- `nerisCheckEntityExists()` added to `lib/neris-api.ts` — uses validate endpoint to confirm entity + auth
- `testNerisConnection()` server action added to `app/actions/departments.ts`
- NERIS admin troubleshooting panel (`/admin/neris`) — 3 tabs:
  - Departments: all NERIS-enabled depts, entity ID status, submitted/draft/error counts, last submission, per-dept Test button
  - Issues: failed submissions with raw error + ready-but-not-submitted drafts, direct link to NERIS form
  - Error Logs: system_logs filtered to NERIS with dept context
- `neris_last_error` column added to `incident_neris` — stores API error message on failed submissions
- Submit action: on failure writes `neris_status='error'` + `neris_last_error`; on success clears `neris_last_error`
- `NERIS_USE_TEST` still `true` — flip to `false` after confirming production credentials work

### 2026-05-17 — Training Module Overhaul + Fire School Polish
- Training member page: replaced 3-tab layout with unified My Training list + My Certifications section
- Simple cert flow: admin assigns cert with training date → member logs attendance after date → officer verifies → cert auto-issued → member signs
- Training events: added `certification_type_id` — verified attendance auto-issues cert to member
- Direct cert entry: admin UI built in Enrollments tab, `createDirectCertification` action (was action-only, no UI)
- Member signatures on all cert records (`member_certifications.signature_url`, `signed_at`)  
- `CertSignaturePadModal` component for cert signing
- Dept-wide enrollment: "Assign to All Active Members" toggle — one click creates enrollments for entire dept
- Re-enroll button on withdrawn enrollment rows
- Admin Pending tab: shows both pending course unit progress AND pending simple cert sessions
- Fuel log: inline edit for officer+ (Edit button per row, same form pre-filled)
- Fire school: on/off toggle in sys admin (system_settings table) — when off, QR codes show marketing cover page with inquiry form
- Fire school inquiry form: submits to system_logs as fire_school_inquiry type
- Salamander QR scanner: Take Photo fallback for dense QR codes

### 2026-05-16 — Fire School Realtime + Verification + QR Research
- Fire school settings page (`/fire-school/settings`) — timezone selector saved to localStorage per device, drives fill log timestamp display
- Fill log converted to Supabase Realtime — new fills appear instantly on tablet without reload, new rows flash green for 3s, pulsing Live badge in header
- Fill verification added — `verified_at` column on `fire_school_fill_logs`; Verify button on tablet fill log row; Verify button on fill station success screen for single-operator use
- Unverified fill prompt — scanning a bottle that has an unverified fill shows an amber banner with Verify/Skip before the normal fill flow
- QR scanner improvements — native BarcodeDetector API (Chrome/Android) as primary with jsQR fallback; Take Photo button uses native camera for full-res still decode (solves dense/proprietary QR codes)
- Salamander personnel accountability QR format decoded — binary payload with readable fields: LASTNAME*FIRSTNAME, dept name after ESC char, title, cert codes. Stored in `qr_debug_scans` for reference.
- Accountability module architecture documented in REFERENCE.md — full standalone PAR system with temp cards, planned for future build
- Kiosk/movement tracking concept documented in CLAUDE.md — deferred, build accountability first

### 2026-05-06 — Admin Hub + Unified Nav + ISO
- Equipment hub (`/dept-admin/setup`): wizard → plain tabs (Stations/Apparatus/Compartments/Items/Assets), Personnel tab removed
- Load button on each apparatus card → `/equipment/[id]?from=/dept-admin/setup`; back nav returns to hub
- Back button moved below header as styled action row button across ALL detail pages (equipment, stations, incidents, personnel, inspection run, new incident, new event)
- Personnel hub (`/dept-admin/personnel`): Members tab (card grid 1→2→3 cols) + Attendance Settings tab
- Training hub: updated to left rail + mobile scroll tabs, renamed "Training"
- Main nav unified — identical for all roles: Dashboard/Personnel/Training & Events/Operations/Inspections/Reports
- ISO removed from main nav; added to Dept Admin: Hose Inventory / Hydrants / ISO Report (3 separate links)
- Assets tab added to Equipment hub (5th tab): card grid using existing props + "Full Roster →" link
- `removeHose` + `removeHydrant` server actions added to `iso.ts`
- Hose/Hydrant pages: Add button moved below header, Remove button added per row (inline confirm/cancel)

### 2026-05-06 — Nav Redesign + Member Equipment + Back Navigation
- Nav restructured: Personnel / Training & Events / Operations / Inspections / ISO (officer+) / Reports
- Apparatus + Stations removed from main nav — accessed via Inspections drill-down
- My Profile: sidebar footer name links to own personnel profile page
- Inspections landing page rebuilt — stations group apparatus cards, compartments visible inline with View / Inspect / Daily Check per row
- Member equipment: `moveItemToCompartment` + `removeItemFromCompartment` opened to all dept members (was officer+)
- `CompartmentItemsClient` — Move modal (apparatus + compartment picker) + Remove confirm on compartment detail page
- `BackButton` component (`components/BackButton.tsx`) — accepts `href` for explicit dest or falls back to `router.back()`
- `?from` navigation pattern: InspectionsClient View links pass `?from=/inspections`; compartment page reads it and passes to BackButton
- Hardcoded back destinations: personnel → /personnel, stations → /stations, incidents → /incidents
- Compartment detail page: removed Verify Present + Start Inspection buttons (accessed via Inspections page); Back is now a styled action card button
- Docs split: CLAUDE.md / REFERENCE.md / MODULES.md / HISTORY.md (previous session)

### 2026-05-05 — Permit Flow, Login Polish, Equipment Nav
- Burn permit submission triggers `logEvent` → notify-on-log → sys admin email
- Sign-then-approve flow: officer must sign via `PermitSignatureModal` before status flips to approved
- Login page: show/hide password toggle (eye icon, tabIndex -1)
- Apparatus detail: "Manage Equipment" link → `/equipment/[id]` (officer+ only, when active compartments)
- `signature_pad` npm package installed (was missing from node_modules)
- CLAUDE.md trimmed to essentials; REFERENCE.md / MODULES.md / HISTORY.md split out

### 2026-05-05 — Burn Permit Signatures + Public Site Completion (earlier session)
- Config validation: yellow banner + server-side block if county/sheriff info missing
- Officer signs in inbox → `signatures/permits/officer/{id}.png`
- Resident signs/acknowledges at `/dept/[slug]/permit-status`
- Both signatures embedded on printed permit
- `ApplicantSignatureSection` — choose digital sign vs print-and-sign path

### 2026-05-04, session 2 — Public Site + Inbox + Burn Permit
- `/dept/[slug]/*` — landing, events, burn permit, records request
- Permit status + public print pages
- Sys admin Public Site config tab on `/admin/dept/[id]`
- Officer event public/private toggle from `/events` manage panel
- Public Inbox (`/inbox`) — burn permits + records requests tabs
- Printable Nebraska state burn permit (NE Statute 81-520.01 legal text)
- `send-permit-approval` Edge Function deployed (awaiting domain verification)
- `apparatus.exclude_from_iso` flag

### 2026-05-04, session 1 — Announcements + Training Signatures
- `/announcements` — newest-first, pinned float, officer create, admin pin/delete, all mark read
- Dashboard unread announcement banner
- `signature_pad` installed, `SignaturePadModal` built
- Training signatures: members sign own records, embedded on `/print/training-signin`

### 2026-05-03, session 2 — Setup Flow Polish + Permission Model
- Inspection Templates tab in Dept Setup
- HelpPrompt dismissable help system (localStorage persistence)
- Officer add personnel via `PersonnelAddForm` on `/personnel`
- Dashboard profile card (replaced 3 stat cards)
- Role-adaptive quick links on dashboard
- Nav: "Training" → "Certifications", Incidents → Operations group
- Permission model finalized: setup = admin only, operational pages = role-adaptive

### 2026-05-03, session 1 — Dept Setup Flow
- `/dept-admin/setup` — 5-step rail (Stations → Apparatus → Personnel → Compartments → Items & Assets)
- Desktop sidebar + mobile horizontal scrollable tab bar
- Each step: records as cards + inline edit + inline add form

### 2026-04-30 — Flow & Presentation Polish
- Dashboard: removed SCBA Bottles stat card
- Personnel: card grid replacing scrolling table
- Nav: split Apparatus group into Apparatus + Equipment

### 2026-04-28 — QR Printing, Session Expiry Notifications, ISO Baseline
- `/print/qr` dedicated print page; bottle QR labels; fill station auto-check on scan
- `notify-expired-sessions` Edge Function (hourly cron)
- ISO DB tables + `/iso/hoses`, `/iso/hydrants`, `/iso/report`, apparatus ISO specs card
- Incident mutual aid section

### 2026-04-27 — Inspection Sessions, Asset Roster, Compartment Detail, QR Infrastructure
- Inspection sessions (`/inspections/apparatus/[id]`) with claim/release, 12h expiry, auto-complete
- Asset Roster (`/equipment/assets`) with inline apparatus assignment
- Compartment detail page (`/equipment/[id]/[compartment_id]`)
- QR code columns on apparatus + compartments, `/scan` route
- Incident attendance self-log + officer verification
- Excused absence flow, Close Event, auto-close cron

---

## Reference Documents
- Winslow Run Sheet (Excel) — uploaded April 16, 2026
- CAD CFS Report (PDF) — uploaded April 16, 2026 (Dodge County 9-1-1)
  - Workflow: received via email → manually transcribed into NERIS
