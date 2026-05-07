# FireOps7 — Build History & DB Reference

## What's Built & Working ✅
- Full auth flow + middleware routing
- Unified main nav — identical for all roles: Dashboard / Personnel / Training & Events / Operations / Inspections / Reports
- My Profile link in sidebar footer (name links to own personnel profile)
- Dept Admin hub: Equipment (`/dept-admin/setup`) / Personnel (`/dept-admin/personnel`) / Training (`/dept-admin/training`) / Hose Inventory / Hydrants / ISO Report
- Equipment hub — 5 tabs: Stations, Apparatus (with Load button), Compartments, Items, Assets
- Personnel hub — 2 tabs: Members (card grid), Attendance Settings
- Training hub — 4 tabs: Cert Types, Enrollments, Pending, Events (left rail + mobile scroll)
- Sys admin dashboard, Departments, Users, System Logs
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
- Inspections landing page — grouped by station → apparatus cards → compartments with View / Inspect / Daily Check
- Daily Check mode (presence-only)
- QR system — human-readable codes, `/scan` redirect, print labels
- Announcements — pinning, unread tracking, dashboard banner
- Events + attendance — full lifecycle, excused absence, close event, auto-close cron
- Training/Certifications — courses, enrollments, verification, direct cert entry, training events, digital signatures
- Incidents — manual entry, apparatus/personnel tracking, mutual aid, officer verify + finalize
- ISO audit — hose inventory (add/edit/remove/log test), hydrant flow tests (add/edit/remove/log test), apparatus specs, mutual aid log, `/iso/report`
- Reports — inspections, inventory, training, attendance, my-activity (all with print)
- Member training record print
- Public department sites — `/dept/[slug]/*`, per-dept on/off toggle
- Burn permit system — public form, inbox sign-then-approve flow, officer + applicant signatures, printable Nebraska state permit
- Burn permit submission notification → logEvent → sys admin email
- Records request system — public form, inbox review flow
- Public Inbox — burn permits + records tabs, pending count badge
- Login show/hide password toggle
- BackButton component — `href` prop for explicit dest, else `router.back()`; always below header in action row
- Fire School — QR scanning, bottle tracking, fill log
- Error logging + email via notify-on-log Edge Function
- Vercel deployed + fireops7.com DNS live

## What's Not Yet Built
- Equipment storage system — unassigned item pool, member add-from-storage, move logging. **When building:** restore the quantity guard in `removeItemFromCompartment` (`app/actions/equipment.ts`) — was removed temporarily since storage doesn't exist yet. Gate removal on quantity = 0 and require user to move quantity to storage first.
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

### Attendance
- `excuse_types`, `participation_requirements`
- `event_series`, `event_instances`, `event_attendance`

### Training
- `certification_types`, `certification_course_units`, `course_enrollments`
- `member_course_progress`, `member_certifications`
- `training_events`, `training_event_attendance`

### Incidents
- `incidents`, `incident_apparatus`, `incident_personnel`, `incident_fire_details`

### Comms / Content
- `announcements`, `announcement_reads`
- `burn_permits`, `public_record_requests`
- `system_logs`

### ISO
- `apparatus_iso_specs`, `hoses`, `hose_tests`, `hydrants`, `hydrant_flow_tests`, `incident_mutual_aid`

### Fire School (public, no auth)
- `fire_school_bottles`, `fire_school_fill_logs`

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
