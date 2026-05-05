@AGENTS.md

## Session Start Checklist
1. Verify Git is installed: `git --version`. If not found, download from https://git-scm.com/download/win and install before proceeding.
2. Run `git pull` to sync latest changes from remote before starting any work.
3. Run `git status` and `git log --oneline -5` to review what changed since the last session.
4. Run `npm run build` to confirm the current branch compiles clean before making changes.

## Local-Only Files — Never Commit
- `.env.local` — Supabase keys + Resend API key
- `.claude/settings.json` — Claude Code permissions, machine-specific paths. Each machine maintains its own. Do NOT commit.

# FireOps7 — Project Guide

## Stack
- **Next.js 16.2.3** (App Router, TypeScript, Server Actions)
- **Supabase** (PostgreSQL 17, Auth, RLS) — project: FireOps7 (kolrhnxozeroaselapzn, us-east-1)
- **Tailwind CSS v4**
- **@supabase/ssr** + **@supabase/supabase-js**
- **Resend** — email notifications via Supabase Edge Functions

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
- RESEND_API_KEY=re_... (also in Supabase Edge Function Secrets)

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
- event_instances.status: `scheduled` | `cancelled` | `completed`

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
- `/apparatus`, `/apparatus/[id]` — apparatus list + detail (compartment View → links here)
- `/stations`, `/stations/[id]` — stations list + detail
- `/equipment/[id]`, `/equipment/[id]/[compartment_id]` — equipment detail + compartment detail
- `/equipment/assets` — dept-wide asset roster (in Apparatus nav group)
- `/inspections`, `/inspections/run`, `/inspections/apparatus/[id]` — inspection flow + sessions
- `/scan` — QR code lookup + redirect
- `/events`, `/events/new` — events + attendance
- `/training` — enrollments, certifications, training events (nav label: "Certifications")
- `/announcements` — department announcements with unread badge
- `/incidents`, `/incidents/[id]`, `/incidents/new` — incident log
- `/reports/inspections`, `/reports/inventory`, `/reports/training`, `/reports/attendance`, `/reports/my-activity`
- `/iso/hoses`, `/iso/hydrants`, `/iso/report` — ISO audit
- `/inbox` — Public Inbox: burn permits + records requests (officers/admins, pending count badge)
- `/admin/departments`, `/admin/users`, `/admin/logs` — sys admin
- `/admin/dept/[id]` — sys admin dept drill-in (5 tabs: Personnel/Stations/Apparatus/Compartments/Public Site)
- `/dept-admin/setup`, `/dept-admin/items`, `/dept-admin/attendance`, `/dept-admin/training`

### Public Site Routes (no auth)
- `/dept/[slug]` — department landing page
- `/dept/[slug]/events` — upcoming public events (is_public=true only)
- `/dept/[slug]/burn-permit` — burn permit request form
- `/dept/[slug]/records` — records request form
- `/dept/[slug]/permit-status` — permit lookup by confirmation code + applicant signature flow
- `/dept/[slug]/permit-print` — public printable permit (by confirmation code)

### Print Routes
- `/print/qr` — QR label print
- `/print/training-signin?event_id=xxx` — training sign-in sheet with signatures
- `/print/member-training?personnel_id=xxx&from=xxx&to=xxx` — member training record
- `/print/burn-permit?id=xxx` — officer-facing permit print (auth required)

### Key Action Files
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
- `app/actions/public-site.ts` — savePublicSiteSettings, toggleEventSeriesPublic, submitBurnPermit, submitRecordRequest, updateBurnPermitStatus, updateRecordRequestStatus, savePermitOfficerSignature, savePermitApplicantSignature, acknowledgePermitPrintAndSign

### Supabase Edge Functions
- `notify-on-log` — emails zklein3@gmail.com on new system_logs entries
- `auto-close-events` — nightly 2 AM UTC, closes stale event instances
- `notify-expired-sessions` — hourly, emails officers when inspection sessions expire
- `send-permit-approval` — emails resident when burn permit is approved (needs fireops7.com Resend domain verified)

## Auth
- Roles: `is_sys_admin` (personnel table) | `system_role: admin/officer/member` (department_personnel)
- Sys admin: zklein3@outlook.com — no department_personnel record (intentional)
- signup_status flow: temp_password → change-password | profile_setup → profile-setup | active → dashboard | awaiting_approval → pending | denied → denied

## Mobile Layout
- Desktop: fixed sidebar (w-64, red-800)
- Mobile: top bar + hamburger → slide-out drawer (MobileSidebar.tsx)
- Main content: `pt-20 px-4 pb-4 sm:pt-0 sm:p-6 lg:p-8`
- Input text fix: globals.css forces `color: #18181b` and `-webkit-text-fill-color` on all inputs

## Error Logging
- Table: `system_logs` (log_type: error | user_report | info)
- `lib/logger.ts` — logError(), logEvent()
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
- `tracks_quantity` — count based | `tracks_assets` — individual tracking | `requires_presence_check` — apparatus check | `requires_inspection` — has template + schedule | `tracks_expiration` — expiry date
- Asset Statuses: `IN SERVICE` | `OUT OF SERVICE` | `RETIRED`
- Daily Check = presence-only (`?mode=presence`). Full Inspection = asset checklist per slot.
- ASSET_LINK step type fully removed. Do not re-introduce.
- Inspection Template Builder: primary path via Dept Setup → Items & Assets → Inspection Templates tab

## Burn Permit System
- Public form at `/dept/[slug]/burn-permit` → writes to `burn_permits` table with auto confirmation code
- Officer reviews in `/inbox` → must configure `burn_permit_county_info` + dept name before approving
- Approval flow: approve (sets issued_date, expiry) → officer signs → email to resident → resident signs or acknowledges → print unlocks
- Permit email currently goes via logEvent → sys admin forwards. Direct resident email blocked until fireops7.com verified in Resend (~1 month, Wix migration)
- `send-permit-approval` Edge Function deployed and ready — swap in when domain verified
- Signatures stored in Supabase Storage `signatures/permits/officer/{id}.png` and `signatures/permits/applicant/{id}.png`
- Nebraska Statute 81-520.01 legal text hardcoded on permit. County sheriff info set per-dept in Admin → Public Site tab.

## Public Site System
- Path-based: `fireops7.com/dept/[slug]` — one codebase serves all depts
- Per-dept on/off via `departments.public_site_enabled` + `public_slug` (sys admin sets in `/admin/dept/[id]` → Public Site tab)
- Middleware bypasses auth for `/dept/*` routes
- Events shown on public site require `event_series.is_public = true` (toggled from `/events` manage panel)
- Future: subdomain routing when Vercel Pro; API key Option B when customers ask

## Permission Model
- Setup flow (`/dept-admin/setup`) — admin only
- Officers can: add personnel (officers/members), edit apparatus, assign items, run inspections, manage events/attendance, approve permits, toggle events public
- Officers cannot: create apparatus/stations/compartments/item types, manage roles, access dept-admin setup

## Dev Workflow
- Start: `npm run dev` in project directory
- Build: `npm run build` (always before pushing)
- Push policy: always git push after a successful build
- Git: `git add . && git commit -m "message" && git push`

## Test Accounts
- `zklein3@outlook.com` — sys admin, no department
- `test.winfire@fireops7.com` — Winslow Fire dept admin
- `member.winfire@fireops7.com` — Winslow Fire member
- `test.admin@fireops7.com` — Fremont Fire Test dept admin
- Temp password for new accounts: `Hello1!`

## Test Data (Winslow Fire)
- Engine 32 → D1 (Scott Air Pack ×2, Scott Air Pack Bottle ×2, Halligan ×1) + P1 (Chainsaw ×1)
- Assets: Chainsaw 1, Scott Air Pack 1, Scott Air Pack 2, B-0001, B-0002
- Templates: Weekly Chainsaw Inspection (3 steps), Weekly Airpack Inspection (4 steps)

## Historical Reference
Full module detail, DB table list, completed session history → read `REFERENCE.md`

## IMMEDIATE NEXT — Resume Here Next Session

### Build Next List ← START HERE

#### 1. Permit Submission Notification (priority)
When a resident submits a burn permit, no one at the department is notified — it sits silently in the inbox. Need to email the department when a new submission arrives.

**Design:**
- Add `departments.admin_notification_email text` — internal address for permit/request alerts (separate from public_email). Sys admin sets in Public Site tab.
- Deploy `notify-permit-submission` Edge Function — emails `admin_notification_email` with permit details (contact name, phone, email, burn address, burn date, link to login)
- Call from `submitBurnPermit` after successful insert
- Same pattern: use logEvent as fallback if `admin_notification_email` not set (emails sys admin)
- After Wix domain migration: from address becomes `permits@fireops7.com`, direct to dept

**Expansion:** Same `admin_notification_email` used for record request notifications too.

#### 2. Permit Approval Email — Direct to Resident (when domain migrated)
Currently: approved → logEvent → sys admin forwards.
Fix: swap `logEvent` call in `updateBurnPermitStatus` for `send-permit-approval` Edge Function call (already deployed). Blocked until `fireops7.com` verified in Resend (~1 month, post-Wix migration).

#### 3. Personnel page — officer inline edit controls (lower priority)
Officers see Add button on `/personnel` but no inline edit per card. Not urgent — detail page works.

#### 4. Public Site Option B — API Keys (only when customers ask)
`department_api_keys` table + public API endpoints for depts with their own site.

### Roadmap
- Subdomain routing (`slug.fireops7.com`) when Vercel Pro upgraded
- Inspection schedule settings (daily/weekly/monthly per dept)
- Officer personnel inline edit on roster cards
