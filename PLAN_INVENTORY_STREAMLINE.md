# Inventory Streamlining — Build Plan

**Status (2026-10-22, end of first build session):** Milestone 1 steps 1–8 built on branch
`feature/inventory-presets` (local, not pushed; `main` untouched). Build clean.
- Steps 2–4: migrations `add_starter_catalog_master`, `add_compartment_presets` applied to prod DB
  (additive, harmless to `main`); initial master content seeded (14 categories, 64 items, 5 medication
  types, 17 compartments, 37 type tags).
- Step 5: `lib/starter-seed.ts` + `app/actions/starters.ts`; wired into `createDepartment`. Verified by
  script on QA Test Department: seed twice → no duplicates; deleted item/preset and renamed preset not
  re-added or duplicated.
- Step 7: `lib/preset-deploy.ts` + `app/actions/presets.ts`; `getOrCreateCompartmentStoreroom` moved to
  `lib/medical-storeroom.ts`. Verified by script on QA "Engine 1": add standard compartments (6 created,
  QR codes 1-PUMP etc.), re-run adds nothing, Trauma + Medications kits into existing D1 (7 items,
  5 meds at PAR, zero lots).
- Steps 6/8 UI: Setup → Presets tab (`PresetsStep.tsx`), "Add standard compartments" checkbox on both
  new-apparatus forms, "+ Add standard <type> compartments" and "Save as preset" on `/equipment/[id]`,
  sys-admin "Push to all fire departments" on `/admin/departments`.
- **Not yet done:** live click-through (Zak), verification items 1, 5, 7, 8 in the UI (esp. a full
  inspection on a freshly built truck), a "needs initial count" indicator for zero-lot medications
  (today they show the existing zero-stock status), docs (REFERENCE/HISTORY/help content).
- **QA Test Department now holds seeded starters + a stamped Engine 1** — test data, fine to keep.
- **Tooling note:** the Supabase MCP auto-declines SQL containing DELETE in this VS Code panel; test
  with self-rolling-back transactions, or delete via app/server code.
**Origin:** sys-log feedback note (2026-10-14) — "narrow in the inventory build out and truck check build
out ... streamlined ... includes medications for the ambulance and the station."

## Goal
Cut the time from **"create the truck" to "first check run."** Today that takes many separate layers
(apparatus → compartments → catalog items → place items → assets → medications in a separate area).
An average fire/EMS admin should never build a catalog or a truck layout from scratch: departments start
with a finished master list, keep what fits, rename or remove what doesn't, and add their own.

## Decisions (all confirmed with Zak)
1. **Prebuilt functional compartments** (Pump Panel, Hose Bed, Airway, Trauma…) exist as **presets** in
   every department. Renameable, editable, deletable. Departments can still build their own any time.
2. **A preset is its own entity**, not a compartment name. Deploying one either **creates a new
   compartment on a truck** or **stocks an existing truck compartment** (positional layouts like
   Winslow's D1/P2/PC-x keep working). Deploy creates the truck's own `apparatus_compartments` row — that
   row holds inspection data and inventory ties. Nothing references the preset afterward, so editing or
   deleting a preset never touches trucks or history.
3. **After deploy, each truck is independent.** No silent propagation of preset edits.
4. **A truck's compartment can be saved back as a preset.**
5. **Preset contents:** items with expected/min quantity, and **medication type + PAR only** — never
   lots, expiration, or on-hand stock (those are counted in at deploy via Receive).
6. **Assets tie to the apparatus, not the compartment.** A preset says "Air Pack × 2"; the inspection
   assigns specific packs to the slots at check time (already how `inspections/run` works).
7. **Master catalog lives in the database, curated by sys admin.** It grows as we work each apparatus
   type, is **pushed** to departments, and can **pull** definitions from any department's catalog.
8. **Seed ledger** records everything ever given to each department. Push only adds what that department
   has never received — renames, edits, and deletes are never undone. Push is additive only in v1.
9. **Which presets are standard for a type** = apparatus-type tags on each preset (master + department
   copy). Department-editable.
10. **Every compartment the system creates gets an auto-generated QR code.**
11. **Permissions:** "Add standard compartments" while creating a truck needs only `manage_apparatus`
    (uses already-approved presets). Editing presets/tags needs `manage_dept_setup`. Master catalog,
    pull, and push are sys-admin only.
12. **Truck check stays a department-level list**, editable; type-specific items come later from the
    same master list.

## Security model
- **Pull** copies definitions only (names, category, tracking flags, compartment contents and
  quantities). Never assets, serials, stock, lots, locations, personnel, or history. Sys admin only;
  departments never see each other's data.
- **Push** writes via the service-role client, gated by `is_sys_admin`, additive, logged to `system_logs`.
- All new tables: RLS enabled, no policies (admin client only), matching the rest of the schema.

---

## MILESTONE 1 — Trucks come with compartments and some items

Each step ends at `npm run build` clean and a check that can be verified on its own. Safe to stop after
any step.

### Step 1 — Branch
`feature/inventory-presets` off `main`. Local until verified (per the local-only branching rule).

### Step 2 — Master tables (migration)
| Table | Purpose |
|---|---|
| `starter_categories` | master item categories |
| `starter_items` | master items (name, category, tracking flags) |
| `starter_medication_types` | master medication types (name, unit, category, tracks_expiration) |
| `starter_compartments` | master presets (name, default code, sort order) |
| `starter_compartment_types` | which apparatus types a master preset is standard for |
| `starter_compartment_items` | master preset contents — items + expected/min qty |
| `starter_compartment_medications` | master preset contents — medication types + PAR |

**Check:** tables exist, constraints and FKs correct, nothing existing changed.

### Step 3 — Department tables (migration)
| Table / column | Purpose |
|---|---|
| `compartment_presets` | the department's presets (name, default code, sort, active, `source_starter_id`) |
| `compartment_preset_types` | apparatus-type tags |
| `compartment_preset_items` | items + expected/min qty |
| `compartment_preset_medications` | medication types + PAR |
| `department_starter_seeds` | ledger: department, master row, kind, seeded_at |
| `source_starter_id` (nullable) on `items`, `item_categories`, `medical_supply_types` | traceability back to master |

**Check:** as step 2; existing rows untouched (new columns nullable).

### Step 4 — Small initial master content
Engine, BLS Ambulance, Brush/Wildland, Tanker: a few functional compartments each, a few items each,
entered by Claude via SQL. Content grows type by type later — structure matters now, not the list.
Items seeded as **presence/quantity checks only, no inspection templates** (so a new truck's first check
can finish before any assets exist).

### Step 5 — Seeder (`lib/starter-seed.ts`)
- Additive, ledger-driven, idempotent (re-running after a partial failure finishes the job).
- Name matching normalized (trim + case-insensitive) — e.g. Winslow's `"Chainsaw "`.
- Collisions handled, never fail mid-seed: `items.item_name`, `item_categories.category_name`,
  `compartment_names.compartment_code` are unique per department → adopt an existing match or suffix.
- Satisfies item constraints: `tracks_quantity OR tracks_assets`; `minimum_quantity <= expected_quantity`.
- Medication types seeded only when `module_medical` is on; fire departments only.
- Entry points: `createDepartment` (new fire depts), dept-admin **"Add missing starters"**, sys-admin
  **"Push to all departments"** (minimal button in M1; full UI in M2).

**Check:** seed QA Test Department twice → no duplicates; delete a seeded item, re-seed → stays deleted.

### Step 6 — Department preset UI (Setup → Compartments → Presets)
List, rename, edit contents (item picker + medication picker, qty, min, PAR), apparatus-type tags,
delete, create your own, and **"Save as preset"** from a truck compartment page.

### Step 7 — Deploy
`deployPreset(preset_id, targets)`, target = **new compartment on truck X** or **existing compartment Y**.
- Creates `compartment_names` + `apparatus_compartments` as needed, with auto QR code.
- Items → `item_location_standards`; **merge-only** — adds missing items, never overwrites quantities.
  No replace-all semantics (unlike `bulkSetCompartmentApparatus`, which removes unticked trucks).
- Medications → `getOrCreateCompartmentStoreroom` + assignment at PAR with zero lots; shown as
  "needs initial count" with a quick **+ Receive**. Skipped with a message if `module_medical` is off.

### Step 8 — Truck creation and existing trucks
- Apparatus create form: **"Add standard compartments for this type"** checkbox, default on.
- Apparatus page: **"Add standard compartments"** for existing trucks (Winslow 22, 42, 43, 81, the
  ambulance). Merge-only. No type set → nothing offered. Changing type later does nothing automatically.

### Step 9 — Verify and document
Test on QA Test Department (`26c1cbff-2e5a-4e71-b54e-9a38316d9c86`), then Winslow. Dev server on port
3001 + direct DB checks; Playwright only if Zak asks. Then Zak tests live.
1. New fire department → presets + catalog arrive.
2. Create an Engine with the box ticked → compartments, items, QR codes created.
3. "Add standard compartments" on an existing truck → only missing pieces added.
4. Deploy a preset into an existing positional compartment (e.g. D3) → merged, nothing overwritten.
5. Rename and delete presets → deployed trucks and past inspections unchanged.
6. Save a truck compartment as a preset → items + medication type/PAR, no lots.
7. Medication deployed → PAR, zero lots, "needs initial count"; Receive works with expiry warnings.
8. Run a full inspection on a freshly built truck → completes with no assets in the system.
9. Seed twice; delete-then-reseed → ledger behavior correct.
10. `npm run build` clean.

Docs on ship: REFERENCE.md (tables, actions), HISTORY.md, CLAUDE.md resume section,
`lib/help-content.ts` + `<HelpText>` on Setup → Compartments and apparatus create.

---

## MILESTONE 2 — Containers & bags ("nesting dolls") — decided 2026-10-22, needs its own plan pass
Driven by testing: medications are rarely loose in a compartment — they live in a bag, and bags live in
compartments or in other bags. Example: BLS 11 → PC-2 (compartment) → Trauma Box (bag: trauma items) →
Med Bag (bag: medications).
- **A bag has its own location:** in a compartment *or* in another bag. A compartment holds its loose
  contents plus **any number of bags** (removes today's one-bag-per-compartment limit, which exists
  because a compartment's medication storeroom and a pinned bag are currently the same
  `medical_storerooms` row).
- **Bags hold items and medications** — folds in (replaces) `feature/items-in-containers`; its schema
  (`item_location_standards.storeroom_id`, `medical_storerooms.content_type`) is already live.
- **Bag templates can contain other bag templates** (Trauma Box includes a Med Bag); deploying the
  outer bag brings its nested bags. Moving a bag moves everything inside it.
- **Inspection — drill-in, decided by Zak:** every bag has its own check. In the parent's check (a
  compartment or a bag), each child bag appears as **one line in the list**; selecting it opens that
  bag's own check; finishing returns to the parent. (Not a flattened list.)
- **Starter bags** (Trauma Box, Med Bag, …) join the master catalog and seed like items/presets;
  compartment presets can carry bags (e.g. ambulance "PC-2 holds a Trauma Box").
- **Starter "Medications" compartment preset** and medications loose in presets become the rare case:
  keep the ability, move the starters to bags.
- Open for the plan pass: claim/complete lifecycle for a bag inside an inspection session
  (`inspection_session_compartments` has no row type for a bag today), how a bag's check shows on
  reports, and asset slots inside bags.

## MILESTONE 3 — Sys-admin catalog management (`/admin/catalog`)
Edit the master list; **pull** from a department (browse its items and presets, promote definitions to
master); **push** to all or selected departments with a preview of what each receives. Until then,
Claude maintains master content via SQL while we work each type.

## After milestones 1–3
1. Grow the master list type by type: Engine → BLS Ambulance → Brush/Wildland → Tanker → Ladder/Aerial.
2. Truck checks by apparatus type (master-list driven, "applies to" types; uses the ledger so new
   checks reach existing departments — today `ensureVehicleCheckItems` only seeds empty departments).
3. Bags: rebase/redo `feature/items-in-containers` (~2 months stale, never click-tested; its migration
   is already live and harmless to `main`), so bags hold items → bag presets (trauma box, airway bag).
4. One build screen per rig, bulk entry (incl. bulk asset creation), whole-rig clone.

## Known gaps, deliberately out of scope
- Equipment check logs (`compartment_presence_check_logs`, `item_asset_inspection_logs`) and
  `vehicle_inspection_results` point at live rows with no name snapshot → items/compartments with history
  can only be hidden, not deleted. Fix later with the medical-log pattern (snapshot names + SET NULL).
- Compartments added mid-inspection appear in the next session, not the current one.
- Fire/EMS item split (dormant `item_categories.category_type`) — undecided.
- Push never updates a department's existing rows (v1 is additive only).

## Risks
- **Breadth:** touches setup, apparatus create, equipment pages, medical assignment, and department
  creation. Every step is additive; existing compartment behavior must not change (top regression check).
- **Seeding correctness:** collisions and the ledger are where silent duplicates would come from — the
  seed-twice and delete-reseed checks are mandatory.
- **Overlap with the container branch:** same files; building off `main` first, redo that branch after.
