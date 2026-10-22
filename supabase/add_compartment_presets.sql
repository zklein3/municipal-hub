-- Inventory streamlining, Milestone 1 Step 3 — department-owned compartment presets + seed ledger.
-- See PLAN_INVENTORY_STREAMLINE.md. Additive only; new columns on existing tables are nullable.

-- A preset is a reusable compartment definition, independent of any truck. Deploying one creates
-- (or stocks) a truck's own apparatus_compartments row; nothing references the preset afterward.
create table compartment_presets (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id) on delete cascade,
  name text not null,
  default_code text not null,
  description text,
  sort_order integer,
  active boolean not null default true,
  source_starter_id uuid references starter_compartments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index uq_compartment_presets_dept_name on compartment_presets (department_id, lower(btrim(name)));
create index idx_compartment_presets_source on compartment_presets (source_starter_id);

-- Apparatus types a preset is "standard" for (drives "Add standard compartments").
create table compartment_preset_types (
  preset_id uuid not null references compartment_presets(id) on delete cascade,
  apparatus_type_id uuid not null references apparatus_types(id) on delete cascade,
  primary key (preset_id, apparatus_type_id)
);
create index idx_compartment_preset_types_type on compartment_preset_types (apparatus_type_id);

create table compartment_preset_items (
  id uuid primary key default gen_random_uuid(),
  preset_id uuid not null references compartment_presets(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  expected_quantity integer not null default 1 check (expected_quantity >= 0),
  minimum_quantity integer check (minimum_quantity is null or minimum_quantity >= 0),
  sort_order integer,
  notes text,
  created_at timestamptz not null default now(),
  constraint chk_compartment_preset_items_min_le_expected
    check (minimum_quantity is null or minimum_quantity <= expected_quantity),
  unique (preset_id, item_id)
);
create index idx_compartment_preset_items_item on compartment_preset_items (item_id);

-- Medication type + PAR only. Lots, expiration and on-hand stock are counted in at deploy (Receive).
create table compartment_preset_medications (
  id uuid primary key default gen_random_uuid(),
  preset_id uuid not null references compartment_presets(id) on delete cascade,
  supply_type_id uuid not null references medical_supply_types(id) on delete cascade,
  par_level integer check (par_level is null or par_level >= 0),
  sort_order integer,
  created_at timestamptz not null default now(),
  unique (preset_id, supply_type_id)
);
create index idx_compartment_preset_meds_type on compartment_preset_medications (supply_type_id);

-- Ledger of every master row ever given to a department. Seeding/push only adds master rows not
-- yet recorded here, so a department's renames, edits and deletes are never undone.
-- starter_id deliberately has no FK: the record must survive a master row being deleted.
create table department_starter_seeds (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id) on delete cascade,
  kind text not null check (kind in (
    'category', 'item', 'medication_type',
    'compartment', 'compartment_type', 'compartment_item', 'compartment_medication'
  )),
  starter_id uuid not null,
  target_id uuid,
  seeded_at timestamptz not null default now(),
  unique (department_id, kind, starter_id)
);

alter table items add column source_starter_id uuid references starter_items(id) on delete set null;
alter table item_categories add column source_starter_id uuid references starter_categories(id) on delete set null;
alter table medical_supply_types add column source_starter_id uuid references starter_medication_types(id) on delete set null;
create index idx_items_source_starter on items (source_starter_id) where source_starter_id is not null;
create index idx_item_categories_source_starter on item_categories (source_starter_id) where source_starter_id is not null;
create index idx_medical_supply_types_source_starter on medical_supply_types (source_starter_id) where source_starter_id is not null;

create trigger trg_compartment_presets_updated_at before update on compartment_presets
  for each row execute function set_updated_at();

alter table compartment_presets enable row level security;
alter table compartment_preset_types enable row level security;
alter table compartment_preset_items enable row level security;
alter table compartment_preset_medications enable row level security;
alter table department_starter_seeds enable row level security;
