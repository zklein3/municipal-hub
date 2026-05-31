# FireOps7 — Quick Reference (Routes, Actions, Permissions)

## App Route Structure

### Route Groups
| Group | Auth |
|---|---|
| `(auth)` — `/login`, `/change-password`, `/profile-setup`, `/pending`, `/denied` | Public |
| `(dashboard)` — all dashboard routes | Required |
| `(fire-school)` — `/fire-school`, `/fire-school/bottles`, `/fire-school/fill-log` | Public |
| `(public-site)` — `/dept/[slug]/*` | Public |

### Nav Structure (layout.tsx)

**Hub-and-spoke — sidebar 6 items only (all dept roles):**
| Sidebar Item | Hub Page | What's on it |
|---|---|---|
| Dashboard | `/dashboard` | Greeting, upcoming events, announcements, quick links |
| Operations | `/operations` | Incidents, Announcements, Fuel Log, Public Inbox cards + recent incidents list |
| Personnel | `/personnel` | Roster + profile card (already a hub) |
| Training | `/training` | Events / My Certs / Print cards + TrainingClient below |
| Equipment | `/equipment` | Inspections, Assets, Storage, Movement Log cards + apparatus grid |
| Reports | `/reports` | Tile grid — My Activity (all), Attendance/Training/Inspections/Inventory/Fuel (officer+) |

**Dept Admin section — admin only:** Single link → `/dept-admin` hub
Tiles: Personnel / Training & Certs / Accountability / Equipment Setup / Inspections / ISO (if enabled) / NERIS Settings (if enabled) / Public Site (if enabled)

**ISO sub-hub** (`/iso`): Hose Inventory / Hydrants / Mutual Aid / Pre-Fire Plans / ISO Report

**System Admin section:** Departments / Users / System Logs / NERIS

**PageNavBar** (`components/PageNavBar.tsx`) — auto-rendered on every dashboard page above content. Shows `← Back` (router.back()) + `[Hub Name] ↑` (parent hub link). Hidden on `/dashboard`. Pathname-driven — no per-page wiring needed.

Sidebar footer: name links to own `/personnel/[id]` profile.

### Dashboard Routes
- `/dashboard` — dept dashboard or sys admin overview
- `/personnel`, `/personnel/[id]` — roster + profile
- `/apparatus`, `/apparatus/[id]` — apparatus list + detail (still exists, not in nav)
- `/stations`, `/stations/[id]` — stations list + detail (still exists, not in nav)
- `/equipment/[id]` — manage items per apparatus (assign/remove/move), reached via apparatus detail
- `/equipment/[id]/[compartment_id]` — compartment detail; Back uses `?from` param; QR code auto-assigned on first open; Print QR always available
- `/equipment/[id]/fuel` — fuel log for a specific apparatus; receipt scan pre-fills fields
- `/equipment/storage` — dept-wide storage view: quantity items + unassigned tracked assets
- `/equipment/movement-log` — movement history with search + source filter
- `/equipment/assets` — dept-wide asset roster (Inspections nav group, officer+)
- `/inspections` — landing page: stations → apparatus cards → compartments (Scan QR / View / Inspect / Daily Check / Vehicle Check)
- `/inspections/run`, `/inspections/apparatus/[id]` — inspection run + session flow
- `/inspections/vehicle-check/[id]` — standalone vehicle check form (fluids, mechanical, lights, comms, emergency equipment, cleaning, air brakes if enabled); per-apparatus, all roles
- `/scan` — QR code lookup + redirect; compartment scans → `/inspections/run`; supports `?next=` post-login redirect
- `/fuel` — dept-wide fuel log + add entry (dashboard quick-action)
- `/events`, `/events/new`
- `/training` — nav label "Certifications"
- `/announcements` — unread badge
- `/incidents`, `/incidents/[id]`, `/incidents/new`
- `/reports/inspections`, `/reports/inventory`, `/reports/training`, `/reports/attendance`, `/reports/my-activity`, `/reports/fuel`
- `/iso/hoses`, `/iso/hydrants`, `/iso/report`
- `/inbox` — Signatures tab (all members, pending run signatures); Permits + Records tabs (officers/admins only)
- `/admin/departments`, `/admin/users`, `/admin/logs`
- `/admin/dept/[id]` — 5 tabs: Personnel/Stations/Apparatus/Compartments/Public Site
- `/dept-admin/setup`, `/dept-admin/items`, `/dept-admin/attendance`, `/dept-admin/training`
- `/dept-admin/inspections` — 2 tabs: Session Settings (inspection session duration) + Vehicle Check Items (add/edit/disable checklist items, instructions, reset to defaults)

### Public Site Routes (no auth)
- `/dept/[slug]` — landing | `/dept/[slug]/events` | `/dept/[slug]/burn-permit` | `/dept/[slug]/records`
- `/dept/[slug]/permit-status` — permit lookup + applicant signature
- `/dept/[slug]/permit-print` — printable permit by confirmation code

### Print Routes
- `/print/qr` | `/print/training-signin?event_id=xxx` | `/print/member-training?personnel_id=xxx&from=xxx&to=xxx`
- `/print/burn-permit?id=xxx` — auth required
- `/print/run-sheet?id=xxx` — auth required; Run Field Report matching dept paper form (one letter sheet)

---

## Back Navigation Pattern
- `components/BackButton.tsx` — `href` prop for explicit dest, else `router.back()`
- Back button lives BELOW the header as a styled action row button — never inline with title
- Single parent pages: hardcode dest (personnel → /personnel, stations → /stations, incidents → /incidents)
- Contextual pages: pass `?from=/origin` in link, read in page, pass as `href` to BackButton

## Key Action Files
- `app/actions/auth.ts` — signIn, changePassword, signOut
- `app/actions/personnel.ts` — updateOwnProfile, updatePersonnelProfile, updateDeptPersonnel, changeOwnPassword
- `app/actions/apparatus.ts` — createApparatus, updateApparatus
- `app/actions/stations.ts` — createStation, updateStation
- `app/actions/compartments.ts` — createCompartmentName, assignCompartmentToApparatus, removeCompartmentFromApparatus, setCompartmentQrCode
- `app/actions/equipment.ts` — createItemCategory, createItem, updateItem, createAsset, updateAsset, assignItemToCompartment, removeItemFromCompartment, moveItemToCompartment, assignAssetApparatus
- `app/actions/inspections.ts` — createInspectionTemplate, addTemplateStep, updateTemplateStep, deleteTemplateStep, submitInspection, inspection session actions; vehicle check: ensureVehicleCheckItems, getVehicleCheckItems, submitVehicleCheck, getVehicleCheckHistory, addVehicleCheckItem, updateVehicleCheckItem, toggleVehicleCheckItem, resetVehicleCheckItemsToDefaults
- `app/actions/attendance.ts` — createEventSeries, updateEventInstance, logAttendance, verifyAttendance, requestExcuse, closeEventInstance, cancelEventInstance, createExcuseType, saveParticipationRequirement
- `app/actions/incidents.ts` — createIncident, updateIncident, setIncidentStatus, apparatus/personnel/attendance actions
- `app/actions/training.ts` — createCertificationType, createCourseUnit, enrollMember, verifyProgress, logDirectCert, createTrainingEvent, logTrainingAttendance, saveTrainingSignature
- `app/actions/announcements.ts` — createAnnouncement, deleteAnnouncement, pinAnnouncement, markAnnouncementRead
- `app/actions/iso.ts` — upsertApparatusIsoSpecs, hose/hydrant/mutual aid actions
- `app/actions/users.ts` — createDeptMember
- `app/actions/fire-school.ts` — checkBottle, logFill, addFireSchoolBottle
- `app/actions/parse-fuel-receipt.ts` — Claude Haiku vision, extracts gallons/price/vendor/date from receipt photo
- `app/actions/fuel.ts` — saveFuelEntry, getFuelEntries
- `app/actions/public-site.ts` — savePublicSiteSettings, toggleEventSeriesPublic, submitBurnPermit, submitRecordRequest, updateBurnPermitStatus, updateRecordRequestStatus, savePermitOfficerSignature, savePermitApplicantSignature

## Supabase Edge Functions
- `notify-on-log` — emails zklein3@gmail.com on new system_logs entries
- `auto-close-events` — nightly 2 AM UTC, closes stale event instances
- `notify-expired-sessions` — hourly, emails officers on expired inspection sessions
- `send-permit-approval` — emails resident on permit approval (awaiting fireops7.com Resend domain)

---

## Permission Model

### Role Fields
| Field | Table | Values |
|---|---|---|
| `is_sys_admin` | `personnel` | boolean — global, no dept record needed |
| `system_role` | `department_personnel` | `admin / officer / member` |

### What Officers Can / Cannot Do
- **Can:** add personnel (officers/members), edit apparatus, assign items, run inspections, manage events/attendance, approve permits, toggle events public
- **Cannot:** create apparatus/stations/compartments/item types, manage roles, access `/dept-admin/setup`

### Permission Matrix
| Action | Member | Officer | Admin |
|---|---|---|---|
| View roster/apparatus/equipment | ✅ | ✅ | ✅ |
| Run inspections | ✅ | ✅ | ✅ |
| Log own attendance | ✅ | ✅ | ✅ |
| Verify/approve attendance | ❌ | ✅ | ✅ |
| Create events / log incidents | ❌ | ✅ | ✅ |
| Edit apparatus/station info | ❌ | ✅ | ✅ |
| Assign items to compartments | ❌ | ✅ | ✅ |
| Add/manage personnel | ❌ | ✅* | ✅ |
| Add apparatus/stations/compartments | ❌ | ❌ | ✅ |
| Manage item types/categories/assets | ❌ | ❌ | ✅ |
| Create cert types + courses | ❌ | ❌ | ✅ |

*Officers: add officers/members only. Admin role assignment stays in `/dept-admin/setup`.

---

## Burn Permit Flow
- Public submits at `/dept/[slug]/burn-permit` → `burn_permits` table, auto confirmation code, `logEvent` notification to sys admin
- Officer reviews in `/inbox` → requires `burn_permit_county_info` + dept name configured
- Approval: officer fills expiry/notes → "Sign & Approve" → `PermitSignatureModal` → signature saved → `updateBurnPermitStatus` → `logEvent` notification
- Direct resident email: `send-permit-approval` Edge Function ready, swap in when fireops7.com verified
- Resident signs at `/dept/[slug]/permit-status?code=xxx`
- Signatures: `signatures/permits/officer/{id}.png` and `signatures/permits/applicant/{id}.png`

## Public Site System
- Path-based at `fireops7.com/dept/[slug]` — one codebase, all depts
- Toggle: `departments.public_site_enabled` + `public_slug` (sys admin in `/admin/dept/[id]` → Public Site tab)
- Middleware bypasses auth for `/dept/*`
- Events: `event_series.is_public = true` required (toggled from `/events` manage panel)

## Accountability Module — Future Build (not started)

Standalone personnel accountability system using Salamander QR cards + temp cards. See CLAUDE.md → "Salamander QR Card Integration" for QR format details.

**Concept:** Scene accountability officer runs this on a tablet. People scan in/out. PAR button snapshots the roster. Works independent of incident reporting.

**Check-in methods:** Salamander QR card | Temp card (pre-printed, handed to visitors/mutual aid) | Manual name entry

**Temp cards:** Print laminated QR badges (TEMP-001…TEMP-020). Hand out to people without cards. Scan → assign to a person. Scan out → card returns to available. Unreturned cards flagged at event close.

**Tables to build:**
- `accountability_events` — scene/event, optional `incident_id` link, status (active/closed)
- `accountability_roster` — person on scene: `personnel_id` (nullable), raw name/dept, assignment, status (on_scene/staged/rehab/released), check-in/out times
- `accountability_pars` — PAR timestamp + roster snapshot (jsonb)
- `accountability_temp_cards` — card inventory: code, status (available/checked_out/retired), current assignee

**Routes:** `/accountability` list → `/accountability/[id]` main board → `/accountability/[id]/scan` full-screen tablet scan mode → `/accountability/temp-cards` inventory + QR print

**Open questions before building:** assignment list (fixed ICS divisions or free text?), who can run it (officers only?), linking to incidents (optional or required?).

## Test Data (Winslow Fire)
- Engine 32 → D1 (Scott Air Pack ×2, Bottle ×2, Halligan ×1) + P1 (Chainsaw ×1)
- Assets: Chainsaw 1, Scott Air Pack 1, Scott Air Pack 2, B-0001, B-0002
- Templates: Weekly Chainsaw Inspection (3 steps), Weekly Airpack Inspection (4 steps)
