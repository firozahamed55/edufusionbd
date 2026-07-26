-- ============================================================================
-- Phase 1.3 (A-M16) — the server side of academic-year scoping.
--
-- `fn_unpaid_by_institute` already matched an invoice to its enrolment's year
-- (`fi.academic_year_id = se.academic_year_id`), but it selected from
-- `class_section` with no year filter at all. `class_section` rows are per-year,
-- so from year two the institute-wide unpaid report would list "Class 6 — ক"
-- once per academic year and add the rows together. No error, no visual cue,
-- and the number it produces is the school's total outstanding debt.
--
-- `v_year is null` keeps the old behaviour if an institution has not marked a
-- current year yet, rather than silently reporting zero due.
-- ============================================================================
create or replace function private.fn_unpaid_by_institute() returns jsonb
 language plpgsql security definer set search_path = '' as $function$
declare v_inst uuid; v_year uuid; v_result jsonb;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  select id into v_year from public.academic_year
   where institution_id = v_inst and is_current and deleted_at is null;

  with r as (
    select c.numeric_level, c.name_bn cls_bn, c.name_en cls_en, sec.name sec_name,
      count(distinct se.student_id) total_students,
      count(distinct case when coalesce(fi.due_amount,0) > 0 then fi.student_id end) due_students,
      coalesce(sum(case when coalesce(fi.due_amount,0) > 0 then fi.due_amount else 0 end), 0) due_amount
    from public.class_section cs
    join public.class c on c.id = cs.class_id and c.institution_id = v_inst
    left join public.section sec on sec.id = cs.section_id
    join public.student_enrollment se on se.class_section_id = cs.id and se.deleted_at is null and se.status = 'active'
    left join public.fee_invoice fi on fi.student_id = se.student_id and fi.academic_year_id = se.academic_year_id and fi.deleted_at is null
    where cs.deleted_at is null
      and (v_year is null or cs.academic_year_id = v_year)
    group by c.numeric_level, c.name_bn, c.name_en, sec.name
  )
  select jsonb_build_object(
    'rows', coalesce(jsonb_agg(to_jsonb(r) order by r.numeric_level), '[]'::jsonb),
    'total_students', (select coalesce(sum(total_students),0) from r),
    'due_students', (select coalesce(sum(due_students),0) from r),
    'total_due', (select coalesce(sum(due_amount),0) from r)
  ) into v_result from r;
  return v_result;
end; $function$;
revoke all on function private.fn_unpaid_by_institute() from authenticated, anon, public;
