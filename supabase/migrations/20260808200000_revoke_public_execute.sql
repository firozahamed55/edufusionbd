-- ============================================================================
-- Take `anon` off every SECURITY DEFINER function except the one that wants it.
--
-- FOUND BY RE-RUNNING THE ADVISORS AS PART OF THE PHASE 9 GATE, not by reading
-- code. The settings audit recorded a baseline of ONE
-- `anon_security_definer_function_executable` warning — `fn_verify_document`,
-- deliberate. It is now eighteen: nine functions added during this engagement,
-- seven added during Phase 1, a trigger function, and the intentional one.
--
-- THE CAUSE IS A DEFAULT PRIVILEGE, NOT A MISSING LINE — and the first fix for
-- it was wrong, which is worth recording. `revoke execute … from public` does
-- nothing here: the grant is not to PUBLIC. `pg_default_acl` shows Supabase
-- ships `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS
-- TO anon, authenticated, service_role`, so every function created in `public`
-- gets an EXPLICIT `anon=X` entry the moment it exists. Writing
-- `grant execute … to authenticated` at the end of a migration therefore does
-- not restrict anything; it restates a grant that was already there and leaves
-- `anon` beside it.
--
-- HOW BAD IS IT, HONESTLY. Not a live data leak: each of these functions opens
-- with `private.require_permission(...)`, which resolves the caller through
-- `auth.uid()` and raises for an anonymous request. The guard holds — this was
-- checked, not assumed. What was missing is the layer BEHIND the guard: an
-- unauthenticated caller could reach the function body at all, so any future
-- guard bug would be internet-facing rather than tenant-facing. That is the
-- difference between a bug and an incident.
--
-- TWO PARTS, AND THE SECOND IS THE IMPORTANT ONE. Revoking from the functions
-- that exist fixes today. Changing the default privilege fixes every migration
-- anyone writes after this one — otherwise the next `create function` silently
-- reopens it and the advisor count climbs again.
--
-- `fn_verify_document` keeps anon access: a third party holding a printed
-- certificate has no account, and checking it without one is the entire point.
-- ============================================================================

/* 1 — the functions that exist today. */
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and p.proname <> 'fn_verify_document'
       and has_function_privilege('anon', p.oid, 'EXECUTE')
  loop
    execute format('revoke execute on function %s from anon', r.sig);
    execute format('revoke execute on function %s from public', r.sig);
  end loop;
end;
$$;

/* 2 — every function created from here on.

   Scoped to `postgres`, the role migrations run as. The `supabase_admin`
   default ACL is the platform's own and is left alone; functions created by
   the platform are not this project's to re-privilege. */
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;

/* The grant the product does rely on, restated so this migration is
   self-contained rather than dependent on what earlier ones left behind. */
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and p.prorettype <> 'trigger'::regtype
       and p.proname <> 'fn_verify_document'
  loop
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end;
$$;
