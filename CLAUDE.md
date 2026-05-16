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

### 1. NERIS — Add Env Vars to Vercel ⚠️ USER ACTION REQUIRED
NERIS submission works locally but fails on live site — env vars not in Vercel.
Add these in Vercel dashboard → Project Settings → Environment Variables:
- `NERIS_CLIENT_ID` — from NERIS Integrations tab
- `NERIS_CLIENT_SECRET` — from NERIS Integrations tab
- `NERIS_USE_TEST=true` — remove/set false for production submissions
- `NERIS_TEST_DEPT_ID=FD35049607` — FSRI test dept (dev only)

### 2. NERIS — Remaining Modules
Core submission complete. Modules confirmed + wired: locations, fire, narrative.
Still TODO (field names unverified, stripped from payload):
- `unit_responses` timing — `enroute_at`/`on_scene_at` field names unknown
- `medical` / `rescue` — patient/victim fields unknown
- `hazmat` — disposition, chemical fields unknown

Test dept: `neris_entity_id = 'FD35049607'`, use `test.admin@fireops7.com`.
See `NERIS.md` for full field reference and payload builder notes.
Payload builder: `app/actions/neris.ts` → `buildNerisPayload`

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

### 6. Permit Approval Email (blocked)
Blocked until `fireops7.com` verified in Resend post-Wix migration.
Swap `logEvent` in `updateBurnPermitStatus` for `send-permit-approval` Edge Function.

### 5. Officer Sub-Menu
Officers need elevated access similar to admin hub scoped to operational functions. Not yet designed.

### 7. Module / Feature Flag System
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
