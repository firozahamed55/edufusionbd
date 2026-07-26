-- ============================================================================
-- Phase 0.2a — the permission helper the RLS layer was always missing.
--
-- `private.has_role()` has existed since migration 05 and is referenced by zero
-- policies. The role/permission/role_permission tables are fully modelled and
-- enforced nowhere. This migration adds the one function the policies need and
-- seeds the three system roles that were created with no permissions at all.
-- Migration 20260726043413 then wires it into every policy.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. audit.read — the only permission code the catalogue was missing.
--    (Everything else re-uses the 28 codes seeded in 10_seed_global.)
-- ---------------------------------------------------------------------------
insert into public.permission (code, label, module)
values ('audit.read', 'View Audit Log', 'core')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- 2. private.has_permission(code)
--
--    STABLE so the planner hoists it; wrapped in `(select ...)` at every call
--    site so it is an initplan evaluated once per statement rather than once
--    per row — the same discipline the existing tenant policies use.
-- ---------------------------------------------------------------------------
create or replace function private.has_permission(p_code text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select coalesce((select is_platform_admin from public.profile where id = (select auth.uid())), false)
      or exists (
        select 1
        from public.user_role ur
        join public.role_permission rp on rp.role_id = ur.role_id
        join public.permission p on p.id = rp.permission_id
        where ur.profile_id = (select auth.uid()) and p.code = p_code
      )
$$;
grant execute on function private.has_permission(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. private.has_full_class_scope()
--
--    Whether the caller sees every class section or only the ones they teach.
--    Exists so the per-row `can_access_class_section()` subquery in the
--    attendance/mark/enrollment policies can be short-circuited by an initplan
--    for admin-ish roles — who are the overwhelming majority of reads, and for
--    whom a per-row EXISTS would be a real regression.
-- ---------------------------------------------------------------------------
create or replace function private.has_full_class_scope() returns boolean
  language sql stable security definer set search_path = '' as $$
  select private.is_platform_admin()
      or private.has_role('institution_admin')
      or private.has_role('exam_controller')
      or private.has_role('accountant')
$$;
grant execute on function private.has_full_class_scope() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. private.is_guardian_of(student_id)
--
--    A parent reaches a student either directly (profile.linked_student_id, a
--    student's own account) or through the guardian link table. Used only by
--    the parent read policies in 20260726043508.
-- ---------------------------------------------------------------------------
create or replace function private.is_guardian_of(p_student_id uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profile pr
    where pr.id = (select auth.uid())
      and ( pr.linked_student_id = p_student_id
         or ( pr.linked_guardian_id is not null
              and exists (select 1 from public.student_guardian sg
                          where sg.guardian_id = pr.linked_guardian_id
                            and sg.student_id = p_student_id)) )
  )
$$;
grant execute on function private.is_guardian_of(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Seed the system roles.
--
--    `11_seed_demo_tenant` created institution_admin/teacher/accountant/
--    exam_controller but granted permissions to institution_admin only — the
--    other three have been empty since day one. Harmless while policies
--    ignored permissions entirely; a total lockout the moment they don't.
--
--    Written as a function, not an inline loop, because it is the seam a
--    future create-institution flow has to call. It is called below for every
--    institution that exists today.
--    ponytail: no create-institution RPC exists yet, so nothing else calls
--    this. Wire it into that flow when it is built.
-- ---------------------------------------------------------------------------
create or replace function private.seed_system_role_permissions(p_institution uuid)
  returns void language plpgsql security definer set search_path = '' as $$
declare rec record; v_role_id uuid;
begin
  for rec in
    select * from (values
      ('institution_admin', null::text[]),  -- null = every permission
      ('teacher',         array['dashboard.view','student.view','teacher.view',
                                'attendance.view','attendance.mark',
                                'exam.view','exam.mark_entry','certificate.view']),
      ('accountant',      array['dashboard.view','student.view',
                                'fee.view','fee.collect','fee.mapping','fee.void',
                                'sms.view']),
      ('exam_controller', array['dashboard.view','student.view',
                                'exam.view','exam.manage','exam.mark_entry',
                                'exam.result_process','exam.result_publish',
                                'certificate.view','certificate.generate'])
    ) as t(code, perms)
  loop
    select id into v_role_id from public.role
      where institution_id = p_institution and code = rec.code;
    continue when v_role_id is null;

    insert into public.role_permission (role_id, permission_id)
    select v_role_id, p.id from public.permission p
    where rec.perms is null or p.code = any(rec.perms)
    on conflict do nothing;
  end loop;
end;
$$;

do $$ declare i uuid; begin
  for i in select id from public.institution loop
    perform private.seed_system_role_permissions(i);
  end loop;
end $$;
