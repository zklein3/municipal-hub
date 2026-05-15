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
- `MODULES.md` — equipment/inspection, attendance, training, incident, ISO module design
- `HISTORY.md` — what's built, what's not, DB tables, session history

---

## IMMEDIATE NEXT — Resume Here Next Session

### NERIS Incident Submission — PHASE 1 COMPLETE ✅ (2026-05-13)
Core submission flow working end-to-end against NERIS test API (FD35049607). Badge criteria all passed.

**What works:** OAuth2 client_credentials auth, POST /incident with base/dispatch/incident_types/actions_tactics. Submitting locks the incident and sets `status = 'finalized'` + `neris_reported = true`.

**Key confirmed field names (live API):**
- Incident types: pipe-delimited e.g. `FIRE||STRUCTURE_FIRE||STRUCTURAL_INVOLVEMENT_FIRE`
- Action codes: pipe-delimited e.g. `EMERGENCY_MEDICAL_CARE||PROVIDE_BASIC_LIFE_SUPPORT`
- `actions_tactics.action_noaction` = discriminated union — `{ type: 'ACTION', actions: [...] }` or `{ type: 'NOACTION', reason: '...' }`
- `dispatch`: `call_create`, `call_answered`, `call_arrival` (all = call_time), `location: { state }`, `unit_responses: [{ reported_id_unit }]`
- `base`: `department_neris_id`, `incident_number`, `location: { state }`

**Test dept:** Fremont Fire Test Dept (FFTD) has `neris_entity_id = 'FD35049607'` — use `test.admin@fireops7.com` to test submissions.

**NERIS module data still TODO** (add back one section at a time, test against FFTD):
- ✅ `locations` — `base.location_use.use_type` (property use), `base.displacement_count` (displaced persons), `base.location.street/postal_code` — confirmed + wired (2026-05-15)
- ✅ `fire` — `fire_detail.location_detail` (STRUCTURE or OUTSIDE discriminated by incident type), `arrival_condition`, `damage_type`, `cause`, `floor_of_origin`, `room_of_origin_type`, `acres_burned`, `suppression_appliances` — confirmed + wired (2026-05-15)
- `narrative` — top-level key unknown, stripped
- `unit_responses` timing — `enroute_at`/`on_scene_at` field names unverified
- `medical` / `rescue` — patients/victims (field names unknown, stripped)
- `hazmat` — disposition, chemical (field names unknown, stripped)

**Env vars in `.env.local`:** `NERIS_CLIENT_ID`, `NERIS_CLIENT_SECRET`, `NERIS_TEST_DEPT_ID=FD35049607`, `NERIS_USE_TEST=true`

### Asset Storage + Inspection — COMPLETE ✅
All 10 phases done (2026-05-11). Key files: `app/(dashboard)/inspections/`, `app/actions/equipment.ts`, `app/(dashboard)/equipment/storage/`, `app/(dashboard)/equipment/movement-log/`.
- Session flow: stays open until closed, multi-user claim/release, Resume Session with progress badge, Abandon (officer+)
- Reconciliation scoped to completed compartments only; assets auto-assign from storage during inspection
- "Not present" slot marking for missing assets during inspection
- `/equipment/storage` shows quantity items + unassigned tracked assets, manual assign for officers+
- `/equipment/movement-log` — movement history with search + source filter
- Apparatus equipment page shows assigned vs expected count per tracked item
- Dept-configurable session timeout via Dept Admin → Inspections

### Fuel Logging — BUILD NEXT
Track apparatus fuel usage with receipt scanning. Two entry points + a report.

**DB table: `apparatus_fuel_logs`**
```
id, department_id, apparatus_id, logged_by_personnel_id
fuel_date (date), gallons (numeric), cost_per_gallon (numeric), total_cost (numeric)
fuel_type (diesel | gasoline | other), odometer (integer, optional)
vendor (text, optional), notes (text, optional), created_at
```

**Receipt parsing:** Claude Haiku extracts gallons, price/gallon, total, vendor, date from a receipt photo. Action: `app/actions/parse-fuel-receipt.ts`. Model + key same as run sheet parser (`ANTHROPIC_API_KEY`, `claude-haiku-*`). User uploads/photos receipt → fields pre-fill → user confirms + saves.

**Entry point 1 — Apparatus detail page** (`/equipment/[id]`)
- Add "Fuel Log" button in the action row (next to Inventory Storage)
- Opens `/equipment/[id]/fuel` — list of fuel entries for that apparatus + Add Entry button with receipt scan

**Entry point 2 — Dashboard**
- Add a "Log Fuel" quick-action card on the dashboard (all roles)
- Apparatus picker dropdown → same receipt scan + form flow
- Shows last 5 fuel entries dept-wide as a mini feed

**Report: `/reports/fuel`**
- Filter by apparatus and/or date range
- Summary: total gallons, total cost, cost per apparatus
- Breakdown table: date / apparatus / vendor / gallons / cost
- Print-ready

### Permit Approval Email (blocked)
Swap `logEvent` in `updateBurnPermitStatus` for `send-permit-approval` Edge Function. Blocked until `fireops7.com` verified in Resend post-Wix migration.

### Officer Sub-Menu
Officers need elevated access similar to admin hub but scoped to operational functions. Not yet designed.

### Personnel Page — Officer Inline Edit (lower priority)
Officers see Add button on `/personnel` but no inline edit per card. Detail page works for now.

### Module / Feature Flag System (design ready, after storage)
Bundles: A = Operations, B = ISO, C = Public, D = Medical (future). `module_operations` + `module_iso` already in DB and nav-gated. Remaining: sys admin toggle UI, plan presets, demo dept gets everything on.

---

## Run Sheet Import — Central Square CFS Format
Action: `app/actions/parse-run-sheet.ts` | Model: Claude Haiku | Key: `ANTHROPIC_API_KEY`

**Three time sources in every CFS:**
1. Page 1 header — `Call Time` → `call_time` | `Completed Time` → `in_service_at`
2. `Response Times` block — dept-level: `Assigned` → `paged_at`, `Arrived` → `first_on_scene_at`, `Leaving` → `last_leaving_scene_at`
3. `Unit Response Times` section — per-vehicle: `Enroute`, `Arrived`, `Leaving Scene`, `Available`/`Off Duty`

**Unit number matching:** CAD uses 3-letter agency prefix (e.g. `WIN11`); DB stores plain number (`11`). Parser is given the dept's unit list; Claude returns plain numbers. Client-side fallback strips alpha prefix before matching.

**Timestamp storage:** All times stored as local values with no timezone conversion — Supabase timezone = UTC. `formatDT` uses `timeZone: 'UTC'` to prevent CDT→UTC shift on display. Never instruct Claude to convert times to UTC.

**Re-import on existing incidents:** "Import Run Sheet" button on incident detail page (`app/(dashboard)/incidents/[id]/IncidentDetailClient.tsx`) — overwrites incident fields and upserts apparatus rows in place.

**Address fields (2026-05-13):** `incidents` table now has separate `address` (street), `city`, `state`, `zip` columns. Parser extracts each separately. NERIS uses `incident.state` directly — no regex parsing.

### Fire School Module — COMPLETE ✅ (2026-05-14)
Built and deployed as a standalone public site (`/fire-school/*`) for SCBA cylinder fill station operations at fire school events. No login required.

**What's live:**
- `/fire-school` — Fill station: scan QR or enter bottle ID, shows go/no-go with bottle detail, logs fill
- `/fire-school/bottles` — Bottle roster: add, edit (inline), status badges, mobile card layout + desktop table, Print Report + Print QR Label per bottle
- `/fire-school/fill-log` — Full fill history log
- `/print/fire-school-report` — Printable PDF report: summary stats (total/in-spec/out-of-spec/total fills), full roster table with out-of-spec rows highlighted red, sorted OOS first

**Cylinder types (DOT/NFPA compliant):**
| Type | DB value | Service Life | Hydro Interval |
|------|----------|-------------|----------------|
| Carbon Fiber/Composite | `composite_15` | 15 yr | 5 yr |
| Next-Gen Composite | `composite_30` | 30 yr | 5 yr |
| Hoop-Wrapped/Fiberglass | `hoop_wrapped` | 15 yr | 3 yr |
| Steel | `steel` | None | 5 yr |
| Aluminum | `aluminum` | None | 5 yr |

**Key technical notes:**
- Type selection auto-locks hydro interval + service life in the add/edit form — user can't enter wrong combo
- QR codes encode `https://www.fireops7.com/fire-school?scan=BOTTLE_ID` — works with native camera and in-app scanner
- `export const dynamic = 'force-dynamic'` required on fill-log and report pages or Vercel caches them
- Print button must be an isolated `'use client'` component — inline `<style>` JSX causes hydration failure that kills button interactivity
- DB tables: `fire_school_bottles`, `fire_school_fill_logs`

---

## Business Model — Next Focus 🔜

FireOps7 is currently free. Goal: transition to a paid SaaS model. Need to design pricing, feature gating, and the upgrade/billing flow.

**Context for this conversation:**
- Platform serves fire departments of varying sizes (volunteer to career)
- Current module bundles already defined in DB: `module_operations`, `module_iso` (flags per dept)
- Module/feature flag system is designed but sys admin toggle UI not yet built
- Demo dept gets everything on; plan presets (A/B/C/D bundles) are designed in MODULES.md

**Questions to work through:**
- What is the pricing model? (per dept flat rate / per seat / per module bundle / tiered)
- What is free forever vs. paid? (e.g. fire school fill station is likely always free as a public good)
- How does a department admin sign up and pay? (Stripe integration, billing portal)
- What happens when a dept doesn't pay — graceful degradation vs. hard lock?
- How do we handle volunteer depts with no budget vs. career depts?
- Who is the buyer — fire chief, department admin, municipality?
- Is there a grant/SAFER angle given the NERIS compliance features?

---

## NERIS Compliance Reference → see `NERIS.md`
