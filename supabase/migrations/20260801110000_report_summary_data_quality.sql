-- ============================================================================
-- C-6 — stop the student report laundering missing data into a finding.
--
-- The 268-student roster imported on 2026-08-01 has no date of birth in the
-- source sheet, so every row carries the agreed placeholder `dob = 1900-01-01`
-- flagged `metadata.dob_missing = true`. The age bucketing ended with
-- `else 'other'`, so all 268 land there:
--
--     bucket | cnt | min_age | max_age
--     other  | 268 |   126   |   126
--
-- The screen then renders "Other — 268 (100%)" in the same bar styling as the
-- genuine class and gender breakdowns beside it. A gap in the data is presented
-- as a fact about the students. Same shape for religion, which is null for
-- every imported row and aggregates to `unknown: 268`.
--
-- The rule this restores: a report may say "not recorded", or it may state a
-- finding. It must never render the first as the second. So rows with no real
-- date of birth are EXCLUDED from the age distribution and counted separately,
-- and the caller is handed the counts it needs to say so out loud.
--
-- `dob_missing` is the flag rather than `dob = '1900-01-01'` because the
-- sentinel is an import convention, not a contract — a later import could pick
-- a different one, and an actual 1900 birth date should not be silently dropped.
-- ============================================================================

create or replace function private.fn_student_report_summary(p_academic_year_id uuid default null::uuid)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_inst uuid; v_year uuid; v_result jsonb;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  v_year := coalesce(p_academic_year_id,
    (select id from public.academic_year where institution_id=v_inst and is_current and deleted_at is null limit 1));

  with enr as (
    select se.id as enrollment_id, s.id as student_id, s.gender, s.religion, s.dob,
           coalesce((s.metadata->>'dob_missing')::boolean, false) as dob_missing,
           coalesce((s.metadata->>'dob_synthetic')::boolean, false) as dob_synthetic,
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
    -- Religion, with "not recorded" kept as its own number rather than folded
    -- into the enum's own `other` value, which means something different.
    'by_religion', (
      select coalesce(jsonb_object_agg(religion::text, cnt), '{}'::jsonb) from (
        select religion, count(*) cnt from enr where religion is not null group by religion
      ) x
    ),
    'religion_missing', (select count(*) from enr where religion is null),
    -- Age over rows that HAVE a real date of birth. Denominator is
    -- `age_known`, not `total` — percentages against the full roll would
    -- understate every bucket by the size of the gap.
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
    -- Present but GENERATED (a class-derived test fixture). Distinct from
    -- missing: the age chart CAN be drawn, and must still be labelled as not
    -- describing real students, or a fixture becomes a demographic claim.
    'dob_synthetic',(select count(*) from enr where dob_synthetic)
  ) into v_result;

  return v_result;
end; $function$;
