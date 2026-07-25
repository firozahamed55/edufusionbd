-- Phase 6 Exam: exam CRUD, mark entry, config save. (fn_process_exam_result exists.)

-- 1) Create/update an exam.
create or replace function public.fn_upsert_exam(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_id uuid; v_year uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  v_id := nullif(payload->>'id','')::uuid;
  v_year := coalesce(nullif(payload->>'academic_year_id','')::uuid,
    (select id from public.academic_year where institution_id=v_inst and is_current and deleted_at is null limit 1));

  if v_id is null then
    insert into public.exam(institution_id, name, academic_year_id, type, grade_scheme_id, start_date, end_date, status)
    values (v_inst, coalesce(nullif(payload->>'name',''),'Untitled Exam'), v_year,
      nullif(payload->>'type',''), nullif(payload->>'grade_scheme_id','')::uuid,
      nullif(payload->>'start_date','')::date, nullif(payload->>'end_date','')::date,
      coalesce(nullif(payload->>'status',''),'setup'))
    returning id into v_id;
  else
    update public.exam set
      name = coalesce(nullif(payload->>'name',''), name),
      type = coalesce(nullif(payload->>'type',''), type),
      grade_scheme_id = coalesce(nullif(payload->>'grade_scheme_id','')::uuid, grade_scheme_id),
      start_date = nullif(payload->>'start_date','')::date,
      end_date = nullif(payload->>'end_date','')::date,
      status = coalesce(nullif(payload->>'status',''), status),
      updated_at = now()
    where id = v_id and institution_id = v_inst;
  end if;
  return v_id;
end; $fn$;

-- 2) Save marks for an exam+section+subject (ensures the exam_subject, upserts marks).
create or replace function public.fn_save_marks(payload jsonb)
returns int language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_exam uuid; v_cs uuid; v_class uuid; v_subject uuid; v_full numeric; v_pass numeric; v_es uuid; v_item jsonb; v_cnt int := 0; v_status text;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  v_exam := nullif(payload->>'exam_id','')::uuid;
  v_cs := nullif(payload->>'class_section_id','')::uuid;
  v_subject := nullif(payload->>'subject_id','')::uuid;
  if v_exam is null or v_cs is null or v_subject is null then raise exception 'exam, section and subject required'; end if;
  v_status := coalesce(nullif(payload->>'status',''), 'submitted');

  select class_id into v_class from public.class_section where id = v_cs;
  if v_class is null then raise exception 'invalid section'; end if;
  v_full := coalesce(nullif(payload->>'full_marks','')::numeric,
    (select full_marks from public.subject where id = v_subject), 100);
  v_pass := coalesce(nullif(payload->>'pass_marks','')::numeric,
    (select pass_marks from public.subject where id = v_subject), 33);

  select id into v_es from public.exam_subject where exam_id = v_exam and class_id = v_class and subject_id = v_subject;
  if v_es is null then
    insert into public.exam_subject(exam_id, class_id, subject_id, full_marks, pass_marks)
    values (v_exam, v_class, v_subject, v_full, v_pass) returning id into v_es;
  else
    update public.exam_subject set full_marks = v_full, pass_marks = v_pass where id = v_es;
  end if;

  for v_item in select value from jsonb_array_elements(payload->'entries') loop
    insert into public.mark(institution_id, exam_subject_id, student_id, marks_obtained, is_absent, entered_by, status)
    values (v_inst, v_es, (v_item->>'student_id')::uuid,
      nullif(v_item->>'marks_obtained','')::numeric, coalesce((v_item->>'is_absent')::boolean, false),
      (select auth.uid()), v_status)
    on conflict (exam_subject_id, student_id) do update
      set marks_obtained = excluded.marks_obtained, is_absent = excluded.is_absent,
          entered_by = excluded.entered_by, status = excluded.status, updated_at = now();
    v_cnt := v_cnt + 1;
  end loop;
  return v_cnt;
end; $fn$;

-- 3) Save a jsonb exam-config singleton (kind: mark | comment | marksheet | date).
create or replace function public.fn_save_exam_config(p_kind text, payload jsonb)
returns void language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_tbl text; v_found uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  v_tbl := case p_kind
    when 'mark' then 'mark_config' when 'comment' then 'comment_config'
    when 'marksheet' then 'marksheet_config' when 'date' then 'exam_date_config'
    else null end;
  if v_tbl is null then raise exception 'invalid config kind %', p_kind; end if;

  execute format('select id from public.%I where institution_id = $1 limit 1', v_tbl) into v_found using v_inst;
  if v_found is null then
    execute format('insert into public.%I(institution_id, config) values ($1, $2)', v_tbl) using v_inst, payload;
  else
    execute format('update public.%I set config = $2 where id = $1', v_tbl) using v_found, payload;
  end if;
end; $fn$;

revoke execute on function public.fn_upsert_exam(jsonb) from public, anon;
revoke execute on function public.fn_save_marks(jsonb) from public, anon;
revoke execute on function public.fn_save_exam_config(text, jsonb) from public, anon;
grant execute on function public.fn_upsert_exam(jsonb) to authenticated, service_role;
grant execute on function public.fn_save_marks(jsonb) to authenticated, service_role;
grant execute on function public.fn_save_exam_config(text, jsonb) to authenticated, service_role;
