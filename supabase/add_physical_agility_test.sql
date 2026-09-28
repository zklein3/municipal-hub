-- Physical Agility Test — Fremont Fire Department's candidate/employee test.
-- Same public-PIN-page architecture as hose testing (see hose_testing_pins /
-- hose_testing_pin_attempts) — a no-login page any on-shift officer can pull
-- up, gated by a department PIN rather than a personal login, since candidates
-- being tested have no FireOps7 account at all.
--
-- Run in Supabase SQL editor before testing.

alter table public.departments
  add column if not exists agility_test_enabled boolean not null default false;

-- One PIN per department, same shape/lifecycle as hose_testing_pins.
create table if not exists public.agility_test_pins (
  department_id uuid primary key references public.departments(id) on delete cascade,
  pin_hash text not null,
  version integer not null default 1,
  set_at timestamptz not null default now(),
  set_by uuid references public.personnel(id)
);
alter table public.agility_test_pins enable row level security;

-- Rate-limit tracking for PIN attempts, same shape as hose_testing_pin_attempts.
create table if not exists public.agility_test_pin_attempts (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  ip text,
  succeeded boolean not null,
  attempted_at timestamptz not null default now()
);
create index if not exists idx_agility_test_pin_attempts_dept_time
  on public.agility_test_pin_attempts (department_id, attempted_at);
alter table public.agility_test_pin_attempts enable row level security;

-- One row per administered test. `personnel_id` is set only for a current
-- employee (subject_type = 'employee') — a hiring candidate has no
-- department_personnel record yet, so subject_type = 'candidate' always has
-- personnel_id null and relies on candidate_name alone.
create table if not exists public.physical_agility_tests (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  subject_type text not null check (subject_type in ('candidate', 'employee')),
  personnel_id uuid references public.personnel(id) on delete set null,
  candidate_name text not null,
  test_date date not null,
  administered_by_name text not null,
  overall_result text not null check (overall_result in ('pass', 'fail')),
  stopped_at_evolution integer,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_physical_agility_tests_department on public.physical_agility_tests (department_id);
create index if not exists idx_physical_agility_tests_personnel on public.physical_agility_tests (personnel_id);
alter table public.physical_agility_tests enable row level security;

-- One row per evolution attempted (a test that fails evolution 1 only ever
-- gets one row here — the sheet stops the candidate from proceeding further).
-- sub_checks holds evolution-specific extras (e.g. evolution 1's Stairmaster
-- completion + hose roll placement, evolution 2's hit count) as jsonb rather
-- than dedicated columns, so a future department's own sheet with different
-- evolutions doesn't need a schema change — just a new entry in the
-- department's hardcoded evolution spec (lib/agility-test-spec.ts).
create table if not exists public.physical_agility_test_evolutions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.physical_agility_tests(id) on delete cascade,
  evolution_number integer not null,
  evolution_name text not null,
  time_seconds numeric,
  cutoff_seconds numeric not null,
  result text not null check (result in ('pass', 'fail')),
  sub_checks jsonb,
  created_at timestamptz not null default now(),
  unique (test_id, evolution_number)
);
create index if not exists idx_physical_agility_test_evolutions_test on public.physical_agility_test_evolutions (test_id);
alter table public.physical_agility_test_evolutions enable row level security;

-- No RLS policies on any of these four tables, deliberately — every read/write
-- goes through server actions using the admin (service-role) client, which
-- bypasses RLS, the same pattern already used for hose_testing_pins and
-- medical_supply_presence_check_logs. RLS is enabled purely so anon/authenticated
-- Supabase clients can never read or write these directly.
