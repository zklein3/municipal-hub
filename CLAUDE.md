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

## Error Logging
- Table: `system_logs` (log_type: error | user_report | info)
- `lib/logger.ts` — logError(), logEvent()
- `notify-on-log` Edge Function → email to zklein3@gmail.com via Resend

## RLS / DB Rules
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

## Equipment / Item Type Flags
- `tracks_quantity` — count-based | `tracks_assets` — individual tracking | `requires_presence_check` — apparatus check | `requires_inspection` — has template + schedule | `tracks_expiration` — expiry date
- Asset Statuses (DB exact values): `IN SERVICE` | `OUT OF SERVICE` | `RETIRED`
- ASSET_LINK step type fully removed from codebase + DB. Do not re-introduce.

## Back Navigation Pattern
- `components/BackButton.tsx` — accepts optional `href` prop; uses `router.push(href)` if provided, else `router.back()`
- Back button lives BELOW the header as a styled action row button — never inline with the title
- Pages with single parent: hardcode destination (personnel → /personnel, stations → /stations, incidents → /incidents)
- Contextual pages: pass `?from=/origin` in link, read in page, pass as `href` to BackButton

## Nav Structure
- **Main nav** — identical for all roles: Dashboard / Personnel / Training & Events / Operations / Inspections / Reports
- **Dept Admin section** — admin only: Equipment / Personnel / Training / Hose Inventory / Hydrants / ISO Report
- Operations includes Public Inbox for all (badge only shows for officers+)

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

### Asset Storage + Inspection Reconciliation
This is the next immediate build. NERIS work is intentionally excluded until FireOps7 receives FSRI/vendor permission and credentials.

Members can move/remove items between compartments. "Storage" (unassigned pool) is next:
- Items removed from a compartment go to a visible unassigned pool
- Members can add items from storage into a compartment
- Log all moves: who/what/from/to/timestamp
- Restore the quantity guard in `removeItemFromCompartment` (`app/actions/equipment.ts`): do not let quantity items disappear directly from a compartment. Require moving quantity to storage first, then allow adding from storage later.

Asset storage and inspection reconciliation build plan:
- Goal: assets are assigned to an apparatus or to storage, not to compartments. Compartment standards define what item types and quantities should be present. Inspections identify which exact assets are physically present, then use that information to reconcile asset assignment with a movement audit trail.
- Core model: quantity items use storage counts; asset-tracked items use `item_assets.apparatus_id`; `item_assets.apparatus_id = null` means storage/unassigned; assets are not assigned to compartments; compartment standards stay in `item_location_standards`.
- Phase 1: update the inspection asset picker to group matching assets as assigned to current apparatus, assigned to another apparatus, then storage/unassigned. Show clear labels and prevent duplicate selection in the same inspection.
- Phase 2: when a user selects an asset assigned elsewhere, prompt whether to assign it to the current apparatus. If confirmed, update `item_assets.apparatus_id`, log the move, and continue inspection.
- Phase 3: ensure movement logs support asset moves with `department_id`, `item_id`, `asset_id`, quantity/1, from/to type + id, `moved_by`, source (`inspection_reconciliation` or `manual`), and timestamp.
- Phase 4: at session close, compare assets assigned to the apparatus against assets selected during the session. Show assigned assets not found and default the action to move to storage.
- Phase 5: moving an unaccounted asset to storage sets `item_assets.apparatus_id = null` and logs apparatus -> storage. If later found on another apparatus, prompt and log storage -> apparatus.
- Phase 6: extend `/equipment/storage` to show stored/unassigned assets, apparatus-assigned assets, total active assets, and admin/officer manual move controls.
- Phase 7: add apparatus asset summary showing expected quantity from compartment standards, assigned asset count on apparatus, and shortage/surplus indicators.
- Phase 8: permissions stay layered. Admins create/edit/retire assets and override assignments; officers can manually move assets; members can trigger assignment changes only during inspection reconciliation.
- Phase 9: add movement history by asset, apparatus, item type, user, and source. Separate inspection-driven moves from manual moves.
- Phase 10: safety rules: do not assign assets to compartments, do not silently auto-reassign without confirmation, do not block inspection completion for unresolved reconciliation, preserve inspection results, and always log assignment changes.
- No named storage locations yet — simple unassigned pool first

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
