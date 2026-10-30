# Database Disk IO — Rules for Testing & Rework

Written 2026-10-30 after a Supabase "Disk IO" warning. Read this before any rework, QA pass, or perf session.

## What causes the warning (measured, not guessed)
`pg_stat_statements` (stats since 2026-03-30, 2.2M calls):
- **Disk reads are negligible** (~800 blocks total; 100% cache hit). Page queries are NOT the problem.
- **Writes dominate** (~44k blocks written/dirtied). The top writers are **auth logins**: `refresh_tokens` inserts (~1,450), `sessions` inserts (~980), `mfa_amr_claims` inserts (~980), `DELETE FROM sessions WHERE user_id` (~310), token revokes (~470).
- ~980 logins is far beyond real department use — it matches **scripted Playwright sign-ins**. Every login writes several rows across 3 auth tables, and every write also goes to the write-ahead log (real disk IO).
- Secondary writers: scheduled cron job logs (~300), migration tracking (~220, i.e. us applying migrations), Supabase dashboard metadata queries, signature updates.
- Not the cause: app schema, missing indexes, RLS policy cost, the latency rewrites (those reduced queries per page).

**Bottom line: our own testing/dev activity — mostly logins — is the main driver.**

## Rules
1. **Playwright only when Zak asks.** Never run it proactively; use the dev server for routine verification.
2. **One login per run.** Reuse a single browser context/session for the whole script. Never log in per page or per script step; never loop sign-ins. Batch several checks into one run.
3. **Check the Supabase dashboard IO graph** (Reports → Database) after a heavy testing session. If spikes line up with test times, that confirms the cause. If the warning returns in a quiet period with no testing, it is the free-tier compute limit — the Upgrade Trigger in CLAUDE.md applies (Supabase Pro), not more code changes.

## Extra habits for rework sessions
- Prefer reading code and the dev server over scripted browser walks; batch DB migrations rather than applying many tiny ones.
- Avoid repeated `PERF_LOG` timing loops against production data; one A/B run is enough.
- To re-diagnose: run in the Supabase SQL editor
  `select left(regexp_replace(query,'\s+',' ','g'),110) q, calls, shared_blks_read, shared_blks_written, shared_blks_dirtied from pg_stat_statements order by (shared_blks_read+shared_blks_written+shared_blks_dirtied) desc limit 15;`
  and see whether auth tables (`sessions`, `refresh_tokens`) still lead.

## Related changes made the same day (kept, but not expected to fix this)
- Migration `rls_initplan_wrap_auth_calls` — 36 RLS policies now use `(select auth.uid())` / `(select auth.role())`.
- Migration `add_fk_indexes_hot_tables` — 19 indexes on unindexed foreign keys.
- Open, unfixed: `fuel_tanks` / `fuel_tank_deliveries` policies compare `department_personnel.personnel_id` to `auth.uid()` (different ids; likely never match; harmless while the app uses the admin client).
