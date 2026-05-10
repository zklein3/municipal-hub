-- Phase 3 NERIS data gap fields.
-- Run in Supabase SQL editor before testing the Phase 3 UI.

alter table public.incident_neris
  add column if not exists outside_fire_acres numeric,
  add column if not exists no_action_reason text;

alter table public.incident_apparatus
  add column if not exists staffing_count integer;
