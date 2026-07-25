-- Atomic student registration: student + enrollment + primary guardian + link + addresses.
-- SECURITY DEFINER; tenant resolved from the caller's profile; single transaction (no orphans).
create or replace function public.fn_register_student(payload jsonb) returns uuid
  language plpgsql security definer set search_path = '' as $$
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
    (payload->>'gender')::gender,
    nullif(payload->>'blood_group','')::blood_group,
    nullif(payload->>'religion','')::religion,
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
$$;
revoke execute on function public.fn_register_student(jsonb) from public, anon;
grant execute on function public.fn_register_student(jsonb) to authenticated;
