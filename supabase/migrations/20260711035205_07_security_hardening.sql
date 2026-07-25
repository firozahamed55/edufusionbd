-- 1. set search_path on the one function that lacked it
create or replace function private.set_updated_at() returns trigger
  language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;

-- 2. move pg_trgm out of the public schema (extensions schema is Supabase-managed)
create schema if not exists extensions;
alter extension pg_trgm set schema extensions;

-- 3. lock down SECURITY DEFINER functions
--    trigger-only function: no one should call it via RPC
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
--    RPCs: authenticated (the app) may call; anon/public may not
revoke execute on function public.fn_generate_code(text) from public, anon;
revoke execute on function public.fn_process_exam_result(uuid) from public, anon;

-- 4. defence-in-depth: fn_process_exam_result must verify the caller owns the exam's tenant
create or replace function public.fn_process_exam_result(p_exam_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
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
  insert into public.exam_result(institution_id, exam_id, student_id, total_marks, gpa, result, status)
  select v_inst, p_exam_id, student_id, total_marks, gpa,
         case when any_fail then 'fail' else 'pass' end, 'processed'
  from agg
  on conflict (exam_id, student_id) do update
    set total_marks = excluded.total_marks, gpa = excluded.gpa,
        result = excluded.result, status = 'processed', updated_at = now();

  with ranked as (
    select id, rank() over (order by total_marks desc nulls last) as rnk
    from public.exam_result where exam_id = p_exam_id)
  update public.exam_result er set merit_rank = ranked.rnk from ranked where er.id = ranked.id;
end;
$$;
grant execute on function public.fn_process_exam_result(uuid) to authenticated;
