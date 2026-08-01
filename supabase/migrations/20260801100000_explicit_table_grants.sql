-- ============================================================================
-- Make the migration set reproduce production's GRANT state.
--
-- WHY THIS EXISTS. `supabase test db` has failed on every push since the pgTAP
-- suite landed, with:
--
--     rls_roles.test.sql:64: ERROR: permission denied for table student
--     HINT: GRANT SELECT ON public.student TO authenticated;
--     Parse errors: Bad plan. You planned 48 tests but ran 0.
--
-- The hosted project HAS those grants — the app reads `student` fine — but no
-- migration in this repo ever created them. They came from the `postgres` role's
-- ALTER DEFAULT PRIVILEGES in a hosted project's bootstrap, which a from-empty
-- replay onto a local stack does not reproduce for tables created by migrations.
--
-- So the repo's migrations did not describe production. Two consequences, and
-- the second is the serious one:
--   1. the entire RLS assurance suite could not run — 48 security assertions
--      reported as "green pipeline" while executing zero of them;
--   2. a database rebuilt from these migrations (disaster recovery, a staging
--      project, a second tenant) would come up with an API the app cannot read.
--
-- GRANTS ARE NOT THE SECURITY BOUNDARY HERE. RLS is: every table in `public` has
-- `enable row level security` and a policy set, asserted by the very suite this
-- unblocks. A GRANT only says "this role may attempt the statement"; the policy
-- decides which rows come back. This mirrors what production already has rather
-- than widening or narrowing it — tightening `anon` is a separate decision with
-- its own evidence, not a side effect of a CI fix.
--
-- Deliberately EXCLUDED, matching production exactly:
--   · mfa_recovery_code            — service-role only; a recovery code the
--                                    client can SELECT is not a second factor
--   · attendance_default / mark_default and the `*_y<uuid>` partitions
--                                  — reached only through their parent table
-- ============================================================================

do $$
declare
  t record;
  excluded_prefixes constant text[] := array['attendance_y', 'mark_y'];
  excluded_exact    constant text[] := array['mfa_recovery_code', 'attendance_default', 'mark_default'];
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname <> all (excluded_exact)
      and not exists (select 1 from unnest(excluded_prefixes) p where c.relname like p || '%')
  loop
    execute format('grant select on public.%I to anon', t.relname);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t.relname);
    execute format('grant all on public.%I to service_role', t.relname);
  end loop;
end $$;

-- Future tables created by this role inherit the same shape, so the next
-- migration that adds a table does not silently re-open this gap.
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;

grant usage on schema public to anon, authenticated, service_role;

-- Sequences: `authenticated` inserts rows, so it needs the sequences behind any
-- serial/identity column or the INSERT grant above is only half a grant.
grant usage, select on all sequences in schema public to anon, authenticated;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated;

-- Re-assert the exclusions. `grant all on all tables` elsewhere, or a future
-- default-privilege change, must not quietly hand these back.
revoke all on public.mfa_recovery_code from anon, authenticated;
