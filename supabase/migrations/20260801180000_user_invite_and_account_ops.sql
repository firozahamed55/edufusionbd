-- ============================================================================
-- Settings audit M-15 / S-9.1 / S-9.2 — the operations that make Users & Roles
-- a user-management screen.
--
-- `profile = 1` in production. The whole authorization investment — four roles,
-- twenty-nine permissions, the permission matrix, every `core.user_manage`
-- guard — has been unusable since it shipped, because a school with one
-- account has nobody to assign a role to. The screen's own header comment
-- names the reason it deferred invite: creating an auth user needs the
-- service-role key, which cannot exist in a browser bundle.
--
-- WHAT THAT DEFERRAL ACTUALLY BOUGHT, AND WHAT IT DID NOT. It is true of
-- exactly one of the three operations. Creating an auth user needs GoTrue's
-- admin API. Revoking someone's sessions and looking up the address to send a
-- recovery link to are both plain SQL against `auth.sessions` / `auth.users`,
-- which a SECURITY DEFINER function reaches directly — `fn_revoke_session`
-- (migration 20260801094000) already does precisely this for the caller's own
-- sessions. So two of the three never needed a server route to be possible;
-- they needed a guard, a rate limit and an audit row, and those belong here.
--
-- WHERE THE AUTHORIZATION LIVES. In these functions, not in the Next.js route
-- handler above them. The client talks to PostgREST directly, so a check that
-- exists only in a route handler protects nothing against a direct
-- `POST /rest/v1/rpc/…`. The route's job is to hold the one credential that
-- cannot be in the browser and to give the screen a stable error shape; the
-- database's job is to decide. Same reasoning as `20260726055938`.
-- ============================================================================

-- ── profile: the state an invited account is actually in ────────────────────
-- `status` already allows 'invited' (migration 02) and `handle_new_auth_user`
-- already writes it, so the *state* existed and nothing could produce it
-- deliberately, and nothing recorded when or by whom. S-9.6 files that as "the
-- invited filter can never match anything", which is the visible half.
alter table public.profile
  add column if not exists email             text,
  add column if not exists invited_at        timestamptz,
  add column if not exists invited_by        uuid references public.profile(id) on delete set null,
  add column if not exists suspended_at      timestamptz,
  add column if not exists suspended_reason  text;

comment on column public.profile.email is
  'Mirror of auth.users.email. Denormalised because auth.users is not exposed to PostgREST and the user list needs an email column (S-9.3); written only by the invite path and the backfill below.';
comment on column public.profile.suspended_reason is
  'Why this account was suspended (S-9.10). MFA reset already required a reason; suspension — a comparable action — did not.';

-- Backfill from the source of truth. Idempotent, and cheap at any realistic
-- size: one row per staff account, not per student.
update public.profile p
   set email = u.email
  from auth.users u
 where u.id = p.id and p.email is distinct from u.email and u.email is not null;

-- One address per person per school. Not a global unique: the same person may
-- legitimately hold an account at two institutions on this platform.
create unique index if not exists uq_profile_institution_email
  on public.profile (institution_id, lower(email))
  where email is not null and institution_id is not null;

-- ── shared helper: resolve a target profile inside the caller's tenant ──────
-- Every account operation below needs the same three answers — who am I, is
-- the target really mine, and am I about to do this to myself. Writing it once
-- means a future operation cannot forget the second question, which is the one
-- that would turn a per-school action into a cross-tenant one.
create or replace function private.account_op_target(p_profile_id uuid, p_self_ok boolean)
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare v_inst uuid; v_actor uuid; v_email text; v_status text;
begin
  v_inst  := private.current_institution_id();
  v_actor := (select auth.uid());
  if v_inst is null or v_actor is null then raise exception 'no institution context'; end if;
  if not p_self_ok and p_profile_id = v_actor then
    raise exception 'this action cannot be applied to your own account' using errcode = 'RBAC2';
  end if;

  select p.email, p.status into v_email, v_status
    from public.profile p
   where p.id = p_profile_id and p.institution_id = v_inst;
  if not found then raise exception 'user not found in institution'; end if;

  -- jsonb rather than a composite type: four scalars, read by two callers, and
  -- a named type here would be a schema object to keep in step for nothing.
  return jsonb_build_object(
    'institution_id', v_inst, 'actor_id', v_actor, 'email', v_email, 'status', v_status);
end; $fn$;
revoke all on function private.account_op_target(uuid, boolean) from authenticated, anon, public;

-- ── invite, part 1: may this happen, and to whom ────────────────────────────
/**
 * Everything about an invite that the database can decide on its own, decided
 * before the route spends a GoTrue call on it.
 *
 * Split in two on purpose. Between "the caller is allowed to invite this
 * address" and "the profile now exists and holds these roles" sits a call to
 * an external service that can fail. Doing the authorization, the rate limit
 * and the duplicate check first means a rejected invite never reaches GoTrue,
 * and a GoTrue failure never leaves a half-written profile behind.
 *
 * The rate limit is the reason this is not merely a nicety: an invite sends
 * mail from the project's quota to an address the caller chooses, which is a
 * spam relay with a permission check in front of it if nothing counts.
 */
create or replace function public.fn_prepare_user_invite(payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v_inst uuid; v_actor uuid; v_email text; v_existing uuid; v_existing_status text;
begin
  perform private.require_permission('core.user_manage');
  v_inst  := private.current_institution_id();
  v_actor := (select auth.uid());
  if v_inst is null then raise exception 'no institution context'; end if;

  -- 10 per hour per administrator. A school onboarding its whole staff does it
  -- in a sitting of five or ten, not fifty; a loop wanting to mail a thousand
  -- addresses stops at ten.
  if not private.check_rate_limit('user.invite', 10, interval '1 hour') then
    raise exception 'rate limit exceeded: too many invitations sent recently' using errcode = 'RLIM1';
  end if;

  v_email := lower(nullif(trim(payload->>'email'), ''));
  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'a valid email address is required' using errcode = 'INV01';
  end if;
  if nullif(trim(payload->>'full_name'), '') is null then
    raise exception 'a name is required' using errcode = 'INV01';
  end if;
  if nullif(payload->>'phone','') is not null and payload->>'phone' !~ '^01[3-9][0-9]{8}$' then
    raise exception 'phone must be 11 digits starting 013-019' using errcode = 'INV01';
  end if;

  select p.id, p.status into v_existing, v_existing_status
    from public.profile p
   where p.institution_id = v_inst and lower(p.email) = v_email;

  -- An already-active account is a mistake worth stopping: re-inviting one
  -- mails a recovery link to someone who did not ask for it.
  if v_existing is not null and v_existing_status = 'active' then
    raise exception 'that email already belongs to an active account' using errcode = 'INV02';
  end if;

  return jsonb_build_object(
    'institution_id',   v_inst,
    'actor_id',         v_actor,
    'email',            v_email,
    'existing_profile', v_existing,
    'resend',           v_existing is not null
  );
end; $fn$;
revoke all on function public.fn_prepare_user_invite(jsonb) from public, anon;
grant execute on function public.fn_prepare_user_invite(jsonb) to authenticated;

-- ── invite, part 2: record it ───────────────────────────────────────────────
/**
 * Attach the auth user GoTrue just created (or re-confirmed) to this
 * institution, with its name, phone, roles and invite provenance.
 *
 * `handle_new_auth_user` has already inserted a bare profile row by the time
 * this runs — id, full_name, status 'invited' and nothing else — so this is an
 * UPDATE of a row that exists, with an INSERT fallback for the resend path
 * where the trigger fired long ago.
 */
create or replace function public.fn_complete_user_invite(payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $fn$
declare v_inst uuid; v_actor uuid; v_id uuid; v_roles uuid[]; v_resend boolean;
begin
  perform private.require_permission('core.user_manage');
  v_inst  := private.current_institution_id();
  v_actor := (select auth.uid());
  if v_inst is null then raise exception 'no institution context'; end if;

  v_id := nullif(payload->>'profile_id','')::uuid;
  if v_id is null then raise exception 'profile_id is required'; end if;
  v_resend := coalesce((payload->>'resend')::boolean, false);

  insert into public.profile (id, institution_id, full_name, phone, email, status, invited_at, invited_by)
  values (v_id, v_inst,
          nullif(trim(payload->>'full_name'),''),
          nullif(trim(payload->>'phone'),''),
          lower(nullif(trim(payload->>'email'),'')),
          'invited', now(), v_actor)
  on conflict (id) do update set
    -- `institution_id` is never re-pointed: a profile that already belongs to
    -- another school is not something an invite may quietly annex.
    institution_id = coalesce(profile.institution_id, excluded.institution_id),
    full_name      = coalesce(excluded.full_name, profile.full_name),
    phone          = coalesce(excluded.phone, profile.phone),
    email          = coalesce(excluded.email, profile.email),
    -- A resend must not demote an account that has since signed in.
    status         = case when profile.status = 'active' then 'active' else 'invited' end,
    invited_at     = now(),
    invited_by     = v_actor,
    updated_at     = now();

  if (select institution_id from public.profile where id = v_id) <> v_inst then
    raise exception 'that account already belongs to another institution' using errcode = 'INV03';
  end if;

  -- Roles are optional on invite: "let them in now, decide what they do next"
  -- is a real workflow, and the screen already warns that a role-less account
  -- can sign in and see nothing.
  select coalesce(array_agg(x.v::uuid), '{}'::uuid[])
    into v_roles
    from jsonb_array_elements_text(coalesce(payload->'role_ids','[]'::jsonb)) as x(v);

  if array_length(v_roles, 1) > 0 then
    -- Only roles of this institution, so a forged id cannot grant a role
    -- belonging to another school.
    insert into public.user_role (profile_id, role_id, institution_id)
    select v_id, ro.id, v_inst
      from public.role ro
     where ro.id = any(v_roles) and ro.institution_id = v_inst
    on conflict do nothing;
  end if;

  insert into public.audit_log(institution_id, entity, entity_id, action, changed_by, after)
  values (v_inst, 'profile', v_id, case when v_resend then 'invite_resent' else 'invited' end, v_actor,
          jsonb_build_object(
            'email', lower(nullif(trim(payload->>'email'),'')),
            'full_name', nullif(trim(payload->>'full_name'),''),
            'role_count', coalesce(array_length(v_roles, 1), 0),
            'severity', 'high'));

  return v_id;
end; $fn$;
revoke all on function public.fn_complete_user_invite(jsonb) from public, anon;
grant execute on function public.fn_complete_user_invite(jsonb) to authenticated;

-- ── password reset ──────────────────────────────────────────────────────────
/**
 * Authorize a recovery mail and hand back the address to send it to.
 *
 * The send itself is GoTrue's (`resetPasswordForEmail`), and it deliberately
 * succeeds whether or not the address exists — which is right for the public
 * forgot-password form and useless to an administrator, who needs to know that
 * the person they clicked on actually has an address on file. That is what
 * this returns.
 */
create or replace function public.fn_admin_prepare_password_reset(p_profile_id uuid)
returns text language plpgsql security definer set search_path = '' as $fn$
declare v_inst uuid; v_actor uuid; v_email text; t jsonb;
begin
  perform private.require_permission('core.user_manage');
  if not private.check_rate_limit('user.password_reset', 20, interval '1 hour') then
    raise exception 'rate limit exceeded: too many password resets requested recently' using errcode = 'RLIM1';
  end if;

  -- Self is allowed here: an administrator sending themselves a reset link is
  -- a normal thing to do and nothing about it is dangerous.
  t := private.account_op_target(p_profile_id, true);
  v_inst  := (t->>'institution_id')::uuid;
  v_actor := (t->>'actor_id')::uuid;
  v_email := t->>'email';

  if v_email is null then
    raise exception 'that account has no email address on file' using errcode = 'INV01';
  end if;

  insert into public.audit_log(institution_id, entity, entity_id, action, changed_by, after)
  values (v_inst, 'profile', p_profile_id, 'password_reset_sent', v_actor,
          jsonb_build_object('email', v_email, 'severity', 'high'));
  insert into public.access_log(institution_id, profile_id, action)
  values (v_inst, p_profile_id, 'password.reset_by_admin');

  return v_email;
end; $fn$;
revoke all on function public.fn_admin_prepare_password_reset(uuid) from public, anon;
grant execute on function public.fn_admin_prepare_password_reset(uuid) to authenticated;

-- ── revoke sessions ─────────────────────────────────────────────────────────
/**
 * End every live session of another account in this institution.
 *
 * Same caveat `fn_revoke_session` states for one's own sessions: deleting the
 * row invalidates the refresh token, while the access token already issued
 * stays valid until it expires. That is GoTrue's design; the UI says so rather
 * than implying an instant cut-off.
 */
create or replace function public.fn_admin_revoke_sessions(p_profile_id uuid)
returns integer language plpgsql security definer set search_path = '' as $fn$
declare v_inst uuid; v_actor uuid; v_count int; t jsonb;
begin
  perform private.require_permission('core.user_manage');
  -- Self is refused: revoking your own sessions from the user list would sign
  -- you out mid-action with no warning. `fn_revoke_session` is that path.
  t := private.account_op_target(p_profile_id, false);
  v_inst  := (t->>'institution_id')::uuid;
  v_actor := (t->>'actor_id')::uuid;

  delete from auth.sessions where user_id = p_profile_id;
  get diagnostics v_count = row_count;

  insert into public.audit_log(institution_id, entity, entity_id, action, changed_by, after)
  values (v_inst, 'profile', p_profile_id, 'sessions_revoked', v_actor,
          jsonb_build_object('session_count', v_count, 'severity', 'high'));
  insert into public.access_log(institution_id, profile_id, action)
  values (v_inst, p_profile_id, 'session.revoked_by_admin');

  return v_count;
end; $fn$;
revoke all on function public.fn_admin_revoke_sessions(uuid) from public, anon;
grant execute on function public.fn_admin_revoke_sessions(uuid) to authenticated;

-- ── suspension that actually suspends ───────────────────────────────────────
/**
 * S-9.10 and the second half of S-9.2.
 *
 * Two changes to a function that already existed. It takes an optional reason,
 * because MFA reset — a comparable action — has required one since it shipped
 * and suspension recorded nothing. And suspending now deletes the account's
 * sessions: a suspension that leaves the person signed in until their refresh
 * token happens to expire is a setting, not a control, and the screen's own
 * confirm text already promises "will no longer be able to sign in".
 */
create or replace function private.fn_set_user_status(payload jsonb) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v_inst    uuid;
  v_profile uuid;
  v_status  text;
  v_reason  text;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  v_profile := nullif(payload->>'profile_id','')::uuid;
  v_status  := nullif(payload->>'status','');
  v_reason  := nullif(trim(payload->>'reason'),'');
  if v_status not in ('active','suspended') then
    raise exception 'status must be active or suspended';
  end if;
  if v_profile = (select auth.uid()) then
    raise exception 'you cannot suspend your own account' using errcode = 'RBAC2';
  end if;

  update public.profile
     set status           = v_status,
         suspended_at     = case when v_status = 'suspended' then now() else null end,
         suspended_reason = case when v_status = 'suspended' then v_reason else null end,
         updated_at       = now()
   where id = v_profile and institution_id = v_inst;
  if not found then raise exception 'user not found in institution'; end if;

  if v_status = 'suspended' then
    delete from auth.sessions where user_id = v_profile;
    insert into public.access_log(institution_id, profile_id, action)
    values (v_inst, v_profile, 'session.revoked_by_admin');
  end if;
end;
$$;
revoke all on function private.fn_set_user_status(jsonb) from authenticated, anon, public;
