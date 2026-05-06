# FireOps7 — Reference (Historical / Pull When Needed)

## What's Built & Working ✅
- Full auth flow + middleware routing
- Role-aware sidebar + mobile hamburger drawer
- Sys admin dashboard — department cards with stats
- Sys admin — Departments, Users, System Logs (full log viewer)
- Sys admin dept drill-in — `/admin/dept/[id]` 5 tabs (Personnel/Stations/Apparatus/Compartments/Public Site)
- Dept Admin — Dept Setup, Items, Attendance Settings, Training
- Personnel roster + profile (role-based editing, change password, officer add personnel)
- Apparatus list + detail (edit, compartment assign/remove, Manage Equipment link → `/equipment/[id]`)
- Stations list + detail
- Compartment names management + assignment to apparatus
- Equipment pages — `/equipment/[id]` (assign/remove/move items), `/equipment/[id]/[compartment_id]` (detail)
- Asset Roster (`/equipment/assets`) with dept-wide asset list, status filters, inline apparatus assignment
- Item management — Categories / Items / Assets tabs
- Inspection template builder — inline via Dept Setup → Items → Inspection Templates tab
- Inspection run UI — `/inspections/run` checklist with asset picker, presence checks, all step types
- Inspection sessions (`/inspections/apparatus/[id]`) — claim/release, 12h expiry, notify-expired-sessions cron
- Daily Check mode — presence-only (`?mode=presence`), logs to `compartment_presence_check_logs`
- QR system — `apparatus.qr_code` + `apparatus_compartments.qr_code`, `/scan` route, `/print/qr` print page
- Announcements — `/announcements` + dashboard unread banner; pin/delete admin controls
- Events + attendance — full lifecycle including verification queue, excused absence, close event, auto-close cron
- Training/Certifications — cert types, course units, enrollments, progress verification, direct cert entry, training events with signatures
- Incidents — manual entry, apparatus + per-unit times, personnel, fire details, officer verify + finalize, mutual aid log
- ISO audit — hose inventory/tests, hydrant flow tests, apparatus ISO specs, `/iso/report`
- Department announcements + unread tracking
- Training signatures — `SignaturePadModal`, saves to Supabase Storage `signatures/`, embedded on print sheets
- Member training record print — `/print/member-training`
- Public-facing department sites — `/dept/[slug]/*`, per-dept on/off via `departments.public_site_enabled + public_slug`
- Burn permit system — public form, officer inbox approval (sign-then-approve flow), signatures (officer + applicant), printable Nebraska state permit
- Records request system — public form, officer inbox review flow
- Public Inbox (`/inbox`) — burn permits + records requests with pending count badge
- Burn permit submission notification — `logEvent` on submit → `notify-on-log` → email to sys admin (temporary until domain verified)
- Burn permit approval notification — `logEvent` on approve → sys admin forwards to resident (temporary)
- Login page show/hide password toggle
- Password show/hide on login screen
- Fire School — QR scanning, bottle tracking, fill log
- Vercel deployed + fireops7.com DNS live

## What's Placeholder / Not Yet Built
- Permit approval email direct to resident (blocked until fireops7.com verified in Resend, ~1 month)
- Permit submission notification direct to dept email (currently goes to sys admin)
- Inspection schedule settings (daily/weekly/monthly per dept)
- Subdomain routing (`slug.fireops7.com`) — blocked until Vercel Pro
- Officer personnel inline edit on roster cards
- Public site Option B (API keys) — on demand

---

## App Route Structure

### Route Groups
| Group | Routes | Auth |
|---|---|---|
| `(auth)` | `/login`, `/change-password`, `/profile-setup`, `/pending`, `/denied` | Public |
| `(dashboard)` | All dashboard routes | Required |
| `(fire-school)` | `/fire-school`, `/fire-school/bottles`, `/fire-school/fill-log` | Public |
| `(public-site)` | `/dept/[slug]/*` | Public |

### Dashboard Routes
- `/dashboard` — dept dashboard or sys admin overview
- `/personnel`, `/personnel/[id]` — roster + profile
- `/apparatus`, `/apparatus/[id]` — apparatus list + detail
- `/stations`, `/stations/[id]` — stations list + detail
- `/equipment/[id]` — equipment management per apparatus (assign/remove/move items)
- `/equipment/[id]/[compartment_id]` — compartment detail (items, assets, inspection history)
- `/equipment/assets` — dept-wide asset roster (Apparatus nav group)
- `/inspections`, `/inspections/run`, `/inspections/apparatus/[id]` — inspection flow + sessions
- `/scan` — QR code lookup + redirect
- `/events`, `/events/new` — events + attendance
- `/training` — enrollments, certifications, training events (nav label: "Certifications")
- `/announcements` — announcements with unread badge
- `/incidents`, `/incidents/[id]`, `/incidents/new` — incident log
- `/reports/inspections`, `/reports/inventory`, `/reports/training`, `/reports/attendance`, `/reports/my-activity`
- `/iso/hoses`, `/iso/hydrants`, `/iso/report`
- `/inbox` — Public Inbox: burn permits + records requests (officers/admins)
- `/admin/departments`, `/admin/users`, `/admin/logs` — sys admin
- `/admin/dept/[id]` — sys admin dept drill-in
- `/dept-admin/setup`, `/dept-admin/items`, `/dept-admin/attendance`, `/dept-admin/training`

### Public Site Routes (no auth)
- `/dept/[slug]` — department landing page
- `/dept/[slug]/events` — upcoming public events (is_public=true only)
- `/dept/[slug]/burn-permit` — burn permit request form
- `/dept/[slug]/records` — records request form
- `/dept/[slug]/permit-status` — permit lookup + applicant signature
- `/dept/[slug]/permit-print` — public printable permit (by confirmation code)

### Print Routes
- `/print/qr` — QR label print
- `/print/training-signin?event_id=xxx` — training sign-in sheet with signatures
- `/print/member-training?personnel_id=xxx&from=xxx&to=xxx` — member training record
- `/print/burn-permit?id=xxx` — officer-facing permit print (auth required)

---

## Key Action Files
- `app/actions/auth.ts` — signIn, changePassword, signOut
- `app/actions/personnel.ts` — updateOwnProfile, updatePersonnelProfile, updateDeptPersonnel, changeOwnPassword
- `app/actions/apparatus.ts` — createApparatus, updateApparatus
- `app/actions/stations.ts` — createStation, updateStation
- `app/actions/compartments.ts` — createCompartmentName, assignCompartmentToApparatus, removeCompartmentFromApparatus, setCompartmentQrCode
- `app/actions/equipment.ts` — createItemCategory, createItem, updateItem, createAsset, updateAsset, assignItemToCompartment, removeItemFromCompartment, moveItemToCompartment, assignAssetApparatus
- `app/actions/inspections.ts` — createInspectionTemplate, addTemplateStep, updateTemplateStep, deleteTemplateStep, submitInspection, inspection session actions
- `app/actions/attendance.ts` — createEventSeries, updateEventInstance, logAttendance, verifyAttendance, requestExcuse, closeEventInstance, cancelEventInstance, createExcuseType, saveParticipationRequirement
- `app/actions/incidents.ts` — createIncident, updateIncident, setIncidentStatus, apparatus/personnel/attendance actions
- `app/actions/training.ts` — createCertificationType, createCourseUnit, enrollMember, verifyProgress, logDirectCert, createTrainingEvent, logTrainingAttendance, saveTrainingSignature
- `app/actions/announcements.ts` — createAnnouncement, deleteAnnouncement, pinAnnouncement, markAnnouncementRead
- `app/actions/iso.ts` — upsertApparatusIsoSpecs, hose/hydrant/mutual aid actions
- `app/actions/users.ts` — createDeptMember
- `app/actions/fire-school.ts` — checkBottle, logFill, addFireSchoolBottle
- `app/actions/public-site.ts` — savePublicSiteSettings, toggleEventSeriesPublic, submitBurnPermit, submitRecordRequest, updateBurnPermitStatus, updateRecordRequestStatus, savePermitOfficerSignature, savePermitApplicantSignature

## Supabase Edge Functions
- `notify-on-log` — emails zklein3@gmail.com on new system_logs entries (all log_type values)
- `auto-close-events` — nightly 2 AM UTC, closes stale event instances, marks absent
- `notify-expired-sessions` — hourly, emails officers when inspection sessions expire
- `send-permit-approval` — emails resident on burn permit approval (awaiting fireops7.com Resend domain verification)

---

## Permission Model

### Setup vs Operational
- Setup flow (`/dept-admin/setup`) — admin only
- Main nav pages — role-adaptive
- Officers can: add personnel (officers/members), edit apparatus, assign items, run inspections, manage events/attendance, approve permits, toggle events public
- Officers cannot: create apparatus/stations/compartments/item types, manage roles, access dept-admin setup

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
| Create/log incidents | ❌ | ✅ | ✅ | ✅ |
| Edit apparatus/station info | ❌ | ✅ | ✅ | ✅ |
| Assign items to compartments | ❌ | ✅ | ✅ | ✅ |
| Add/manage personnel | ❌ | ✅* | ✅ | ✅ |
| Add/deactivate apparatus/stations | ❌ | ❌ | ✅ | ✅ |
| Manage compartments/items/categories/assets | ❌ | ❌ | ✅ | ✅ |
| Create certification types + courses | ❌ | ❌ | ✅ | ✅ |

*Officers can add officers/members. Admin role assignment stays under `/dept-admin/setup`.

---

## Burn Permit System
- Public form at `/dept/[slug]/burn-permit` → `burn_permits` table with auto confirmation code
- Submission triggers `logEvent` → `notify-on-log` → email to sys admin (temporary until domain verified)
- Officer reviews in `/inbox` → must configure `burn_permit_county_info` + dept name first
- Approval flow: officer fills expiry/notes → clicks "Sign & Approve" → signs permit → status set to approved → logEvent notification
- Direct resident email: `send-permit-approval` Edge Function deployed, swap in when fireops7.com verified in Resend
- Signatures stored: `signatures/permits/officer/{id}.png` and `signatures/permits/applicant/{id}.png`
- Nebraska Statute 81-520.01 hardcoded on permit. County sheriff info set per-dept in Admin → Public Site tab.
- Resident confirms/signs at `/dept/[slug]/permit-status?code=xxx`

## Public Site System
- Path-based: `fireops7.com/dept/[slug]` — one codebase, all depts
- Per-dept on/off via `departments.public_site_enabled` + `public_slug` (sys admin sets in `/admin/dept/[id]` → Public Site tab)
- Middleware bypasses auth for `/dept/*` routes
- Events on public site require `event_series.is_public = true` (toggled from `/events` manage panel)
- Future: subdomain routing when Vercel Pro; API key Option B when customers ask

## Test Data (Winslow Fire)
- Engine 32 → D1 (Scott Air Pack ×2, Scott Air Pack Bottle ×2, Halligan ×1) + P1 (Chainsaw ×1)
- Assets: Chainsaw 1, Scott Air Pack 1, Scott Air Pack 2, B-0001, B-0002
- Templates: Weekly Chainsaw Inspection (3 steps), Weekly Airpack Inspection (4 steps)

---

## User Roles

### signup_status values
| Status | Redirect |
|---|---|
| `temp_password` | /change-password |
| `profile_setup` | /profile-setup |
| `active` | /dashboard |
| `awaiting_approval` | /pending |
| `denied` | /denied |

### Role Fields
| Field | Table | Purpose |
|---|---|---|
| `is_sys_admin` | `personnel` | Global — all departments, no dept record needed |
| `system_role` | `department_personnel` | `admin / officer / member` within dept |
| `department_id` | `department_personnel` | Scopes all data to their department |

---

## Attendance Module
- `requires_verification` defaults to TRUE — admin consciously opts out
- Self-report window: 12 hours from event start time (members only)
- Officer/admin can log retroactively at any time
- DB: `excuse_types`, `participation_requirements`, `event_series`, `event_instances`, `event_attendance`

## Equipment / Inspection System

### Inspection Design
- **Daily Check** — presence-only (`?mode=presence`). Shows present/missing + qty, no checklist. Logs to `compartment_presence_check_logs`.
- **Full Inspection** — asset-tracked items with template → N slots driven by `expected_quantity`. Each slot: pick asset → run checklist → submit.
- Rule: `presenceOnly || !(requires_inspection && templates.length > 0)` → presence check. Otherwise → full inspection.
- ASSET_LINK step type removed. Bottles are standalone location standard items.

### Inspection Sessions
- `inspection_sessions`: apparatus_id, status (`in_progress`|`completed`|`expired`), 12h expiry
- `inspection_session_compartments`: one record per compartment, claim/release/complete flow
- One person per compartment — claimed on click, officer/admin can release stuck compartments
- `notify-expired-sessions` Edge Function runs hourly — emails officers when sessions expire

### QR System
- Apparatus QR: encodes `fireops7.com/scan?type=apparatus&code=ENGINE-32`
- Compartment QR: encodes `fireops7.com/scan?type=compartment&code=ENGINE-32-D1`
- `/scan` looks up code, redirects to correct page
- QR label print at `/print/qr`

---

## Training Module

### Three Scenarios
1. **Certification Course** — Admin creates course + units, enrolls member, member submits progress, officer verifies → cert record
2. **Direct Cert Entry** — Admin logs cert directly (no course history)
3. **Training Event** — Officer/admin creates event, logs attendance, no cert attached

### Key Rules
- Expiration: configurable per cert type (e.g. FF1 Nebraska = no expiration, EMT-B = 24 months)
- Renewals create new cert record — history kept
- DB: `certification_types`, `certification_course_units`, `course_enrollments`, `member_course_progress`, `member_certifications`, `training_events`, `training_event_attendance`

---

## Incident Log Module
- Manual entry → CAD email parsing (future) → CAD API (future)
- EMS reporting NOT in scope
- DB: `incidents`, `incident_apparatus`, `incident_personnel`, `incident_fire_details`
- `first_enroute_at` auto-computed as min `enroute_at` across apparatus

---

## Database Tables

### Fire Department (auth-protected, RLS)
- `departments`, `stations`, `apparatus`, `apparatus_types`
- `apparatus_compartments`, `compartment_names`
- `personnel`, `department_personnel`
- `items`, `item_categories`, `item_assets`, `item_location_standards`
- `item_inspection_templates`, `item_inspection_template_steps`
- `item_asset_inspection_logs`, `item_asset_inspection_log_steps`
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
- `burn_permits`, `public_record_requests`
- `system_logs`

### Fire School (public, no auth)
- `fire_school_bottles`, `fire_school_fill_logs`

### Key DB Fields Added Over Time
- `apparatus.qr_code`, `apparatus.exclude_from_iso`
- `apparatus_compartments.qr_code`
- `item_assets.apparatus_id` — which truck an asset lives on
- `inspection_sessions.notified_at` — prevents double email on expiry
- `item_asset_inspection_logs.inspection_session_id`
- `training_event_attendance.signature_url`, `.signed_at`
- `burn_permits.officer_signature_url`, `.officer_signed_at`, `.applicant_signature_url`, `.applicant_signed_at`
- `departments.public_slug`, `.public_site_enabled`, `.public_phone`, `.public_email`, `.public_address`, `.public_tagline`, `.public_about`, `.burn_permit_county_info`, `.burn_permit_restrictions`
- `event_series.is_public`

---

## ISO Audit
- Built: apparatus specs (`apparatus_iso_specs`), hose inventory/tests (`/iso/hoses`), hydrant flow tests (`/iso/hydrants`), mutual aid log on incident detail, `/iso/report`
- Future: mutual aid partners table (manual entry → partner self-entry page → cross-dept data pull)

## Fire School
- Uses BarcodeDetector Web API, rear camera via getUserMedia
- Scan → bottle ID → handleCheck() → fill log
- IDs are public/shared across depts, separate from main app QR system

---

## Session History

### 2026-05-05 — Permit Flow, Show/Hide Password, Equipment Nav
- Burn permit submission now triggers `logEvent` → sys admin email notification
- Officer must sign permit before approving (sign-then-approve flow in BurnPermitsTab)
- Login page: show/hide password toggle (eye icon button)
- Apparatus detail: "Manage Equipment" button → `/equipment/[id]` (officer+ only)
- `signature_pad` npm package installed (was missing, broke build)

### 2026-05-05 — Burn Permit Signatures + Public Site Completion
- Config validation in inbox: yellow banner if county/sheriff info missing, blocks approval server-side
- Burn permit signature flow: officer signs in inbox → resident signs/acknowledges on permit-status → both embedded on printed permit
- `PermitSignatureModal` — saves to `signatures/permits/officer/{id}.png`
- `ApplicantSignatureSection` — choose sign digitally or print and sign

### 2026-05-04, session 2 — Public Site + Inbox + Burn Permit
- Public site at `/dept/[slug]/*` — landing, events, burn permit, records request
- Permit status + public print pages
- Sys admin Public Site config tab
- Public Inbox (`/inbox`) — burn permits + records requests tabs
- Printable Nebraska state burn permit (NE Statute 81-520.01)
- `send-permit-approval` Edge Function deployed (awaiting domain verification)

### 2026-05-04, session 1 — Announcements + Training Signatures
- `/announcements` with pinning, unread tracking, dashboard banner
- `SignaturePadModal` + training signatures on `/print/training-signin`

### 2026-05-03, session 2 — Setup Flow Polish + Permission Model
- Inspection Templates tab in Dept Setup
- HelpPrompt dismissable help system
- Officer add personnel on `/personnel`
- Dashboard profile card + role-adaptive quick links
- Nav: "Training" → "Certifications", Incidents → Operations group

### 2026-05-03, session 1 — Dept Setup Flow
- `/dept-admin/setup` five-step rail (Stations → Apparatus → Personnel → Compartments → Items & Assets)

### 2026-04-30 — Flow & Presentation Polish
- Personnel card grid | Nav split into Apparatus + Equipment groups

### 2026-04-28 — QR Printing, Session Expiry Notifications, ISO Baseline
- `/print/qr` | `notify-expired-sessions` Edge Function | ISO DB + pages

### 2026-04-27 — Inspection Sessions, Asset Roster, Compartment Detail, QR Infrastructure
- Inspection sessions with claim/release | Asset Roster | Compartment detail | `/scan` route
- Incident attendance self-log + officer verify | Excused absence flow | auto-close cron

---

## Reference Documents
- Winslow Run Sheet (Excel) — uploaded April 16, 2026
- CAD CFS Report (PDF) — uploaded April 16, 2026 (Dodge County 9-1-1)
  - Current workflow: received via email after call → manually transcribed into NERIS
