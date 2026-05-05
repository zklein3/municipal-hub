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
- `/training` — enrollments, certifications, training events (nav label: "Certifications")
- `/announcements` — department announcements, unread/read tracking, pin/delete controls
- `/reports/inspections` — inspection report: filters, flat table, asset drill-in, print (officer/admin only)
- `/reports/inventory` — inventory inspection reports (officer/admin only)
- `/reports/training` — training/certification report (officer/admin only)
- `/reports/attendance` — attendance participation report (officer/admin only)
- `/reports/my-activity` — member self-view: attendance, inspections, incidents (all roles)
- `/iso/hoses`, `/iso/hydrants`, `/iso/report` — ISO audit logs and summary report
- `/inbox` — Public Inbox (officers/admins): burn permits + records requests tabs with pending count badge
- `/admin/departments`, `/admin/users`, `/admin/logs` — sys admin pages
- `/admin/dept/[id]` — sys admin dept drill-in (5 tabs: Personnel/Stations/Apparatus/Compartments/Public Site)
- `/dept-admin/setup`, `/dept-admin/items` — dept admin structure/items
- `/dept-admin/attendance`, `/dept-admin/training` — dept admin settings
- `/scan` — QR scan landing/redirect ✓ built
- `/dept/[slug]` — public department landing page (no auth required)
- `/dept/[slug]/events` — public upcoming events (is_public=true series only)
- `/dept/[slug]/burn-permit` — public burn permit request form
- `/dept/[slug]/records` — public records request form
- `/print/burn-permit?id=xxx` — printable Nebraska state burn permit (auth required, approved only)

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
- `app/actions/training.ts` — createCertificationType, createCourseUnit, enrollMember, verifyProgress, logDirectCert, createTrainingEvent, logTrainingAttendance, saveTrainingSignature
- `app/actions/announcements.ts` — createAnnouncement, deleteAnnouncement, pinAnnouncement, markAnnouncementRead
- `app/actions/iso.ts` — apparatus ISO specs, hose tests, hydrant flow tests, mutual aid logging
- `app/actions/users.ts` — createDeptMember
- `app/actions/fire-school.ts` — checkBottle, logFill, addFireSchoolBottle
- `app/actions/public-site.ts` — savePublicSiteSettings, toggleEventSeriesPublic, submitBurnPermit, submitRecordRequest, updateBurnPermitStatus, updateRecordRequestStatus

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
- **Primary path:** Dept Admin → Dept Setup → Items & Assets → Inspection Templates tab (inline builder, preferred)
- **Secondary path:** Dept Admin → Items → Items tab → [item] → Manage → Inspections tab (full manager)
- Step types: BOOLEAN, NUMERIC, TEXT, LONG_TEXT
- Multiple templates per item type allowed (Daily/Weekly/Monthly)
- ASSET_LINK step type removed — bottles are now standalone location standard items

## IMMEDIATE NEXT — Resume Here Next Session

### Build Next List ← START HERE

#### 1. Permit Approval Email — Direct to Resident (when domain migrated)
Currently: permit approved → logEvent → notify-on-log Edge Function → email to zklein3@gmail.com → forward to applicant.
Fix when ready: `fireops7.com` must be verified in Resend (blocked until Wix → new registrar migration, ~1 month out). Once verified, swap the `logEvent` call in `updateBurnPermitStatus` for a call to the `send-permit-approval` Edge Function (already deployed at `kolrhnxozeroaselapzn.supabase.co/functions/v1/send-permit-approval`). One line change.

#### 2. Public Permit Status + Print Page (done — 2026-05-04)
Residents need to retrieve and print their own approved permit without logging in. Officer approves → resident gets email → clicks link → prints. Nobody has to meet.

**Public lookup page:** `/dept/[slug]/permit-status`
- Input: confirmation code (the code they got when submitting)
- Shows current status (pending / approved / denied)
- If approved: shows permit details + **Print Permit** button
- Print button opens `/dept/[slug]/permit-print?code=ABC12345` — public, no auth, same formatted permit as `/print/burn-permit` but accessible by confirmation code only

**Approval email via Resend:**
- Trigger in `updateBurnPermitStatus` when status flips to `approved`
- Send to `contact_email` via existing Resend/Edge Function pattern
- Email contains: dept name, applicant name, burn address, burn date, expiry date, and a direct link to `/dept/[slug]/permit-status?code=ABC12345`
- Subject: "Your Burn Permit Has Been Approved — [Dept Name]"

**DB needed:** `departments.public_slug` already exists — use it to build the link in the email.

**Edge Function or direct Resend call:** Can use the existing `notify-on-log` pattern or add a new `send-permit-approval` Edge Function. Whichever is cleaner.

#### 2. Burn Permit — Full Signature + Config Flow (next build)

**Two blocking config issues to fix first (Step 1):**
- **Department name on permit** — printed permit header must use the department's full legal name as set in `departments.name`. Currently fetched correctly but no validation exists. Add a check: if `departments.name` is null/empty, block approval with a clear error.
- **County/sheriff info required** — `burn_permit_county_info` MUST be set before a permit is legally usable (Nebraska statute requires the sheriff notification section). Currently defaults to blank. Fix: in `/inbox` Burn Permits tab, show a yellow warning banner if `burn_permit_county_info` is null for the department. Warn officer before they approve. Also validate in `updateBurnPermitStatus` — if county info is missing and status is 'approved', return an error: "Configure county/sheriff info in Admin → Public Site before approving permits."
- Same check for `burn_permit_restrictions` — default to "Brush" if null (already done) but warn admin it's not set.

**DB additions (Step 2):**
- `burn_permits.officer_signature_url text`
- `burn_permits.officer_signed_at timestamptz`
- `burn_permits.applicant_signature_url text`
- `burn_permits.applicant_signed_at timestamptz`
- `burn_permits.applicant_acknowledged_at timestamptz` — set when resident clicks "I'll Print and Sign"

**Signature flow (Steps 3–5):**

**Step 3 — Officer signature**
- After approving, a "Collect Officer Signature" button appears on the permit card in `/inbox`
- Opens SignaturePadModal: "Signing as officer for [Permit #] — [Contact Name]"
- Saves to Supabase Storage `signatures/permits/officer/{permit_id}.png`
- Stores URL + timestamp on `burn_permits.officer_signature_url/officer_signed_at`
- Permit card shows "Officer Signed ✓" badge once done

**Step 4 — Resident signature (on permit-status page)**
- Once officer has signed, permit-status page shows the signature section
- Two options:
  - **Sign Digitally** — SignaturePadModal on their device → saves to `signatures/permits/applicant/{permit_id}.png` → stores on `applicant_signature_url/applicant_signed_at`
  - **I'll Print and Sign** — acknowledgement button → sets `applicant_acknowledged_at`, blank line on printed copy
- After either action: "Your permit is complete — you may now print it"
- Print button only enabled after resident completes their step

**Step 5 — Inbox status + updated print pages**
- Permit card in `/inbox` shows completion state: Officer Signed ✓ | Applicant Signed ✓ / Acknowledged ✓ / Pending
- `/dept/[slug]/permit-print` and `/print/burn-permit` — embed officer signature image above "(Fire Department Officer)" line, applicant signature above "(Signature of Applicant)" line (or blank line if print-acknowledged)

#### 3. Personnel page — officer edit controls (lower priority)
Officers see Add button on `/personnel` but no inline edit per card. Not urgent — detail page works.

#### 4. Public Site Option B — API Keys (only when customers ask)
`department_api_keys` table + public API endpoints for departments with their own site.

### Completed This Session (2026-05-04) — Announcements + Training Signatures

- **Department announcements** — `/announcements` page with newest-first list, pinned items first, officer/admin creation, admin pin/unpin/delete, and all-role read access.
- **Unread announcement handling** — dashboard shows unread announcements through `DashboardAnnouncementBanner`; members can mark announcements read. Reads are stored in `announcement_reads`.
- **Announcement actions** — `app/actions/announcements.ts` contains `createAnnouncement`, `deleteAnnouncement`, `pinAnnouncement`, and `markAnnouncementRead`; all use flat admin-client queries and revalidate `/announcements` + `/dashboard`.
- **Training attendance signatures** — `signature_pad` installed, `SignaturePadModal` added, signatures saved through `saveTrainingSignature` to Supabase Storage bucket `signatures`, with `signature_url` and `signed_at` stored on `training_event_attendance`.
- **Signature UI + print** — members can sign their own attended training records; officers/admins can collect and review signature status. `/print/training-signin?event_id=xxx` renders the printable sign-in sheet with embedded signature images.

### Completed This Session (2026-05-04, session 2) — Public Site + Inbox

- **Member Training Record print page** — `/print/member-training?personnel_id=xxx&from=xxx&to=xxx`. Training events (date-filtered) + all active certs. Signed indicator, expired certs flagged red. Entry point: "Member Record ↗" link on `/reports/training` when single member selected.
- **Equipment/Apparatus nav cleanup** — Dropped `/equipment` picker from nav (redundant). Asset Roster moved into Apparatus group. "View →" links added to each compartment card on apparatus detail so users reach compartment detail directly without the intermediary page.
- **`apparatus.exclude_from_iso`** — Boolean flag (admin only checkbox on apparatus edit form). ISO report filters excluded apparatus from the specs coverage stat and table; shows them dimmed with "Excluded" badge.
- **Public-facing department sites** — Path-based routing at `/dept/[slug]`. One merged codebase serves all departments. Per-department on/off via `departments.public_site_enabled` + `public_slug`. Middleware updated to bypass auth for `/dept/*` routes.
  - Landing page: hero, contact cards (address/phone/email), about, quick-action tiles
  - Events page: upcoming instances where `event_series.is_public = true`
  - Burn permit request form with safety advisory, confirmation code on submit
  - Records request form with type selector (incident/inspection/other), incident fields conditional on type
  - All forms write to `burn_permits` / `public_record_requests` tables with auto-generated confirmation codes
- **Sys admin Public Site config** — 5th tab on `/admin/dept/[id]`. Enable toggle, slug field, public profile (tagline/phone/email/address/about), burn permit settings (restrictions text + county/sheriff info textarea), event series public toggles.
- **Event public/private toggle** — Officers toggle `is_public` directly on individual event series from the `/events` page manage panel. Toggle hidden when dept public site is off. Blue "Public" badge on card when visible.
- **Dept admin dashboard preview** — "Your Public Site is Live" banner with Preview ↗ link appears when site is enabled and slug is set.
- **Public Inbox** — `/inbox` route (officers/admins only). Nav badge shows combined pending count.
  - Burn Permits tab: status filter, approve flow (expiry date + notes → issues permit), deny flow (confirmation + reason), Print ↗ link for approved permits
  - Record Requests tab: status filter, Mark In Review → Fulfilled/Denied flow with notes
  - Both tabs use optimistic UI
- **Printable burn permit** — `/print/burn-permit?id=xxx`. Matches Nebraska state form: issued-to, address, expiry, liability line, NE Statute 81-520.01 legal text, sheriff call-out with county info, signature lines, "VOID IF WIND EXCEEDS 10 MPH". Auto-prints. Auth-gated, approved permits only.
- **DB additions this session:** `apparatus.exclude_from_iso`, `departments.public_slug/public_site_enabled/public_phone/public_email/public_address/public_tagline/public_about/burn_permit_county_info/burn_permit_restrictions`, `event_series.is_public`, `burn_permits` table (+ `permit_expiry_date/issued_date/approved_by_personnel_id`), `public_record_requests` table

### Roadmap (later — not immediate)

#### Public-Facing Department Sites — Option B (API Keys, future)
Option A (path-based public site at `/dept/[slug]`) is fully built and live. Option B (API key integration for depts with their own site) is a future addition:
- `department_api_keys` table — scoped per department
- Public API endpoints: `GET /api/public/events`, `GET /api/public/announcements`, `POST /api/public/burn-permit`, `POST /api/public/record-request`
- Only needed when a paying customer has their own web presence and asks for it

#### Public Site — Subdomain Routing (when Vercel Pro)
Currently path-based (`fireops7.com/dept/slug`). When upgraded to Vercel Pro, migrate to `slug.fireops7.com` via wildcard DNS + Next.js middleware. Page content and DB unchanged — routing only.

#### Personnel page — officer edit controls (lower priority)
Officers see Add button on `/personnel` but no inline edit per card. Quick role/status edit inline on roster card. Not urgent — detail page works.

### Completed This Session (2026-05-03, session 2) — Setup Flow Completion + UX Polish

- **Inspection Templates tab** — 4th tab in Items & Assets step of `/dept-admin/setup`. Inline template + step builder per inspectable item. Steps: add, edit, reorder (▲▼), soft-delete. Templates auto-expand after creation.
- **Help prompt system** — `HelpPrompt` component (`app/(dashboard)/dept-admin/setup/HelpPrompt.tsx`). `? Help` / `Hide Help` toggle in setup page header, persisted in localStorage. Each step and items tab has a dismissable blue prompt. Re-enabling help clears all dismissals.
- **Nav cleanup** — Removed "Manage Personnel" and "Compartments" from Dept Admin nav (covered by Dept Setup). Dept Admin nav now: Dept Setup · Items · Attendance Settings · Training.
- **Officer add personnel** — `createDeptMember` updated to allow `system_role === 'officer'`. `PersonnelAddForm` client component added to `/personnel` page. Officers and admins see `+ Add Personnel` button; members see read-only roster. Officers can add officers and members (not admins). `/personnel/page.tsx` also fixed to use flat queries (no nested joins).
- **Dashboard profile card** — Replaced 3 stat cards (Personnel/Stations/Apparatus) with a user profile card: initials avatar, name, role badge, title/rank, department, emp#, hire date, phone, email, Edit Profile link. Removed unused DB queries from `getDashboardData`.
- **Dashboard quick links** — Now role-adaptive: Admin (Dept Setup/Personnel/Apparatus/Events/Inspections/Reports), Officer (Personnel/Apparatus/Events/Inspections/Incidents/Reports), Member (Events/Certifications/Inspections/My Activity/Personnel/Apparatus).
- **Pending setup banner** — Fixed link to point to `/dept-admin/setup` instead of old `/dept-admin/personnel`. Fixed JSX whitespace typo ("usershaven't" → "users haven't").
- **Nav rename** — "Training" → "Certifications" everywhere (nav label, TrainingClient.tsx h1, TrainingAdminClient.tsx h1, dashboard quick links). URL `/training` unchanged.
- **Incidents → Operations group** — Incidents moved out of Personnel group into its own labeled "Operations" nav group.

### Permission model (decided this session — reference for future work)
- **Setup flow (`/dept-admin/setup`)** — admin only. Creates department structure.
- **Main nav pages** — role-adaptive. Officers see operational controls; members see read-only.  
- **Officers can:** add personnel (officers/members), edit apparatus descriptive fields, assign items to compartments, run inspections, manage events/attendance.
- **Officers cannot:** create apparatus/stations/compartments/item types, manage roles, access dept-admin setup.
- **`Training` label** — renamed to "Certifications" site-wide. Route stays `/training`. The page covers cert types, course enrollments, and training event logs — "Training" was a misnomer.

### Completed This Session (2026-05-03, session 1) — Setup Flow Build

**What to build:**
- Tab lists every item where `requires_inspection = true`
- Each item shows template name + step count, or yellow "No template yet" badge
- **"+ Add Template"** per item → form: template_name, template_description (name by frequency: Weekly, Daily, Monthly)
- Expand template → step list with **"+ Add Step"** → step_text, step_type (BOOLEAN/NUMERIC/TEXT/LONG_TEXT), required toggle, fail_if_negative toggle
- Steps reorderable (▲▼) and soft-deletable
- Actions needed: `createInspectionTemplate`, `addTemplateStep`, `updateTemplateStep`, `deleteTemplateStep` from `app/actions/inspections.ts` — add `revalidatePath('/dept-admin/setup')` to each
- Also fetch `templates` and `steps` in `page.tsx` and pass through `SetupFlowClient` → `ItemsStep`

**Data already fetched in page.tsx:** templates + steps are fetched but not currently passed to ItemsStep — wire them through.

### 2. Dismissable Help Prompt System (build alongside #1)

Add contextual help prompts throughout the setup flow. Design approved:
- **`HelpPrompt` component** (`app/(dashboard)/dept-admin/setup/HelpPrompt.tsx`) — dismissable per-prompt via localStorage key, global "? Help" toggle in SetupFlowClient header also saved to localStorage
- When help toggled OFF globally: all prompts hidden
- When toggled back ON: resets individual dismissals so all prompts reappear
- One prompt per step, one per Items tab. Content approved:

| Location | Prompt text |
|---|---|
| Page header (first visit) | "Work through each step in order — Stations → Apparatus → Personnel → Compartments → Items. Each step depends on the one before it." |
| Stations | "Add each physical station location first. Apparatus gets assigned to a station, so stations need to exist first." |
| Apparatus | "Add each vehicle or unit and assign it to a station. You'll add compartments to each apparatus separately." |
| Personnel | "Add members here. New accounts are created with a temporary password — the member must change it on first login." |
| Compartments | "Compartment templates define named storage locations (D1, Officer Side, Hose Bay). Create the templates first, then assign them to each apparatus." |
| Items — Categories | "Categories group your equipment types. Create these first so items have somewhere to live." |
| Items — Items | "Items are equipment types. Checking 'Requires Inspection' enables individual asset tracking and an inspection checklist for that type." |
| Items — Assets | "Assets are individually tracked units (SCBA-001, SCBA-002). Add one asset per physical piece of equipment for each item that requires inspection." |
| Items — Inspection Templates | "Each inspectable item needs a template before it can be inspected in the field. Name it by frequency (Weekly, Monthly), then add the checklist steps." |

### 3. Nav cleanup (quick, do after #1 and #2)
- Remove "Manage Personnel" and "Compartments" from Dept Admin nav — fully covered by setup flow
- Keep "Items" (inspection template builder is still there), "Attendance Settings", "Training"
- `/dept-admin/personnel` and `/dept-admin/compartments` pages remain but are no longer surfaced in nav

### 4. Officer — Add Personnel capability
- `createDeptMember` action currently blocks officers — update to allow `system_role === 'officer'`
- Add "+ Add Personnel" button to main `/personnel` page, visible to officers and admins
- Setup flow Personnel step stays admin-only (structural setup); officer add-user lives in main nav

### Completed This Session (2026-05-03) — Dept Setup Flow

- **`/dept-admin/setup`** — new admin-only page in Dept Admin nav ("Dept Setup"). Five-step rail: Stations → Apparatus → Personnel → Compartments → Items & Assets.
- **Step rail** — desktop left sidebar with step numbers, green checkmarks once data exists, count badges. Mobile: horizontal scrollable tab bar.
- **Each step** — existing records as cards with inline Edit + inline Add form. All mutations use existing server actions.
- **Compartments step** — includes apparatus assignment checkbox panel per template (same logic as existing `/dept-admin/compartments`).
- **Items & Assets step** — tabbed (Categories / Items / Assets) with full inline CRUD. Inspection Templates were added to this setup flow in the follow-up 2026-05-03 session.
- **revalidatePath** — all relevant actions (stations, apparatus, users, personnel, compartments, equipment) now also revalidate `/dept-admin/setup`.
- **Nav** — "Dept Setup" added as first item in Dept Admin nav section.
- **Permission philosophy decided** — Setup flow = admin only. Main nav pages = role-adaptive. Officers get operational controls in main nav pages; setup/structure stays admin.

### Completed This Session (2026-04-30) — Flow & Presentation Polish
- **Dashboard** — removed SCBA Bottles stat card (legacy holdover, no data value). Stats row now 3 cards: Personnel, Stations, Apparatus.
- **Personnel** — replaced horizontally-scrolling table with responsive card grid (1→2→3 cols). Cards show name, role badge, title, phone, emp#, View Profile link inline. No horizontal scroll on mobile.
- **Nav** — split "Apparatus" group into two: **Apparatus** (Apparatus, Stations, Inspections) and **Equipment** (Equipment, Asset Roster). Clearer separation of physical units vs. what's on the truck.

### Remaining Polish Notes (no decision needed, build when ready)
- Quick links on dashboard — leave as-is; future: editable per-dept or auto-surfaced by usage.

### Completed This Session (2026-04-28) — Fire School QR Printing
- **`/print/qr` page** — dedicated minimal print page (`app/print/qr/page.tsx`). Reads `type`, `code`, `title`, `subtitle` from searchParams, renders QR label, auto-calls `window.print()` after 600ms. Works on mobile (iOS share→print, Android print dialog) and desktop.
- **QrPrintLabel** — simplified to just open `/print/qr?...` in a new tab. Portal + `@media print` CSS approach removed entirely. Now supports `type: 'apparatus' | 'compartment' | 'bottle'`.
- **Bottle QR labels** — `type='bottle'` encodes `fireops7.com/fire-school?scan=<id>`. Print QR button added to each row in the bottles table. Print QR button also appears immediately in the success banner after adding a new bottle.
- **Fill station auto-check** — `/fire-school` reads `?scan=` URL param on mount and auto-triggers `handleCheck()`. Scanning a printed bottle label with any phone camera opens the fill station and immediately pulls up the bottle result.
- **`bottles/page.tsx`** — fixed searchParams not being awaited (Next.js 16 pattern).
- **Hydrants numeric overflow fix** — `lat`/`lng` changed from `numeric(10,7)` to `double precision`, `main_size_in` from `numeric(4,2)` to `numeric(6,2)`.
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
