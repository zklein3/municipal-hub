-- Per-department timezone setting.
-- Run in Supabase SQL editor before testing the dept-admin timezone UI.

alter table public.departments
  add column if not exists timezone text default 'America/Chicago';
