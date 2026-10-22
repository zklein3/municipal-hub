-- Milestone 2, step 2A — make container kind and bag location explicit on medical_storerooms.
-- See PLAN_CONTAINERS_BAGS.md. DRAFT — not yet applied. Additive and safe for `main`:
-- the trigger derives container_kind for inserts from code that doesn't know the column yet.

alter table medical_storerooms add column container_kind text
  check (container_kind in ('storeroom', 'compartment_storage', 'bag'));
alter table medical_storerooms add column parent_storeroom_id uuid references medical_storerooms(id) on delete set null;
alter table medical_storerooms add column assigned_personnel_id uuid references personnel(id) on delete set null;
alter table medical_storerooms add column qr_code text;
alter table medical_storerooms add column bag_number integer;
create unique index uq_medical_storerooms_qr_code on medical_storerooms (qr_code) where qr_code is not null;
create index idx_medical_storerooms_parent on medical_storerooms (parent_storeroom_id) where parent_storeroom_id is not null;
create index idx_medical_storerooms_assigned on medical_storerooms (assigned_personnel_id) where assigned_personnel_id is not null;
create index idx_medical_storerooms_kind on medical_storerooms (department_id, container_kind);

-- Backfill from today's structural inference.
update medical_storerooms set container_kind = case
  when template_id is not null then 'bag'
  when compartment_id is not null then 'compartment_storage'
  else 'storeroom'
end;

-- Keep `main` correct until 2A code ships: derive the kind when an insert doesn't set it.
create or replace function medical_storerooms_derive_kind() returns trigger language plpgsql as $$
begin
  if new.container_kind is null then
    new.container_kind := case
      when new.template_id is not null then 'bag'
      when new.compartment_id is not null then 'compartment_storage'
      else 'storeroom'
    end;
  end if;
  return new;
end $$;
create trigger trg_medical_storerooms_derive_kind before insert on medical_storerooms
  for each row execute function medical_storerooms_derive_kind();

alter table medical_storerooms alter column container_kind set not null;

-- Location rules.
alter table medical_storerooms add constraint chk_medical_storerooms_location check (
  case container_kind
    -- a bag is in at most one place: a compartment, another container (bag or storeroom), or a member;
    -- none = on a truck (apparatus_id) but not placed in a compartment, or unplaced
    when 'bag' then num_nonnulls(compartment_id, parent_storeroom_id, assigned_personnel_id) <= 1
    when 'compartment_storage' then compartment_id is not null and parent_storeroom_id is null and assigned_personnel_id is null
    else compartment_id is null and parent_storeroom_id is null and assigned_personnel_id is null
  end
);
alter table medical_storerooms add constraint chk_medical_storerooms_not_own_parent check (parent_storeroom_id is null or parent_storeroom_id <> id);

-- Existing bags get instance numbers per (department, template) in creation order.
with numbered as (
  select id, row_number() over (partition by department_id, template_id order by created_at) n
  from medical_storerooms where container_kind = 'bag'
)
update medical_storerooms m set bag_number = numbered.n from numbered where m.id = numbered.id;
