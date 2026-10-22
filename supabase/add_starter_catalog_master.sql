-- Inventory streamlining, Milestone 1 Step 2 — master (global) starter catalog.
-- Curated by sys admin, seeded into each department as department-owned copies.
-- See PLAN_INVENTORY_STREAMLINE.md. Additive only; nothing existing changes.

create table starter_categories (
  id uuid primary key default gen_random_uuid(),
  category_name text not null,
  sort_order integer,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index uq_starter_categories_name on starter_categories (lower(btrim(category_name)));

create table starter_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references starter_categories(id) on delete set null,
  item_name text not null,
  item_description text,
  tracks_quantity boolean not null default true,
  tracks_assets boolean not null default false,
  requires_presence_check boolean not null default true,
  tracks_expiration boolean not null default false,
  requires_inspection boolean not null default false,
  requires_maintenance boolean not null default false,
  sort_order integer,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_starter_items_tracking_mode check (tracks_quantity or tracks_assets)
);
create unique index uq_starter_items_name on starter_items (lower(btrim(item_name)));
create index idx_starter_items_category on starter_items (category_id);

create table starter_medication_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('medication', 'supply', 'equipment')),
  unit_of_measure text not null default 'each',
  is_controlled boolean not null default false,
  tracks_expiration boolean not null default false,
  required_signatures integer not null default 0 check (required_signatures in (0, 1, 2)),
  sort_order integer,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_starter_med_controlled_sigs check (not is_controlled or required_signatures >= 2)
);
create unique index uq_starter_medication_types_name on starter_medication_types (lower(btrim(name)));

create table starter_compartments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  default_code text not null,
  description text,
  sort_order integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index uq_starter_compartments_name on starter_compartments (lower(btrim(name)));
create unique index uq_starter_compartments_code on starter_compartments (upper(btrim(default_code)));

create table starter_compartment_types (
  starter_compartment_id uuid not null references starter_compartments(id) on delete cascade,
  apparatus_type_id uuid not null references apparatus_types(id) on delete cascade,
  primary key (starter_compartment_id, apparatus_type_id)
);
create index idx_starter_compartment_types_type on starter_compartment_types (apparatus_type_id);

create table starter_compartment_items (
  id uuid primary key default gen_random_uuid(),
  starter_compartment_id uuid not null references starter_compartments(id) on delete cascade,
  starter_item_id uuid not null references starter_items(id) on delete cascade,
  expected_quantity integer not null default 1 check (expected_quantity >= 0),
  minimum_quantity integer check (minimum_quantity is null or minimum_quantity >= 0),
  sort_order integer,
  notes text,
  created_at timestamptz not null default now(),
  constraint chk_starter_compartment_items_min_le_expected
    check (minimum_quantity is null or minimum_quantity <= expected_quantity),
  unique (starter_compartment_id, starter_item_id)
);
create index idx_starter_compartment_items_item on starter_compartment_items (starter_item_id);

create table starter_compartment_medications (
  id uuid primary key default gen_random_uuid(),
  starter_compartment_id uuid not null references starter_compartments(id) on delete cascade,
  starter_medication_type_id uuid not null references starter_medication_types(id) on delete cascade,
  par_level integer check (par_level is null or par_level >= 0),
  sort_order integer,
  created_at timestamptz not null default now(),
  unique (starter_compartment_id, starter_medication_type_id)
);
create index idx_starter_compartment_meds_type on starter_compartment_medications (starter_medication_type_id);

create trigger trg_starter_categories_updated_at before update on starter_categories
  for each row execute function set_updated_at();
create trigger trg_starter_items_updated_at before update on starter_items
  for each row execute function set_updated_at();
create trigger trg_starter_medication_types_updated_at before update on starter_medication_types
  for each row execute function set_updated_at();
create trigger trg_starter_compartments_updated_at before update on starter_compartments
  for each row execute function set_updated_at();

-- Admin (service-role) client only, same as the rest of the schema.
alter table starter_categories enable row level security;
alter table starter_items enable row level security;
alter table starter_medication_types enable row level security;
alter table starter_compartments enable row level security;
alter table starter_compartment_types enable row level security;
alter table starter_compartment_items enable row level security;
alter table starter_compartment_medications enable row level security;
