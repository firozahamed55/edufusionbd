-- ============================================================================
-- Settings audit S-9.7 and S-10.4 — the matrix says what a role CAN do and
-- never who holds it, and the role editor lists `name` + `code` with no
-- description of what ticking the box grants.
--
-- Both are the same missing two columns, and both are already in the schema:
-- `role.description` has been populated since the RBAC seed, and the holder
-- count is a group-by on `user_role`. The RPC simply never returned them.
--
-- `user_count` is scoped to the caller's institution — a global count would
-- leak how many people hold `institution_admin` across every tenant.
-- ============================================================================

create or replace function public.fn_permission_matrix()
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_inst uuid;
begin
  perform private.require_permission('core.user_manage');
  v_inst := private.current_institution_id();

  return jsonb_build_object(
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'code', r.code, 'name', r.name,
               'description', r.description, 'is_system', r.is_system,
               'user_count', (select count(*) from public.user_role ur
                               where ur.role_id = r.id and ur.institution_id = v_inst)
             ) order by r.code)
        from public.role r
       where r.institution_id is null or r.institution_id = v_inst), '[]'::jsonb),
    'permissions', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'code', p.code, 'label', p.label, 'module', p.module) order by p.module, p.code)
        from public.permission p), '[]'::jsonb),
    'grants', coalesce((
      select jsonb_agg(jsonb_build_object('role_id', rp.role_id, 'permission_id', rp.permission_id))
        from public.role_permission rp), '[]'::jsonb)
  );
end;
$$;
