# Medical Inventory Module — Build Plan

## Architecture Overview

Medical inventory is a dedicated module separate from general equipment inventory, but integrated at key touchpoints (vehicle check, compartments, storeroom restocking).

### How it fits with existing systems

```
Medical Storeroom (per station)
  ├── Receives supplies (lot #, expiration, quantity)
  ├── Tracks stock levels vs PAR
  ├── Fires notifications → low stock, expiring, expired
  └── Source for restocking kits on apparatus

        ↓  restock flow (signature for controlled)

Compartment P1 — Engine 32
  └── Trauma Kit (kit type, configured by admin)
        ├── Trauma dressings × 4   exp tracked
        ├── Morphine 10mg × 4      controlled — count + 2 signatures
        └── ...

        ↑  vehicle check reads kit contents inline
        ↑  expiration flags show during check
        ↑  controlled items prompt count + signatures
```

### Signature rules
- `required_signatures: 0 | 1 | 2` per supply type
- `is_controlled: true` → minimum 2 signatures (enforced, cannot be lowered)
- Non-controlled: dept admin sets 0, 1, or 2 per supply type

---

## Phase 1 — Medical Storeroom Foundation ✅ COMPLETE (2026-06-03)

### Step 1 — DB Migration ✅ DONE (2026-06-03)
Five new tables:
- `medical_supply_types` — catalog (name, category, unit, is_controlled, tracks_expiration, required_signatures)
- `medical_storerooms` — one per station (dept_id, station_id, name)
- `medical_storeroom_inventory` — supply type + PAR level per storeroom
- `medical_stock_lots` — received lots (lot #, expiration, qty received, qty remaining, received_by)
- `medical_stock_transactions` — audit trail (received/adjusted/wasted, who, when)

### Step 2 — Supply Type Management
`/dept-admin/medical` — new admin page, Supplies tab
- CRUD for supply types: name, category (Medication / Supply / Equipment), unit of measure, is_controlled toggle, tracks_expiration toggle, required_signatures (0/1/2; controlled locks to 2)

### Step 3 — Storeroom Setup
`/dept-admin/medical` — Storerooms tab
- Create storeroom per station
- Assign supply types to storeroom with PAR level

### Step 4 — Receive Stock
Officer flow on storeroom page:
- Select supply type → enter lot #, expiration date, quantity received
- Signature capture: 1 or 2 signatures per supply type's `required_signatures`
- Creates a `medical_stock_lot` row + `medical_stock_transaction` (type: received)

### Step 5 — Storeroom Inventory View
`/medical` — new page, card added to Inventory hub (officers+ see it)
- Current stock per supply type with status color coding:
  - 🔴 Expired or quantity below PAR
  - 🟡 Expiring within 30 days or near PAR
  - 🟢 Good
- Expandable rows show individual lots with lot numbers + expiration dates
- "Receive Stock" button per supply type

### Step 6 — Notifications ✅ DONE (2026-06-03)
- Alerts panel on /medical page: expired lots (red), expiring within 30 days (amber), below PAR (red/amber) — computed from fetched data, no extra queries
- Inbox sidebar badge count includes medical alert count (expiring/expired lots within 30 days) for officers

---

## Phase 2 — Kits + Apparatus Integration ⬅ NEXT AFTER PHASE 1

### Overview
Kits are configurable medical bags/boxes that live in apparatus compartments. They're tracked separately from general equipment but assigned to compartments the same way — the vehicle check displays kit contents inline with expiration and controlled substance checks.

### Steps

**Step 1 — Kit Types (admin config)**
- `kit_types` table — name, description, active (e.g., "Trauma Kit", "ALS Bag", "Drug Box")
- `kit_type_items` — supply types + expected quantities within a kit template
  - Flags per item: tracks_expiration, is_required

**Step 2 — Assign Kits to Compartments**
- `apparatus_kits` — links a kit_type to an apparatus compartment
- In Equipment Setup → Inventory tab: apparatus compartment row shows "+ Add Kit" alongside "+ Add Item"
- A compartment can have both regular items AND kits

**Step 3 — Kit Instance Inventory**
- `apparatus_kit_inventory` — actual contents per kit per apparatus
  - supply_type_id, quantity, lot_number, expiration_date, last_checked_at, last_checked_by
- Populated on first kit assignment (copies expected quantities from template)
- Restock flow: storeroom → kit (decrements storeroom lot, updates kit inventory)
  - Controlled substances require required_signatures during restock

**Step 4 — Vehicle Check Integration**
- Vehicle check groups gain a "Kits" section (if apparatus has any kits)
- Each kit shows as expandable row in the check
- Kit contents show: item name, expected qty, actual qty (enterable), expiration date, status badge
- Controlled items: require count entry + signature capture inline
- Check submit writes to `apparatus_kit_inventory` (updates last_checked_at, flags discrepancies)

**Step 5 — Restock Flow**
- From storeroom view: "Restock Kit" button → select apparatus → select kit → fill quantities + lot/exp per item
- Signature required for controlled items (1 or 2 per supply type config)
- Creates medical_stock_transaction records (type: transferred)
- Decrements storeroom lot quantities

---

## Phase 3 — Controlled Substance Audit + Advanced Notifications ⬅ FUTURE

### Controlled Substance Log
- `controlled_substance_log` — dedicated narc log table
  - apparatus_kit_id, supply_type_id, expected_count, actual_count, discrepancy
  - verified_by, witness_id, signature_url, witness_signature_url
  - log_date, shift, notes
- Every vehicle check that touches a controlled item creates a log entry
- Discrepancies (count doesn't match expected) create an alert + flag for follow-up

### Waste Documentation
- When a partial vial is wasted (used but not fully administered):
  - Log quantity wasted, quantity used, reason
  - Two-signature witness requirement
  - Creates transaction (type: wasted)

### Advanced Notifications
- Configurable expiration warning window (default 30 days, admin can change per supply type)
- Daily background job checks all storerooms and kit inventories
- Email notifications when domain is ready (fireops7.com)
- Notification digest option: one daily summary vs. immediate per-item alerts

### DEA-Adjacent Reporting
- Running balance report per controlled substance per apparatus
- Discrepancy report (date range)
- Chain of custody log (full audit trail)
- Printable shift log for controlled substances

---

## Navigation Plan

| Path | What |
|---|---|
| `/medical` | Storeroom inventory view (officers+) |
| `/medical/storeroom/[id]` | Individual storeroom detail + receive stock |
| `/dept-admin/medical` | Supply types + storeroom setup (admin) |

- `/equipment` hub: add **Medical Storeroom** card (officers+ only)
- `/dept-admin/medical` card added to Dept Admin hub

## DB Tables Summary

| Table | Phase | Purpose |
|---|---|---|
| `medical_supply_types` | 1 | Catalog of all medical supplies and medications |
| `medical_storerooms` | 1 | Per-station medical storerooms |
| `medical_storeroom_inventory` | 1 | Supply type → storeroom with PAR level |
| `medical_stock_lots` | 1 | Individual received lots with expiration + qty |
| `medical_stock_transactions` | 1 | Audit trail for all storeroom movements |
| `kit_types` | 2 | Kit templates (Trauma Kit, ALS Bag, etc.) |
| `kit_type_items` | 2 | Items within a kit template |
| `apparatus_kits` | 2 | Kit assigned to a compartment on an apparatus |
| `apparatus_kit_inventory` | 2 | Actual contents of each kit instance |
| `controlled_substance_log` | 3 | Dedicated narc log per vehicle check |
