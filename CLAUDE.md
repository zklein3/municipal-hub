@AGENTS.md

## Session Start Checklist
1. Verify Git is installed: `git --version`
2. Run `git pull` to sync latest changes
3. Run `git status` and `git log --oneline -5`
4. Run `npm run build` to confirm clean before making changes

## Local-Only Files — Never Commit
- `.env.local` — Supabase keys + Resend API key
- `.claude/settings.json` — Claude Code permissions, machine-specific. Do NOT commit.

# FireOps7 — Project Guide

## Stack
- **Next.js 16.2.3** (App Router, TypeScript, Server Actions)
- **Supabase** (PostgreSQL 17, Auth, RLS) — project: FireOps7 (kolrhnxozeroaselapzn, us-east-1)
- **Tailwind CSS v4**, **@supabase/ssr**, **Resend** (email via Supabase Edge Functions)

## GitHub & Machines
- Repo: https://github.com/zklein3/FireOps7-Next — branch: main
- Personal: `C:\Users\zklein3\Documents\FireOps7-Next`
- Shared: `C:\Users\zklei\Documents\FireOps7-Next`

## Production
- Vercel: https://fire-ops7-next.vercel.app | Domain: https://www.fireops7.com
- Every push to main auto-deploys to Vercel

## Environment Variables (.env.local — never commit)
- NEXT_PUBLIC_SUPABASE_URL=https://kolrhnxozeroaselapzn.supabase.co
- NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci... (anon key)
- SUPABASE_SERVICE_ROLE_KEY=eyJhbGci... (service role key)
- RESEND_API_KEY stored in Supabase Edge Function Secrets

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
- `pending` — member self-logged | `excused_pending` — excuse request pending
- `present` — officer approved | `absent` — rejected or auto-closed | `excused` — excuse approved
- event_instances.status: `scheduled` | `cancelled` | `completed`

## Auth
- Roles: `is_sys_admin` (personnel table) | `system_role: admin/officer/member` (department_personnel)
- Sys admin: zklein3@outlook.com — no department_personnel record (intentional)
- signup_status: temp_password → change-password | profile_setup → profile-setup | active → dashboard | awaiting_approval → pending | denied → denied

## Mobile Layout
- Desktop: fixed sidebar (w-64, red-800) | Mobile: top bar + hamburger → MobileSidebar.tsx
- Main content: `pt-20 px-4 pb-4 sm:pt-0 sm:p-6 lg:p-8`
- globals.css forces `color: #18181b` and `-webkit-text-fill-color` on all inputs

## Dynamic Route Params — CRITICAL
```ts
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
}
export default async function Page({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams
}
```

## Dev Workflow
- Start: `npm run dev` | Build: `npm run build` (always before pushing)
- `git add . && git commit -m "message" && git push`

## Test Accounts
- `zklein3@outlook.com` — sys admin | `test.winfire@fireops7.com` — Winslow admin
- `member.winfire@fireops7.com` — Winslow member | `test.admin@fireops7.com` — Fremont admin
- Temp password for new accounts: `Hello1!`

## Reference Files
- `REFERENCE.md` — routes, action files, edge functions, permissions, nav structure
- `MODULES.md` — equipment/inspection, attendance, training, incident, ISO module design + **Future Integrations** (ImageTrend EMS push)
- `HISTORY.md` — what's built, what's not, DB tables, session history

---

## IMMEDIATE NEXT — Resume Here Next Session

### 0. Nav Hub-and-Spoke — SHIPPED ✅ (2026-05-20)
Sidebar trimmed to 6 items. Hub pages live at `/operations`, `/equipment` (enhanced), `/reports`, `/dept-admin`, `/iso`. `PageNavBar` on every page. No further nav work needed unless user requests tweaks after testing.

### 0a. Incident Run Signatures — SHIPPED ✅ (2026-05-23)
- `incident_signatures` table — unique `(incident_id, personnel_id)`, `signed_at` null = pending
- Triggered on NERIS submit — rows upserted for all non-absent personnel
- Members sign via `/inbox` Signatures tab (`IncidentSignaturePadModal`)
- Officer/admin sees signed/pending roster on incident detail page
- Inbox opened to all members; layout badge includes pending signature count
- `standby` role added to `incident_personnel_role_check` constraint

### 0b. Run Sheet Print — SHIPPED ✅ (2026-05-23)
`/print/run-sheet?id=xxx` — matches dept paper Run Field Report, fits one letter sheet.
- Units Dispatched: each apparatus with member names; **POV** group (no apparatus, role ≠ standby); **Station** group (no apparatus, role = standby)
- Mutual aid reads `incident_mutual_aid`: `gave_aid` → To, `received_aid` → From
- PrintButton: `type="button"`, z-index 9999, "Print / Save PDF"
- Key file: `app/print/run-sheet/page.tsx`

### 1. Training — Resume After User Testing ✳️ IN PROGRESS
Built 2026-05-17. User is playing with flow before proposing further changes.

**What's working:**
- Unified member training page (My Training list + My Certifications)
- Simple cert: assign → training date → member logs attendance → officer verifies → cert issued → member signs
- Training event with cert type: bulk log attendance → cert auto-issued to all
- Direct cert entry (admin): picks cert type or enters custom name, dates, cert number
- Dept-wide enrollment: "Assign to All Active Members" toggle
- Cert signatures on all records (CertSignaturePadModal)

**Known gaps to revisit after testing:**
- Training event cert issuance deduplication (same-day check only — may double-issue if event re-verified)
- No way to edit a cert record after entry (wrong date, cert number, etc.)
- No expiry notification for certs approaching expiration
- Admin has no read-only view of a member's full cert history

### 2. NERIS — Payload validation in progress ✳️ (2026-05-22)
V1 Compatible badge earned. Production Client ID + Secret set in Vercel + .env.local.
`NERIS_USE_TEST=true` in `.env.local` — test credentials were retired when badge was issued; no test OAuth available. Use payload preview for local dev; live submissions go through Vercel once a real dept is enrolled.

**Auth situation:** Production credentials only work against `api.neris.fsri.org`. Test API (`api-test.neris.fsri.org`) had separate credentials that were retired. To go live: flip `NERIS_USE_TEST=false` in Vercel, set real dept FDID as `neris_entity_id`, dept must be enrolled and linked to vendor account `VN03615504`.

**Dept enrollment UI built** (`/dept-admin/neris`) — 4-step guide, Client ID copy button, Test Connection.
**Admin troubleshooting panel built** (`/admin/neris`) — Departments / Issues / Error Logs tabs.

**New DB column:** `incident_neris.neris_last_error` — stores API error on failed submissions.

**Confirmed live submissions (test API, `NERIS_USE_TEST=true`):**
- `FD35049607|WIN26-0017|1779004260` — rescue (2026-05-17)
- `FD35049607|FRE26-T001|1779199200` — structure fire
- `FD35049607|FRE26-T002|1779204600` — medical (chest pain)
- `FD35049607|FRE26-T003|1779209100` — hazmat (gas leak)
- `FD35049607|WIN26-0008|1771255200` — structure fire with investigation
- `FD35049607|WIN26-0002|1767597600` — mutual aid
- `FD35049607|26-0100|1761846420` — vehicle / transportation fire

**Confirmed payload structures (2026-05-19 + 2026-05-22):**
- Actions taken: flat string array — groups ordered suppression-first in `NERIS_ACTIONS_TAKEN`
- Ventilation actions have timing variants (PRIOR_TO_SUPPRESSION / DURING_SUPPRESSION / POST_SUPPRESSION) — added 2026-05-22
- Fire module — `location_detail.type` discriminator:
  - `STRUCTURE`: condition on arrival, building damage, cause, floor of origin (required), room of origin (required), water supply, investigation
  - `OUTSIDE`: cause, acres burned, water supply — NO condition on arrival, NO building damage, NO floor/room
  - Transportation fires (`FIRE||TRANSPORTATION_FIRE||*`): also use `OUTSIDE` type — only cause sent
- Alarm/suppression modules: structure fires only, NOT sent for outside or transportation fires
- `investigation_needed` + `investigation_types`: always sent for fire incidents
- Mutual aid: `involves_mutual_aid` boolean on `incident_neris`
- **Rescue module** (`casualty_rescues[]`) — confirmed correct 2026-05-22:
  - Per person: `type` (FF|NONFF) + `rescue` + optional `casualty`
  - `rescue.ffrescue_or_nonffrescue` discriminated by type: FF rescue types → `FfRescuePayload` (requires `removal_or_nonremoval`); non-FF → `NonFfRescuePayload`
  - FF rescue `removal_or_nonremoval.type`: EXTRICATION | DISENTANGLEMENT | RECOVERY | REMOVAL_FROM_STRUCTURE | OTHER
  - `rescue.presence_known`: NONFF persons only (regardless of who did the rescuing)
  - `casualty.injury_or_noninjury.type`: UNINJURED | INJURED_NONFATAL | INJURED_FATAL
- **Medical module** (`medical_details[]`) — field names confirmed 2026-05-22:
  - `patient_care_evaluation` (required), `patient_status`, `transport_disposition`
  - `transport_disposition` values: TRANSPORT_BY_EMS_UNIT | OTHER_AGENCY_TRANSPORT | NONPATIENT_TRANSPORT | PATIENT_REFUSED_TRANSPORT | NO_TRANSPORT
- **Hazmat module**: top-level key is `hazsit_detail` (not `hazardous_situation`) — sub-fields still TODO(api-review)

**Confirmed clean payloads (preview verified 2026-05-22):**
- Motor vehicle extrication (`RESCUE||TRANSPORTATION||MOTOR_VEHICLE_EXTRICATION_ENTRAPPED`) — FFD26-1819
- Wildland fire (`FIRE||OUTSIDE_FIRE||WILDFIRE_WILDLAND`) — UEH26-0017

**Still to verify:**
- Mutual aid module payload structure
- Hazmat module sub-field names (`hazsit_detail` inner fields)

**Key files:**
- Payload builder: `app/actions/neris.ts` → `buildNerisPayload`
- Value sets (all confirmed enums): `lib/neris-value-sets.ts`
- Requirements checker: `lib/neris-requirements.ts`
- See `NERIS.md` for full field reference

### 3. ISO Hose — Build Plan ✳️ ARCHITECTURE LOCKED

**Two parallel systems — no overlap:**

**A) `hoses` table — inventory + testing only**
- Tracks physical hose sections (H-0001, H-0002, etc.) by diameter and length
- No location field — we don't track which truck a specific hose is on
- Annual pressure tests logged per section via `hose_tests` table
- No DB changes needed to `hoses` table

**B) `apparatus_iso_specs.hose_loads` — per-truck load spec (already built 2026-05-15)**
- Engine 32: 500ft of 3", 300ft of 1.75" (not linked to specific hose IDs)
- This is the source for on-truck totals in the ISO report
- No changes needed — keep as-is

**ISO Report hose section (to build):**
- Total owned per diameter: sum from `hoses` table (what the dept owns)
- On trucks per diameter: sum `hose_loads` across all apparatus specs
- In storage = Total owned − On trucks (simple calculation)

Example output:
| Diameter | Total Owned | On Trucks | In Storage |
|---|---|---|---|
| 3" | 1,000 ft | 500 ft | 500 ft |
| 1.75" | 500 ft | 500 ft | 0 ft |

**Hose testing session (to build):**
- Header set once: date, pressure used (PSI), duration (min, default 5), tester (auto from login)
- List of all active hoses with NFPA 1962 required PSI shown per diameter:
  - Attack hose (1"–3"): 300 PSI required
  - Supply hose (4"–6"): 200 PSI required
- Tester marks each hose Pass / Fail; failure reason field appears on Fail
- Submit creates one `hose_test` record per hose with shared session params + individual result

**Key files:** `app/(dashboard)/iso/hoses/HosesClient.tsx`, `app/actions/iso.ts`, `app/(dashboard)/iso/report/page.tsx`

### 4. ISO Module — Gating Architecture Decision ✳️ FUTURE REFACTOR
Current state: hose inventory, hose testing, hydrant tests all gated behind `module_iso`.

**Agreed architecture (build now as ISO, refactor gating later):**
- **Base platform (no gate):** Data collection — apparatus specs, pump tests (NFPA 1911), hose inventory/testing (NFPA 1962), hydrant flow tests. Departments need this regardless of ISO — it's NFPA compliance.
- **ISO module only:** `/iso/report` — the compiled audit-ready report. This is the reporting layer that justifies the module gate.

**What changes when we refactor:**
- Move hose/hydrant pages out of ISO nav into a general Compliance section (main nav)
- Only `/iso/report` stays behind `module_iso`
- ISO Specs button on apparatus (feeds the report) stays gated
- Data collected before module upgrade automatically populates the report

**Why deferred:** Continue building ISO features as-is under the current gate. Change the gating in one pass once ISO section is feature-complete.

### 5. ISO Mutual Aid — Data Entry Roadmap (future phases)
Current: manual entry by user (Phase 1, built 2026-05-16).

**Phase 2 — Partner link:** Generate a shareable URL the dept admin emails to the M/A department. Partner fills out their apparatus specs (pump, tank, hose loads) via a public form (no login). Submits → populates the agreement record. Same pattern as burn permit public form.

**Phase 3 — System-to-system:** If the M/A department also uses FireOps7, their apparatus ISO specs (`apparatus_iso_specs.hose_loads`, pump rating, tank) can be pulled directly from their dept record. Admin links agreements by selecting the partner dept from a FireOps7 dept lookup instead of entering manually. Data stays live — if partner updates their specs, it reflects automatically.

**Key files when building:** `app/(dashboard)/iso/mutual-aid/`, `app/actions/iso.ts` → mutual aid actions, `iso_mutual_aid_agreements` table.

### 6. ISO — Configurable Single-Page Report Builder (next ISO phase)
All current ISO report sections on one print-ready page. Admin controls which sections appear and their date ranges/filters.

**Sections to include:**
- Apparatus specs + pump test status
- Personnel & staffing
- Training hours (configurable date range — default 12 months)
- Training certifications breakdown
- Hose inventory summary + test compliance
- Hydrant flow test compliance
- Mutual aid agreements with apparatus
- Pre-fire plans list

**Admin controls per section:**
- Show/hide toggle per section
- Date range override (e.g. change training window from 12 to 24 months)
- Dept name / ISO audit date / auditor name fields for the report header

**Output:** Single scrollable page with print stylesheet — `window.print()` produces a clean multi-page PDF matching ISO audit format.

**Route:** `/iso/report/print` or a print mode toggle on `/iso/report`.

### 7. ISO — Aerial Testing (deferred — build when dept has aerial apparatus)
Same model as pump tests (NFPA 1911). Date, vendor, pass/fail, document upload per apparatus.
Only relevant for depts with aerial apparatus — skip until needed.
Key files when building: `apparatus_pump_tests` pattern, `app/actions/iso.ts`, apparatus detail page.

### 9. Pending Email Tasks — Blocked on Resend + fireops7.com domain migration from Wix

All items below are stubbed/logged to `system_logs` in the interim. Wire up once domain is verified in Resend.

**When domain is ready:**
1. **Permit Approval Email** — swap `logEvent` in `updateBurnPermitStatus` for `send-permit-approval` Edge Function.
2. **Landing Page Contact Form** — `app/actions/contact.ts` currently writes to `system_logs` (`log_type: contact_request`). Add Resend `fetch` call to email `zklein3@gmail.com`. Use `from: 'FireOps7 <noreply@fireops7.com>'`, `reply_to: submitter email`. See `RequestAccessModal.tsx`.
3. **New Member Welcome Email** — not yet built. Send when a dept admin creates a new personnel record / invite.
4. **Resend setup steps:** Verify `fireops7.com` in Resend dashboard → add DNS records → set `from` addresses → install `resend` npm package or keep using raw `fetch` to `https://api.resend.com/emails`.

### 10. Officer Sub-Menu
Officers need elevated access similar to admin hub scoped to operational functions. Not yet designed.

### 11. Timezone Setting per Department
All timestamps currently display in UTC on Vercel (server-rendered). Fire school fill log hardcoded to `America/Chicago` as a temporary fix.

**Build:**
- Add `timezone` column to `departments` table (text, default `'America/Chicago'`)
- Dept admin can select timezone in dept settings (dropdown of IANA tz names — US zones at minimum)
- Pass `timezone` through server layouts wherever timestamps are displayed
- Replace all `'America/Chicago'` hardcodes with dept timezone
- Fire school: use a system-level default timezone setting (no dept context) or read from a config table

**Key files when building:** `departments` table, `app/(dashboard)/dept-admin/`, all pages using `toLocaleString()` or `formatDT()`.

### 12. Module / Feature Flag System
`module_operations` + `module_iso` in DB and nav-gated. Remaining: sys admin toggle UI, plan presets (A/B/C/D bundles in MODULES.md).

---

## Run Sheet Import — Central Square CFS Format
Action: `app/actions/parse-run-sheet.ts` | Model: Claude Haiku | Key: `ANTHROPIC_API_KEY`

**Three time sources in every CFS:**
1. Page 1 header — `Call Time` → `call_time` | `Completed Time` → `in_service_at`
2. `Response Times` block — dept-level: `Assigned` → `paged_at`, `Arrived` → `first_on_scene_at`, `Leaving` → `last_leaving_scene_at`
3. `Unit Response Times` section — per-vehicle: `Enroute`, `Arrived`, `Leaving Scene`, `Available`/`Off Duty`

**Unit number matching:** CAD uses 3-letter agency prefix (e.g. `WIN11`); DB stores plain number (`11`). Parser given dept's unit list; Claude returns plain numbers. Client-side fallback strips alpha prefix before matching.

**Timestamp storage:** All times stored as local values with no timezone conversion — Supabase timezone = UTC. `formatDT` uses `timeZone: 'UTC'` to prevent CDT→UTC shift on display. Never instruct Claude to convert times to UTC.

**Re-import on existing incidents:** "Import Run Sheet" button on incident detail page (`app/(dashboard)/incidents/[id]/IncidentDetailClient.tsx`) — overwrites incident fields and upserts apparatus rows in place.

**Address fields:** `incidents` table has separate `address`, `city`, `state`, `zip` columns. Parser extracts each separately. NERIS uses `incident.state` directly.

---

## NERIS Compliance Reference → see `NERIS.md`

---

## Salamander QR Card Integration — Architecture Notes

Salamander personnel accountability cards encode binary data with readable text fields embedded. Format confirmed via live scan (2026-05-16).

**Confirmed parseable fields:**
- Name: `LASTNAME*FIRSTNAME` pattern (separated by `*`, with a control char between `*` and first name)
- Department: text following ESC character (`\x1B`)
- Title/Role: text near end of payload after cert block
- Certifications: uppercase codes (ACLS, FFII, EMT_P, etc.) separated by control characters

**Debug table:** `qr_debug_scans` — raw scan strings saved here for analysis. RLS disabled (debug only).

**Parser to build:** `lib/salamander.ts` → `parseSalamanderQR(raw: string)` returns `{ firstName, lastName, department, title, certs[] } | null`

### Use Case A — Incident Accountability (PAR)
Scan cards at incident scenes to track who is on scene, by assignment.
- New `incident_accountability` table: `incident_id`, `personnel_id` (nullable — mutual aid may not be in system), `raw_name`, `raw_dept`, `assignment`, `checked_in_at`, `checked_out_at`, `status` (on_scene | staged | released)
- Tab on incident detail page: "Accountability" — scan or manual entry, live roster, PAR timestamp button
- Must handle mutual aid personnel (not in personnel table) — store raw name/dept from QR
- PAR check logs a timestamped snapshot of everyone currently on scene

### Use Case B — Kiosk Login / Movement Tracking (future)
Dedicated `/kiosk` page on a shared station tablet. Scan card → identifies who is at the station. Three options discussed:
- **Option A (preferred for stations):** QR identifies person → short-lived device session token in DB → no full Supabase auth needed
- **Option B:** Device pre-logged in as kiosk account → QR scan logs activity for that person
- **Option C:** QR finds email in personnel → sends Supabase magic link to phone

Decision deferred. Build incident accountability first, then revisit kiosk/movement.
