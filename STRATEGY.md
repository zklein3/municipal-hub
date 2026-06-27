# Business Strategy & Platform Expansion

Session notes captured 2026-06-26. Forward-looking roadmap — not yet built. See `HISTORY.md` for what's actually shipped.

---

## MuniOps — Parent Brand Concept

- `muniops.com` — check domain availability, register through Vercel if available
- Parent brand sits above FireOps7 and future vertical products
- Think Intuit (QuickBooks, TurboTax) — one company, multiple focused products
- FireOps7 stays exactly as is — it's the fire vertical, already branded
- PoliceOps — law enforcement vertical, next to build
- Public Works, Municipal Admin — future verticals
- Single login portal at MuniOps — user selects department context on login
- Same database, same auth system, same core logic underneath — different skin per department type

## Department Type Toggle

- Add `department_type` field to `departments` table
  - `fire` — current FireOps7 experience, no changes
  - `law_enforcement` — police-specific modules, forms, nav
  - `public_works` — future
  - `municipal` — future, sees everything
- UI adapts based on department type — police chief sees police tools, fire admin sees fire tools
- Module/feature flag system already partially built (`module_operations`, `module_iso`) — extend it to support department type
- No duplication of the database or codebase needed

## Terry's Yutan Police Pilot Plan

- Terry is a friend — fire department member AND police chief of Yutan
- Already in the system under Valley Fire as admin
- Yutan Police Department created 2026-06-26 — Terry + zklein3@gmail.com both admin (see CLAUDE.md "IMMEDIATE NEXT")
- He logs in, selects police context, sees only police-relevant tools
- Goal: have a working shell ready before he even delivers the forms — done; police gets a stripped nav + navy theme, but no police-specific modules yet

**Current tooling & competitive context (2026-06-26):**
- Terry currently runs Yutan PD's forms through **Connecteam** — a generic frontline workforce/shift app, not a police RMS. He finds the UI difficult and the system limiting.
- He referenced **Sleuth Systems** (legacy small/mid-agency CAD/RMS vendor, est. 1984) as his frame of reference for "real" police software — confirms police workflows center on **contact/incident reports as primary documents**, not recurring checklists. Inspections are barely used in police work, unlike fire.
- He wants to bring this to the **City of Yutan** for potential adoption — this is a sales opportunity, not just a personal pilot.
- **Two concrete gaps to close before the city pitch:**
  1. **Time clock function** — municipal HR/payroll will care about this. Likely belongs on the shared core platform (not gated behind `department_type`), since fire also wants paid/volunteer hour tracking.
  2. **Import/export (CSV at minimum)** — so the city doesn't feel like historical Connecteam data is orphaned in a switch. A full Connecteam integration is probably unnecessary; CSV in/out should suffice.
- Forms are expected from Terry ~late June 2026. Don't guess at police schema until they arrive — his forms will define the actual field-level shape of a contact report vs. an incident report.
- Likely schema approach once forms arrive: keep shared core tables (personnel, departments, training/certs, announcements, events) as-is; give police its own primary report tables rather than reusing `incidents`/`incident_fire_details` — a traffic stop or contact report isn't an "incident" in the fire 911-response sense. Some pages may need to be rebuilt police-specific rather than themed, per Terry's described UI/feel expectations.

## Forms as a Product

- Small municipalities paying $5,000+ to put a form in a database
- FireOps7's inspection template builder is already essentially a dynamic form builder
- Police contact reports, internal memos, use of force forms = same pattern as inspection checklists
- Build Terry's actual Yutan city forms into the system as the demo
- Scanned form or photo → build it digitally → huge value proposition
- Form management is the horizontal feature that works across ALL department types

## Multi-Department Login Flow — NEEDS TO BE BUILT

- Current flow assumes one person = one department (works for 99% of users)
- New flow needed:
  - User logs in with email + password as normal
  - System checks how many departments they belong to
  - One department → straight to dashboard (no change)
  - Multiple departments → show department selector screen
  - User picks context → session scopes to that department
- `department_personnel` table already supports multiple rows per person
- Just the login/session flow needs updating

## ICS Module — Incident Command System

Off by default — explicitly inactive until admin toggles it on per department. No clutter for departments not ready for it — only appears when enabled. Activated via department module toggle in admin settings.

**Core concept:**
- When opened, pulls existing data already in the system — incident details, personnel roster, apparatus assignments
- No re-entering data that already exists
- Built-in form fill instructions alongside each field — members know what goes where and why
- Each ICS position has guidance on responsibilities and what to document

**ICS Forms to support:**
- ICS 201 — Incident Briefing
- ICS 202 — Incident Objectives
- ICS 203 — Organization Assignment List (pulls from personnel roster)
- ICS 204 — Assignment List (pulls from apparatus assignments)
- ICS 205 — Incident Radio Communications Plan
- ICS 206 — Medical Plan
- ICS 207 — Incident Organization Chart (visual org chart)
- ICS 214 — Activity Log

**Connection to existing modules:**
- Incidents module — ICS positions assigned per incident (IC, Safety Officer, Ops Chief, etc.)
- Training module — ICS 100/200/300/400 are just certification types already supported
- Personnel profiles — show ICS qualifications, only show qualified personnel for each role when building command chart

**Key design rules:**
- Module is off until turned on — never visible by default
- Always pulls existing data in — never ask for what's already there
- Instructions built into every form field — no guessing required
- Printable ICS chart for command post use

## Infrastructure & Scaling Plan

- Stay on Supabase free + Vercel free until first paying department
- Upgrade trigger: NERIS goes live with a real department OR first paying customer
- Vercel Pro ($20/mo) + Supabase Pro ($25/mo) = $50/mo for production-grade setup
- Long term: AWS RDS PostgreSQL for enterprise-grade data security
- Architecture is fully portable — just a connection string change
- Independent backups: weekly pg_dump to Google Drive or Backblaze B2 (see `CLAUDE.md` — already shipped to B2)
- Future feature: customer-facing data export (trust builder for departments)

(See `CLAUDE.md` "Infrastructure & Business Roadmap" for the current-state version of this — that section is authoritative for what's actually live.)

## Native App Roadmap

- PWA first — `manifest.json` + service worker (shipped, see `CLAUDE.md`)
- Capacitor next — wraps existing Next.js site in native shell (in progress, see `NATIVE.md`)
- Push notifications — key feature, alerts members for new incidents, events, cert expirations

## Mobile Brainstorming Workflow

- claude.ai on phone → brainstorm ideas on the go
- Claude Desktop on laptop → finds phone conversations via account sync
- Ask Desktop to summarize and push to `CLAUDE.md` / `STRATEGY.md`
- Keeps ideas captured without stopping workflow

## Next Dev Priorities (strategy-level)

1. PWA support — shipped, see `CLAUDE.md`
2. Multi-department login flow — shipped 2026-06-26, see `CLAUDE.md` "IMMEDIATE NEXT"
3. Department type toggle — shipped 2026-06-26 (`department_type` column + nav/theme gating)
4. Terry's Yutan Police pilot — department + admin access created 2026-06-26; his actual forms not yet delivered/built
5. ICS module — off by default, pulls existing data, built-in instructions
6. Capacitor Android build — in progress, see `NATIVE.md` / `ANDROID_HANDOFF.md`
7. MuniOps parent brand site — when ready to market
