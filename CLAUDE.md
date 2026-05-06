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
- `pending` — member self-logged, awaiting officer verification
- `excused_pending` — member submitted excuse request, awaiting officer approval
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

## Dev Workflow
- Start: `npm run dev` | Build: `npm run build` (always before pushing)
- `git add . && git commit -m "message" && git push`

## Test Accounts
- `zklein3@outlook.com` — sys admin | `test.winfire@fireops7.com` — Winslow admin
- `member.winfire@fireops7.com` — Winslow member | `test.admin@fireops7.com` — Fremont admin
- Temp password for new accounts: `Hello1!`

## Reference Files
- `REFERENCE.md` — routes, action files, edge functions, permissions, burn permit + public site details
- `MODULES.md` — equipment/inspection, attendance, training, incident, ISO, fire school module design
- `HISTORY.md` — what's built, what's not, DB tables, session history

---

## IMMEDIATE NEXT — Resume Here Next Session

### Permit Email — Direct to Resident (blocked ~1 month)
`fireops7.com` must be verified in Resend first (blocked until Wix → new registrar migration). Once verified: swap `logEvent` call in `updateBurnPermitStatus` for the already-deployed `send-permit-approval` Edge Function. One line change.

### Personnel Page — Officer Inline Edit (lower priority)
Officers see Add button on `/personnel` but no inline edit per card. Detail page works fine for now.

### Public Site Option B — API Keys (only when customers ask)
`department_api_keys` table + public API endpoints for depts with their own site.

### Roadmap
- Subdomain routing (`slug.fireops7.com`) when Vercel Pro upgraded
- Inspection schedule settings (daily/weekly/monthly per dept)
- Permit submission notification email direct to dept (currently goes to sys admin via logEvent)
