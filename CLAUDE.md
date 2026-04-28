@AGENTS.md

## Session Start Checklist
1. Verify Git is installed: `git --version`. If not found, download from https://git-scm.com/download/win and install before proceeding.
2. Run `git pull` to sync latest changes from remote before starting any work.
3. Run `git status` and `git log --oneline -5` to review what changed since the last session.
4. Run `npm run build` to confirm the current branch compiles clean before making changes.

## Local-Only Files — Never Commit
- `.env.local` — Supabase keys + Resend API key
- `.claude/settings.json` — Claude Code permissions, machine-specific paths. Each machine maintains its own. There is ONE settings file per machine (settings.local.json was merged into settings.json and removed). Do NOT commit.

# FireOps7 — Project Guide

## Stack
- **Next.js 16.2.3** (App Router, TypeScript, Server Actions)
- **Supabase** (PostgreSQL 17, Auth, RLS) — project: FireOps7 (kolrhnxozeroaselapzn, us-east-1)
- **Tailwind CSS v4**
- **@supabase/ssr** + **@supabase/supabase-js**
- **Resend** — email notifications via Supabase Edge Function

## GitHub & Machines
- Repo: https://github.com/zklein3/FireOps7-Next — branch: main
- Personal machine: `C:\Users\zklein3\Documents\FireOps7-Next`
- Shared machine: `C:\Users\zklei\Documents\FireOps7-Next`

## Production
- Vercel: https://fire-ops7-next.vercel.app
- Primary domain: https://www.fireops7.com (DNS live)
- Every push to main auto-deploys to Vercel

## Environment Variables (.env.local — never commit)
- NEXT_PUBLIC_SUPABASE_URL=https://kolrhnxozeroaselapzn.supabase.co
- NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci... (anon key)
- SUPABASE_SERVICE_ROLE_KEY=eyJhbGci... (service role key)
- Resend API key stored in Supabase Edge Function Secrets as RESEND_API_KEY

## Supabase Clients
- `lib/supabase/client.ts` — browser client (anon key)
- `lib/supabase/server.ts` — server client (anon key, cookie-based session)
- `lib/supabase/admin.ts` — admin client (service role key, bypasses RLS)

## CRITICAL PATTERNS
- Always use admin client for fetching department-wide data
- Never use nested Supabase joins — causes TypeScript build errors in production
- Always fetch related data flat and join in JavaScript with maps
- sys admin has no department_personnel record — pass department_id explicitly in forms
- Never name a destructured Supabase error variable `logError` — conflicts with imported logger fn. Use `dbErr`, `stepsErr`, etc.

## Attendance Status Values (event_attendance.status)
DB constraint: `pending` | `present` | `absent` | `excused` | `excused_pending`
- `pending` — member self-logged, awaiting officer verification
- `excused_pending` — member submitted excuse request, awaiting officer approval
- `present` — officer approved attendance (or auto-approved when requires_verification = false)
- `absent` — officer rejected, or written by closeEventInstance / auto_close_stale_events()
- `excused` — officer approved excuse request
- event_instances.status: `scheduled` | `cancelled` | `completed` (completed = attendance finalized)

## App Route Structure

### Route Groups
| Group | Routes | Auth |
|---|---|---|
| `(auth)` | `/login`, `/change-password`, `/profile-setup`, `/pending`, `/denied` | Public |
| `(dashboard)` | All dashboard routes | Required |
| `(fire-school)` | `/fire-school`, `/fire-school/bottles`, `/fire-school/fill-log` | Public |

### Dashboard Routes
- `/dashboard` — dept dashboard or sys admin overview
- `/personnel`, `/personnel/[id]` — roster + profile
- `/apparatus`, `/apparatus/[id]` — apparatus list + detail
- `/stations`, `/stations/[id]` — stations list + detail
- `/equipment`, `/equipment/[id]` — equipment by apparatus
- `/equipment/assets` — dept-wide asset roster with status/type filters + inline apparatus assignment (admin)
- `/equipment/[id]/[compartment_id]` — compartment detail: item list, asset status, action buttons (Verify Present / Start Inspection), recent activity, QR code admin form
- `/inspections` — select apparatus + compartment to inspect
- `/inspections/run` — run inspection checklist
- `/scan` — QR code lookup + redirect (`?type=apparatus|compartment|asset&code=...`)
- `/events`, `/events/new` — events + attendance
- `/training` — enrollments, certifications, training events
- `/reports/inspections` — inspection report: filters, flat table, asset drill-in, print (officer/admin only)
- `/reports/inventory` — inventory inspection reports (officer/admin only)
- `/reports/my-activity` — member self-view: attendance, inspections, incidents (all roles)
- `/admin/departments`, `/admin/users`, `/admin/logs` — sys admin pages
- `/admin/dept/[id]` — sys admin dept drill-in (tabbed)
- `/dept-admin/personnel`, `/dept-admin/compartments`, `/dept-admin/items` — dept admin
- `/dept-admin/attendance`, `/dept-admin/training` — dept admin settings
- `/scan` — QR scan landing/redirect ✓ built

### Key Action Files
- `app/actions/auth.ts` — signIn, changePassword, signOut
- `app/actions/personnel.ts` — updateOwnProfile, updatePersonnelProfile, updateDeptPersonnel, changeOwnPassword
- `app/actions/apparatus.ts` — createApparatus, updateApparatus
- `app/actions/stations.ts` — createStation, updateStation
- `app/actions/compartments.ts` — createCompartmentName, assignCompartmentToApparatus, removeCompartmentFromApparatus, setCompartmentQrCode
- `app/actions/equipment.ts` — createItemCategory, createItem, updateItem, createAsset, updateAsset, assignItemToCompartment, removeItemFromCompartment, moveItemToCompartment, assignAssetApparatus
- `app/actions/inspections.ts` — createInspectionTemplate, addTemplateStep, updateTemplateStep, deleteTemplateStep, submitInspection
- `app/actions/attendance.ts` — createEventSeries, updateEventInstance, logAttendance, verifyAttendance, requestExcuse, closeEventInstance, cancelEventInstance, createExcuseType, saveParticipationRequirement
- `app/actions/incidents.ts` — createIncident, updateIncident, setIncidentStatus, addIncidentApparatus, updateIncidentApparatus, removeIncidentApparatus, addIncidentPersonnel, logIncidentAttendance, verifyIncidentPersonnel, removeIncidentPersonnel
- `app/actions/training.ts` — createCertificationType, createCourseUnit, enrollMember, verifyProgress, logDirectCert, createTrainingEvent, logTrainingAttendance
- `app/actions/fire-school.ts` — checkBottle, logFill, addFireSchoolBottle

## Auth
- Roles: `is_sys_admin` (personnel table) | `system_role: admin/officer/member` (department_personnel)
- Sys admin: zklein3@outlook.com — no department_personnel record (intentional), always pass department_id explicitly
- signup_status flow: temp_password → change-password | profile_setup → profile-setup | active → dashboard | awaiting_approval → pending | denied → denied

## Mobile Layout
- Desktop: fixed sidebar (w-64, red-800)
- Mobile: top bar + hamburger → slide-out drawer (MobileSidebar.tsx)
- Main content: `pt-20 px-4 pb-4 sm:pt-0 sm:p-6 lg:p-8`
- All pages responsive: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
- Input text fix: globals.css forces `color: #18181b` and `-webkit-text-fill-color` on all inputs

## Error Logging
- Table: `system_logs` (log_type: error | user_report | info)
- `lib/logger.ts` — logError() in all server actions
- Edge Function `notify-on-log` → email to zklein3@gmail.com via Resend

## RLS Notes
- All dept-wide queries MUST use admin client
- Never use nested Supabase joins
- Recursive RLS causes infinite loops

## Dynamic Route Params — CRITICAL
```ts
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
}
export default async function Page({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams
}
```

## Equipment / Item System

### Item Type Flags
- `tracks_quantity` — count based (auto false when requires_inspection = true)
- `tracks_assets` — individual tracking (auto true when requires_inspection = true)
- `requires_presence_check` — verified during apparatus check
- `requires_inspection` — has inspection template + schedule
- `tracks_expiration` — has expiry date

### Asset Statuses (DB values — must match exactly)
- `IN SERVICE` | `OUT OF SERVICE` | `RETIRED`

### Asset Location Tracking
- `item_assets.apparatus_id` — nullable FK to `apparatus`; records which apparatus an individual asset lives on (e.g. SCBA 1 → Engine 32). Set by admin via Asset Roster inline "Manage" button. Independent of inspection flow.
- `apparatus.qr_code` — unique text; human-readable QR code (e.g. `ENGINE-32`). Set on apparatus edit form.
- `apparatus_compartments.qr_code` — unique text; human-readable QR code (e.g. `ENGINE-32-D1`). Set on compartment detail page (admin). `/scan?type=compartment&code=ENGINE-32-D1` routes to the compartment page.

### Inspection Design — Two Check Modes
- **Daily Check** — presence-only (`?mode=presence`), available from `/inspections` → "Daily Check" button. Shows present/missing + qty for every item, no asset picking or checklist. Logs to `compartment_presence_check_logs`. When QR system is built, scanning a compartment lands here.
- **Full Inspection** — full checklist per individual asset. Each item type (airpack, bottle, chainsaw) is inspected independently in its own slot.

### Independent Asset Model
- Each asset type is inspected on its own — airpacks and bottles are separate items in the same compartment, each with their own checklist and slots. No linking between assets.
- ASSET_LINK step type has been fully removed from the codebase and DB. Do not re-introduce it.

### Inspection Flow
1. Select apparatus → select compartment
2. In Daily Check mode OR any item with no template → presence check (Present/Missing + actual qty)
3. Full Inspection: asset-tracked items WITH a template → N slots driven by `expected_quantity`; each slot: pick asset → run checklist
4. Submit → `item_asset_inspection_logs` + `item_asset_inspection_log_steps` + `compartment_presence_check_logs`

**Key rule:** `presenceOnly || !(requires_inspection && templates.length > 0)` → presence check. Otherwise → full asset inspection.

### Inspection Template Builder
- Dept Admin → Items → Items tab → [item] → Manage → Inspections tab
- Step types: BOOLEAN, NUMERIC, TEXT, LONG_TEXT
- Multiple templates per item type allowed (Daily/Weekly/Monthly)
- ASSET_LINK step type removed — bottles are now standalone location standard items

## IMMEDIATE NEXT — Resume Here Next Session

### 1. Flow & Presentation Polish ← START HERE
When an inspection session is abandoned and expires, notify the department admin/officer. Requires a cron (similar to `auto-close-events`) to sweep expired sessions and trigger Resend email via Edge Function. Design already discussed — lazy expiry is live, active cron + notification is the next step.

### 3. Flow & Presentation Polish

### Completed This Session (2026-04-28) — Session Expiry Notifications + ISO Audit Baseline
- **`notify-expired-sessions` Edge Function** — hourly cron (`0 * * * *`) sweeps for inspection sessions where `expires_at < now()` and `notified_at IS NULL` (catches both lazily-marked expired and sessions nobody re-opened). Marks `status = expired, notified_at = now()` immediately to prevent double-send, then emails all active officers/admins in the department: apparatus name, who started it, when, and compartment completion progress. Uses Resend via RESEND_API_KEY secret. `notified_at timestamptz` column added to `inspection_sessions`.

### Completed This Session (2026-04-28) — ISO Audit Baseline
- **ISO DB tables** — `apparatus_iso_specs`, `hoses`, `hose_tests`, `hydrants`, `hydrant_flow_tests`, `incident_mutual_aid` (all with RLS enabled)
- **`/iso/hoses`** — Hose inventory with NFPA 1962 service test log per hose (date, pressure, duration, pass/fail). Compliance header shows % tested in past 12 months. Officers can add/edit hoses and log tests inline.
- **`/iso/hydrants`** — Hydrant list with flow test history per hydrant (static/residual PSI, GPM, pitot, nozzle). Officers can add/edit hydrants and log flow tests inline.
- **`/iso/report`** — Consolidated ISO audit summary: apparatus specs coverage table, per-hose test compliance (Tested/Overdue/Failed), per-hydrant flow test compliance, recent mutual aid log.
- **Apparatus detail ISO Specs card** — Officer-editable section on apparatus detail page: pump GPM, tank/foam capacity, aerial length, hose load notes. Upsert on save.
- **Incident Mutual Aid section** — Officer-only section on incident detail: log which departments gave/received aid with apparatus description, personnel count, arrival/departure times.
- **`app/actions/iso.ts`** — All ISO server actions: `upsertApparatusIsoSpecs`, `createHose`, `updateHose`, `addHoseTest`, `createHydrant`, `updateHydrant`, `addHydrantFlowTest`, `addMutualAid`, `removeMutualAid`.
- **Design decision** — ISO hose test is a simple log entry (who/when/pressure/pass-fail), not a guided checklist. This matches what ISO auditors historically look for. Can expand to a full checklist workflow later if needed.

### Completed Previous Session (2026-04-28)
- **Inspection Session** (`/inspections/apparatus/[id]`) — session grouping layer on top of existing inspection flow. `inspection_sessions` + `inspection_session_compartments` tables added to DB. `inspection_session_id` added to `item_asset_inspection_logs`. Sessions expire after 12 hours (lazy expiry on page open). One person per compartment — compartment is claimed (`in_progress`) when user clicks Inspect, released by officer/admin. Auto-completes session when all compartments done. Officer/admin "Close Session" force-closes regardless of compartment state.
- **Session server actions** — `getOrCreateInspectionSession`, `claimCompartment`, `completeCompartmentInSession`, `releaseCompartment`, `closeInspectionSession` in `app/actions/inspections.ts`. `submitInspection` updated to accept + store `inspection_session_id` and `session_compartment_id`, auto-marks compartment complete on submit.
- **Session UI** — progress bar (done/total), compartment list with status badges and claimed-by/completed-by names, Inspect → claim → run flow, Release button for officers, Close Session button for officers. Success screen on `/inspections/run` shows "Back to Session" when session context is present.
- **"Start Inspection Session" button** — added to Compartments section header on apparatus detail page, links to `/inspections/apparatus/[id]`. Visible to all roles, only shown when apparatus has active compartments.

### Completed Previous Session (2026-04-27)
- **QR label printing** — `qrcode.react` installed. `QrPrintLabel` client component portals an SVG QR label into body, uses `body.qr-printing` CSS class to isolate the label during `window.print()`. "Print QR Label" button on apparatus detail header + compartment action buttons (only when qr_code is set). Compartment QR code input auto-suggests `{apparatus.qr_code}-{compartment_code}` (e.g. `ENGINE-32-D1`) when no code saved yet; falls back to `{unit_number}-{compartment_code}`.

### Completed Previous Session (2026-04-27)
- **Asset Roster** (`/equipment/assets`) — dept-wide asset list with status summary cards (clickable filters), item type dropdown, search by tag/serial/item. Admin inline "Manage" button per row opens apparatus dropdown to assign/move asset location (`item_assets.apparatus_id`). Mobile card layout. `?search=` URL param pre-fills search (used by `/scan` asset redirect).
- **Asset apparatus assignment** — `item_assets.apparatus_id` FK added to DB. `assignAssetApparatus` server action. Location column shows actual assigned apparatus, not inferred from item type standards.
- **Compartment detail page** (`/equipment/[id]/[compartment_id]`) — item list with expected qty + asset status badges, Verify Present + Start Inspection action buttons (pre-filled links to existing inspection run), recent full inspection and presence check history. "View →" link added to each compartment header in equipment detail.
- **QR code infrastructure** — `apparatus.qr_code` and `apparatus_compartments.qr_code` unique text columns added to DB. Admin UI: qr_code field on apparatus edit form + compartment detail page form. `/scan` route looks up code across all types, redirects to correct page, shows error screen if not found.
- **Incident attendance — member self-log + officer verification** — members log onto active incidents via "Log Attendance" (role select + confirm/cancel, 7-day window). Officer sees pending queue per incident → Approve → `present` / Reject → `absent`. Incident list shows "My Attendance" column for members with "Log →" link on open incidents. `incident_personnel.status` constraint updated to `pending | present | absent`.
- **Incident apparatus times pre-populate** — clicking "+ Add" apparatus pre-fills paged/on-scene/leaving/in-service from the incident's saved times (both on new incident form and detail page). `first_enroute_at` removed from manual entry — auto-computed as min `enroute_at` across apparatus and synced to DB on every apparatus add/update/remove.
- **Attendance status fix** — `verifyAttendance` was writing `verified`/`rejected`; changed to `present`/`absent` to match both reports. DB check constraint updated, 7 existing records backfilled.
- **My Activity stat counts** — now correctly count `present`, `excused`, `absent`, `pending` (was always 0 due to status mismatch)
- **Excused absence flow** — member submits `requestExcuse` (upcoming = "Notify of Absence", past = "Request Excused Absence"); creates `excused_pending` record. Officer sees Excuse Requests queue per event → Approve → `excused` / Deny → `absent`. Members auto-marked absent by Close Event can still appeal within 7-day window.
- **Close Event (officer)** — "Close Event" button in Manage panel for past events; marks all unrecorded active dept members as `absent`, sets instance `status = completed`. Locked from further changes.
- **Auto-close cron** — `auto_close_stale_events()` SQL function + `auto-close-events` Edge Function runs nightly at 2 AM UTC. Auto-closes any `scheduled` instance older than 7 days with same absent logic.
- **Member attendance UX** — Log Attendance is now two-step (Confirm/Cancel before submitting). Excuse form has Cancel button. "Request Excuse" renamed to "Request Excused Absence".
- **Event form inputs** — Start time `step=60` (1-min precision), Duration `step=1` (free typing, e.g. 50 min).
- **`.claude/settings.json`** — `settings.local.json` deleted, merged into single file; all Supabase MCP tools + memory write path added.

### Completed Previous Session
- Training/Cert Report (`/reports/training`) — officer/admin, filters by member/cert type/date range, expiry flagging, printable
- Attendance Report (`/reports/attendance`) — officer/admin, participation rates, threshold flagging, printable
- Collapsible grouped sidebar nav (Personnel / Apparatus / Reports)
- Mobile header — hamburger left, title centered
- Inspection step notes required on fail (BOOLEAN No → textarea; required if fail_if_negative)
- Soft-delete inspection template steps (no more FK constraint error)
- Step reorder (▲▼) in template builder — 3-step swap avoids unique constraint
- Apparatus detail — equipment manifest inline in compartments (item name + qty only, read-only all roles)
- Fixed attendance verification not updating My Activity page — added revalidatePath for `/reports/my-activity` and `/dashboard`
- Events page defaults to 'all' filter (was 'upcoming' — hid past events from members)
- Member self-log window: 12 hours from event start_time (null start_time defaults to midnight — set explicit start_time on test events)

## Dev Workflow
- Start: `npm run dev` in project directory
- Build: `npm run build` (always before pushing)
- Push policy: always git push after a successful build — troubleshoot on live Vercel site
- Git: `git add . && git commit -m "message" && git push`

## Test Accounts
- `zklein3@outlook.com` — sys admin, no department
- `test.winfire@fireops7.com` — Winslow Fire dept admin
- `member.winfire@fireops7.com` — Winslow Fire member
- `test.admin@fireops7.com` — Fremont Fire Test dept admin
- Temp password for new accounts: `Hello1!`

## Test Data (Winslow Fire)
- Engine 32 → D1 (Scott Air Pack ×2, Scott Air Pack Bottle ×2, Halligan ×1) + P1 (Chainsaw ×1)
- Assets: Chainsaw 1, Scott Air Pack 1, Scott Air Pack 2, B-0001, B-0002 (bottles are standalone location standards, not linked to airpacks)
- Templates: Weekly Chainsaw Inspection (3 steps), Weekly Airpack Inspection (4 steps, on Scott Air Pack)

## Historical Reference
Full module detail (attendance, training, incident, QR system design, DB table list, permission matrix, what's built) → read `REFERENCE.md`
