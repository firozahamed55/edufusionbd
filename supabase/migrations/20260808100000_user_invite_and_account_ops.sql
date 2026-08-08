-- ============================================================================
-- Settings audit M-15 / S-9.1 / S-9.2 — the keystone.
--
-- `profile = 1` in production. The whole school runs on one shared credential,
-- every audit-log row is attributed to it, and none of the RBAC investment —
-- four roles, twenty-nine permissions, the permission matrix, the
-- `core.user_manage` guards — can be used by a real institution, because there
-- is only ever one account to assign a role to. The reason is a single missing
-- server route: creating an auth user needs the service-role key.
--
-- This migration is the database half of that route, plus three things the
-- sweep for it turned up that are worse than the gap it was written to close.
--
-- 1. SUSPENSION WAS DECORATIVE. `private.has_permission` never looked at
--    `profile.status`, and no RLS policy anywhere joins to it — a search of
--    `pg_policies` for a status predicate returns zero rows. So "Suspend" wrote
--    `status = 'suspended'`, greyed the row in the UI, and left the account with
--    every permission it had a minute earlier, indefinitely. The screen said the
--    account was stopped; the database had not been told. That is a worse
--    failure than the missing invite flow, because the product actively reports
--    a control it does not have.
--
-- 2. `last_login_at` WAS NEVER WRITTEN. Nothing in the repository assigns it.
--    The Users list renders a "Last sign-in" column that is empty for every row
--    in every institution, which reads as "nobody has ever signed in" rather
--    than as "this is not recorded". It is also the column an administrator
--    would use to find dormant accounts to revoke.
--
-- 3. THE `invited` STATUS HAD NO PRODUCER. `profile.status` defaults to
--    `'invited'` and its check constraint allows it, the user list offers it as
--    a filter — and no code path could ever set it, because no code path created
--    a user. It is the default for rows the `on_auth_user_created` trigger makes,
--    so it was reachable only by accident.
--
-- Together those close the loop the audit's own test asks for: invite → invited
-- → sign-in → active.
--
-- WHY `profile.email` IS DENORMALIZED HERE. The user list is a direct,
-- RLS-scoped PostgREST read of `public.profile`, and RLS cannot reach
-- `auth.users` — only a SECURITY DEFINER function can, which is how
-- `fn_my_profile` does it for one row. Identity in that list is currently
-- `full_name` + `phone`, so two teachers called Rahim are indistinguishable.
-- The alternatives were to turn a working screen into an RPC or to copy the
-- column; the column is smaller, and the two triggers below keep it honest
-- rather than leaving it to drift.
-- ============================================================================

/* ------------------------------------------------------------ 1. columns */

alter table public.profile
  add column if not exists email      text,
  add column if not exists invited_at timestamptz,
  add column if not exists invited_by uuid references public.profile(id) on delete set null;

comment on column public.profile.email is
  'Denormalized from auth.users. Kept in sync by on_auth_user_created / on_auth_user_email_changed; RLS cannot read auth.users, and the user list needs it for identity and search.';

update public.profile p
   set email = u.email
  from auth.users u
 where u.id = p.id and p.email is distinct from u.email;

-- One account per address per school. Partial, because the column is nullable
-- for any profile whose auth row predates the sync triggers.
create unique index if not exists profile_institution_email_uniq
  on public.profile (institution_id, lower(email))
  where email is not null and institution_id is not null;

create index if not exists profile_status_idx on public.profile (institution_id, status);

/* ------------------------------------------------- 2. auth.users → profile */

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  insert into public.profile (id, full_name, email, status)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email, 'invited')
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.handle_auth_user_email_changed()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  update public.profile set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (new.email is distinct from old.email)
  execute function public.handle_auth_user_email_changed();

/* ------------------------------------------- 3. suspension actually suspends */

-- The only change is the `status <> 'suspended'` gate. Deliberately NOT
-- `status = 'active'`: an invited account that has signed in but whose first
-- request races the status flip below would otherwise be denied everything, and
-- 'invited' is the DEFAULT for every profile the auth trigger has ever created.
-- Denying the one state that means "stop this person" is the minimal change
-- that cannot lock anybody out who works today.
create or replace function private.has_permission(p_code text)
returns boolean language sql stable security definer set search_path to '' as $$
  select not coalesce(
           (select p.status = 'suspended' from public.profile p where p.id = (select auth.uid())),
           false)
     and (
       coalesce((select is_platform_admin from public.profile where id = (select auth.uid())), false)
       or exists (
         select 1
         from public.user_role ur
         join public.role_permission rp on rp.role_id = ur.role_id
         join public.permission p on p.id = rp.permission_id
         where ur.profile_id = (select auth.uid()) and p.code = p_code
       ))
$$;

/* --------------------------------------------- 4. sign-in closes the loop */

create or replace function public.fn_record_security_event(p_action text)
returns void language plpgsql security definer set search_path to '' as $$
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

  -- A successful sign-in is the only evidence the product has that an account
  -- is real and in use. It records the timestamp the Users list has always
  -- shown an empty column for, and completes an invite: the person proved they
  -- can reach the mailbox the invitation went to.
  if p_action = 'auth.sign_in' then
    update public.profile
       set last_login_at = now(),
           status = case when status = 'invited' then 'active' else status end
     where id = v_uid;
  end if;
end;
$$;

/* ------------------------------------------------------- 5. the invite flow */

-- Split in two on purpose. The auth user has to exist before there is an id to
-- attach a profile to, and creating it needs the service-role key, which lives
-- in the Next route and nowhere else. So: authorize FIRST (this function),
-- create the auth user, then claim the row the trigger made (the next one). The
-- route deletes the auth user if the claim fails, so a rejected invite does not
-- leave an orphan able to sign in with no institution.
create or replace function public.fn_invite_user_precheck(p_email text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_inst uuid; v_email text;
begin
  perform private.require_permission('core.user_manage');
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  v_email := lower(trim(coalesce(p_email, '')));
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'a valid email address is required' using errcode = 'INV01';
  end if;

  -- Inviting is a mail send and an account creation. Twenty an hour is far more
  -- than onboarding a school needs and far less than a scripted loop wants.
  if not private.check_rate_limit('user_invite', 20, interval '1 hour') then
    raise exception 'too many invitations sent — try again later' using errcode = 'RLIM1';
  end if;

  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'that email already has an account' using errcode = 'INV02';
  end if;

  return jsonb_build_object('institution_id', v_inst, 'email', v_email);
end;
$$;

create or replace function public.fn_complete_user_invite(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  v_inst    uuid;
  v_actor   uuid;
  v_profile uuid;
  v_roles   uuid[];
begin
  perform private.require_permission('core.user_manage');
  v_inst  := private.current_institution_id();
  v_actor := (select auth.uid());
  if v_inst is null then raise exception 'no institution context'; end if;

  v_profile := nullif(payload->>'profile_id','')::uuid;
  if v_profile is null then raise exception 'profile_id is required'; end if;

  select coalesce(array_agg(value::text::uuid), '{}')
    into v_roles from jsonb_array_elements_text(coalesce(payload->'role_ids','[]'::jsonb));

  -- Claim the row `on_auth_user_created` made. `institution_id is null` is the
  -- guard that matters: it means this profile has never belonged to anyone, so
  -- this cannot be used to pull an existing user out of another school.
  update public.profile
     set institution_id = v_inst,
         full_name      = coalesce(nullif(trim(payload->>'full_name'),''), full_name),
         phone          = nullif(trim(payload->>'phone'),''),
         status         = 'invited',
         invited_at     = now(),
         invited_by     = v_actor,
         updated_at     = now()
   where id = v_profile and institution_id is null;
  if not found then raise exception 'that account is already claimed' using errcode = 'INV03'; end if;

  -- Roles must belong to this institution's role set (or be a system role).
  insert into public.user_role (profile_id, role_id, institution_id)
  select v_profile, r.id, v_inst
    from public.role r
   where r.id = any(v_roles)
     and (r.institution_id is null or r.institution_id = v_inst)
  on conflict do nothing;

  insert into public.audit_log(institution_id, entity, entity_id, action, changed_by, after)
  values (v_inst, 'profile', v_profile, 'invite', v_actor,
          jsonb_build_object('email', payload->>'email', 'roles', to_jsonb(v_roles), 'severity', 'high'));

  return v_profile;
end;
$$;

/* ------------------------------------- 6. password reset / session revoke */

-- Both actions happen through the Supabase admin API in the Next route; the
-- database's job is to authorize the target and write the record. Calling this
-- BEFORE the admin call means an unauthorized attempt never reaches the API,
-- and the audit row exists even if the mail provider then fails.
create or replace function public.fn_authorize_account_action(p_profile_id uuid, p_action text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_inst uuid; v_actor uuid; v_email text; v_target_inst uuid;
begin
  perform private.require_permission('core.user_manage');
  v_inst  := private.current_institution_id();
  v_actor := (select auth.uid());
  if p_action not in ('password_reset','revoke_sessions','resend_invite') then
    raise exception 'unknown account action: %', p_action;
  end if;

  select p.institution_id, p.email into v_target_inst, v_email
    from public.profile p where p.id = p_profile_id;
  if v_target_inst is null or v_target_inst <> v_inst then
    raise exception 'user not found in institution';
  end if;

  if not private.check_rate_limit('account_action', 30, interval '1 hour') then
    raise exception 'too many account actions — try again later' using errcode = 'RLIM1';
  end if;

  insert into public.audit_log(institution_id, entity, entity_id, action, changed_by, after)
  values (v_inst, 'profile', p_profile_id, p_action, v_actor,
          jsonb_build_object('reason', p_reason, 'severity', 'high'));
  insert into public.access_log(institution_id, profile_id, action)
  values (v_inst, p_profile_id, 'admin.' || p_action);

  return jsonb_build_object('email', v_email);
end;
$$;

-- Revoking somebody else's sessions needs no service-role route:
-- `fn_revoke_session` has been deleting from `auth.sessions` inside a SECURITY
-- DEFINER function since the MFA work. This is the same operation with a
-- permission guard and a tenant check instead of a self-scope.
--
-- The access token already issued stays valid until it expires (one hour).
-- Killing the refresh token is what ends the session; the `has_permission`
-- change above is what makes the remaining hour harmless for a suspension.
create or replace function public.fn_admin_revoke_sessions(p_profile_id uuid, p_reason text default null)
returns integer language plpgsql security definer set search_path to '' as $$
declare v_inst uuid; v_actor uuid; v_count int;
begin
  perform private.require_permission('core.user_manage');
  v_inst  := private.current_institution_id();
  v_actor := (select auth.uid());

  if not exists (select 1 from public.profile where id = p_profile_id and institution_id = v_inst) then
    raise exception 'user not found in institution';
  end if;

  delete from auth.sessions where user_id = p_profile_id;
  get diagnostics v_count = row_count;

  insert into public.audit_log(institution_id, entity, entity_id, action, changed_by, after)
  values (v_inst, 'profile', p_profile_id, 'revoke_sessions', v_actor,
          jsonb_build_object('reason', p_reason, 'sessions', v_count, 'severity', 'high'));
  insert into public.access_log(institution_id, profile_id, action)
  values (v_inst, p_profile_id, 'admin.revoke_sessions');

  return v_count;
end;
$$;

/* ----------------------------------------------- 7. suspension gets a reason */

create or replace function private.fn_set_user_status(payload jsonb)
returns void language plpgsql security definer set search_path to '' as $$
declare
  v_inst    uuid;
  v_actor   uuid;
  v_profile uuid;
  v_status  text;
  v_reason  text;
begin
  v_inst  := private.current_institution_id();
  v_actor := (select auth.uid());
  if v_inst is null then raise exception 'no institution context'; end if;

  v_profile := nullif(payload->>'profile_id','')::uuid;
  v_status  := nullif(payload->>'status','');
  v_reason  := nullif(trim(coalesce(payload->>'reason','')),'');
  if v_status not in ('active','suspended') then
    raise exception 'status must be active or suspended';
  end if;
  if v_profile = v_actor then
    raise exception 'you cannot suspend your own account' using errcode = 'RBAC2';
  end if;

  update public.profile set status = v_status, updated_at = now()
   where id = v_profile and institution_id = v_inst;
  if not found then raise exception 'user not found in institution'; end if;

  -- Suspending an account that keeps its refresh token is not a suspension.
  -- Done HERE rather than in the screen so that every caller of the RPC —
  -- including the next one — gets it, which is the difference between a
  -- control and a habit.
  if v_status = 'suspended' then
    delete from auth.sessions where user_id = v_profile;
  end if;

  -- The row-level audit trigger already records the UPDATE. This adds the one
  -- thing a diff of `status` cannot carry: why. MFA reset has required a reason
  -- since it shipped; suspension is the comparable action and did not.
  insert into public.audit_log(institution_id, entity, entity_id, action, changed_by, after)
  values (v_inst, 'profile', v_profile,
          case when v_status = 'suspended' then 'suspend' else 'reactivate' end, v_actor,
          jsonb_build_object('reason', v_reason, 'severity', case when v_status = 'suspended' then 'high' else 'normal' end));
end;
$$;

grant execute on function public.fn_invite_user_precheck(text)       to authenticated;
grant execute on function public.fn_complete_user_invite(jsonb)      to authenticated;
grant execute on function public.fn_authorize_account_action(uuid, text, text) to authenticated;
grant execute on function public.fn_admin_revoke_sessions(uuid, text)          to authenticated;
