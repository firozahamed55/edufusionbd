-- Phase 6: Teacher module CRUD + Phase 9 fix for fn_register_student enum casts.
-- Defensive cleanup of any lingering probe.
drop function if exists public._probe_enum();

-- 1) Seed code_sequence past the highest existing code so generated codes never
--    collide with directly-seeded rows (EMP-0001..0003 / STU-xxxx already exist).
insert into public.code_sequence(institution_id, entity, next_val)
select institution_id, 'teacher', max((regexp_replace(employee_code, '\D', '', 'g'))::int)
from public.teacher
where employee_code ~ '\d'
group by institution_id
on conflict (institution_id, entity) do nothing;

insert into public.code_sequence(institution_id, entity, next_val)
select institution_id, 'student', max((regexp_replace(student_code, '\D', '', 'g'))::int)
from public.student
where student_code ~ '\d'
group by institution_id
on conflict (institution_id, entity) do nothing;

-- 2) Transaction-safe teacher registration (mirrors fn_register_student).
create or replace function public.fn_register_teacher(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_inst uuid; v_teacher uuid; v_code text;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  v_code := public.fn_generate_code('teacher');

  insert into public.teacher(
    institution_id, employee_code, name_bn, name_en, dob, gender, blood_group, religion,
    nid, nationality, designation_id, department_id, main_subject_id, joining_date,
    employment_type, email, mobile, alt_mobile, emergency_contact_name,
    emergency_contact_relation, emergency_contact_number, highest_degree, experience_years,
    status, created_by)
  values (
    v_inst, v_code, payload->>'name_bn', payload->>'name_en',
    nullif(payload->>'dob','')::date,
    nullif(payload->>'gender','')::public.gender,
    nullif(payload->>'blood_group','')::public.blood_group,
    nullif(payload->>'religion','')::public.religion,
    nullif(payload->>'nid',''),
    coalesce(nullif(payload->>'nationality',''), 'বাংলাদেশি'),
    nullif(payload->>'designation_id','')::uuid,
    nullif(payload->>'department_id','')::uuid,
    nullif(payload->>'main_subject_id','')::uuid,
    nullif(payload->>'joining_date','')::date,
    nullif(payload->>'employment_type','')::public.employment_type,
    nullif(payload->>'email',''),
    nullif(payload->>'mobile',''),
    nullif(payload->>'alt_mobile',''),
    nullif(payload->>'emergency_contact_name',''),
    nullif(payload->>'emergency_contact_relation',''),
    nullif(payload->>'emergency_contact_number',''),
    nullif(payload->>'highest_degree',''),
    nullif(payload->>'experience_years','')::int,
    'active', (select auth.uid()))
  returning id into v_teacher;

  if nullif(payload->>'present_division_id','') is not null
     or nullif(payload->>'present_village','') is not null then
    insert into public.teacher_address(teacher_id, type, division_id, district_id, upazila_id, village, house_road)
    values (v_teacher, 'present',
      nullif(payload->>'present_division_id','')::uuid, nullif(payload->>'present_district_id','')::uuid,
      nullif(payload->>'present_upazila_id','')::uuid, nullif(payload->>'present_village',''),
      nullif(payload->>'present_house_road',''));
  end if;

  if nullif(payload->>'permanent_division_id','') is not null
     or nullif(payload->>'permanent_village','') is not null then
    insert into public.teacher_address(teacher_id, type, division_id, district_id, upazila_id, village, house_road)
    values (v_teacher, 'permanent',
      nullif(payload->>'permanent_division_id','')::uuid, nullif(payload->>'permanent_district_id','')::uuid,
      nullif(payload->>'permanent_upazila_id','')::uuid, nullif(payload->>'permanent_village',''),
      nullif(payload->>'permanent_house_road',''));
  end if;

  return v_teacher;
end;
$function$;

-- 3) Transaction-safe teacher update (institution-guarded, addresses replaced by type).
create or replace function public.fn_update_teacher(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_inst uuid; v_teacher uuid; v_owner uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  v_teacher := nullif(payload->>'id','')::uuid;
  if v_teacher is null then raise exception 'teacher id required'; end if;

  select institution_id into v_owner from public.teacher where id = v_teacher and deleted_at is null;
  if v_owner is null or v_owner <> v_inst then raise exception 'teacher not found in institution'; end if;

  update public.teacher set
    name_bn = coalesce(nullif(payload->>'name_bn',''), name_bn),
    name_en = coalesce(nullif(payload->>'name_en',''), name_en),
    dob = nullif(payload->>'dob','')::date,
    gender = nullif(payload->>'gender','')::public.gender,
    blood_group = nullif(payload->>'blood_group','')::public.blood_group,
    religion = nullif(payload->>'religion','')::public.religion,
    nid = nullif(payload->>'nid',''),
    nationality = coalesce(nullif(payload->>'nationality',''), nationality),
    designation_id = nullif(payload->>'designation_id','')::uuid,
    department_id = nullif(payload->>'department_id','')::uuid,
    main_subject_id = nullif(payload->>'main_subject_id','')::uuid,
    joining_date = nullif(payload->>'joining_date','')::date,
    employment_type = nullif(payload->>'employment_type','')::public.employment_type,
    email = nullif(payload->>'email',''),
    mobile = nullif(payload->>'mobile',''),
    alt_mobile = nullif(payload->>'alt_mobile',''),
    emergency_contact_name = nullif(payload->>'emergency_contact_name',''),
    emergency_contact_relation = nullif(payload->>'emergency_contact_relation',''),
    emergency_contact_number = nullif(payload->>'emergency_contact_number',''),
    highest_degree = nullif(payload->>'highest_degree',''),
    experience_years = nullif(payload->>'experience_years','')::int,
    updated_by = (select auth.uid()),
    updated_at = now()
  where id = v_teacher;

  if payload ? 'present_division_id' or payload ? 'present_village' then
    delete from public.teacher_address where teacher_id = v_teacher and type = 'present';
    if nullif(payload->>'present_division_id','') is not null or nullif(payload->>'present_village','') is not null then
      insert into public.teacher_address(teacher_id, type, division_id, district_id, upazila_id, village, house_road)
      values (v_teacher, 'present',
        nullif(payload->>'present_division_id','')::uuid, nullif(payload->>'present_district_id','')::uuid,
        nullif(payload->>'present_upazila_id','')::uuid, nullif(payload->>'present_village',''),
        nullif(payload->>'present_house_road',''));
    end if;
  end if;

  if payload ? 'permanent_division_id' or payload ? 'permanent_village' then
    delete from public.teacher_address where teacher_id = v_teacher and type = 'permanent';
    if nullif(payload->>'permanent_division_id','') is not null or nullif(payload->>'permanent_village','') is not null then
      insert into public.teacher_address(teacher_id, type, division_id, district_id, upazila_id, village, house_road)
      values (v_teacher, 'permanent',
        nullif(payload->>'permanent_division_id','')::uuid, nullif(payload->>'permanent_district_id','')::uuid,
        nullif(payload->>'permanent_upazila_id','')::uuid, nullif(payload->>'permanent_village',''),
        nullif(payload->>'permanent_house_road',''));
    end if;
  end if;

  return v_teacher;
end;
$function$;

-- 4) Fix fn_register_student: schema-qualify enum casts so it works under search_path=''.
create or replace function public.fn_register_student(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_inst uuid; v_student uuid; v_code text; v_guardian uuid; v_enrollment uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  v_code := public.fn_generate_code('student');

  insert into public.student(
    institution_id, student_code, name_bn, name_en, dob, gender, blood_group, religion,
    birth_reg_no, nationality, student_category_id, admission_date, status, created_by)
  values (
    v_inst, v_code, payload->>'name_bn', payload->>'name_en', (payload->>'dob')::date,
    (payload->>'gender')::public.gender,
    nullif(payload->>'blood_group','')::public.blood_group,
    nullif(payload->>'religion','')::public.religion,
    nullif(payload->>'birth_reg_no',''),
    coalesce(nullif(payload->>'nationality',''), 'বাংলাদেশি'),
    nullif(payload->>'student_category_id','')::uuid,
    coalesce(nullif(payload->>'admission_date','')::date, current_date),
    'active', (select auth.uid()))
  returning id into v_student;

  if nullif(payload->>'class_section_id','') is not null
     and nullif(payload->>'academic_year_id','') is not null then
    insert into public.student_enrollment(
      institution_id, student_id, academic_year_id, class_section_id, roll_no, status)
    values (
      v_inst, v_student, (payload->>'academic_year_id')::uuid, (payload->>'class_section_id')::uuid,
      nullif(payload->>'roll_no','')::int, 'active')
    returning id into v_enrollment;
    update public.student set current_enrollment_id = v_enrollment where id = v_student;
  end if;

  if nullif(payload->>'guardian_name','') is not null
     or nullif(payload->>'guardian_mobile','') is not null
     or nullif(payload->>'father_name','') is not null then
    insert into public.guardian(institution_id, name, nid, occupation, mobile, monthly_income)
    values (
      v_inst,
      coalesce(nullif(payload->>'guardian_name',''), nullif(payload->>'father_name',''), 'Guardian'),
      nullif(payload->>'guardian_nid',''),
      nullif(payload->>'father_occupation',''),
      nullif(payload->>'guardian_mobile',''),
      nullif(payload->>'monthly_income','')::numeric)
    returning id into v_guardian;
    insert into public.student_guardian(student_id, guardian_id, relationship, is_primary_contact)
    values (v_student, v_guardian, coalesce(nullif(payload->>'relationship',''), 'father'), true);
  end if;

  if nullif(payload->>'present_division_id','') is not null
     or nullif(payload->>'present_village','') is not null then
    insert into public.student_address(student_id, type, division_id, district_id, upazila_id, village, house_road)
    values (v_student, 'present',
      nullif(payload->>'present_division_id','')::uuid, nullif(payload->>'present_district_id','')::uuid,
      nullif(payload->>'present_upazila_id','')::uuid, nullif(payload->>'present_village',''),
      nullif(payload->>'present_house_road',''));
  end if;

  if nullif(payload->>'permanent_division_id','') is not null
     or nullif(payload->>'permanent_village','') is not null then
    insert into public.student_address(student_id, type, division_id, district_id, upazila_id, village, house_road)
    values (v_student, 'permanent',
      nullif(payload->>'permanent_division_id','')::uuid, nullif(payload->>'permanent_district_id','')::uuid,
      nullif(payload->>'permanent_upazila_id','')::uuid, nullif(payload->>'permanent_village',''),
      nullif(payload->>'permanent_house_road',''));
  end if;

  return v_student;
end;
$function$;

grant execute on function public.fn_register_teacher(jsonb) to authenticated, service_role;
grant execute on function public.fn_update_teacher(jsonb) to authenticated, service_role;
