-- ============================================================================
-- Settings audit M-2 / S-10.1 — the one unguarded Core Settings RPC.
--
-- Every other function behind the Settings module opens with
-- `perform private.require_permission('core.settings')` or `('core.user_manage')`.
-- `fn_permission_matrix` did not: it is SECURITY DEFINER, owned by `postgres`
-- (which carries `rolbypassrls`, so RLS does not apply inside it), and EXECUTE
-- was granted to `authenticated`. Any signed-in account on the tenant — a
-- teacher, an accountant, a parent — could read the institution's complete
-- role x capability map with one PostgREST call.
--
-- It was missed because the hardening pass that added the guards swept the
-- WRITE functions. This is a read, so it was not in the sweep. That is a
-- process gap, not a one-off, which is why the fix ships with the pgTAP
-- assertion in `rls_roles.test.sql` §3.6 rather than on its own: from here, a
-- new SECURITY DEFINER function with no guard fails CI unless someone
-- deliberately adds it to the allow-list, in the same commit, where a reviewer
-- will see it.
--
-- WHY `core.user_manage` AND NOT `core.settings`. The matrix answers "what may
-- this role do", which is the same question the user list answers one row at a
-- time — and `profile`, `user_role` and `role_permission` are already gated on
-- `core.user_manage` at the RLS layer. Gating the matrix on `core.settings`
-- would let someone who may configure grading also enumerate the access model.
-- ============================================================================

create or replace function public.fn_permission_matrix()
returns jsonb language plpgsql stable security definer set search_path to '' as $fn$
begin
  perform private.require_permission('core.user_manage');

  return jsonb_build_object(
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'code', r.code, 'name', r.name, 'is_system', r.is_system) order by r.code)
        from public.role r), '[]'::jsonb),
    'permissions', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'code', p.code, 'label', p.label, 'module', p.module) order by p.module, p.code)
        from public.permission p), '[]'::jsonb),
    'grants', coalesce((
      select jsonb_agg(jsonb_build_object('role_id', rp.role_id, 'permission_id', rp.permission_id))
        from public.role_permission rp), '[]'::jsonb)
  );
end; $fn$;

revoke all on function public.fn_permission_matrix() from public, anon;
grant execute on function public.fn_permission_matrix() to authenticated;

-- ---------------------------------------------------------------------------
-- The second one, found by the sweep this migration adds.
--
-- `fn_resolve_sms_recipients` returns a recipient COUNT plus a ten-row sample
-- of guardian names and mobile numbers, so an operator can sanity-check who a
-- campaign will reach. It was SECURITY DEFINER, unguarded, and executable by
-- every authenticated account on the tenant. Ten rows is a small leak once; it
-- is the whole guardian directory when the caller walks `p_class_section_id`
-- across every section in the school, which is a loop, not an attack.
--
-- This is the finding that justifies the sweep: nobody was looking for it, and
-- it is worse than the one that was actually reported.
-- ---------------------------------------------------------------------------
create or replace function public.fn_resolve_sms_recipients(p_audience text, p_class_section_id uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $fn$
begin
  perform private.require_permission('sms.view');

  return jsonb_build_object(
    'count',  (select count(*) from private.resolve_sms_recipients(p_audience, p_class_section_id)),
    -- A bounded sample so the operator can sanity-check WHO, not just how many.
    -- The full list is never shipped to the browser: it is a few thousand
    -- guardians' phone numbers, and nothing on the screen needs it.
    'sample', coalesce((
      select jsonb_agg(jsonb_build_object('name', r.name, 'mobile', r.mobile))
        from (select * from private.resolve_sms_recipients(p_audience, p_class_section_id) limit 10) r
    ), '[]'::jsonb)
  );
end; $fn$;

revoke all on function public.fn_resolve_sms_recipients(text, uuid) from public, anon;
grant execute on function public.fn_resolve_sms_recipients(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The allow-list the pgTAP sweep reads.
--
-- A table rather than a hard-coded array in the test, so adding a deliberately
-- unguarded function is a schema change with a written reason attached to it,
-- reviewed like any other migration — not a line quietly appended to a test
-- file's IN (...) clause.
-- ---------------------------------------------------------------------------
create table if not exists private.unguarded_function_allowlist (
  proname text primary key,
  reason  text not null
);

insert into private.unguarded_function_allowlist (proname, reason) values
  ('fn_verify_document',
   'Public certificate verification. Deliberately reachable by anon: the whole point is that a third party holding a printed certificate can check it without an account. Takes an opaque id, returns validity only.'),
  ('fn_my_permissions',
   'Returns the CALLER''s own permission codes, derived from auth.uid(). Guarding it on a permission would be circular, and it discloses nothing the caller does not already have.'),
  ('fn_my_profile',
   'The caller''s own profile row, keyed on auth.uid().'),
  ('fn_update_my_profile',
   'The caller updating their own profile, keyed on auth.uid().'),
  ('fn_my_sessions',
   'The caller''s own auth sessions, keyed on auth.uid().'),
  ('fn_revoke_session',
   'The caller revoking one of their own sessions; ownership is checked inside against auth.uid().'),
  ('fn_my_security_events',
   'The caller''s own security-log entries, keyed on auth.uid().'),
  ('fn_record_security_event',
   'Writes a security-log row for the caller. Self-attributed from auth.uid(); a permission gate would stop the product recording events for exactly the accounts that matter least-privileged.'),
  ('fn_generate_recovery_codes',
   'MFA enrolment for the caller''s own account.'),
  ('fn_consume_recovery_code',
   'Sign-in path. Runs before the caller has a session with permissions to check.'),
  ('fn_recovery_code_count',
   'How many of the caller''s own recovery codes remain.'),
  ('fn_log_export',
   'Append-only accountability record. The actor comes from auth.uid() inside the function. Refusing the write on a missing permission would drop the log entry for precisely the call worth logging.')
on conflict (proname) do update set reason = excluded.reason;
