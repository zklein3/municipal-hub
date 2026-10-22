-- Inventory streamlining, Milestone 1 Step 4 — small initial master content.
-- Deliberately small: structure first, lists grow type by type. Names reuse Winslow's existing
-- catalog where generic so seeding Winslow adopts its rows instead of duplicating them.
-- Items are presence/quantity checks only (no inspection templates) so a new truck's first check
-- can finish before any assets exist. Clinical contents are suggested defaults — review with your
-- medical director. Inserts only; safe to re-run (on conflict do nothing).

insert into starter_categories (category_name, sort_order) values
  ('Hose', 10), ('Nozzle', 20), ('Hose Adapters', 30), ('Water Supply', 40),
  ('Hand Tools', 50), ('Ventilation', 60), ('Air Packs', 70), ('Lighting', 80),
  ('Wildland', 90), ('Medical Supplies', 100), ('Airway & Oxygen', 110), ('Patient Assessment', 120),
  ('Immobilization', 130), ('PPE & Isolation', 140)
on conflict do nothing;

insert into starter_items (category_id, item_name, tracks_quantity, tracks_assets, sort_order)
select c.id, v.item_name, v.tq, v.ta, v.so
from (values
  ('Hose', '1.75" Hose', true, false, 10),
  ('Hose', '2.5" Hose', true, false, 20),
  ('Hose', '3" Hose', true, false, 30),
  ('Hose', '5" Hose', true, false, 40),
  ('Hose', 'Hard Suction', true, false, 50),
  ('Hose', '1" Forestry Hose', true, false, 60),
  ('Nozzle', '1.75 Fog Tip Nozzle', true, false, 10),
  ('Nozzle', '2.5" Nozzle Bale', true, false, 20),
  ('Nozzle', 'Forestry Nozzle', true, false, 30),
  ('Hose Adapters', 'Gated Wye Adapter', true, false, 10),
  ('Hose Adapters', '2.5" Double Female', true, false, 20),
  ('Hose Adapters', '2.5" Double Male', true, false, 30),
  ('Hose Adapters', 'Spanner Wrench', true, false, 40),
  ('Water Supply', 'Rural Hydrant Wrench', true, false, 10),
  ('Water Supply', 'Barrel Strainer', true, false, 20),
  ('Water Supply', 'Portable Water Tank', true, false, 30),
  ('Water Supply', 'Drop Tank Venturi Adapter', true, false, 40),
  ('Hand Tools', 'Halligan', true, false, 10),
  ('Hand Tools', 'Flat Head Axe', true, false, 20),
  ('Hand Tools', 'Pik Head Axe', true, false, 30),
  ('Hand Tools', 'Pry Bar', true, false, 40),
  ('Hand Tools', 'Pike Pole', true, false, 50),
  ('Hand Tools', 'Thermal Imaging Camera', false, true, 60),
  ('Ventilation', 'Positive Pressure Ventilation Fan - Battery', false, true, 10),
  ('Air Packs', 'SCBA', false, true, 10),
  ('Air Packs', 'SCBA Spare Cylinder', false, true, 20),
  ('Lighting', 'Flashlight', true, false, 10),
  ('Lighting', 'Portable Scene Light', true, false, 20),
  ('Wildland', 'Pulaski', true, false, 10),
  ('Wildland', 'McLeod', true, false, 20),
  ('Wildland', 'Fire Rake', true, false, 30),
  ('Wildland', 'Flapper', true, false, 40),
  ('Wildland', 'Backpack Pump', true, false, 50),
  ('Medical Supplies', '4x4 Gauze', true, false, 10),
  ('Medical Supplies', 'Trauma Dressings', true, false, 20),
  ('Medical Supplies', 'Tourniquet', true, false, 30),
  ('Medical Supplies', 'Rolled Gauze', true, false, 40),
  ('Medical Supplies', 'Medical Tape', true, false, 50),
  ('Medical Supplies', 'Triangular Bandage', true, false, 60),
  ('Medical Supplies', 'Cold Packs', true, false, 70),
  ('Airway & Oxygen', 'BVM - Adult', true, false, 10),
  ('Airway & Oxygen', 'BVM - Pediatric', true, false, 20),
  ('Airway & Oxygen', 'OPA Set', true, false, 30),
  ('Airway & Oxygen', 'NPA Set', true, false, 40),
  ('Airway & Oxygen', 'Portable Suction Unit', true, false, 50),
  ('Airway & Oxygen', 'Non-Rebreather Mask - Adult', true, false, 60),
  ('Airway & Oxygen', 'Nasal Cannula', true, false, 70),
  ('Airway & Oxygen', 'O2 Cylinder - D', true, false, 80),
  ('Patient Assessment', 'AED', false, true, 10),
  ('Patient Assessment', 'Blood Pressure Cuff - Adult', true, false, 20),
  ('Patient Assessment', 'Stethoscope', true, false, 30),
  ('Patient Assessment', 'Pulse Oximeter', true, false, 40),
  ('Patient Assessment', 'Glucometer', true, false, 50),
  ('Patient Assessment', 'Thermometer', true, false, 60),
  ('Immobilization', 'Adult C - Collar', true, false, 10),
  ('Immobilization', 'Pediatric C - Collar', true, false, 20),
  ('Immobilization', 'Backboard', true, false, 30),
  ('Immobilization', 'Vacuum Splint', true, false, 40),
  ('Immobilization', 'Stair Chair', true, false, 50),
  ('PPE & Isolation', 'Gloves - Medium', true, false, 10),
  ('PPE & Isolation', 'Gloves - Large', true, false, 20),
  ('PPE & Isolation', 'Surgical Masks', true, false, 30),
  ('PPE & Isolation', 'Safety Glasses', true, false, 40),
  ('PPE & Isolation', 'Isolation Kit', true, false, 50)
) as v(cat, item_name, tq, ta, so)
join starter_categories c on c.category_name = v.cat
on conflict do nothing;

insert into starter_medication_types (name, category, unit_of_measure, tracks_expiration, sort_order, notes) values
  ('Oral Glucose', 'medication', 'tube', true, 10, 'Suggested default — review with your medical director.'),
  ('Aspirin 81mg', 'medication', 'tablet', true, 20, 'Suggested default — review with your medical director.'),
  ('Naloxone (Intranasal)', 'medication', 'dose', true, 30, 'Suggested default — review with your medical director.'),
  ('Epinephrine Auto-Injector - Adult', 'medication', 'each', true, 40, 'Suggested default — review with your medical director.'),
  ('Epinephrine Auto-Injector - Pediatric', 'medication', 'each', true, 50, 'Suggested default — review with your medical director.')
on conflict do nothing;

insert into starter_compartments (name, default_code, description, sort_order) values
  ('Pump Panel', 'PUMP', 'Pump operator panel and adjacent storage.', 10),
  ('Hose Bed', 'HB', 'Main supply and attack hose loads.', 20),
  ('Crosslays', 'XL', 'Preconnected attack lines.', 30),
  ('Crew Cab', 'CREW', 'Riding positions — SCBA and personal tools.', 40),
  ('Forcible Entry & Tools', 'TOOL', 'Hand tools and forcible entry.', 50),
  ('Water Supply', 'WS', 'Hydrant and drafting supply equipment.', 60),
  ('Dump Valve & Pump Panel', 'DUMP', 'Tanker dump valves and pump controls.', 70),
  ('Portable Tank', 'PTANK', 'Drop tank and fill equipment.', 80),
  ('Skid Unit', 'SKID', 'Wildland skid pump and reels.', 90),
  ('Wildland Tools', 'WLT', 'Wildland hand tools.', 100),
  ('Airway', 'AIR', 'Airway management.', 110),
  ('Oxygen', 'O2', 'Oxygen delivery.', 120),
  ('Trauma', 'TRAUMA', 'Bleeding control and wound care.', 130),
  ('Patient Assessment', 'ASSESS', 'Vitals and assessment equipment.', 140),
  ('Immobilization', 'IMMOB', 'Spinal motion restriction and splinting.', 150),
  ('PPE & Isolation', 'PPE', 'Body substance isolation.', 160),
  ('Medications', 'MEDS', 'BLS medications. Review with your medical director.', 170)
on conflict do nothing;

insert into starter_compartment_types (starter_compartment_id, apparatus_type_id)
select sc.id, t.id
from (values
  ('Pump Panel', 'Engine'), ('Pump Panel', 'Rescue Engine'), ('Pump Panel', 'Quint'),
  ('Hose Bed', 'Engine'), ('Hose Bed', 'Rescue Engine'), ('Hose Bed', 'Quint'),
  ('Crosslays', 'Engine'), ('Crosslays', 'Rescue Engine'), ('Crosslays', 'Quint'),
  ('Crew Cab', 'Engine'), ('Crew Cab', 'Rescue Engine'), ('Crew Cab', 'Quint'), ('Crew Cab', 'Ladder/Aerial'),
  ('Forcible Entry & Tools', 'Engine'), ('Forcible Entry & Tools', 'Rescue Engine'), ('Forcible Entry & Tools', 'Quint'), ('Forcible Entry & Tools', 'Ladder/Aerial'),
  ('Water Supply', 'Engine'), ('Water Supply', 'Tanker/Tender'),
  ('Dump Valve & Pump Panel', 'Tanker/Tender'),
  ('Portable Tank', 'Tanker/Tender'),
  ('Skid Unit', 'Brush/Wildland'),
  ('Wildland Tools', 'Brush/Wildland'),
  ('Airway', 'BLS Ambulance'), ('Airway', 'ALS Ambulance'),
  ('Oxygen', 'BLS Ambulance'), ('Oxygen', 'ALS Ambulance'),
  ('Trauma', 'BLS Ambulance'), ('Trauma', 'ALS Ambulance'),
  ('Patient Assessment', 'BLS Ambulance'), ('Patient Assessment', 'ALS Ambulance'),
  ('Immobilization', 'BLS Ambulance'), ('Immobilization', 'ALS Ambulance'),
  ('PPE & Isolation', 'BLS Ambulance'), ('PPE & Isolation', 'ALS Ambulance'),
  ('Medications', 'BLS Ambulance'), ('Medications', 'ALS Ambulance')
) as v(comp, type_name)
join starter_compartments sc on sc.name = v.comp
join apparatus_types t on t.name = v.type_name
on conflict do nothing;

insert into starter_compartment_items (starter_compartment_id, starter_item_id, expected_quantity, minimum_quantity, sort_order)
select sc.id, si.id, v.qty, v.minq, v.so
from (values
  ('Pump Panel', 'Spanner Wrench', 2, 1, 10),
  ('Pump Panel', 'Flashlight', 1, null, 20),
  ('Hose Bed', '5" Hose', 10, null, 10),
  ('Hose Bed', '2.5" Hose', 4, null, 20),
  ('Hose Bed', '2.5" Nozzle Bale', 1, null, 30),
  ('Crosslays', '1.75" Hose', 8, null, 10),
  ('Crosslays', '1.75 Fog Tip Nozzle', 2, 2, 20),
  ('Crew Cab', 'SCBA', 4, null, 10),
  ('Crew Cab', 'Flashlight', 4, null, 20),
  ('Crew Cab', 'Thermal Imaging Camera', 1, null, 30),
  ('Forcible Entry & Tools', 'Halligan', 1, 1, 10),
  ('Forcible Entry & Tools', 'Flat Head Axe', 1, 1, 20),
  ('Forcible Entry & Tools', 'Pik Head Axe', 1, null, 30),
  ('Forcible Entry & Tools', 'Pry Bar', 1, null, 40),
  ('Forcible Entry & Tools', 'Pike Pole', 2, null, 50),
  ('Water Supply', 'Rural Hydrant Wrench', 1, 1, 10),
  ('Water Supply', 'Gated Wye Adapter', 1, null, 20),
  ('Water Supply', '2.5" Double Female', 1, null, 30),
  ('Water Supply', '2.5" Double Male', 1, null, 40),
  ('Water Supply', 'Barrel Strainer', 1, null, 50),
  ('Water Supply', 'Hard Suction', 2, null, 60),
  ('Dump Valve & Pump Panel', 'Spanner Wrench', 2, 1, 10),
  ('Dump Valve & Pump Panel', 'Flashlight', 1, null, 20),
  ('Portable Tank', 'Portable Water Tank', 1, 1, 10),
  ('Portable Tank', 'Drop Tank Venturi Adapter', 1, null, 20),
  ('Portable Tank', 'Hard Suction', 2, null, 30),
  ('Skid Unit', '1" Forestry Hose', 4, null, 10),
  ('Skid Unit', 'Forestry Nozzle', 2, 1, 20),
  ('Wildland Tools', 'Pulaski', 2, null, 10),
  ('Wildland Tools', 'McLeod', 1, null, 20),
  ('Wildland Tools', 'Fire Rake', 2, null, 30),
  ('Wildland Tools', 'Flapper', 2, null, 40),
  ('Wildland Tools', 'Backpack Pump', 2, null, 50),
  ('Airway', 'BVM - Adult', 1, 1, 10),
  ('Airway', 'BVM - Pediatric', 1, 1, 20),
  ('Airway', 'OPA Set', 1, 1, 30),
  ('Airway', 'NPA Set', 1, 1, 40),
  ('Airway', 'Portable Suction Unit', 1, 1, 50),
  ('Oxygen', 'O2 Cylinder - D', 2, 1, 10),
  ('Oxygen', 'Non-Rebreather Mask - Adult', 4, 2, 20),
  ('Oxygen', 'Nasal Cannula', 4, 2, 30),
  ('Trauma', 'Trauma Dressings', 4, 2, 10),
  ('Trauma', '4x4 Gauze', 20, 10, 20),
  ('Trauma', 'Tourniquet', 2, 2, 30),
  ('Trauma', 'Rolled Gauze', 6, 2, 40),
  ('Trauma', 'Medical Tape', 2, 1, 50),
  ('Trauma', 'Triangular Bandage', 4, null, 60),
  ('Trauma', 'Cold Packs', 4, null, 70),
  ('Patient Assessment', 'AED', 1, 1, 10),
  ('Patient Assessment', 'Blood Pressure Cuff - Adult', 1, 1, 20),
  ('Patient Assessment', 'Stethoscope', 1, 1, 30),
  ('Patient Assessment', 'Pulse Oximeter', 1, 1, 40),
  ('Patient Assessment', 'Glucometer', 1, null, 50),
  ('Patient Assessment', 'Thermometer', 1, null, 60),
  ('Immobilization', 'Adult C - Collar', 2, 1, 10),
  ('Immobilization', 'Pediatric C - Collar', 1, null, 20),
  ('Immobilization', 'Backboard', 1, 1, 30),
  ('Immobilization', 'Vacuum Splint', 1, null, 40),
  ('Immobilization', 'Stair Chair', 1, null, 50),
  ('PPE & Isolation', 'Gloves - Medium', 2, 1, 10),
  ('PPE & Isolation', 'Gloves - Large', 2, 1, 20),
  ('PPE & Isolation', 'Surgical Masks', 10, 4, 30),
  ('PPE & Isolation', 'Safety Glasses', 2, null, 40),
  ('PPE & Isolation', 'Isolation Kit', 2, 1, 50)
) as v(comp, item, qty, minq, so)
join starter_compartments sc on sc.name = v.comp
join starter_items si on si.item_name = v.item
on conflict do nothing;

insert into starter_compartment_medications (starter_compartment_id, starter_medication_type_id, par_level, sort_order)
select sc.id, sm.id, v.par, v.so
from (values
  ('Medications', 'Oral Glucose', 2, 10),
  ('Medications', 'Aspirin 81mg', 8, 20),
  ('Medications', 'Naloxone (Intranasal)', 2, 30),
  ('Medications', 'Epinephrine Auto-Injector - Adult', 2, 40),
  ('Medications', 'Epinephrine Auto-Injector - Pediatric', 1, 50)
) as v(comp, med, par, so)
join starter_compartments sc on sc.name = v.comp
join starter_medication_types sm on sm.name = v.med
on conflict do nothing;
