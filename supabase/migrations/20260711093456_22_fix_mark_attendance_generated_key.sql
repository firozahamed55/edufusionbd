-- attendance.exam_key is GENERATED (coalesce(exam_id, nil-uuid)); never insert it.
-- Match existing rows on exam_id (NULL-safe) instead of the generated key.
create or replace function public.fn_mark_attendance(payload jsonb)
returns int language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_cs uuid; v_date date; v_ctx public.attendance_context; v_exam uuid; v_item jsonb; v_cnt int := 0; v_sms bool;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  v_cs := nullif(payload->>'class_section_id','')::uuid;
  v_date := nullif(payload->>'att_date','')::date;
  v_ctx := coalesce(nullif(payload->>'context','')::public.attendance_context, 'daily');
  v_exam := nullif(payload->>'exam_id','')::uuid;
  v_sms := coalesce((payload->>'sms')::boolean, false);
  if v_cs is null or v_date is null then raise exception 'section and date required'; end if;

  for v_item in select value from jsonb_array_elements(payload->'entries') loop
    delete from public.attendance
      where student_id = (v_item->>'student_id')::uuid and att_date = v_date and context = v_ctx
        and exam_id is not distinct from v_exam and institution_id = v_inst;
    insert into public.attendance(institution_id, student_id, class_section_id, att_date, context, exam_id, status, marked_by, guardian_sms_sent)
    values (v_inst, (v_item->>'student_id')::uuid, v_cs, v_date, v_ctx, v_exam,
      (v_item->>'status')::public.attendance_status, (select auth.uid()), v_sms);
    v_cnt := v_cnt + 1;
  end loop;
  return v_cnt;
end; $fn$;
revoke execute on function public.fn_mark_attendance(jsonb) from public, anon;
grant execute on function public.fn_mark_attendance(jsonb) to authenticated, service_role;
