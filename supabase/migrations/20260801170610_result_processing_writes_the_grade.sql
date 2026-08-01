-- Result processing never wrote the grade letter.
--
-- Found while building the academic performance report (analysis II · R-1),
-- whose headline panel is a grade distribution read from `exam_result.grade`.
-- Every band rendered zero. The column was not empty because grading is
-- unimplemented — `grade_scale` is seeded, `gpa` is computed correctly from it,
-- and `result` is derived from it — it was empty because the INSERT in
-- `fn_process_exam_result` simply never listed the column.
--
-- The blast radius is wider than the report that surfaced it. Four places read
-- this column and all four have been rendering an em-dash since Phase 2:
--
--   exam/documents/MarksheetDoc.tsx    "Grade: —" on every printed marksheet
--   exam/documents/TabulationDoc.tsx   the grade column of every tabulation sheet
--   exam/components/ResultProcessor    the per-grade badges after processing
--   reports/screens/academic           the distribution this was found from
--
-- A marksheet is a document a school hands to a guardian. It has been going out
-- with no grade on it.
--
-- The letter is the highest band the student's FINAL gpa reached, which needs
-- no special case for a failure: a failed subject already averages a 0 into the
-- gpa, so a fail lands on the lowest band by the same rule as everyone else.
-- Bands are compared on `gpa_point`, not on `min_marks`/`max_marks` — those are
-- percentage bands for a single subject's raw score, and an aggregate gpa is
-- not a percentage of anything.

create or replace function private.fn_process_exam_result(p_exam_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare v_inst uuid; v_scheme uuid;
begin
  select institution_id, grade_scheme_id into v_inst, v_scheme from public.exam where id = p_exam_id;
  if v_inst is null then raise exception 'exam not found'; end if;
  if not (private.is_platform_admin() or v_inst = private.current_institution_id()) then
    raise exception 'not authorized for this institution';
  end if;
  if v_scheme is null then
    select id into v_scheme from public.grade_scheme where institution_id = v_inst and is_default limit 1;
  end if;

  with base as (
    select m.student_id, coalesce(m.marks_obtained,0) as obtained,
           coalesce(es.full_marks, cs.full_marks, s.full_marks, 100) as fullm, m.is_absent
    from public.mark m
    join public.exam_subject es on es.id = m.exam_subject_id
    join public.subject s on s.id = es.subject_id
    left join public.class_subject cs on cs.class_id = es.class_id and cs.subject_id = es.subject_id
    where es.exam_id = p_exam_id
  ),
  scored as (
    select b.student_id, b.obtained, b.is_absent,
           (select gsc.gpa_point from public.grade_scale gsc
            where gsc.grade_scheme_id = v_scheme
              and (b.obtained / nullif(b.fullm,0) * 100) between gsc.min_marks and gsc.max_marks
            limit 1) as gp
    from base b
  ),
  agg as (
    select student_id, sum(obtained) as total_marks, round(avg(coalesce(gp,0)),2) as gpa,
           bool_or(coalesce(gp,0) = 0 or is_absent) as any_fail
    from scored group by student_id
  )
  insert into public.exam_result(institution_id, exam_id, student_id, total_marks, gpa, grade, result, status)
  select v_inst, p_exam_id, student_id, total_marks, gpa,
         (select gsc.grade_letter from public.grade_scale gsc
          where gsc.grade_scheme_id = v_scheme and gsc.gpa_point <= agg.gpa
          order by gsc.gpa_point desc limit 1),
         case when any_fail then 'fail' else 'pass' end, 'processed'
  from agg
  on conflict (exam_id, student_id) do update
    set total_marks = excluded.total_marks, gpa = excluded.gpa, grade = excluded.grade,
        result = excluded.result, status = 'processed', updated_at = now();

  with ranked as (
    select id, rank() over (order by total_marks desc nulls last) as rnk
    from public.exam_result where exam_id = p_exam_id)
  update public.exam_result er set merit_rank = ranked.rnk from ranked where er.id = ranked.id;
end;
$function$;

-- Backfill anything already processed without a letter, so existing marksheets
-- are correct without anyone having to re-run processing exam by exam. Uses
-- each exam's own scheme with the same institution-default fallback.
update public.exam_result er
set grade = (
  select gsc.grade_letter
  from public.grade_scale gsc
  where gsc.grade_scheme_id = coalesce(
          (select e.grade_scheme_id from public.exam e where e.id = er.exam_id),
          (select g.id from public.grade_scheme g where g.institution_id = er.institution_id and g.is_default limit 1))
    and gsc.gpa_point <= coalesce(er.gpa, 0)
  order by gsc.gpa_point desc
  limit 1)
where er.grade is null and er.status = 'processed';
