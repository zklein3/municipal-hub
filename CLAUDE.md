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

### NERIS API Integration — Resume Here (UNBLOCKED 2026-05-10)
Credentials received from Conor Brady (FSRI). Vendor ID: VN03615504, Test Dept: FD35049607.
Auth confirmed: HTTP Basic auth — username `VN03615504`, password from portal. Awaiting Conor's reply on whether Basic is certified for vendor integrations or if OAuth2 is required.
Once auth confirmed: add `NERIS_VENDOR_ID`, `NERIS_TEST_DEPT_ID`, `NERIS_AUTH_MODE=basic`, `NERIS_VENDOR_PASSWORD` to `.env.local`, run `npm run neris:smoke`, then start compatibility badge work against FD35049607.

**API Review items (flagged with TODO(api-review) in code):**
- `app/actions/neris.ts` — Verify `patients[]` and `victims[]` payload field names against openapi.json once credentials active. Unified `incident_persons` splits into both medical and rescue sections; field names must match NERIS schema exactly.
- Module activation: UI now mirrors `getNerisActiveModules` — sections open based on both cover type AND selected NERIS code. Verify NERIS accepts partial modules (e.g. rescue section present on a fire call if rescue code selected).

### Asset Storage + Inspection Reconciliation — Resume at Phase 4
NERIS work is intentionally excluded until FireOps7 receives FSRI/vendor permission and credentials — NOW UNBLOCKED, see above.

**Phases 1–3 DONE (2026-05-08, feature/neris branch):**
- Phase 1 ✓ — Inspection asset picker groups: "On this apparatus" / "On another apparatus" / "Unassigned / storage" (optgroups in select)
- Phase 2 ✓ — Selecting a cross-apparatus asset shows inline yellow confirmation prompt; confirm fires `moveAssetToApparatus` action
- Phase 3 ✓ — DB migration: `asset_id` + `source` (manual | inspection_reconciliation) added to `item_movement_log`
- Key files: `app/(dashboard)/inspections/run/InspectionRunClient.tsx`, `app/(dashboard)/inspections/run/page.tsx`, `app/actions/equipment.ts` (`moveAssetToApparatus`)

**Phases 4–10 remaining — resume here:**
- Core model: quantity items use storage counts; asset-tracked items use `item_assets.apparatus_id`; `apparatus_id = null` means storage/unassigned; assets are not assigned to compartments; compartment standards stay in `item_location_standards`.
- Phase 4: at session close, compare assets assigned to the apparatus against assets selected during the session. Show assigned assets not found and default the action to move to storage.
- Phase 5: moving an unaccounted asset to storage sets `item_assets.apparatus_id = null` and logs apparatus → storage.
- Phase 6: extend `/equipment/storage` to show stored/unassigned assets, apparatus-assigned assets, total active assets, and admin/officer manual move controls.
- Phase 7: add apparatus asset summary showing expected quantity from compartment standards, assigned asset count on apparatus, and shortage/surplus indicators.
- Phase 8: permissions — admins create/edit/retire assets and override; officers manually move; members trigger assignment changes only during inspection reconciliation.
- Phase 9: movement history by asset, apparatus, item type, user, and source. Separate inspection-driven from manual moves.
- Phase 10: safety rules — no asset-to-compartment assignment, no silent auto-reassign, don't block inspection for unresolved reconciliation, always log changes.

### Events — Delete + End Time (DONE ✓ 2026-05-09, feature/neris branch)
User feedback from `/events` page (system_log IDs 16ac6509, da88add2) requested two fixes:
- **Delete button** ✓ — Admins can permanently delete an event instance (removes attendance records too). `deleteEventInstance` added to `app/actions/attendance.ts`. Delete button visible to admins only in `EventsClient.tsx`.
- **End time display** ✓ — Event cards now show "7:00 PM – 8:30 PM" when `start_time` + `duration_minutes` are both present. `formatEndTime` added to `EventsClient.tsx`.
- **Series end date** ✓ — New recurring event form now has an optional "Series Ends On" date field (`generate_through_date`). Defaults to 1 year if left blank.
Mark those system_log entries resolved when merging to main.

### Status Center — Burn Permits + Records Requests Lookup
User feedback (Brock Pierson, 2026-05-09): records request confirmation codes don't work on the burn permit status page. Need to extend the status lookup to support both burn permits and records requests, and rename the page (e.g. "Status Center" or "Status Portal"). Currently lives at `/dept/[slug]/permit-status`.

### Events — Show All Special Events for Current Year
User feedback (2026-05-09): special events should show all for the current year on the events landing page, not just the current rolling 30-day past / 60-day future window.

### Permit Approval Email — Direct to Resident (blocked ~1 month)
Swap `logEvent` in `updateBurnPermitStatus` for `send-permit-approval` Edge Function (already deployed). Blocked until `fireops7.com` verified in Resend (post-Wix migration).

### Officer Sub-Menu
Officers need elevated access similar to admin hub but scoped to operational functions (not structural setup). Not yet designed — discuss next session.

### Personnel Page — Officer Inline Edit (lower priority)
Officers see Add button on `/personnel` but no inline edit per card. Detail page works for now.

### Module / Feature Flag System (design ready, after storage)
Per-department feature flags managed by sys admin. Each dept has a checklist of enabled modules. Nav and routes respect flags. Sys admin panel gets a module toggle UI. Plan presets (e.g. "Starter", "Full") auto-check a standard set but individual overrides always available. Demo dept gets everything on.

**Base (always on for all depts):**
Personnel, Apparatus, Stations, Inventory, Inspections, Events + Attendance, Training/Certifications, Announcements, Basic Reports

**Bundle A — Operations**
Incidents, Run Sheet PDF Import, Incident Reports
- NERIS BLOCKED: Do not build NERIS integration until FSRI/vendor permission and credentials are granted.
- NERIS COMPLIANCE PRIORITY: After permission is granted, scope the NERIS field gap before building module flags around incident reporting. If FireOps7 incidents match NERIS schema and submit via the NERIS API, this eliminates double-entry for departments and becomes a flagship feature.

**Bundle B — ISO / Compliance**
ISO audit (hoses, hydrants, ISO report)
- Standalone — depts pursuing ISO grading specifically need this

**Bundle C — Public Engagement**
Public site, burn permits, records requests, public inbox
- Already has `public_site_enabled` flag — extend this to the full bundle

**Bundle D — Medical / EMS** *(future)*
Medical supply tracking, expiration alerts, EMS-specific inventory
- For combination fire/EMS departments

### Run Sheet PDF Import (DONE ✓)
Central Square CFS PDF → Claude Haiku extracts fields → pre-fills new incident form. `ANTHROPIC_API_KEY` in `.env.local` + Vercel. Action: `app/actions/parse-run-sheet.ts`.

---

## NERIS Compliance Reference → see `NERIS.md`
