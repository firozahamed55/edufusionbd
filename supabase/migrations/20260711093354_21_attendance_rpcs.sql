-- Phase 6 Attendance: mark (daily/exam) + summary (report + analytics).

-- 1) Mark/replace attendance for a set of students. exam_key is NULL for daily,
--    so upsert uses "is not distinct from" (NULL-safe) — insert-after-delete.
create or replace function public.fn_mark_attendance(payload jsonb)
returns int language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_cs uuid; v_date date; v_ctx public.attendance_context; v_exam uuid; v_key uuid; v_item jsonb; v_cnt int := 0; v_sms bool;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  v_cs := nullif(payload->>'class_section_id','')::uuid;
  v_date := nullif(payload->>'att_date','')::date;
  v_ctx := coalesce(nullif(payload->>'context','')::public.attendance_context, 'daily');
  v_exam := nullif(payload->>'exam_id','')::uuid;
  v_sms := coalesce((payload->>'sms')::boolean, false);
  if v_cs is null or v_date is null then raise exception 'section and date required'; end if;
  v_key := case when v_ctx = 'exam' then v_exam else null end;

  for v_item in select value from jsonb_array_elements(payload->'entries') loop
    delete from public.attendance
      where student_id = (v_item->>'student_id')::uuid and att_date = v_date and context = v_ctx
        and exam_key is not distinct from v_key and institution_id = v_inst;
    insert into public.attendance(institution_id, student_id, class_section_id, att_date, context, exam_id, exam_key, status, marked_by, guardian_sms_sent)
    values (v_inst, (v_item->>'student_id')::uuid, v_cs, v_date, v_ctx, v_exam, v_key,
      (v_item->>'status')::public.attendance_status, (select auth.uid()), v_sms);
    v_cnt := v_cnt + 1;
  end loop;
  return v_cnt;
end; $fn$;

-- 2) Attendance summary for a date range (section or whole institution when
--    p_class_section_id is null). Powers both Report and Analytics screens.
create or replace function public.fn_attendance_summary(p_class_section_id uuid, p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_wd int; v_result jsonb;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

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
    select r.student_code, r.roll_no, r.name_bn, r.name_en,
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
    'students', (select coalesce(jsonb_agg(jsonb_build_object('code',student_code,'roll',roll_no,'name_bn',name_bn,'name_en',name_en,'present',attended,'total',v_wd,'rate',rate) order by roll_no), '[]'::jsonb) from per),
    'at_risk', (select coalesce(jsonb_agg(jsonb_build_object('code',student_code,'roll',roll_no,'name_bn',name_bn,'name_en',name_en,'rate',rate,'absent',absent_ct) order by rate asc), '[]'::jsonb) from per where rate < 75)
  ) into v_result;
  return v_result;
end; $fn$;

revoke execute on function public.fn_mark_attendance(jsonb) from public, anon;
revoke execute on function public.fn_attendance_summary(uuid, date, date) from public, anon;
grant execute on function public.fn_mark_attendance(jsonb) to authenticated, service_role;
grant execute on function public.fn_attendance_summary(uuid, date, date) to authenticated, service_role;
