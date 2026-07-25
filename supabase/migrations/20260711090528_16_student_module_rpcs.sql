-- Phase 6 Student module: basic update, transactional migration + pushback, report summary.

-- 1) Update basic student info (institution-guarded, single table).
create or replace function public.fn_update_student_basic(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_id uuid; v_owner uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  v_id := nullif(payload->>'id','')::uuid;
  if v_id is null then raise exception 'student id required'; end if;
  select institution_id into v_owner from public.student where id=v_id and deleted_at is null;
  if v_owner is null or v_owner <> v_inst then raise exception 'student not found in institution'; end if;

  update public.student set
    name_bn = coalesce(nullif(payload->>'name_bn',''), name_bn),
    name_en = coalesce(nullif(payload->>'name_en',''), name_en),
    dob = coalesce(nullif(payload->>'dob','')::date, dob),
    gender = coalesce(nullif(payload->>'gender','')::public.gender, gender),
    blood_group = nullif(payload->>'blood_group','')::public.blood_group,
    religion = nullif(payload->>'religion','')::public.religion,
    birth_reg_no = nullif(payload->>'birth_reg_no',''),
    nationality = coalesce(nullif(payload->>'nationality',''), nationality),
    student_category_id = nullif(payload->>'student_category_id','')::uuid,
    updated_by = (select auth.uid()), updated_at = now()
  where id = v_id;
  return v_id;
end; $fn$;

-- 2) Run a migration batch (merit / no-merit). Retires each source enrollment
--    (soft-delete) BEFORE creating the target so the (student, year) unique index
--    stays satisfied; assigns target rolls past the section's current max.
create or replace function public.fn_run_migration(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare
  v_inst uuid; v_batch uuid; v_year uuid; v_src uuid; v_tgt uuid; v_type text;
  v_item jsonb; v_ord int := 0; v_base_roll int;
  v_student uuid; v_src_enr uuid; v_target_enr uuid; v_old_roll int;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  v_year := nullif(payload->>'academic_year_id','')::uuid;
  v_src  := nullif(payload->>'source_class_section_id','')::uuid;
  v_tgt  := nullif(payload->>'target_class_section_id','')::uuid;
  v_type := coalesce(nullif(payload->>'type',''), 'merit');
  if v_year is null or v_tgt is null then raise exception 'academic_year and target section required'; end if;
  if payload->'students' is null or jsonb_array_length(payload->'students') = 0 then
    raise exception 'no students selected'; end if;

  select coalesce(max(roll_no), 0) into v_base_roll
    from public.student_enrollment where class_section_id = v_tgt and deleted_at is null;

  insert into public.migration_batch(
    institution_id, academic_year_id, source_class_section_id, target_class_section_id, type, status, created_by)
  values (v_inst, v_year, v_src, v_tgt, v_type, 'completed', (select auth.uid()))
  returning id into v_batch;

  for v_item in select value from jsonb_array_elements(payload->'students') loop
    v_ord := v_ord + 1;
    v_student := nullif(v_item->>'student_id','')::uuid;
    v_src_enr := nullif(v_item->>'source_enrollment_id','')::uuid;
    select roll_no into v_old_roll from public.student_enrollment where id = v_src_enr;

    if v_src_enr is not null then
      update public.student_enrollment set status='promoted', deleted_at=now()
        where id = v_src_enr and institution_id = v_inst;
    end if;

    insert into public.student_enrollment(
      institution_id, student_id, academic_year_id, class_section_id, roll_no, status, promoted_from_id)
    values (v_inst, v_student, v_year, v_tgt, v_base_roll + v_ord, 'active', v_src_enr)
    returning id into v_target_enr;

    update public.student set current_enrollment_id = v_target_enr,
      updated_by=(select auth.uid()), updated_at=now()
      where id = v_student and institution_id = v_inst;

    insert into public.migration_student(
      migration_batch_id, student_id, source_enrollment_id, target_enrollment_id, old_roll, new_roll, merit_rank, result)
    values (v_batch, v_student, v_src_enr, v_target_enr, v_old_roll, v_base_roll + v_ord,
      nullif(v_item->>'merit_rank','')::int, nullif(v_item->>'result',''));
  end loop;

  return v_batch;
end; $fn$;

-- 3) Reverse a migration batch. Retires target BEFORE restoring source so the
--    (student, year) unique index never sees two live rows.
create or replace function public.fn_pushback_migration(p_batch_id uuid)
returns int language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_owner uuid; v_rec record; v_count int := 0;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  select institution_id into v_owner from public.migration_batch where id = p_batch_id;
  if v_owner is null or v_owner <> v_inst then raise exception 'batch not found in institution'; end if;

  for v_rec in select * from public.migration_student where migration_batch_id = p_batch_id loop
    if v_rec.target_enrollment_id is not null then
      update public.student_enrollment set status='inactive', deleted_at=now()
        where id = v_rec.target_enrollment_id and institution_id = v_inst;
    end if;
    if v_rec.source_enrollment_id is not null then
      update public.student_enrollment set status='active', deleted_at=null
        where id = v_rec.source_enrollment_id and institution_id = v_inst;
    end if;
    update public.student set current_enrollment_id = v_rec.source_enrollment_id,
      updated_by=(select auth.uid()), updated_at=now()
      where id = v_rec.student_id and institution_id = v_inst;
    v_count := v_count + 1;
  end loop;

  update public.migration_batch set status='reversed' where id = p_batch_id;
  return v_count;
end; $fn$;

-- 4) Aggregated student report summary (server-side, RLS-scoped) for the report screen.
create or replace function public.fn_student_report_summary(p_academic_year_id uuid default null)
returns jsonb language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_year uuid; v_result jsonb;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  v_year := coalesce(p_academic_year_id,
    (select id from public.academic_year where institution_id=v_inst and is_current and deleted_at is null limit 1));

  with enr as (
    select se.id as enrollment_id, s.id as student_id, s.gender, s.religion, s.dob,
           cs.id as class_section_id, c.name_bn, c.name_en, c.numeric_level
    from public.student_enrollment se
    join public.student s on s.id = se.student_id and s.deleted_at is null
    join public.class_section cs on cs.id = se.class_section_id
    join public.class c on c.id = cs.class_id
    where se.institution_id = v_inst and se.deleted_at is null and se.status = 'active'
      and (v_year is null or se.academic_year_id = v_year)
  )
  select jsonb_build_object(
    'academic_year_id', v_year,
    'total', (select count(*) from enr),
    'boys',  (select count(*) from enr where gender='male'),
    'girls', (select count(*) from enr where gender='female'),
    'status', (
      select coalesce(jsonb_object_agg(status, cnt), '{}'::jsonb) from (
        select s.status, count(*) cnt from public.student s
        where s.institution_id=v_inst and s.deleted_at is null group by s.status
      ) x
    ),
    'by_class', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.numeric_level), '[]'::jsonb) from (
        select numeric_level, name_bn, name_en,
               count(*) total,
               count(*) filter (where gender='male') boys,
               count(*) filter (where gender='female') girls,
               count(distinct class_section_id) sections
        from enr group by numeric_level, name_bn, name_en
      ) t
    ),
    'by_religion', (
      select coalesce(jsonb_object_agg(coalesce(religion::text,'unknown'), cnt), '{}'::jsonb) from (
        select religion, count(*) cnt from enr group by religion
      ) x
    ),
    'by_age', (
      select coalesce(jsonb_object_agg(bucket, cnt), '{}'::jsonb) from (
        select case
          when age_years between 5 and 8 then '5-8'
          when age_years between 9 and 11 then '9-11'
          when age_years between 12 and 14 then '12-14'
          when age_years between 15 and 17 then '15-17'
          else 'other' end as bucket, count(*) cnt
        from (select date_part('year', age(dob))::int as age_years from enr) a
        group by bucket
      ) x
    )
  ) into v_result;

  return v_result;
end; $fn$;

revoke execute on function public.fn_update_student_basic(jsonb) from public, anon;
revoke execute on function public.fn_run_migration(jsonb) from public, anon;
revoke execute on function public.fn_pushback_migration(uuid) from public, anon;
revoke execute on function public.fn_student_report_summary(uuid) from public, anon;
grant execute on function public.fn_update_student_basic(jsonb) to authenticated, service_role;
grant execute on function public.fn_run_migration(jsonb) to authenticated, service_role;
grant execute on function public.fn_pushback_migration(uuid) to authenticated, service_role;
grant execute on function public.fn_student_report_summary(uuid) to authenticated, service_role;
