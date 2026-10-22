# Milestone 2 — Containers & Bags ("nesting dolls") — Build Plan

**Status:** drafted 2026-10-22 for Zak's review. Nothing built. Milestone 1 (presets, starter catalog,
inspection fixes) is on `main` (5a0e0a4). Design decisions behind this plan are recorded in
`PLAN_INVENTORY_STREAMLINE.md` → "MILESTONE 2".

## Goal
Equipment and medications get packed the way crews actually pack them: a compartment holds loose items
**and any number of bags**; a bag holds items, medications, tracked equipment and **other bags**; a bag
can also sit in a station storeroom or be assigned to a member (POV bag). Every bag has its own check,
opened from its parent's list. Moving a bag always records whether its contents went with it.

```
BLS 11
└─ PC-2 (compartment)                ← checked in the truck inspection
   ├─ loose items
   ├─ Trauma Box (bag)               ← one line in PC-2's list; tap to open its own check
   │  ├─ trauma items, AED (asset)
   │  └─ Med Bag (bag)               ← one line in the Trauma Box's list
   │     └─ medications
   └─ Airway Bag (bag)
Station 1 storeroom → spare Med Bag  ← checked on its own
Member: J. Smith    → POV Jump Bag   ← checked on its own by the member
```

## What exists today (verified 2026-10-22)
- **`medical_storerooms` is the container table**, polymorphic by nullable columns: station storeroom
  (`station_id`), bag (`template_id` + `apparatus_id`), compartment storage (`compartment_id`). There is
  **no explicit kind column**; code infers it. `content_type` (`medical|items|mixed`) and
  `item_location_standards.storeroom_id` are live from the old container branch but unused by `main`.
- **A compartment's medication storage and a bag pinned there are the same row.**
  `deployBagFromTemplate(compartment_id)` and `updateBagCompartment` merge the bag *into* the
  compartment's storeroom — the cause of the one-bag-per-compartment limit.
- **Bag templates hold medications only** (`medical_bag_templates` + `medical_bag_template_items`).
- **Inspection sessions** have one row per truck compartment (`inspection_session_compartments`:
  `compartment_id` NOT NULL, claim/complete/release). Compartment answers live only in the browser until
  submit. The session auto-completes when every row is completed.
- **Logs:** `compartment_presence_check_logs` and `item_asset_inspection_logs` store truck + compartment
  (live FKs, no names). `medical_supply_presence_check_logs` already stores `storeroom_id` + name
  snapshots + SET NULL FKs — the pattern to copy.
- **Assets** tie to `item_assets.apparatus_id` only.
- **Live data:** Winslow — 2 "Trauma Box" bags (on unit 11, not pinned), "11 — PC - 6" compartment
  storage, "Winslow Med Vault". No bag is currently pinned to a compartment → migration is simple.
- ~33 `medical_storerooms` queries across 13 files; heaviest surfaces: `app/actions/medical.ts`,
  `MedicalBagsSection.tsx`, `MedicalCompartmentsSection.tsx`, `MedicalAdminClient.tsx` (Bags tab),
  `inspections/run/page.tsx`, `lib/medical-storeroom.ts`, `lib/preset-deploy.ts`.

## Design

### Data model
Keep `medical_storerooms` as the one container table (renaming it is cosmetic churn across 13 files —
deferred). Make the kind and the location explicit:

| Column (new) | Purpose |
|---|---|
| `container_kind` text NOT NULL: `storeroom` \| `compartment_storage` \| `bag` | Replaces inference. Backfill from existing columns. |
| `parent_storeroom_id` uuid → `medical_storerooms` | A bag inside another bag, or a bag stored in a station storeroom |
| `assigned_personnel_id` uuid → `personnel` | POV bag assigned to a member |
| `qr_code` text UNIQUE | Scan a bag to open its check (auto-generated, like compartments) |
| `bag_number` int | Distinguishes instances: "Trauma Box 1", "Trauma Box 2" |

- **Bag location = exactly one of** `compartment_id`, `parent_storeroom_id`, `assigned_personnel_id`
  (CHECK; a bag may also be *unplaced on a truck* — see Q2). `apparatus_id` stays as a denormalized
  "which truck is this on" (null for storeroom/POV), recomputed on every move.
- **Compartment storage becomes loose-only.** `getOrCreateCompartmentStoreroom` returns only
  `container_kind = 'compartment_storage'`; a bag placed in a compartment is always **its own row** with
  `compartment_id` set. → many bags per compartment.
- Cycle guard: a bag can't be placed inside itself or its own descendant (checked in the action).

**Bag templates** (rename in UI only: "Bag Templates"):
- `medical_bag_template_items` (medications + PAR) — exists.
- `bag_template_items` (new): `template_id`, `item_id`, expected/min qty — items and tracked equipment.
- `bag_template_children` (new): `template_id`, `child_template_id`, `quantity` — bags inside bags.
- Deploying a template creates the bag **and its nested bags**, contents at PAR / expected qty, zero lots.

**Contents of a bag instance:** medications → `medical_storeroom_inventory` (+ lots), exactly as today;
items → `item_location_standards.storeroom_id` (already live). Assets: an item slot anywhere (compartment
or any bag depth) can be an asset slot.

**Assets:** add `item_assets.container_id` (the bag/storage it was last confirmed in, nullable) alongside
`apparatus_id`. Set at check time; used to answer "move the tracked items with the bag".

**Movement log:** new `container_movement_log` (bag id, from/to kind + id, apparatus from/to, moved_by,
moved_at, `meds_moved` bool, `meds_destination_id`, `assets_moved` bool, notes). Item/asset moves still
also write `item_movement_log` (`from_type`/`to_type` gain `'bag'`, `'storeroom'`, `'member'`).

### Moving a bag (required questions)
`moveBag(bag_id, destination, { medsMovedWithBag, medsDestination?, assetsMovedWithBag })`:
- Destination: a compartment, another bag, a station storeroom, or a member.
- **Medications:** "moved with it" → stock stays on the bag (it's keyed to the bag). "Just the bag" →
  every active lot is transferred to `medsDestination` via the existing `transferStock` path
  (`transferred_out`/`transferred_in` transactions, audit trail).
- **Tracked equipment:** "moved with it" → assets whose `container_id` is this bag (or a nested bag)
  get the new `apparatus_id`. "Just the bag" → assets stay put; `container_id` cleared.
- Nested bags travel with their parent automatically (they're located *in* it).
- The move can't complete without both answers (UI and server). Logged.

### Inspections
- **Session rows become a tree.** `inspection_session_compartments` gains `storeroom_id` (bag) and
  `parent_row_id`; `compartment_id` becomes nullable; CHECK exactly one of them. On session start, seed
  one row per compartment **plus one per bag inside it, recursively**. Bags added mid-session appear next
  session (as with compartments today).
- **Drill-in:** a compartment's (or bag's) check lists its loose contents **and its child bags as
  lines**, each showing status (not started / in progress by X / done). Tapping a bag opens that bag's
  own check; finishing returns to the parent.
- **Roll-up:** a row's own contents are "submitted" separately; a row is **done** only when it's
  submitted **and** every child row is done. The session completes when every top-level row is done.
  (The existing "inspection complete" screen + vehicle-check prompt from M1 stay.)
- **Take over:** anyone can continue an in-progress row started by someone else, from their last
  answers ("Take over" with a confirm; records who took over). Officers keep Release/Reopen.
- **Save as you go (new):** each answer is saved to the server as it's entered (debounced), in
  `inspection_draft_responses` (session row, response key, payload jsonb, updated_by, updated_at; unique
  per row+key). The run page loads drafts on open; submit converts drafts to logs and clears them.
  Also protects against a locked/dead phone.
- **Standalone bag checks:** a bag in a storeroom or assigned to a member is checked outside any truck
  inspection: `inspection_sessions` gains `root_storeroom_id` and `apparatus_id` becomes nullable; the
  session's rows are that bag and its nested bags. Entry points: the bag's page, the storeroom page,
  "My POV bags" for the assigned member, and scanning the bag's QR.

### Logs & reports
- `compartment_presence_check_logs` and `item_asset_inspection_logs` gain `storeroom_id` (bag),
  `session_row_id`, and snapshot text: `location_path` ("BLS 11 › PC-2 › Trauma Box 1 › Med Bag"),
  `item_name`, `apparatus_name`, `compartment_name`. Their `compartment_id`/`item_id` FKs become nullable
  + `ON DELETE SET NULL` (folds in M1's log-cleanup candidate: compartments/items with history become
  deletable without losing history).
- `medical_supply_presence_check_logs` gains `location_path` + `session_row_id`.
- **Inspection report:** results grouped by compartment; bags appear **nested as links** — clicking
  "Trauma Box 1" inside PC-2's results for a date opens that bag's check for that date — or can be
  broken out as their own rows (filter/toggle).
- **Bag history page:** every check of that bag across trucks/locations (history follows the bag), with
  where it was each time.

### Starter bags
- Master tables: `starter_bags`, `starter_bag_items`, `starter_bag_medications`, `starter_bag_children`.
- Seeder (`lib/starter-seed.ts`) seeds bag **templates** into each department's bag list; ledger gains
  kinds `bag`, `bag_item`, `bag_medication`, `bag_child`. Starters arrive **in the list only — never
  pre-placed** in compartments.
- Initial starters: **Trauma Box** (items, contains a Med Bag), **Med Bag** (medications), **Airway Bag**,
  **Jump Bag (POV)**. Clinical contents labeled "review with your medical director".
- Retire the starter **"Medications" compartment preset** in master (departments that already have it
  keep their copy — QA only today). Medications loose in presets stay possible for the rare fixed
  cabinet.
- Optional, department-configured: a compartment preset can carry bag templates
  (`compartment_preset_bags`); deploy creates the bag instances.

## Build steps (each ships on its own; stop and verify after each)
| # | Step | Shows up as |
|---|---|---|
| **2A** | **Decouple bags from compartment storage.** Migration: `container_kind` + backfill, location columns + CHECK, `qr_code`, `bag_number`. `getOrCreateCompartmentStoreroom` loose-only; deploy/move a bag as its own row. Audit all ~33 queries that infer kind. | Nothing new visually; multiple bags per compartment now possible. Highest regression risk — medical module. |
| **2B** | **Bags hold items + bags.** `bag_template_items`, `bag_template_children`; deploy creates nested bags. Setup → **Bags** tab: templates (items, meds, child bags), instances with location tree, place a bag (compartment / bag / storeroom / member), QR print. Truck inventory page shows each compartment's bag tree. | Build a Trauma Box with a Med Bag inside, put it in PC-2. |
| **2C** | **Moving bags.** `moveBag` with the two required questions, `container_movement_log`, assets follow, meds transfer via ledger. `item_assets.container_id`. | Move Trauma Box 1 to Engine 32 → asked about meds + equipment. |
| **2D** | **Inspection tree + drill-in + roll-up**, standalone bag checks, scan a bag's QR to open its check. | Truck check shows bags as lines; tap to open; POV/storeroom bag checks. |
| **2E** | **Save as you go + take over.** `inspection_draft_responses`, autosave, resume, Take over. | Start the Trauma Box, stop; someone else finishes from your answers. |
| **2F** | **Logs & reports.** Snapshot/location columns + SET NULL FKs, report tree with bag links, bag history page. | Click Trauma Box inside PC-2's report for a date. |
| **2G** | **Starter bags** in master + seeder + optional preset bags; retire starter Medications preset. | New departments get the bag list; "Add missing starters" brings them to Winslow. |

Order rationale: 2A is the foundation and the riskiest (it touches the live medical module), so it goes
first and alone. 2E (autosave) can be built in parallel with 2B–2C if wanted. 2G last so starters match
the finished bag shape.

## Data migration (2A)
- `container_kind`: `template_id` not null → `bag`; else `compartment_id` not null → `compartment_storage`;
  else → `storeroom`.
- Winslow's two "Trauma Box" bags: `apparatus_id` set, no compartment → state "on unit 11, not placed in
  a compartment" (see Q2); they get `bag_number` 1 and 2 and QR codes.
- No pinned bags exist, so no merged rows need splitting. Verify again right before migrating.
- All additive except: `inspection_session_compartments.compartment_id` and
  `inspection_sessions.apparatus_id` become nullable (no data change).

## Verification
Test department: QA Test Department. Each step: `npm run build` clean + targeted DB checks + Zak's
click-through on the dev server. Must-pass regressions: existing medical flows (receive, dispense,
transfer, waste, restock, CS log print), compartment medications added via "+ Add Item", presets
deploying medications (M1), existing truck inspections with no bags.

## Risks
- **2A touches the live medical module** — every query that infers "bag vs compartment storage" must be
  found. Mitigation: the explicit `container_kind` column, an audit list of all ~33 call sites, and
  regression checks above before anything ships.
- **Inspection changes affect every department's daily checks** — the tree must reduce to exactly
  today's behavior when a truck has no bags.
- **Autosave write volume** — debounce (e.g. 1–2 s) and upsert one row per answer.
- **Controlled substances** are out of scope (separate future module); the move/transfer ledger is built
  so it can carry signatures later.

## Decisions on the open questions (Zak, 2026-10-22)
1. **Bags are base equipment**, not Medical-module-only. Medications inside a bag still require the
   Medical module (a department without it can build items-only bags).
2. **A bag may be on a truck without being in a compartment** (Winslow's Trauma Boxes today), shown with
   a "place in a compartment" prompt.
3. **Permissions:** moving bags = officers (`manage_inventory`); assigning a POV bag to a member =
   officers/admins; a member can check their own POV bag.
4. **Naming:** new instances auto-number ("Trauma Box 1, 2…") with their own QR code, and **can be
   renamed at any time** — `bag_number` only seeds the default name; the name is freely editable and
   the QR code doesn't change when renamed.
