-- ============================================================================
-- SRA A-4 item 9 — "no per-student drill-down" on the attendance Report and
-- Analytics screens.
--
-- The summary already returns a row per student; it returns no way to ADDRESS
-- that student. `student_code` is a display string (nullable, and null for
-- anyone registered before codes were minted), so the screens could render a
-- roster they could not link out of.
--
-- Body only. The permission guard installed by 20260726044457 moved this
-- function to `private` and left a `public` wrapper that checks
-- `attendance.view`; the wrapper is untouched and still the only entry point.
-- Signature, arguments and every existing key of the result are unchanged, so
-- this is additive to callers.
-- ============================================================================

create or replace function private.fn_attendance_summary(p_class_section_id uuid, p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_wd int; v_result jsonb;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  -- A null section means the WHOLE institution, and always has. The client
  -- refused to send null (see attendance/logic/api.ts), which is why the
  -- Analytics screen's "All classes & sections" option could never load.
  select count(distinct att_date) into v_wd from public.attendance
    where institution_id = v_inst and context = 'daily' and att_date between p_from and p_to
      and (p_class_section_id is null or class_section_id = p_class_section_id);

  with roster as (
    select distinct se.student_id, s.name_bn, s.name_en, s.student_code, se.roll_no
    from public.student_enrollment se
    join public.student s on s.id = se.student_id and s.deleted_at is null
    where se.status = 'active' and se.deleted_at is null and se.institution_id = v_inst
      and (p_class_section_id is null or se.class_section_id = p_class_section_id)
  ),
  att as (
    select a.student_id,
      count(*) filter (where a.status = 'present') p,
      count(*) filter (where a.status = 'late') l,
      count(*) filter (where a.status = 'absent') ab,
      count(*) filter (where a.status = 'leave') lv,
      count(*) filter (where a.status = 'exam_absent') ea
    from public.attendance a
    where a.institution_id = v_inst and a.context = 'daily' and a.att_date between p_from and p_to
      and (p_class_section_id is null or a.class_section_id = p_class_section_id)
    group by a.student_id
  ),
  per as (
    select r.student_id, r.student_code, r.roll_no, r.name_bn, r.name_en,
      coalesce(a.p,0) + coalesce(a.l,0) attended, coalesce(a.ab,0) absent_ct,
      case when v_wd > 0 then round((coalesce(a.p,0) + coalesce(a.l,0))::numeric / v_wd * 100, 0) else 0 end rate
    from roster r left join att a on a.student_id = r.student_id
  )
  select jsonb_build_object(
    'working_days', v_wd,
    'total_students', (select count(*) from roster),
    'avg_rate', (select coalesce(round(avg(rate),0),0) from per),
    'regular_count', (select count(*) from per where rate >= 90),
    'at_risk_count', (select count(*) from per where rate < 75),
    'status_split', (select jsonb_build_object(
        'present', coalesce(sum(p),0), 'late', coalesce(sum(l),0),
        'absent', coalesce(sum(ab),0), 'leave', coalesce(sum(lv),0), 'exam_absent', coalesce(sum(ea),0)) from att),
    'students', (select coalesce(jsonb_agg(jsonb_build_object('student_id',student_id,'code',student_code,'roll',roll_no,'name_bn',name_bn,'name_en',name_en,'present',attended,'total',v_wd,'rate',rate) order by roll_no), '[]'::jsonb) from per),
    'at_risk', (select coalesce(jsonb_agg(jsonb_build_object('student_id',student_id,'code',student_code,'roll',roll_no,'name_bn',name_bn,'name_en',name_en,'rate',rate,'absent',absent_ct) order by rate asc), '[]'::jsonb) from per where rate < 75)
  ) into v_result;
  return v_result;
end; $fn$;
