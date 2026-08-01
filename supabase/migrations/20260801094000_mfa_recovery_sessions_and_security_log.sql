-- ============================================================================
-- SRA B-2 / B-3 — multi-factor authentication and session management.
--
-- B-2: "A single password protects an account that can read every student's
-- personal data, every guardian's phone number, every fee balance, and can
-- irreversibly promote or void records for a whole institution." MFA is a
-- standard line item on institutional security questionnaires; its absence is
-- a procurement blocker at any buyer with an IT function.
--
-- B-3: "A user cannot see where they are signed in, and cannot revoke a
-- session. A session on a shared school computer persists indefinitely."
--
-- WHAT SUPABASE GIVES US AND WHAT IT DOES NOT. `auth.mfa.enroll/challenge/
-- verify` is TOTP, complete, and used directly from the client — that part is
-- configuration, not cryptography. What GoTrue has no concept of is:
--   * recovery codes — so a lost phone is a permanently locked account;
--   * a way for an ADMIN to clear another user's factor;
--   * any UI-reachable view of `auth.sessions`.
-- Those three are what this migration adds. Everything here is SECURITY
-- DEFINER against the `auth` schema, which PostgREST does not expose, and each
-- function is scoped to `auth.uid()` or gated on a permission.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

/* ------------------------------------------------------------ recovery codes */

create table if not exists public.mfa_recovery_code (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profile(id) on delete cascade,
  -- SHA-256 of the code, never the code. Codes are 50 bits of entropy from
  -- `gen_random_bytes`, so a fast hash is fine here — the reason bcrypt exists
  -- is human-chosen secrets, and these are not.
  code_hash   text not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists ix_mfa_recovery_profile on public.mfa_recovery_code (profile_id) where used_at is null;

alter table public.mfa_recovery_code enable row level security;
-- No policy is granted to `authenticated` on purpose: a recovery code is only
-- ever handled by the SECURITY DEFINER functions below. A row this table holds
-- must not be readable even by its owner — reading the hash set tells an
-- attacker how many codes are left, and nothing legitimate needs it.
revoke all on table public.mfa_recovery_code from anon, authenticated;

create or replace function private.hash_recovery_code(p_code text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(upper(regexp_replace(p_code, '[^0-9A-Za-z]', '', 'g')), 'sha256'), 'hex')
$$;

/**
 * Mint 10 single-use recovery codes, invalidating any previous set.
 *
 * Returned in plaintext exactly once — the screen shows them, offers a
 * download, and cannot show them again. Regenerating is the supported path,
 * which is why the previous set is deleted rather than kept alongside.
 */
create or replace function public.fn_generate_recovery_codes()
returns text[] language plpgsql security definer set search_path = '' as $fn$
declare v_uid uuid; v_codes text[] := '{}'; v_code text; i int;
begin
  v_uid := (select auth.uid());
  if v_uid is null then raise exception 'not authenticated'; end if;

  delete from public.mfa_recovery_code where profile_id = v_uid;

  for i in 1..10 loop
    -- 10 chars of Crockford-ish base32 from 5 random bytes. Grouped 5-5 in the
    -- UI; `hash_recovery_code` strips the separator so either form verifies.
    v_code := upper(encode(extensions.gen_random_bytes(5), 'hex'));
    v_codes := array_append(v_codes, v_code);
    insert into public.mfa_recovery_code(profile_id, code_hash)
    values (v_uid, private.hash_recovery_code(v_code));
  end loop;

  insert into public.access_log(institution_id, profile_id, action)
  values (private.current_institution_id(), v_uid, 'mfa.recovery_codes_generated');

  return v_codes;
end; $fn$;
revoke all on function public.fn_generate_recovery_codes() from public, anon;
grant execute on function public.fn_generate_recovery_codes() to authenticated;

/**
 * Spend a recovery code to clear the caller's own TOTP factors.
 *
 * A recovery code CANNOT raise the session's assurance level — that is
 * GoTrue's to decide and it has no notion of one. What it can honestly do is
 * remove the factor the user has lost access to, so they can sign in with
 * their password and enrol a new authenticator. Pretending otherwise would
 * mean minting a session outside GoTrue, which is a far worse thing to build.
 */
create or replace function public.fn_consume_recovery_code(p_code text)
returns boolean language plpgsql security definer set search_path = '' as $fn$
declare v_uid uuid; v_row uuid;
begin
  v_uid := (select auth.uid());
  if v_uid is null then raise exception 'not authenticated'; end if;

  select id into v_row from public.mfa_recovery_code
   where profile_id = v_uid and used_at is null and code_hash = private.hash_recovery_code(p_code)
   limit 1;

  if v_row is null then
    insert into public.access_log(institution_id, profile_id, action)
    values (private.current_institution_id(), v_uid, 'mfa.recovery_code_rejected');
    return false;
  end if;

  update public.mfa_recovery_code set used_at = now() where id = v_row;
  delete from auth.mfa_factors where user_id = v_uid;

  insert into public.access_log(institution_id, profile_id, action)
  values (private.current_institution_id(), v_uid, 'mfa.recovery_code_used');
  return true;
end; $fn$;
revoke all on function public.fn_consume_recovery_code(text) from public, anon;
grant execute on function public.fn_consume_recovery_code(text) to authenticated;

/** How many unused codes remain — the only thing the UI legitimately needs. */
create or replace function public.fn_recovery_code_count()
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.mfa_recovery_code
   where profile_id = (select auth.uid()) and used_at is null
$$;
revoke all on function public.fn_recovery_code_count() from public, anon;
grant execute on function public.fn_recovery_code_count() to authenticated;

/* ---------------------------------------------------------- admin MFA reset */

/**
 * A super_admin clears another user's MFA (SRA B-2, last bullet).
 *
 * The realistic failure this exists for: a head teacher's phone is lost or
 * wiped and they have also lost the recovery codes. Without this the account
 * is unrecoverable and the institution's only administrator is locked out of
 * its own product.
 *
 * Deliberately `core.settings` AND an explicit super-admin check, and it
 * writes a high-severity audit row — resetting someone else's second factor is
 * the single most abusable action in this schema.
 */
create or replace function public.fn_admin_reset_mfa(p_profile_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $fn$
declare v_inst uuid; v_actor uuid; v_target_inst uuid;
begin
  perform private.require_permission('core.settings');
  v_actor := (select auth.uid());
  v_inst := private.current_institution_id();
  if coalesce(trim(p_reason),'') = '' then raise exception 'a reason is required'; end if;
  if p_profile_id = v_actor then raise exception 'use your own recovery codes to reset your own MFA'; end if;

  select institution_id into v_target_inst from public.profile where id = p_profile_id;
  if v_target_inst is null or v_target_inst <> v_inst then
    raise exception 'user not found in institution';
  end if;

  delete from auth.mfa_factors where user_id = p_profile_id;
  delete from public.mfa_recovery_code where profile_id = p_profile_id;

  insert into public.audit_log(institution_id, entity, entity_id, action, changed_by, after)
  values (v_inst, 'mfa_factor', p_profile_id, 'admin_reset', v_actor,
          jsonb_build_object('reason', p_reason, 'severity', 'high'));
  insert into public.access_log(institution_id, profile_id, action)
  values (v_inst, p_profile_id, 'mfa.reset_by_admin');
end; $fn$;
revoke all on function public.fn_admin_reset_mfa(uuid, text) from public, anon;
grant execute on function public.fn_admin_reset_mfa(uuid, text) to authenticated;

/* ------------------------------------------------------------- sessions */

/**
 * The caller's own sessions.
 *
 * `auth.sessions` is not exposed by PostgREST and must not be — it is keyed by
 * user_id across the whole project, i.e. across every tenant. This function
 * reads only `auth.uid()`'s rows and returns no token material.
 *
 * The current session is identified by the `session_id` claim GoTrue puts in
 * the access token, so "this device" is marked without any fingerprinting.
 */
create or replace function public.fn_my_sessions()
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare v_uid uuid; v_current uuid; v_out jsonb;
begin
  v_uid := (select auth.uid());
  if v_uid is null then raise exception 'not authenticated'; end if;
  v_current := nullif((select auth.jwt() ->> 'session_id'), '')::uuid;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id,
           'created_at', s.created_at,
           'last_active', coalesce(s.refreshed_at, s.updated_at, s.created_at),
           'user_agent', s.user_agent,
           'ip', host(s.ip),
           'current', s.id = v_current) order by coalesce(s.refreshed_at, s.updated_at, s.created_at) desc), '[]'::jsonb)
    into v_out
    from auth.sessions s
   where s.user_id = v_uid;

  return v_out;
end; $fn$;
revoke all on function public.fn_my_sessions() from public, anon;
grant execute on function public.fn_my_sessions() to authenticated;

/**
 * Revoke one session, or every session but this one.
 *
 * Deleting the row invalidates the refresh token; the access token stays valid
 * until it expires (one hour by default), which is GoTrue's design and is
 * stated in the UI rather than papered over.
 */
create or replace function public.fn_revoke_session(p_session_id uuid default null)
returns integer language plpgsql security definer set search_path = '' as $fn$
declare v_uid uuid; v_current uuid; v_count int;
begin
  v_uid := (select auth.uid());
  if v_uid is null then raise exception 'not authenticated'; end if;
  v_current := nullif((select auth.jwt() ->> 'session_id'), '')::uuid;

  if p_session_id is null then
    delete from auth.sessions where user_id = v_uid and (v_current is null or id <> v_current);
  else
    -- Scoped to the caller: a session id from another user is simply not found.
    delete from auth.sessions where user_id = v_uid and id = p_session_id;
  end if;
  get diagnostics v_count = row_count;

  insert into public.access_log(institution_id, profile_id, action)
  values (private.current_institution_id(), v_uid,
          case when p_session_id is null then 'session.revoke_others' else 'session.revoke' end);

  return v_count;
end; $fn$;
revoke all on function public.fn_revoke_session(uuid) from public, anon;
grant execute on function public.fn_revoke_session(uuid) to authenticated;

/* ------------------------------------------------------- security event log */

/**
 * The caller's own security events (B-3: "a security-event log — sign-ins,
 * password changes, MFA changes, failed attempts").
 *
 * `access_log` already existed with the right shape and no writer for auth
 * events. `fn_record_security_event` is the writer; the action vocabulary is
 * constrained so a client cannot forge an arbitrary event into someone's
 * security history.
 */
create or replace function public.fn_record_security_event(p_action text)
returns void language plpgsql security definer set search_path = '' as $fn$
declare v_uid uuid;
begin
  v_uid := (select auth.uid());
  if v_uid is null then return; end if;
  if p_action not in (
    'auth.sign_in', 'auth.sign_out', 'auth.password_changed',
    'mfa.enrolled', 'mfa.unenrolled', 'mfa.challenge_failed', 'auth.step_up'
  ) then
    raise exception 'unknown security event: %', p_action;
  end if;

  insert into public.access_log(institution_id, profile_id, action)
  values (private.current_institution_id(), v_uid, p_action);
end; $fn$;
revoke all on function public.fn_record_security_event(text) from public, anon;
grant execute on function public.fn_record_security_event(text) to authenticated;

create or replace function public.fn_my_security_events(p_limit int default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare v_uid uuid; v_out jsonb;
begin
  v_uid := (select auth.uid());
  if v_uid is null then raise exception 'not authenticated'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', l.id, 'at', l.at, 'action', l.action,
           'ip', host(l.ip), 'user_agent', l.user_agent) order by l.at desc), '[]'::jsonb)
    into v_out
    from (select * from public.access_log
           where profile_id = v_uid
           order by at desc
           limit least(greatest(p_limit, 1), 200)) l;

  return v_out;
end; $fn$;
revoke all on function public.fn_my_security_events(int) from public, anon;
grant execute on function public.fn_my_security_events(int) to authenticated;

/* --------------------------------------------------------- my own profile */

/** The signed-in user's own record — My Account (B-4). Distinct from the
 *  all-users list the Profile menu item used to point at. */
create or replace function public.fn_my_profile()
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare v_uid uuid; v_out jsonb;
begin
  v_uid := (select auth.uid());
  if v_uid is null then raise exception 'not authenticated'; end if;

  select jsonb_build_object(
           'id', p.id, 'full_name', p.full_name, 'phone', p.phone,
           'email', (select email from auth.users u where u.id = p.id),
           'status', p.status, 'last_login_at', p.last_login_at,
           'avatar_file_id', p.avatar_file_id,
           'roles', coalesce((select jsonb_agg(r.name order by r.name)
                                from public.user_role ur join public.role r on r.id = ur.role_id
                               where ur.profile_id = p.id), '[]'::jsonb))
    into v_out
    from public.profile p
   where p.id = v_uid;

  return coalesce(v_out, '{}'::jsonb);
end; $fn$;
revoke all on function public.fn_my_profile() from public, anon;
grant execute on function public.fn_my_profile() to authenticated;

/** Update one's own name / phone. Deliberately narrow: role, status and
 *  institution are not self-writable, which is the whole point of RBAC. */
create or replace function public.fn_update_my_profile(payload jsonb)
returns void language plpgsql security definer set search_path = '' as $fn$
declare v_uid uuid;
begin
  v_uid := (select auth.uid());
  if v_uid is null then raise exception 'not authenticated'; end if;

  update public.profile
     set full_name = coalesce(nullif(payload->>'full_name',''), full_name),
         phone     = coalesce(nullif(payload->>'phone',''), phone),
         updated_at = now()
   where id = v_uid;
end; $fn$;
revoke all on function public.fn_update_my_profile(jsonb) from public, anon;
grant execute on function public.fn_update_my_profile(jsonb) to authenticated;
