-- Filters on the enrolment report (analysis II · R-5).
--
-- `fn_student_report_summary` took an academic year and nothing else, so the
-- one report in the product answered exactly one question — "the whole
-- institution" — and a user could not ask "girls in Class Five". The Teacher
-- Directory has implemented filter → URL → paginate → export since Phase 2;
-- Reports implemented none of it.
--
-- Three things change:
--
--  1. A `p_filters` jsonb argument. jsonb rather than eight positional
--     arguments because this list will grow, and every growth of a positional
--     signature is a new overload plus a deployment ordering problem — the
--     failure `466cec2` has just finished cleaning up.
--
--  2. The status breakdown is computed over the REPORTED POPULATION instead of
--     over `public.student` unscoped. That was defensible while the report was
--     always institution-wide; the moment a filter exists it is a figure
--     describing a different population sitting inside a filtered report,
--     which is the most expensive kind of wrong number.
--
--  3. The payload echoes back `filters_applied`. Provenance (R-9) has to come
--     from what the function actually applied, not from what the client
--     believes it sent — a printed report that states its own filters is only
--     citable if the statement and the query cannot drift.
--
-- The signature keeps its default, so every existing caller is unchanged.

create or replace function private.fn_student_report_summary(
  p_academic_year_id uuid default null,
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_inst uuid;
  v_year uuid;
  v_result jsonb;
  v_class uuid;
  v_section uuid;
  v_shift uuid;
  v_gender text;
  v_religion text;
  v_status text;
  v_from date;
  v_to date;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  v_year := coalesce(p_academic_year_id,
    (select id from public.academic_year where institution_id=v_inst and is_current and deleted_at is null limit 1));

  -- nullif('') so an unset <select> (which posts "") reads as "no filter"
  -- rather than as a filter matching nothing.
  v_class    := nullif(p_filters->>'class_id', '')::uuid;
  v_section  := nullif(p_filters->>'class_section_id', '')::uuid;
  v_shift    := nullif(p_filters->>'shift_id', '')::uuid;
  v_gender   := nullif(p_filters->>'gender', '');
  v_religion := nullif(p_filters->>'religion', '');
  -- Enrolment status. Defaults to 'active' — the population the report has
  -- always described — and 'all' is the explicit opt-out.
  v_status   := coalesce(nullif(p_filters->>'enrollment_status', ''), 'active');
  v_from     := nullif(p_filters->>'admitted_from', '')::date;
  v_to       := nullif(p_filters->>'admitted_to', '')::date;

  with enr as (
    select se.id as enrollment_id, s.id as student_id, s.gender, s.religion, s.dob,
           s.status as student_status,
           coalesce((s.metadata->>'dob_missing')::boolean, false) as dob_missing,
           coalesce((s.metadata->>'dob_synthetic')::boolean, false) as dob_synthetic,
           cs.id as class_section_id, c.name_bn, c.name_en, c.numeric_level
    from public.student_enrollment se
    join public.student s on s.id = se.student_id and s.deleted_at is null
    join public.class_section cs on cs.id = se.class_section_id
    join public.class c on c.id = cs.class_id
    where se.institution_id = v_inst and se.deleted_at is null
      and (v_status = 'all' or se.status = v_status)
      and (v_year is null or se.academic_year_id = v_year)
      and (v_class    is null or cs.class_id   = v_class)
      and (v_section  is null or cs.id         = v_section)
      and (v_shift    is null or cs.shift_id   = v_shift)
      and (v_gender   is null or s.gender::text = v_gender)
      and (v_religion is null or s.religion::text = v_religion)
      and (v_from is null or s.admission_date >= v_from)
      and (v_to   is null or s.admission_date <= v_to)
  )
  select jsonb_build_object(
    'academic_year_id', v_year,
    -- What was actually applied, for the provenance line (R-9).
    'filters_applied', jsonb_strip_nulls(jsonb_build_object(
      'class_id', v_class, 'class_section_id', v_section, 'shift_id', v_shift,
      'gender', v_gender, 'religion', v_religion, 'enrollment_status', v_status,
      'admitted_from', v_from, 'admitted_to', v_to
    )),
    'total', (select count(*) from enr),
    'boys',  (select count(*) from enr where gender='male'),
    'girls', (select count(*) from enr where gender='female'),
    -- Over the reported population, not over the institution (see header note 2).
    'status', (
      select coalesce(jsonb_object_agg(student_status, cnt), '{}'::jsonb) from (
        select student_status, count(distinct student_id) cnt from enr group by student_status
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
    'by_class_religion', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.numeric_level), '[]'::jsonb) from (
        select numeric_level, name_bn, name_en,
               count(*) filter (where religion = 'islam')     as islam,
               count(*) filter (where religion = 'hindu')     as hindu,
               count(*) filter (where religion = 'christian') as christian,
               count(*) filter (where religion = 'buddhist')  as buddhist,
               count(*) filter (where religion = 'other')     as other,
               count(*) filter (where religion is null)       as not_recorded,
               count(*) as total
        from enr group by numeric_level, name_bn, name_en
      ) t
    ),
    'by_religion', (
      select coalesce(jsonb_object_agg(religion::text, cnt), '{}'::jsonb) from (
        select religion, count(*) cnt from enr where religion is not null group by religion
      ) x
    ),
    'religion_missing', (select count(*) from enr where religion is null),
    'by_age', (
      select coalesce(jsonb_object_agg(bucket, cnt), '{}'::jsonb) from (
        select case
          when age_years between 5 and 8 then '5-8'
          when age_years between 9 and 11 then '9-11'
          when age_years between 12 and 14 then '12-14'
          when age_years between 15 and 17 then '15-17'
          else 'other' end as bucket, count(*) cnt
        from (
          select date_part('year', age(dob))::int as age_years
          from enr where not dob_missing and dob is not null
        ) a
        group by bucket
      ) x
    ),
    'age_known',    (select count(*) from enr where not dob_missing and dob is not null),
    'dob_missing',  (select count(*) from enr where dob_missing or dob is null),
    'dob_synthetic',(select count(*) from enr where dob_synthetic)
  ) into v_result;

  return v_result;
end; $function$;

create or replace function public.fn_student_report_summary(
  p_academic_year_id uuid default null,
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform private.require_permission('student.view');
  return private.fn_student_report_summary(p_academic_year_id, p_filters);
end $function$;

-- The one-argument forms are now ambiguous against the two-argument ones for a
-- call that passes only `p_academic_year_id`, so they go. Nothing else calls
-- them: the defaults on the new signature cover every existing call shape.
drop function if exists public.fn_student_report_summary(uuid);
drop function if exists private.fn_student_report_summary(uuid);

revoke all on function public.fn_student_report_summary(uuid, jsonb) from public, anon;
grant execute on function public.fn_student_report_summary(uuid, jsonb) to authenticated;
