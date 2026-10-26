# FireOps7 — QA Click-Test Script (Containers & Medical forms)

Paste everything under **THE PROMPT** into the Claude Chrome extension. Keep this file as the single source;
update it (don't fork it) as steps are added. Last updated 2026-10-26 (covers C4 truck screen, C3 shared
medication forms, controlled-substance setup).

Notes for whoever runs it
- Dev: `npm run dev -p 3001` (or the port in use) — Prod: https://www.fireops7.com
- Ignore "message channel closed" errors and the "1 Issue" hydration overlay: both come from browser
  extensions (Scribe recorder / Claude), not the app. Dismiss the overlay.
- Leave the test data in QA; the script reuses it on later runs (skip Part 1 steps that are already done).

---

## THE PROMPT

You are click-testing FireOps7 in the **QA Test Department**. Log in as `qa.admin@fireops7.com`. Work through
the parts in order. For every numbered step report PASS / FAIL and what you actually saw (exact banner text,
counts before/after). Do not stop at the first failure; note it and continue. At the end list every FAIL and
every console error that came from the app (ignore "message channel closed" and the hydration "1 Issue"
overlay — those are browser-extension noise).

### Part 1 — Set up test data (skip anything that already exists)

1. Go to `/medical`, click **Medication Types**, then **+ Add Supply Type**.
   - Create `Test Fentanyl`: unit `vial`, tick **Controlled substance** (Required Signatures must lock to a
     minimum of 2), tick **Tracks expiration** if offered. Save. Expect an amber "Controlled" badge and
     "2 signatures". If you see "Controlled substance tracking isn't enabled for your department yet",
     STOP and report that exact text.
   - Confirm a non-controlled supply with expiration exists (e.g. `Aspirin 81mg`, unit `tablet`); create it if
     not, no signatures.
2. Click **Storerooms**, pick the station storeroom (e.g. "Station 1 Medical Storeroom"). Stock `Test Fentanyl`
   (PAR 3) and `Aspirin 81mg` (PAR 10) using the stock-a-medication control.
3. **Receive** Aspirin: lot `ASA-1`, quantity 10, expiration next year, notes optional. Expect ~10 on hand.
4. **Receive** Test Fentanyl: lot `TF-001`, quantity 3, expiration next year, Concentration `50` unit `mcg/mL`,
   **Volume per Vial** `2` mL, starting control # `CS-100` then click the generate button so you get CS-100,
   CS-101, CS-102. Choose Signer 1 and Signer 2 from the dropdowns and draw a signature in BOTH pads (drag the
   mouse across each canvas). Confirm. Expect a green banner and 3 on hand.
5. Click **Bags** (Medical page). If there is no bag template, create one named `Test Bag`, add `Aspirin 81mg`
   with PAR 5, then deploy it to a truck (pick the truck and, if offered, a compartment). If the bag shows no
   stock, use **Restock** (Part 3) to put 3 Aspirin in it. Report if bag creation/deploy is unclear or fails.

### Part 2 — Truck screen (Inventory → a truck → `/equipment/<id>`)

6. **History panel:** click **History ▼** on a compartment that has been inspected. Expect "Loading history…"
   then Presence Checks and/or Full Inspections with badges, person, and date. Click again; it collapses.
   On a never-inspected compartment expect "No inspections recorded for this compartment yet."
7. **Add compartment:** use the add-compartment panel. Add one from "From your compartments", one from
   "From a preset (stocked)", and one brand-new (e.g. code `ZZZ`). Each should appear with a QR code already
   set (no "No QR · Set" prompt). Adding a duplicate code should show an inline "already exists" error.
8. **QR:** on a compartment click the print-QR link (confirm it opens a print tab), and edit the QR code text
   and save.
9. **Remove:** remove an empty compartment (works), then try removing one that holds items (must be blocked
   with a named reason).
10. **Add Item:** on a compartment click **+ Add Item**. The dropdown must list equipment items AND a
    "Medications" group. Add one of each; both appear in the compartment list (medications with a 💊 badge).
11. **Move part of an item:** use the move control on an equipment item to move quantity 1 to another
    compartment; counts update on both.
12. **PAR in place:** (admin) on a medication row click the underlined "PAR n", change it, Save; it updates.
13. **Retired routes/links:** from Dept Admin → Apparatus → a truck click **View →** on a compartment, and from
    Inspections → a truck → **View**. Both must land on `/equipment/<id>` (Back from the second returns to
    `/inspections`). Visiting `/equipment/<truckId>/<anyCompartmentId>` must 404.

### Part 3 — Non-controlled medication forms (same forms on every screen)

Repeat on each location that has Aspirin: **(a)** Storeroom (`/medical`), **(b)** a truck compartment row
(Part 2 screen), **(c)** the bag from step 5 (truck bag section or Medical → Bags).

14. **Use:** click **Use**. Expect title "Use Supply", Quantity (default 1), Notes, and NO signature fields. A
    **Lot** dropdown appears only when there are 2+ lots. Submit 1 → green "Used 1 … of Aspirin 81mg." and the
    count drops by 1. Quantity 0 → "Quantity must be at least 1." (form stays open).
15. **Waste:** expand **Lots**, click **Waste** on a lot. Reason dropdown has exactly: Expired, Damaged,
    Contaminated, Recalled, Administered / Used on Scene, Other. Submit 1 → "Wasted 1 … of Aspirin 81mg." and
    the lot/total drop.
16. **Restock (truck or bag only):** click **Restock**. Title "Restock from Storeroom", Source Storeroom
    dropdown; Lot dropdown only if the storeroom has 2+ lots; Quantity shows "(N available)". Submit 1 →
    "Restocked 1 … from storeroom." Truck/bag +1, storeroom −1. Quantity 99 → "Only N available in this lot."
17. **Transfer (truck or bag only):** click **Transfer**. Title "Transfer to Storeroom", Destination Storeroom
    dropdown. Submit 1 → "Transferred 1 … to storeroom." Counts reverse.
18. **History:** on `/medical` the transaction history shows Used, Wasted, Transferred In/Out entries for
    the steps above, with supply name, person, and date.

### Part 4 — Controlled substance (Test Fentanyl)

19. **Administer** (storeroom row, then the truck row if you put it on a truck): click **Administer**.
    - Title "Administer" with an amber Controlled badge.
    - Vial dropdown lists CS-100/101/102 with lot and expiry. No vials → red "No vials available…" text.
    - After choosing a vial a gray box shows e.g. "100 mcg (2 mL)" and "3 vials remaining in lot".
    - Amount `150` → red "Cannot exceed 100 mcg per vial." and Confirm disabled.
    - Amount `75` → amber box "Waste: 25 mcg".
    - "Administered By" and "Witness" each have a signature pad; the Witness dropdown must NOT list whoever
      you chose first.
20. Click Confirm with no signatures drawn → "Signer 1 must sign." Then sign both and confirm → green
    "Administered 75 mcg of Test Fentanyl — 25 mcg wasted." and the count drops 3 → 2.
21. **Controlled Waste:** expand **Lots**, click **Waste** on lot TF-001. It shows a "Vials to Waste"
    checklist of remaining control numbers (not a quantity box). Tick one, choose a reason, sign both pads,
    confirm → "Wasted 1 vial of Test Fentanyl." and the count drops by 1.
22. **History/CS log:** the transaction history shows the administration and waste with both signers. If a
    **Print CS Log** button exists (it only appears when a controlled type exists), click it and confirm the
    print page opens with the Test Fentanyl entries.

### Report format

For each numbered step: `N — PASS/FAIL — what you saw`. Then: a list of all FAILs, any app console errors,
and anything that looked confusing or took more clicks than it should (we are trying to cut page-hopping).
