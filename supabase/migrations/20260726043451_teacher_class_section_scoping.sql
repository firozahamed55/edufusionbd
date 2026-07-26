-- ============================================================================
-- Phase 0.3 — wire class-section scoping so a teacher sees their sections,
-- not the whole school. Closes the second half of A-C1.
--
-- `private.can_access_class_section()` has existed since migration 05 with
-- zero policy references. It bundles two questions:
--     "does this user bypass section scoping?"  (admin-ish, cheap, per-STATEMENT)
--     "does this user teach this section?"      (per-ROW)
-- Calling it per row would re-evaluate the admin half on every one of the
-- 22M attendance rows a large tenant produces per year. So the two halves are
-- split: `has_full_class_scope()` is hoisted into an InitPlan that
-- short-circuits the whole clause for admins, and `teaches_class_section()`
-- is the narrow per-row test. `can_access_class_section()` keeps its original
-- meaning by delegating to both — nothing that already calls it changes.
-- ============================================================================

create or replace function private.teaches_class_section(cs_id uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.teacher_assignment ta
                 join public.profile p on p.linked_teacher_id = ta.teacher_id
                 where p.id = (select auth.uid()) and ta.class_section_id = cs_id)
      or exists (select 1 from public.class_section cs
                 join public.profile p on p.linked_teacher_id = cs.class_teacher_id
                 where p.id = (select auth.uid()) and cs.id = cs_id)
$$;
grant execute on function private.teaches_class_section(uuid) to authenticated;

create or replace function private.can_access_class_section(cs_id uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select private.has_full_class_scope() or private.teaches_class_section(cs_id)
$$;

-- ---------------------------------------------------------------------------
-- attendance + student_enrollment carry class_section_id directly.
--
-- The scope clause goes on BOTH halves of the pair: permissive policies OR
-- together, so scoping only the read half would leave the FOR ALL write
-- policy's USING clause as an unscoped read path.
-- ---------------------------------------------------------------------------
do $$
declare rec text; parts text[]; t text; p_read text; p_write text; scope text;
begin
  foreach rec in array array[
    'attendance|attendance.view|attendance.mark',
    'student_enrollment|student.view|student.update']
  loop
    parts := string_to_array(rec, '|');
    t := parts[1]; p_read := parts[2]; p_write := parts[3];
    scope := '((select private.has_full_class_scope()) or private.teaches_class_section(class_section_id))';

    execute format('drop policy if exists %I on public.%I;', t || '_read', t);
    execute format('drop policy if exists %I on public.%I;', t || '_write', t);

    execute format($f$create policy %1$I on public.%2$I for select to authenticated
      using ((institution_id = (select private.current_institution_id())
              and (select private.has_permission(%3$L)) and %4$s)
             or (select private.is_platform_admin()));$f$,
      t || '_read', t, p_read, scope);

    execute format($f$create policy %1$I on public.%2$I for all to authenticated
      using ((institution_id = (select private.current_institution_id())
              and (select private.has_permission(%3$L)) and %4$s)
             or (select private.is_platform_admin()))
      with check ((institution_id = (select private.current_institution_id())
              and (select private.has_permission(%3$L)) and %4$s)
             or (select private.is_platform_admin()));$f$,
      t || '_write', t, p_write, scope);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- mark has no class_section_id — it is (exam_subject_id, student_id). The
-- student's active enrollment is what places them in a section, so that is the
-- join. Guarded by the same InitPlan, so this EXISTS is never planned for an
-- admin read.
-- ---------------------------------------------------------------------------
do $$
declare scope text;
begin
  scope := $s$((select private.has_full_class_scope())
               or exists (select 1 from public.student_enrollment se
                          where se.student_id = mark.student_id
                            and se.deleted_at is null
                            and private.teaches_class_section(se.class_section_id)))$s$;

  drop policy if exists mark_read on public.mark;
  drop policy if exists mark_write on public.mark;

  execute format($f$create policy mark_read on public.mark for select to authenticated
    using ((institution_id = (select private.current_institution_id())
            and (select private.has_permission('exam.view')) and %1$s)
           or (select private.is_platform_admin()));$f$, scope);

  execute format($f$create policy mark_write on public.mark for all to authenticated
    using ((institution_id = (select private.current_institution_id())
            and (select private.has_permission('exam.mark_entry')) and %1$s)
           or (select private.is_platform_admin()))
    with check ((institution_id = (select private.current_institution_id())
            and (select private.has_permission('exam.mark_entry')) and %1$s)
           or (select private.is_platform_admin()));$f$, scope);
end $$;

-- The EXISTS above probes student_enrollment by student_id on every mark row a
-- teacher reads. The existing indexes lead with institution_id, so this lookup
-- has no supporting index of its own.
create index if not exists ix_student_enrollment_student_active
  on public.student_enrollment (student_id, class_section_id)
  where deleted_at is null;
