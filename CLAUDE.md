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

### NERIS API Integration (UNBLOCKED — waiting on auth confirmation)
Credentials received from Conor Brady (FSRI). Vendor ID: `VN03615504`, Test Dept: `FD35049607`.
Auth confirmed as HTTP Basic — username `VN03615504`, password from portal. Awaiting Conor's reply on whether Basic is certified or if OAuth2 is required before finalizing.
Once confirmed: add `NERIS_VENDOR_ID`, `NERIS_TEST_DEPT_ID`, `NERIS_AUTH_MODE=basic`, `NERIS_VENDOR_PASSWORD` to `.env.local`, run `npm run neris:smoke`, then compatibility badge work against FD35049607.
**TODO(api-review) in `app/actions/neris.ts`:** verify `patients[]` / `victims[]` field names and partial-module acceptance against openapi.json once live.

### Asset Storage + Inspection Reconciliation — Resume at Phase 4
Phases 1–3 done. Key files: `app/(dashboard)/inspections/run/InspectionRunClient.tsx`, `app/actions/equipment.ts` (`moveAssetToApparatus`).
- Phase 4: session-close reconciliation — compare apparatus-assigned assets vs. selected; show unaccounted, default to move-to-storage
- Phase 5: move unaccounted asset to storage → `item_assets.apparatus_id = null` + log
- Phase 6: `/equipment/storage` — stored/unassigned assets, apparatus-assigned assets, manual move controls
- Phase 7: apparatus asset summary — expected qty vs. assigned, shortage/surplus indicators
- Phase 8: permissions (admins create/retire/override; officers move; members only via inspection)
- Phase 9: movement history by asset/apparatus/item/user/source
- Phase 10: safety rules — no silent auto-reassign, don't block inspection for unresolved reconciliation

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

---

## NERIS Compliance Reference → see `NERIS.md`
