-- "Between evolution rest" from the paper form — the break taken immediately
-- before this evolution started. Null for evolution 1 (nothing precedes it)
-- and for any evolution reached via manual time entry with the stopwatch
-- unused. Already applied directly via Supabase MCP on 2026-09-27/28 —
-- this file is the repo-tracked record of that change, same convention as
-- add_physical_agility_test.sql.

alter table public.physical_agility_test_evolutions
  add column if not exists rest_before_seconds numeric;
