-- Medication check history keeps name snapshots (supply_type_name, storeroom_name, …), so a placement
-- (medical_storeroom_inventory row) being removed should detach history, not block the removal.
-- Needed by the catalog move (medical supply -> equipment item). APPLIED 2026-10-22.
alter table medical_supply_presence_check_logs alter column storeroom_inventory_id drop not null;
alter table medical_supply_presence_check_logs drop constraint medical_supply_presence_check_logs_storeroom_inventory_id_fkey;
alter table medical_supply_presence_check_logs add constraint medical_supply_presence_check_logs_storeroom_inventory_id_fkey
  foreign key (storeroom_inventory_id) references medical_storeroom_inventory(id) on delete set null;
