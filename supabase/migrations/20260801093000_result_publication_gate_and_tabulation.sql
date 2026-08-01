-- ============================================================================
-- SRA A-5.2 — result publication becomes a governed event.
--
-- WHAT WAS WRONG.
--   * "No publish workflow (process ≠ publish; nothing gates parent
--     visibility)." Processing an exam made results visible to every parent
--     the instant the button was pressed — including a run done to check a
--     grading scheme.
--   * "No re-processing safeguard (what happens to published results if marks
--     change and process is re-run?)." Nothing. It silently overwrote.
--   * No tabulation sheet — "the artefact schools actually produce".
--   * No statistics: pass rate, subject averages, grade distribution.
--
-- `result_approval` already existed as a table with no writer and no reader.
-- This gives it both, and makes it the thing parent RLS reads.
-- ============================================================================

alter table public.result_approval
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references public.profile(id) on delete set null,
  add column if not exists unpublish_reason text;

alter table public.result_approval
  alter column status set default 'draft';

create unique index if not exists ux_result_approval_exam on public.result_approval (exam_id);

/* ------------------------------------------------------------ process guard */

/**
 * Re-processing a PUBLISHED exam is refused.
 *
 * The wrapper is the right place for this: `private.fn_process_exam_result`
 * does the set-based GPA/grade/merit computation and is called from nowhere
 * else, so a guard here cannot be routed around. Unpublishing is an explicit,
 * reasoned, audited act — which is what makes "results changed after
 * publication" a decision somebody made rather than something that happened.
 */
create or replace function public.fn_process_exam_result(p_exam_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
  perform private.require_permission('exam.result_process');

  select status into v_status from public.result_approval where exam_id = p_exam_id;
  if v_status = 'published' then
    raise exception 'results for this exam are published; unpublish before reprocessing'
      using errcode = '55000';
  end if;

  perform private.fn_process_exam_result(p_exam_id);

  -- Processing puts an exam into `processed`, never into `published`.
  insert into public.result_approval(exam_id, status)
  values (p_exam_id, 'processed')
  on conflict (exam_id) do update set status = 'processed';
end $$;

/* ------------------------------------------------------- publish / unpublish */

create or replace function private.fn_set_result_publication(p_exam_id uuid, p_publish boolean, p_reason text)
returns void language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_exam_inst uuid; v_count int;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  select institution_id into v_exam_inst from public.exam where id = p_exam_id;
  if v_exam_inst is null or v_exam_inst <> v_inst then raise exception 'exam not found in institution'; end if;

  if p_publish then
    -- Publishing an exam with no processed results would announce an empty
    -- result to every parent in the school.
    select count(*) into v_count from public.exam_result where exam_id = p_exam_id;
    if v_count = 0 then raise exception 'no processed results for this exam'; end if;

    insert into public.result_approval(exam_id, status, approved_at, approved_by, published_at, published_by)
    values (p_exam_id, 'published', now(), (select auth.uid()), now(), (select auth.uid()))
    on conflict (exam_id) do update
      set status = 'published', approved_at = now(), approved_by = (select auth.uid()),
          published_at = now(), published_by = (select auth.uid()), unpublish_reason = null;
  else
    if coalesce(trim(p_reason),'') = '' then
      raise exception 'a reason is required to unpublish results parents can already see';
    end if;
    update public.result_approval
       set status = 'processed', published_at = null, unpublish_reason = p_reason
     where exam_id = p_exam_id;
  end if;

  -- Publication is the single most consequential academic event of a term.
  insert into public.audit_log(institution_id, entity, entity_id, action, changed_by, after)
  values (v_inst, 'result_approval', p_exam_id,
          case when p_publish then 'publish' else 'unpublish' end,
          (select auth.uid()),
          jsonb_build_object('exam_id', p_exam_id, 'reason', p_reason));
end; $fn$;
revoke all on function private.fn_set_result_publication(uuid, boolean, text) from authenticated, anon, public;

create or replace function public.fn_set_result_publication(p_exam_id uuid, p_publish boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_permission('exam.result_process');
  perform private.fn_set_result_publication(p_exam_id, p_publish, p_reason);
end $$;
revoke all on function public.fn_set_result_publication(uuid, boolean, text) from public, anon;
grant execute on function public.fn_set_result_publication(uuid, boolean, text) to authenticated;

/* ------------------------------------------- parents see published results only */

/**
 * The gate, enforced where it has to be.
 *
 * A UI-only publish flag is a label on a door that is not locked: `exam_result`
 * is readable over PostgREST, so an unpublished result was one request away
 * from any signed-in parent. The existing parent policy is replaced with one
 * that additionally requires `result_approval.status = 'published'`.
 */
drop policy if exists parent_read_exam_result on public.exam_result;

-- Same shape as migration 20260726043508's version (`is_guardian_of` in a
-- subselect so it is an InitPlan, not a per-row call), plus the publication
-- requirement. Staff reads are unaffected: they come through the separate
-- `exam.view` permission policy, so a head teacher still sees a processed,
-- unpublished result — which is the whole point of a verify step.
create policy parent_read_exam_result on public.exam_result for select to authenticated
  using (
    (select private.is_guardian_of(student_id))
    and exists (
      select 1 from public.result_approval ra
       where ra.exam_id = exam_result.exam_id and ra.status = 'published'
    )
  );

-- `mark` is the same disclosure by another route: a parent reading the raw
-- per-subject marks of an unpublished exam has the result.
drop policy if exists parent_read_mark on public.mark;
create policy parent_read_mark on public.mark for select to authenticated
  using (
    (select private.is_guardian_of(student_id))
    and exists (
      select 1
        from public.exam_subject es
        join public.result_approval ra on ra.exam_id = es.exam_id
       where es.id = mark.exam_subject_id and ra.status = 'published'
    )
  );

/* --------------------------------------------------------- tabulation sheet */

/**
 * Subject × student matrix for one exam and section — the artefact a school
 * actually produces at the end of a term, and pins to a board.
 *
 * Computed in Postgres because the alternative is one query per subject per
 * student in the client, and a 60-student section with 10 subjects is 600
 * round trips over a school's connection.
 */
create or replace function public.fn_exam_tabulation(p_exam_id uuid, p_class_section_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare v_inst uuid; v_out jsonb;
begin
  perform private.require_permission('exam.view');
  v_inst := private.current_institution_id();

  with roster as (
    select s.id as student_id, s.student_code, s.name_bn, s.name_en, e.roll_no
      from public.exam_result r
      join public.student s on s.id = r.student_id
      left join public.student_enrollment e on e.id = s.current_enrollment_id
     where r.exam_id = p_exam_id
       and r.institution_id = v_inst
       and (p_class_section_id is null or e.class_section_id = p_class_section_id)
  ),
  subs as (
    select es.subject_id, coalesce(sub.name_bn, '') as name_bn, coalesce(sub.name_en, '') as name_en,
           es.full_marks, es.pass_marks
      from public.exam_subject es
      join public.subject sub on sub.id = es.subject_id
     where es.exam_id = p_exam_id
     group by es.subject_id, sub.name_bn, sub.name_en, es.full_marks, es.pass_marks
  ),
  cells as (
    select m.student_id, es.subject_id, m.marks_obtained, m.is_absent
      from public.mark m
      join public.exam_subject es on es.id = m.exam_subject_id
     where es.exam_id = p_exam_id
  )
  select jsonb_build_object(
    'subjects', coalesce((select jsonb_agg(jsonb_build_object(
                   'subject_id', subject_id, 'name_bn', name_bn, 'name_en', name_en,
                   'full_marks', full_marks, 'pass_marks', pass_marks) order by name_en) from subs), '[]'::jsonb),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'student_id', r.student_id, 'student_code', r.student_code,
               'name_bn', r.name_bn, 'name_en', r.name_en, 'roll', r.roll_no,
               'marks', coalesce((select jsonb_object_agg(c.subject_id::text,
                          jsonb_build_object('marks', c.marks_obtained, 'absent', c.is_absent))
                        from cells c where c.student_id = r.student_id), '{}'::jsonb),
               'total', er.total_marks, 'gpa', er.gpa, 'grade', er.grade,
               'merit', er.merit_rank, 'result', er.result)
             order by er.merit_rank nulls last, r.roll_no)
        from roster r join public.exam_result er
          on er.student_id = r.student_id and er.exam_id = p_exam_id), '[]'::jsonb),
    'stats', (
      select jsonb_build_object(
        'appeared', count(*),
        'passed', count(*) filter (where er.result = 'pass'),
        'failed', count(*) filter (where er.result = 'fail'),
        'pass_rate', case when count(*) = 0 then 0
                          else round(100.0 * count(*) filter (where er.result = 'pass') / count(*), 1) end,
        'avg_gpa', coalesce(round(avg(er.gpa)::numeric, 2), 0),
        'highest', coalesce(max(er.total_marks), 0),
        'lowest', coalesce(min(er.total_marks), 0),
        'by_grade', coalesce((
          select jsonb_agg(jsonb_build_object('grade', grade, 'count', cnt) order by cnt desc)
            from (select coalesce(er2.grade,'—') as grade, count(*) as cnt
                    from public.exam_result er2 join roster r2 on r2.student_id = er2.student_id
                   where er2.exam_id = p_exam_id group by er2.grade) g), '[]'::jsonb))
        from public.exam_result er join roster r on r.student_id = er.student_id
       where er.exam_id = p_exam_id)
  ) into v_out;

  return v_out;
end; $fn$;
revoke all on function public.fn_exam_tabulation(uuid, uuid) from public, anon;
grant execute on function public.fn_exam_tabulation(uuid, uuid) to authenticated;

/* --------------------------------------------------------- publication status */

create or replace function public.fn_result_status(p_exam_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare v_out jsonb;
begin
  perform private.require_permission('exam.view');
  select jsonb_build_object(
           'status', coalesce(ra.status, 'draft'),
           'published_at', ra.published_at,
           'published_by', pr.full_name,
           'result_count', (select count(*) from public.exam_result er where er.exam_id = p_exam_id))
    into v_out
    from public.exam e
    left join public.result_approval ra on ra.exam_id = e.id
    left join public.profile pr on pr.id = ra.published_by
   where e.id = p_exam_id;
  return coalesce(v_out, jsonb_build_object('status','draft','result_count',0));
end; $fn$;
revoke all on function public.fn_result_status(uuid) from public, anon;
grant execute on function public.fn_result_status(uuid) to authenticated;
