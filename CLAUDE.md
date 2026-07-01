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
- Repo: https://github.com/zklein3/municipal-hub — branch: main
- Primary (sole active machine): `C:\Users\zklein3\Documents\FireOps7-Next`
- Backup only (emergency failover — not actively used): `C:\Users\zklei\Documents\FireOps7-Next` — keep git pull available in case primary machine dies

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
- `NATIVE.md` — Capacitor/Android/iOS app architecture and build workflow
- `ANDROID_HANDOFF.md` — handoff protocol between Claude Code and the Android Studio agent; point the Android Studio agent at this file
- `STRATEGY.md` — business strategy & platform expansion notes (MuniOps parent brand, dept type toggle, multi-dept login, ICS module spec, forms-as-product). Forward-looking, not yet built.

---

## Infrastructure & Business Roadmap

### Current State
- **Vercel** (free tier) + **Supabase** (free tier) — both production-grade platforms, not toys
- Architecture is standard PostgreSQL + Next.js — fully portable, no lock-in
- NERIS certified and approaching first live department

### Upgrade Trigger — First Paying Department or NERIS Live
- **Vercel Pro** — $20/month: removes cold starts, adds SLA, 60s function timeout
- **Supabase Pro** — $25/month: 8GB storage, no pausing, daily backups, point-in-time recovery
- **Total: ~$50/month** for production-grade setup

### Long-Term Infrastructure Path
1. **Now:** Vercel + Supabase (current)
2. **5–10 depts:** Evaluate Neon (managed Postgres, more control than Supabase)
3. **Enterprise:** AWS RDS PostgreSQL — SOC 2, encryption, multi-region. Migration = connection string change.

### Backup Strategy ✅ Working (2026-06-16)
- `.github/workflows/weekly-backup.yml` — runs every Sunday 2 AM UTC, `pg_dump` → gzip → Backblaze B2, keeps 12 weeks
- **All 4 secrets confirmed working in GitHub repo:** `SUPABASE_DB_PASSWORD`, `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_NAME`
- **Bucket name:** `fireops7-backups` on Backblaze B2 — scoped application key `fireops7-backup` (Read + Write, list all bucket names)
- **Connection confirmed working:** pooler shard `aws-1-us-east-1.pooler.supabase.com:5432`, username `postgres.kolrhnxozeroaselapzn`, `postgresql-client-17` required (PGDG repo added to workflow). pg_dump produces 412 KiB dump. Full end-to-end test passed 2026-06-16.

### PWA ✅ (2026-06-04)
- `public/manifest.json` + `public/sw.js` + root layout meta tags deployed
- Members can Add to Home Screen on Android/Chrome now; iOS works via Safari Share
- **To complete for iOS:** generate real 192×512 PNG icons → drop in `public/icons/`
- Push notifications: separate future phase

### Native App — Capacitor (after Winslow operational + funded)
- `capacitor.config.ts` scaffolded, `@capacitor/core` + `@capacitor/cli` installed
- When funded: `npx cap add ios && npx cap add android`, add PNG icons, submit to stores
- Apple Developer ($99/year) + Google Play ($25 one-time)

### Infrastructure Remaining
- **Upgrade Vercel + Supabase** — trigger: first paying dept or NERIS live (~$50/month)
- **Capacitor** — after Winslow funded

---

## IMMEDIATE NEXT — Resume Here Next Session

### Multi-Department / MuniOps Platform Expansion — IN PROGRESS ✳️ (2026-06-26)

**Shipped this session:**
- `department_type` column on `departments` (`fire | law_enforcement | public_works | municipal`, default `fire`) — migration applied
- Multi-department login flow — `signIn` redirects to `/select-department` when a user has >1 active `department_personnel` row; `selectDepartment` action validates membership and sets `selected_department_id` cookie; sign-out clears it
- Department switcher in sidebar (desktop + mobile) — "Switch Department" link, shown only when `hasMultipleDepartments`
- Navy theme (`lib/department-theme.ts`) for non-fire departments — sidebar, nav active/hover states. Fire stays red. Two-tone only for now (no per-type palette beyond fire/non-fire)
- Nav gating by `department_type` — non-fire depts see a stripped sidebar (Dashboard, Personnel, Training, Reports only); Operations/Inbox/Inventory hidden since they're fire-specific (incidents, apparatus, burn permits, medical)
- **Yutan Police Department** created (`department_type: law_enforcement`) as the pilot for Terry (fire dept member + Yutan police chief). Terry and `zklein3@gmail.com` both added as admin on Yutan PD in addition to their existing fire dept admin roles
- **Major bug fix — multi-department data scoping**: discovered the dashboard layout's cookie-aware department selection only governed the sidebar, not actual page data. ~90 files across the app independently queried `department_personnel` and grabbed the *first* row regardless of which department was selected, meaning a multi-dept user (like Terry/zklein3@gmail.com) would see one department's data while believing they were in another. Fixed via a new shared helper `lib/current-department.ts` (`getCurrentDepartmentContext()`), rolled out across every page and server action that previously duplicated the "first dept row" pattern. Also caught and fixed several **wrong-department write bugs** (`createApparatus`, `createStation`, `createDeptMember`, `saveDeptInspectionSettings` were inserting/updating against the wrong department for multi-dept admins) and a cross-department read leak in `/print/run-sheet` (any dept could print any other dept's run sheet by guessing the incident ID). Also fixed a pre-existing `logError(page, message, id)` argument-order bug (correct signature is `logError(message, page, context)`) found in `incidents.ts` and `iso.ts` while clearing type errors.
- Build verified green after every phase of this rollout — see git log for the phase-by-phase commit, or ask Claude for the file list if auditing.

**Not yet built:**
- Dept Admin hub still shows fire-specific admin cards for non-fire depts (Inspections, ISO, Medical, Events) — no gating there yet
- No police-specific modules/forms — Terry hasn't delivered his Yutan city forms yet (contact reports, internal memos, inspection checklists). Plan is to build those using the existing inspection-template-builder pattern (see STRATEGY.md "Forms as a Product")
- Reports/Training pages still query fire-shaped data under the hood — will render empty/awkward for Yutan rather than something police-relevant
- MuniOps parent brand site not started

See `STRATEGY.md` for the full roadmap this work is drawn from.

### Medical Supply Module — COMPLETE ✅ (2026-06-06)

**Key files:** `app/(dashboard)/medical/`, `app/(dashboard)/dept-admin/medical/`, `app/actions/medical.ts`, `app/(dashboard)/apparatus/[id]/MedicalBagsSection.tsx`, `app/(dashboard)/apparatus/[id]/MedicalCompartmentsSection.tsx`, `app/(dashboard)/inbox/RestockTab.tsx`, `app/(dashboard)/reports/medical/`, `app/print/medical-cs-log/`

- **Phase 1:** DB tables, admin supply/storeroom management, receive stock, alerts panel, inbox badge
- **Phase 2:** Dispense/Use (FIFO, dual-sig), Waste (reason + dual-sig), Transfer, Transaction History (90-day ledger, Print CS Log)
- **Phase 3:** CS log print, Medical Reports page, `module_medical` flag + sys admin toggle
- **Phase 4:** Stock adjustment (admin), daily alert edge function, reorder requests (inbox Restock tab)
- **Phase 5 (2026-06-06):** Lot editing (officer+: edit `lot_number` + `expiration_date` after receipt). Batch waste expired lots — waste all expired active lots in one operation (single reason + signatures). Bidirectional Restock/Transfer on bags + compartments (all surfaces: pull in from storeroom, push out to storeroom). Inbox Restock tab shows expired lots (red section) with "Go to →" link routing to `/equipment/[id]` for bags or `/medical` for storerooms. Medical reports: location type badge (Storeroom / Bag / Compartment) + apparatus context; expired rows red-tinted. Transfer button now shows when apparatus compartments exist (not just multiple storerooms). Bag inventory: Receive button removed (storeroom-only action). `medical_stock_transactions.transaction_type` constraint updated to match app values.
- **Bag system:** Template-based. Dept Admin → Medical → Bags tab. `MedicalBagsSection` + `MedicalCompartmentsSection` in apparatus View Inventory. Mode toggle (Standard ↕ / Independent ↕) per bag.

**Role model:** Members = view + use + restock non-controlled. Officers+ = receive + waste + transfer + edit lots + batch waste expired. Admins = configure + adjust.
**Controlled substances = separate future module.** `is_controlled` flag + dual-sig fields stay as schema placeholders only — no CS compliance workflows built yet.
**DB tables:** `medical_supply_types`, `medical_storerooms` (+`apparatus_id`, `compartment_id`, `template_id`, `inventory_mode`), `medical_storeroom_inventory`, `medical_stock_lots`, `medical_stock_transactions`, `medical_reorder_requests`, `medical_bag_templates`, `medical_bag_template_items`
**Transaction types:** `received` | `dispensed` | `wasted` | `transferred_out` | `transferred_in` | `adjusted`
**Storerooms** = station storage (`apparatus_id=null`). **Bags** = apparatus-linked (`apparatus_id` set, `compartment_id` null). **Compartment storerooms** = both set.

---

### 0f. Events Restructure + Training Toggle — SHIPPED ✅ (2026-06-01)
- `/events` → clean member page (cards, Log Attendance, Sign, Can't Attend). Officers see "Manage Events →" top right.
- `/dept-admin/events` → full management page (edit, bulk log, pending queue, excuse approvals, close, cancel, delete). Card added to Dept Admin hub.
- **Training toggle** on event create + inline edit: sets hours + optional cert type → auto-creates `training_events` rows per instance → linked events show on `/training` page with purple "via [Event Title]" badge
- Officer verifies attendance on training-linked event → cert auto-issued if cert type set
- Standalone training events: Cancel button added; cancelled events hidden from member view
- DB: `event_series` + `is_training`, `training_hours`, `training_cert_type_id`; `training_events` + `event_instance_id`, `cancelled`
- Apparatus ISO specs: `turning_radius_ft` + `gvwr_lbs` added to `apparatus_iso_specs`, ISO report + apparatus detail updated

### 0e. Inventory & Equipment Setup Restructure — SHIPPED ✅ (2026-06-01)
- Nav label: Equipment → **Inventory**
- `/equipment` rewritten as member-focused page: Station Storage card + apparatus list (Vehicle Check, View Inventory, Fuel Log per card)
- Equipment Setup → Items sub-tabs: **Items → Asset Categories → Assets** (templates nested inside Asset Categories per inspectable item; apparatus assignment inline on Assets tab)
- Compartments setup: Active/All toggle (defaults Active)
- Compartment display: `[unit_number] - [code]` everywhere in apparatus context; universal in setup
- Asset Roster moved to Reports hub (read-only). Apparatus assignment moved to Setup → Items → Assets.
- Scattered "Storage →" shortcut buttons removed; Storage now accessed from Inventory page card

### 0f. Batch QR Print — Asset Classes SHIPPED ✅ (2026-07-01); Compartments + Apparatus TODO ⬅

**Shipped:** `/print/qr-batch?item_id=...` — prints all active assets for an item class. Format selector: Sheet 3-up / Avery 5160 (30-up, 2⅝"×1") / Avery 5163 (10-up, 4"×2") / Avery 5164 (6-up, 4"×3⅓"). Avery 26116 (weatherproof) uses same layout as 5163. "Print All QRs" button in Dept Admin → Setup → Items → Assets tab per item group. Backed by `/api/assets-for-item`.

**Still to build — extend batch QR to the rest of the truck:**
- **Compartments** — "Print All QR Codes" per apparatus in Dept Admin → Setup → Compartments. Route: `/print/qr-batch?apparatus_id=...&type=compartments`. Backed by a new `/api/compartments-for-apparatus` route. Each card: compartment `[unit_number] - [code]`, QR encodes `/scan?type=compartment&code=[qr_code]`.
- **Apparatus** — print the apparatus QR itself (one per page or as a single large label for the cab door). Route: `/print/qr-batch?apparatus_id=...&type=apparatus`.
- When building: reuse the same format selector component — extract it into `components/QrBatchPrint.tsx` so sheet/label logic isn't duplicated across routes.

### 0. Nav Hub-and-Spoke — SHIPPED ✅ (2026-05-20)
Sidebar trimmed to 6 items. Hub pages live at `/operations`, `/equipment` (enhanced), `/reports`, `/dept-admin`, `/iso`. `PageNavBar` on every page. No further nav work needed unless user requests tweaks after testing.

### 0d. Vehicle Check — SHIPPED ✅ (2026-05-31)
Standalone truck check at `/inspections/vehicle-check/[id]` — separate from compartment inventory inspection.
- 24 default items across 7 groups: Fluids, Mechanical, Lights, Communications, Emergency Equipment, Cleaning, Air Brakes
- Every item has instructions (procedure, what to look for, pass/fail) — shown expanded by default, tap to collapse
- Per-apparatus toggles on apparatus detail page: `has_air_brakes` (adds Air Brakes group), `has_engine_hours` (adds engine hours field)
- Admin manages checklist via Dept Admin → Inspections (new hub card) → Vehicle Check Items tab
- Results stored in `vehicle_inspections` + `vehicle_inspection_results`; history panel shows last 10 checks
- "Do inventory on this vehicle?" link connects to compartment inspection session
- Equipment Setup → Apparatus consolidated to single Edit button (was 3 redundant buttons)
- Apparatus detail page: ISO Specs + Pump Tests section now before Compartments

**Note for existing depts:** Go to Dept Admin → Inspections → Vehicle Check Items → Reset to defaults once to load instruction text into the DB.

### 0a. Incident Run Signatures — SHIPPED ✅ (2026-05-23)
- `incident_signatures` table — unique `(incident_id, personnel_id)`, `signed_at` null = pending
- Triggered on NERIS submit — rows upserted for all non-absent personnel
- Members sign via `/inbox` Signatures tab (`IncidentSignaturePadModal`)
- Officer/admin sees signed/pending roster on incident detail page
- Inbox opened to all members; layout badge includes pending signature count
- `standby` role added to `incident_personnel_role_check` constraint

### 0b. Run Sheet Print — SHIPPED ✅ (2026-05-23, enhanced 2026-05-24)
`/print/run-sheet?id=xxx` — matches dept paper Run Field Report, fits one letter sheet.
- Units Dispatched: each apparatus with member names; **POV** group (no apparatus, role ≠ standby); **Station** group (no apparatus, role = standby)
- Single "Incident Role" column header at top of Units Dispatched section
- Role labels (IC, Driver, Officer, FF) right of name; members sorted IC → Driver → Officer → FF → Standby
- Cert labels below name — driven by `certification_types.show_on_run_report` flag (dept controls which certs appear)
- Incident info labels tab-aligned (CSS grid, 1.35in label column); address includes zip
- Incident Time rows span full column width (label left, time line right)
- Type of Incident: labels left, checkboxes right; additional fields span full width
- Mutual aid reads `incident_mutual_aid`: `gave_aid` → To, `received_aid` → From
- Key file: `app/print/run-sheet/page.tsx`

### 0c. Run Report — SHIPPED ✅ (2026-05-24)
`/reports/run-report` — filterable incident list with print links.
- Filters: date range (default last 90 days) + incident type dropdown (only types present in dept)
- Each row: date, incident #, type badge (color-coded), address, unit count, responder count
- Print ↗ button opens `/print/run-sheet?id=...` in new tab
- Card added to `/reports` hub (officers + admins)

### 1. Training — ✅ Core complete (2026-06-02)
Built 2026-05-17. Enhanced 2026-05-24. Outside training submission flow added 2026-06-02.

**What's working:**
- Unified member training page (My Training list + My Certifications)
- Simple cert: assign → training date → member logs attendance → officer verifies → cert issued → member signs
- Training event with cert type: bulk log attendance → cert auto-issued to all
- Direct cert entry (admin): picks cert type or enters custom name, dates, cert number
- Dept-wide enrollment: "Assign to All Active Members" toggle
- Cert signatures on all records (CertSignaturePadModal)
- **Member Certs tab** in Training Admin: officers read-only, admins can edit
- `show_on_run_report` flag on cert types — controls run sheet cert display
- **Outside training submission** — member logs external classes (conference, seminar) via "Log Outside Training" button on `/training`. Optional photo upload → Claude Haiku parses image and pre-fills fields. Optional purpose + NREMT category dropdowns. Sits as `pending` until officer/admin approves via Submissions tab in Training Admin. Approval can link to a cert type (auto-issues cert for recert/initial_cert). All submissions (pending/approved/rejected) visible on member training page with status badge and reviewer notes.

**NREMT categories (built in):** AIRWAY | CARDIOLOGY | TRAUMA | MEDICAL | OPERATIONS

**Known gaps still open:**
- Training event cert issuance deduplication (same-day check only — may double-issue if event re-verified)
- No expiry notification for certs approaching expiration
- Outside training print record (deferred — needs Vercel push to test)

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

### 9. Pending Email Tasks — Domain transfer initiated 2026-06-01

`fireops7.com` transfer from Wix to Vercel initiated 2026-06-01. Auth code: `O;JiG{mp%#3u`. Waiting for Wix approval email → once transfer completes, verify domain in Resend, then wire up email tasks below.

**When domain is ready:**
1. **Permit Approval Email** — swap `logEvent` in `updateBurnPermitStatus` for `send-permit-approval` Edge Function.
2. **Landing Page Contact Form** — `app/actions/contact.ts` currently writes to `system_logs` (`log_type: contact_request`). Add Resend `fetch` call to email `zklein3@gmail.com`. Use `from: 'FireOps7 <noreply@fireops7.com>'`, `reply_to: submitter email`. See `RequestAccessModal.tsx`.
3. **New Member Welcome Email** — not yet built. Send when a dept admin creates a new personnel record / invite.
4. **Resend setup steps:** Verify `fireops7.com` in Resend dashboard → add DNS records → set `from` addresses → install `resend` npm package or keep using raw `fetch` to `https://api.resend.com/emails`.

### 9a. Public Records Requests — Reconsider Removing from Public Site ⬅ PINNED FOR LATER
Most small departments aren't actually set up to handle public records requests this way (no formal process). Don't remove yet — wait and see whether any department gets real submissions through `/dept/[slug]/records` (`public_record_requests` table) before deciding whether to pull the "Request Records" card from the public site.

**Note:** Facebook page now links to the public site (set up 2026-06-09) — public site is getting real outside traffic now, so any future removal should be a deliberate UI change, not a silent drop (residents may have bookmarked/shared links).

### 10. QR Self Check-In — Event / Training / Incident ⬅ PINNED FOR LATER
Officer creates an event, training session, or incident → system generates a unique QR code for that session. Members scan with phone camera → opens a lightweight page → attendance/participation logged automatically. No app install required.

**Design notes:**
- QR encodes a signed URL: `/checkin/[token]` where token encodes `{ type: 'event'|'training'|'incident', id, expires }`
- Token signed with `SUPABASE_SERVICE_ROLE_KEY` or a dedicated secret — prevents guessing other sessions
- Landing page: shows event/incident name, confirms identity (member is already logged in via cookie), one-tap check-in
- If not logged in: prompt login first, then redirect back to check-in URL
- Officer generates QR from event/training/incident detail page — displays on screen or prints
- Distinct from Salamander card scanning — this is member self-check-in, not officer scanning cards

### 10a. Salamander QR — Incident Accountability (PAR) ⬅ SEPARATE USE CASE
Salamander cards are for officer-scans-others-cards at a scene, not self check-in.
- Parser: `lib/salamander.ts` → `parseSalamanderQR(raw)` returns `{ firstName, lastName, department, certs[] } | null`
- Match parsed name to `personnel` table; unmatched = store raw name + dept (mutual aid)
- `incident_accountability` table: `incident_id`, `personnel_id` (nullable), `raw_name`, `raw_dept`, `assignment`, `checked_in_at`, `status`
- PAR check logs a timestamped snapshot of everyone currently on scene
- Build incident accountability after QR self check-in is working

### 11. Officer Sub-Menu
Officers need elevated access similar to admin hub scoped to operational functions. Not yet designed.

### 11. Zip Code Auto-Fill on Incident Forms
When a zip code is entered on new/edit incident forms, city and state should auto-populate.
- On blur of zip field: hit `https://api.zippopotam.us/us/{zip}` (free, no key)
- Parse response → fill city + state fields automatically
- Only fill if fields are currently empty or user confirms overwrite
- Key files when building: `app/(dashboard)/incidents/new/NewIncidentClient.tsx`, incident edit form

### 12. Timezone Setting per Department
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
