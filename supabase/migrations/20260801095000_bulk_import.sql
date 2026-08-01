-- ============================================================================
-- SRA A-0.5 point 1 — the import framework.
--
-- "Highest ROI single feature in the product." A school onboarding to
-- EduFusionBD must currently type in 800 students by hand through a 31-field
-- form: 40–80 person-hours before it sees any value, which is the #1 barrier
-- to SIS adoption in this market.
--
-- SHAPE. One RPC per entity, taking a jsonb ARRAY of already-validated rows
-- and committing them in a single transaction per batch. The client validates
-- with the screen's own zod schema first (so the operator sees per-row errors
-- before anything is written), and this re-validates the parts only the
-- database can know — does this class exist, is this roll taken, is this
-- student already here.
--
-- WHY NOT ONE ROW PER CALL. 800 students is 800 round trips over a school's
-- connection, and a failure halfway leaves the operator with no idea which
-- half landed. Batched, each call is atomic and returns a per-row result, so
-- "612 imported, 4 rejected, here is why" is a fact rather than a guess.
-- ============================================================================

/**
 * Students.
 *
 * Reuses `private.fn_register_student` rather than re-implementing admission:
 * that function owns the transactional student + enrolment + guardian +
 * address write and the server-side code generation, and a second copy of that
 * logic would drift the first time either changed.
 *
 * Returns one object per input row, in input order, so the client can show the
 * error against the CSV line the operator is looking at.
 */
create or replace function public.fn_import_students(payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  v_inst    uuid;
  v_row     jsonb;
  v_idx     int := 0;
  v_id      uuid;
  v_results jsonb := '[]'::jsonb;
begin
  perform private.require_permission('student.create');
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  if jsonb_typeof(payload->'rows') <> 'array' then
    raise exception 'payload.rows must be an array';
  end if;
  -- A cap the UI also enforces. Unbounded, one paste of a 50k-row sheet locks
  -- the table for everyone else in the school.
  if jsonb_array_length(payload->'rows') > 500 then
    raise exception 'at most 500 rows per batch';
  end if;

  for v_row in select * from jsonb_array_elements(payload->'rows') loop
    v_idx := v_idx + 1;
    begin
      -- Duplicate detection (A-2.1 item 2) — name + DOB + guardian mobile is
      -- the classic SIS data-quality failure, and it is painful to reconcile
      -- once fees and marks have attached to both records.
      if exists (
        select 1
          from public.student s
          left join public.student_guardian sg on sg.student_id = s.id
          left join public.guardian g on g.id = sg.guardian_id
         where s.institution_id = v_inst
           and s.deleted_at is null
           and lower(s.name_en) = lower(coalesce(v_row->>'name_en',''))
           and s.dob = nullif(v_row->>'dob','')::date
           and coalesce(g.mobile,'') = coalesce(v_row->>'guardian_mobile','')
      ) then
        v_results := v_results || jsonb_build_object(
          'row', v_idx, 'ok', false, 'error', 'duplicate: same name, date of birth and guardian mobile');
        continue;
      end if;

      v_id := private.fn_register_student(v_row);
      v_results := v_results || jsonb_build_object('row', v_idx, 'ok', true, 'id', v_id);

    -- One bad row must not roll back the batch. The sub-block is what makes
    -- that true: without it a single cast failure aborts the whole call and
    -- the operator gets nothing, having fixed nothing.
    exception when others then
      v_results := v_results || jsonb_build_object('row', v_idx, 'ok', false, 'error', sqlerrm);
    end;
  end loop;

  return jsonb_build_object(
    'imported', (select count(*) from jsonb_array_elements(v_results) r where (r->>'ok')::boolean),
    'rejected', (select count(*) from jsonb_array_elements(v_results) r where not (r->>'ok')::boolean),
    'results', v_results);
end; $fn$;
revoke all on function public.fn_import_students(jsonb) from public, anon;
grant execute on function public.fn_import_students(jsonb) to authenticated;

/** Teachers. Same shape, same reasoning. */
create or replace function public.fn_import_teachers(payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  v_inst uuid; v_row jsonb; v_idx int := 0; v_id uuid; v_results jsonb := '[]'::jsonb;
begin
  perform private.require_permission('teacher.create');
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  if jsonb_typeof(payload->'rows') <> 'array' then raise exception 'payload.rows must be an array'; end if;
  if jsonb_array_length(payload->'rows') > 500 then raise exception 'at most 500 rows per batch'; end if;

  for v_row in select * from jsonb_array_elements(payload->'rows') loop
    v_idx := v_idx + 1;
    begin
      if exists (
        select 1 from public.teacher t
         where t.institution_id = v_inst and t.deleted_at is null
           and coalesce(t.mobile,'') = coalesce(v_row->>'mobile','')
           and coalesce(v_row->>'mobile','') <> ''
      ) then
        v_results := v_results || jsonb_build_object(
          'row', v_idx, 'ok', false, 'error', 'duplicate: a teacher with this mobile number already exists');
        continue;
      end if;

      v_id := private.fn_register_teacher(v_row);
      v_results := v_results || jsonb_build_object('row', v_idx, 'ok', true, 'id', v_id);
    exception when others then
      v_results := v_results || jsonb_build_object('row', v_idx, 'ok', false, 'error', sqlerrm);
    end;
  end loop;

  return jsonb_build_object(
    'imported', (select count(*) from jsonb_array_elements(v_results) r where (r->>'ok')::boolean),
    'rejected', (select count(*) from jsonb_array_elements(v_results) r where not (r->>'ok')::boolean),
    'results', v_results);
end; $fn$;
revoke all on function public.fn_import_teachers(jsonb) from public, anon;
grant execute on function public.fn_import_teachers(jsonb) to authenticated;

/**
 * Marks (A-5.1 item 5 — "teachers keep marks in Excel; there is no CSV path
 * in or out").
 *
 * Rows carry a roll number, not a student id: that is what a teacher's
 * spreadsheet has. Resolution to a student happens here against the section,
 * so an unmatched roll is a named rejection rather than a silent skip.
 *
 * Marks above full marks are REJECTED, not clamped. A clamped mark is a wrong
 * mark that looks deliberate, and this is the record A-5.1 calls "the most
 * consequential a school holds".
 */
create or replace function public.fn_import_marks(payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  v_inst uuid; v_row jsonb; v_idx int := 0; v_results jsonb := '[]'::jsonb;
  v_exam uuid; v_section uuid; v_subject uuid; v_class uuid;
  v_full numeric; v_student uuid; v_marks numeric; v_entries jsonb := '[]'::jsonb;
begin
  perform private.require_permission('exam.mark_entry');
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  v_exam    := nullif(payload->>'exam_id','')::uuid;
  v_section := nullif(payload->>'class_section_id','')::uuid;
  v_subject := nullif(payload->>'subject_id','')::uuid;
  if v_exam is null or v_section is null or v_subject is null then
    raise exception 'exam, section and subject are required';
  end if;

  select class_id into v_class from public.class_section where id = v_section;

  -- Full marks come from the exam's own configuration, never from the sheet
  -- (A-5.1 item 1). A spreadsheet column saying "100" for a subject configured
  -- at 50 is exactly how a whole section's GPA goes silently wrong.
  select es.full_marks into v_full
    from public.exam_subject es
   where es.exam_id = v_exam and es.subject_id = v_subject and es.class_id = v_class;
  if v_full is null then
    select full_marks into v_full from public.subject where id = v_subject;
  end if;
  v_full := coalesce(v_full, 100);

  for v_row in select * from jsonb_array_elements(payload->'rows') loop
    v_idx := v_idx + 1;

    select se.student_id into v_student
      from public.student_enrollment se
     where se.class_section_id = v_section
       and se.roll_no = nullif(v_row->>'roll_no','')::int
       and se.deleted_at is null
     limit 1;

    if v_student is null then
      v_results := v_results || jsonb_build_object(
        'row', v_idx, 'ok', false, 'error', 'no student with this roll number in the selected section');
      continue;
    end if;

    v_marks := nullif(v_row->>'marks_obtained','')::numeric;
    if coalesce((v_row->>'is_absent')::boolean, false) then
      v_marks := null;
    elsif v_marks is null then
      v_results := v_results || jsonb_build_object('row', v_idx, 'ok', false, 'error', 'marks are missing and the row is not marked absent');
      continue;
    elsif v_marks < 0 or v_marks > v_full then
      v_results := v_results || jsonb_build_object(
        'row', v_idx, 'ok', false, 'error', format('marks must be between 0 and %s', v_full));
      continue;
    end if;

    v_entries := v_entries || jsonb_build_object(
      'student_id', v_student,
      'marks_obtained', coalesce(v_marks::text, ''),
      'is_absent', coalesce((v_row->>'is_absent')::boolean, false));
    v_results := v_results || jsonb_build_object('row', v_idx, 'ok', true, 'student_id', v_student);
  end loop;

  -- All-or-nothing on the WRITE. A partially-imported subject is worse than a
  -- rejected file: the teacher cannot tell which rows landed without checking
  -- 60 of them by hand.
  if jsonb_array_length(v_entries) > 0 then
    perform private.fn_save_marks(jsonb_build_object(
      'exam_id', v_exam, 'class_section_id', v_section, 'subject_id', v_subject,
      'full_marks', v_full::text, 'entries', v_entries));
  end if;

  return jsonb_build_object(
    'imported', jsonb_array_length(v_entries),
    'rejected', (select count(*) from jsonb_array_elements(v_results) r where not (r->>'ok')::boolean),
    'full_marks', v_full,
    'results', v_results);
end; $fn$;
revoke all on function public.fn_import_marks(jsonb) from public, anon;
grant execute on function public.fn_import_marks(jsonb) to authenticated;
