-- ============================================================================
-- SRA F-4 / A-0.4 — make the authorization model reachable from the product.
--
-- WHAT ALREADY EXISTS. Migration 20260726043308 shipped a complete, correct
-- model: 4 roles (institution_admin, accountant, exam_controller, teacher), 29
-- permissions across 9 modules, 53 grants, `has_permission()`, role-based RLS
-- policies and a permission guard on every RPC. It is the hard half and it is
-- done.
--
-- WHAT IS MISSING is everything between that model and the operator. Nothing in
-- the UI reads a permission, User Management is read-only (no invite, no
-- suspend, no role assignment), and there is no way to see what a role may do.
-- The consequence is that a school's head teacher, accountant and registrar all
-- share one admin credential — which, among other things, destroys the value of
-- the audit log that was built alongside it, because every entry attributes to
-- the same account.
--
-- This migration adds the four reads/writes the UI needs. It adds no new
-- authorization: every write below goes through `require_permission` exactly
-- like the other 51, and the model itself is untouched.
-- ============================================================================

-- ── Read: what may the CALLER do? ──────────────────────────────────────────
-- Drives module visibility in the rail. Filtering the nav by permission rather
-- than by the JWT role is deliberate: the JWT role answers "may this person
-- reach /admin at all" (middleware's job, unchanged), while `user_role` answers
-- "which parts" — and permissions are what the database actually models, so the
-- rail and RLS agree by construction instead of by a parallel list.
create or replace function public.fn_my_permissions() returns text[]
  language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct p.code), '{}')
    from public.user_role ur
    join public.role_permission rp on rp.role_id = ur.role_id
    join public.permission p on p.id = rp.permission_id
   where ur.profile_id = (select auth.uid())
     and ur.institution_id = private.current_institution_id()
$$;
revoke all on function public.fn_my_permissions() from public, anon;
grant execute on function public.fn_my_permissions() to authenticated;

-- ── Read: the permission matrix ────────────────────────────────────────────
-- role x permission, as one document. Small (4 x 29) and read whole, so a
-- single jsonb beats four round trips and a client-side join.
create or replace function public.fn_permission_matrix() returns jsonb
  language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'code', r.code, 'name', r.name, 'is_system', r.is_system) order by r.code)
        from public.role r), '[]'::jsonb),
    'permissions', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'code', p.code, 'label', p.label, 'module', p.module) order by p.module, p.code)
        from public.permission p), '[]'::jsonb),
    'grants', coalesce((
      select jsonb_agg(jsonb_build_object('role_id', rp.role_id, 'permission_id', rp.permission_id))
        from public.role_permission rp), '[]'::jsonb)
  )
$$;
revoke all on function public.fn_permission_matrix() from public, anon;
grant execute on function public.fn_permission_matrix() to authenticated;

-- ── Write: assign / revoke a role ──────────────────────────────────────────
create or replace function private.fn_set_user_roles(payload jsonb) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v_inst    uuid;
  v_profile uuid;
  v_roles   uuid[];
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  v_profile := nullif(payload->>'profile_id','')::uuid;
  select coalesce(array_agg(value::text::uuid), '{}')
    into v_roles from jsonb_array_elements_text(coalesce(payload->'role_ids','[]'::jsonb));

  -- Tenant guard. `user_role` is institution-scoped and a caller must not be
  -- able to grant a role inside someone else's school by id.
  if not exists (select 1 from public.profile where id = v_profile and institution_id = v_inst) then
    raise exception 'user not found in institution';
  end if;

  -- An operator must not be able to remove their own last admin role and lock
  -- the institution out of its own settings. This is the school-management
  -- equivalent of deleting the last superuser.
  if v_profile = (select auth.uid())
     and not exists (
       select 1 from public.role r where r.id = any(v_roles) and r.code = 'institution_admin')
     and exists (
       select 1 from public.user_role ur join public.role r on r.id = ur.role_id
        where ur.profile_id = v_profile and ur.institution_id = v_inst and r.code = 'institution_admin')
  then
    raise exception 'you cannot remove your own admin role' using errcode = 'RBAC1';
  end if;

  -- Set semantics, not add: the screen sends the complete intended list, so a
  -- role removed in the UI is removed here. Delete-then-insert inside one
  -- statement pair keeps it atomic under the caller's transaction.
  delete from public.user_role where profile_id = v_profile and institution_id = v_inst;
  insert into public.user_role (profile_id, role_id, institution_id)
  select v_profile, rid, v_inst from unnest(v_roles) as rid
  on conflict do nothing;
end;
$$;
revoke all on function private.fn_set_user_roles(jsonb) from authenticated, anon, public;

create or replace function public.fn_set_user_roles(payload jsonb) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_permission('core.user_manage');
  perform private.fn_set_user_roles(payload);
end;
$$;
revoke all on function public.fn_set_user_roles(jsonb) from public, anon;
grant execute on function public.fn_set_user_roles(jsonb) to authenticated;

-- ── Write: suspend / reactivate ────────────────────────────────────────────
-- Deliberately NOT a delete. A profile carries audit-log attribution, and
-- deleting it would orphan every "who changed this mark" answer the audit log
-- exists to give.
create or replace function private.fn_set_user_status(payload jsonb) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v_inst    uuid;
  v_profile uuid;
  v_status  text;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  v_profile := nullif(payload->>'profile_id','')::uuid;
  v_status  := nullif(payload->>'status','');
  if v_status not in ('active','suspended') then
    raise exception 'status must be active or suspended';
  end if;
  if v_profile = (select auth.uid()) then
    raise exception 'you cannot suspend your own account' using errcode = 'RBAC2';
  end if;

  update public.profile set status = v_status, updated_at = now()
   where id = v_profile and institution_id = v_inst;
  if not found then raise exception 'user not found in institution'; end if;
end;
$$;
revoke all on function private.fn_set_user_status(jsonb) from authenticated, anon, public;

create or replace function public.fn_set_user_status(payload jsonb) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_permission('core.user_manage');
  perform private.fn_set_user_status(payload);
end;
$$;
revoke all on function public.fn_set_user_status(jsonb) from public, anon;
grant execute on function public.fn_set_user_status(jsonb) to authenticated;
